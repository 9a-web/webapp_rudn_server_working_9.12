"""
Раздел «Тесты по лекциям» — генерация карточек-тестов из текста лекции.

Экспортирует factory `create_quiz_router(db)` → APIRouter с префиксом `/quiz`.
Модель: deepseek-v4-flash через шлюз OpenModel (Anthropic Messages формат).

Эндпоинты (все требуют JWT):
  POST   /api/quiz/generate          — сгенерировать тест из текста лекции
  GET    /api/quiz/list              — список тестов пользователя (сводка)
  GET    /api/quiz/{quiz_id}         — полный тест с вопросами (только владелец)
  DELETE /api/quiz/{quiz_id}         — удалить тест (только владелец)
  POST   /api/quiz/{quiz_id}/attempt — сохранить попытку прохождения и получить результат
"""

import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from auth_utils import get_current_user_required, check_rate_limit

logger = logging.getLogger(__name__)

# ─── Конфигурация OpenModel / deepseek-v4-flash ───
OPENMODEL_BASE_URL = os.environ.get("OPENMODEL_BASE_URL", "https://api.openmodel.ai/v1").rstrip("/")
OPENMODEL_API_KEY = os.environ.get("OPENMODEL_API_KEY", "")
OPENMODEL_QUIZ_MODEL = os.environ.get("OPENMODEL_QUIZ_MODEL", "deepseek-v4-flash")

MAX_LECTURE_CHARS = 24000   # ограничиваем вход (стоимость/латентность)
MIN_LECTURE_CHARS = 40
GENERATE_RATE_LIMIT = 30    # генераций в час на пользователя


# ─── Pydantic схемы запросов ───
class GenerateQuizRequest(BaseModel):
    text: str = Field(..., min_length=1)
    title: Optional[str] = None
    num_questions: int = Field(10, ge=3, le=20)
    language: Optional[str] = "ru"


class AttemptRequest(BaseModel):
    answers: List[Optional[int]] = Field(default_factory=list)


# ─── Утилиты ───
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _owner_filter(uid: Optional[str], tid: Optional[int]) -> Dict[str, Any]:
    ors: List[Dict[str, Any]] = []
    if uid:
        ors.append({"uid": uid})
    if tid is not None:
        ors.append({"tid": tid})
    if not ors:
        # нет валидной идентичности — заведомо пустой фильтр
        return {"_never_match_": str(uuid.uuid4())}
    return {"$or": ors}


def _build_system_prompt(language: str) -> str:
    lang_line = "русском языке" if (language or "ru").startswith("ru") else "том же языке, что и лекция"
    return (
        "Ты — опытный преподаватель университета, который составляет качественные "
        "тестовые вопросы по лекциям для проверки знаний студентов. "
        f"Все вопросы и варианты ответов формулируй на {lang_line}. "
        "Вопросы должны проверять понимание ключевых идей лекции, а не мелкие детали. "
        "Неправильные варианты должны быть правдоподобными, но однозначно неверными. "
        "Отвечай ИСКЛЮЧИТЕЛЬНО валидным JSON-объектом без какого-либо текста до или после него."
    )


def _build_user_prompt(text: str, num_questions: int) -> str:
    return (
        f"Составь ровно {num_questions} тестовых вопросов с выбором ответа по тексту лекции ниже.\n\n"
        "Требования к каждому вопросу:\n"
        "- ровно 4 варианта ответа;\n"
        "- ровно один правильный вариант;\n"
        "- короткое пояснение (1–2 предложения), почему правильный ответ верен.\n\n"
        "Верни JSON строго такого вида (без markdown, без ```):\n"
        '{"questions":[{"question":"...","options":["A","B","C","D"],'
        '"correct_index":0,"explanation":"..."}]}\n\n'
        "Поле correct_index — это индекс правильного варианта в массиве options (0, 1, 2 или 3).\n\n"
        f"Текст лекции:\n\"\"\"\n{text}\n\"\"\""
    )


def _extract_text_blocks(data: Dict[str, Any]) -> str:
    """Из ответа Anthropic Messages берём только блоки type == 'text'
    (deepseek-v4-flash дополнительно отдаёт блок 'thinking', который нам не нужен)."""
    content = data.get("content") or []
    parts: List[str] = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text") or "")
    return "".join(parts).strip()


def _parse_quiz_json(raw: str) -> List[Dict[str, Any]]:
    """Надёжный парсинг JSON из ответа модели."""
    if not raw:
        raise ValueError("empty model output")

    candidate = raw.strip()
    # убираем markdown-ограждения ```json ... ```
    if candidate.startswith("```"):
        candidate = re.sub(r"^```[a-zA-Z]*\n?", "", candidate)
        candidate = re.sub(r"\n?```$", "", candidate).strip()

    def _try(s: str):
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            return None

    data = _try(candidate)
    if data is None:
        # пытаемся выдернуть первый {...} из текста
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end != -1 and end > start:
            data = _try(candidate[start:end + 1])

    if data is None:
        raise ValueError("model did not return valid JSON")

    questions = data.get("questions") if isinstance(data, dict) else None
    if not isinstance(questions, list) or not questions:
        raise ValueError("JSON missing non-empty 'questions' array")

    cleaned: List[Dict[str, Any]] = []
    for item in questions:
        if not isinstance(item, dict):
            continue
        q_text = (item.get("question") or "").strip()
        options = item.get("options")
        if not q_text or not isinstance(options, list) or len(options) != 4:
            continue
        options = [str(o).strip() for o in options]
        if any(not o for o in options):
            continue
        try:
            ci = int(item.get("correct_index"))
        except (TypeError, ValueError):
            continue
        if ci < 0 or ci > 3:
            continue
        explanation = str(item.get("explanation") or "").strip()
        cleaned.append({
            "id": str(uuid.uuid4()),
            "question": q_text,
            "options": options,
            "correct_index": ci,
            "explanation": explanation,
        })

    if not cleaned:
        raise ValueError("no valid questions after validation")
    return cleaned


async def _call_deepseek(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> str:
    if not OPENMODEL_API_KEY:
        raise HTTPException(status_code=503, detail="quiz_generation_not_configured")

    headers = {
        "Authorization": f"Bearer {OPENMODEL_API_KEY}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    payload = {
        "model": OPENMODEL_QUIZ_MODEL,
        "max_tokens": max_tokens,
        "temperature": 0.3,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{OPENMODEL_BASE_URL}/messages", headers=headers, json=payload)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Модель не успела ответить. Попробуйте сократить лекцию.")
    except httpx.HTTPError as exc:
        logger.error(f"[quiz] OpenModel network error: {exc}")
        raise HTTPException(status_code=502, detail="Ошибка соединения с сервисом генерации.")

    if resp.status_code != 200:
        logger.error(f"[quiz] OpenModel {resp.status_code}: {resp.text[:400]}")
        raise HTTPException(status_code=502, detail="Сервис генерации вернул ошибку. Попробуйте позже.")

    return _extract_text_blocks(resp.json())


def create_quiz_router(db) -> APIRouter:
    """Создаёт и возвращает APIRouter с эндпоинтами раздела «Тесты»."""
    router = APIRouter(prefix="/quiz", tags=["quiz"])

    def _identity(current_user: Dict[str, Any]):
        uid_ = current_user.get("uid")
        tid_raw = current_user.get("tid")
        try:
            tid_ = int(tid_raw) if tid_raw is not None else None
        except (TypeError, ValueError):
            tid_ = None
        if not uid_ and tid_ is None:
            raise HTTPException(status_code=401, detail="invalid_token_no_identity")
        return uid_, tid_

    def _summary(doc: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": doc.get("id"),
            "title": doc.get("title"),
            "num_questions": doc.get("num_questions"),
            "language": doc.get("language"),
            "source_preview": doc.get("source_preview"),
            "created_at": doc.get("created_at"),
            "best_score": doc.get("best_score"),
            "best_percent": doc.get("best_percent"),
            "attempts_count": doc.get("attempts_count", 0),
        }

    @router.post("/generate")
    async def generate_quiz(
        body: GenerateQuizRequest,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        uid_, tid_ = _identity(current_user)

        # rate-limit
        rl_key = str(uid_ or tid_)
        if not check_rate_limit(rl_key, "quiz_generate", GENERATE_RATE_LIMIT, 3600):
            raise HTTPException(status_code=429, detail="Слишком много генераций. Попробуйте позже.")

        text = (body.text or "").strip()
        if len(text) < MIN_LECTURE_CHARS:
            raise HTTPException(status_code=400, detail="Текст лекции слишком короткий для генерации теста.")
        truncated = len(text) > MAX_LECTURE_CHARS
        if truncated:
            text = text[:MAX_LECTURE_CHARS]

        system_prompt = _build_system_prompt(body.language or "ru")
        user_prompt = _build_user_prompt(text, body.num_questions)
        # запас токенов под ~20 вопросов
        max_tokens = min(8000, 600 + body.num_questions * 320)

        raw = await _call_deepseek(system_prompt, user_prompt, max_tokens=max_tokens)
        try:
            questions = _parse_quiz_json(raw)
        except ValueError as exc:
            logger.error(f"[quiz] parse error: {exc}; raw[:300]={raw[:300]!r}")
            raise HTTPException(status_code=502, detail="Не удалось разобрать ответ модели. Попробуйте ещё раз.")

        title = (body.title or "").strip() or "Тест по лекции"
        quiz_doc = {
            "id": str(uuid.uuid4()),
            "uid": uid_,
            "tid": tid_,
            "title": title[:120],
            "language": body.language or "ru",
            "source_preview": text[:280],
            "source_length": len(text),
            "source_truncated": truncated,
            "num_questions": len(questions),
            "questions": questions,
            "model": OPENMODEL_QUIZ_MODEL,
            "created_at": _now_iso(),
            "best_score": None,
            "best_percent": None,
            "attempts_count": 0,
        }
        await db.quizzes.insert_one(quiz_doc)
        quiz_doc.pop("_id", None)
        logger.info(f"[quiz] generated quiz id={quiz_doc['id']} q={len(questions)} uid={uid_}")
        return quiz_doc

    @router.get("/list")
    async def list_quizzes(current_user: Dict[str, Any] = Depends(get_current_user_required)):
        uid_, tid_ = _identity(current_user)
        cursor = db.quizzes.find(_owner_filter(uid_, tid_), {"_id": 0, "questions": 0}).sort("created_at", -1)
        docs = await cursor.to_list(length=200)
        return {"quizzes": [_summary(d) for d in docs], "total": len(docs)}

    @router.get("/{quiz_id}")
    async def get_quiz(quiz_id: str, current_user: Dict[str, Any] = Depends(get_current_user_required)):
        uid_, tid_ = _identity(current_user)
        flt = {"id": quiz_id, **_owner_filter(uid_, tid_)}
        doc = await db.quizzes.find_one(flt, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Тест не найден")
        return doc

    @router.delete("/{quiz_id}")
    async def delete_quiz(quiz_id: str, current_user: Dict[str, Any] = Depends(get_current_user_required)):
        uid_, tid_ = _identity(current_user)
        flt = {"id": quiz_id, **_owner_filter(uid_, tid_)}
        res = await db.quizzes.delete_one(flt)
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Тест не найден")
        await db.quiz_attempts.delete_many({"quiz_id": quiz_id})
        return {"status": "ok", "deleted": quiz_id}

    @router.post("/{quiz_id}/attempt")
    async def submit_attempt(
        quiz_id: str,
        body: AttemptRequest,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        uid_, tid_ = _identity(current_user)
        flt = {"id": quiz_id, **_owner_filter(uid_, tid_)}
        quiz = await db.quizzes.find_one(flt, {"_id": 0})
        if not quiz:
            raise HTTPException(status_code=404, detail="Тест не найден")

        questions = quiz.get("questions") or []
        answers = body.answers or []
        results = []
        correct = 0
        for i, q in enumerate(questions):
            your = answers[i] if i < len(answers) else None
            try:
                your = int(your) if your is not None else None
            except (TypeError, ValueError):
                your = None
            is_correct = your is not None and your == q.get("correct_index")
            if is_correct:
                correct += 1
            results.append({
                "question_id": q.get("id"),
                "correct_index": q.get("correct_index"),
                "your_index": your,
                "is_correct": is_correct,
            })

        total = len(questions)
        percent = round((correct / total) * 100) if total else 0

        attempt_doc = {
            "id": str(uuid.uuid4()),
            "quiz_id": quiz_id,
            "uid": uid_,
            "tid": tid_,
            "score": correct,
            "total": total,
            "percent": percent,
            "created_at": _now_iso(),
        }
        await db.quiz_attempts.insert_one(attempt_doc)

        prev_best = quiz.get("best_score")
        update: Dict[str, Any] = {"$inc": {"attempts_count": 1}}
        if prev_best is None or correct > prev_best:
            update["$set"] = {"best_score": correct, "best_percent": percent}
        await db.quizzes.update_one({"id": quiz_id}, update)

        return {
            "score": correct,
            "total": total,
            "percent": percent,
            "results": results,
        }

    return router
