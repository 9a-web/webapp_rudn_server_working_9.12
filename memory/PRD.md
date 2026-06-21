# PRD — RUDN Schedule WebApp

## Original problem statement (2026-06-22)
Repo: https://github.com/9a-web/webapp_rudn_server_working_9.12 (cloned into /app).
Add a new section integrating **deepseek-v4-flash** (via the openmodel.ai gateway):
the user imports a text file with a lecture, and the model generates flashcards —
a quiz of multiple-choice questions based on the lecture.

### User choices
- Quiz format: **multiple choice** — 1 question + 4 options, 1 correct.
- Design: **fit the existing dark RUDN design**, take ideas from the attached
  monday.com-style mockup (cards, big import CTA, empty state).
- Questions language: **Russian**, ~10 by default.
- OpenModel API key provided by user (stored in backend/.env).

## Architecture
- Backend: FastAPI (`/app/backend/server.py`, monolith) + MongoDB (motor),
  UUID identity, JWT auth (`auth_utils`, `auth_routes`), all routes under `/api`.
- Frontend: React 19 + Vite, Tailwind, framer-motion, lucide-react, i18next (RU/EN).
  Single `/` route → `<Home>` shell with internal `activeTab` sections +
  `BottomNavigation`. Standalone SPA + Telegram WebApp.
- Model gateway: **OpenModel** (https://api.openmodel.ai/v1). deepseek-v4-flash
  supports ONLY the Anthropic `messages` protocol → `POST /v1/messages`,
  `Authorization: Bearer om-...`. Response `content` has a `thinking` block + a
  `text` block; only the `text` block is parsed (JSON).

## Implemented — Quiz section "Тесты по лекциям" (2026-06-22) ✅
Backend (`/app/backend/quiz_routes.py`, `create_quiz_router(db)` mounted in server.py):
- `POST /api/quiz/generate` — text + title + num_questions(3-20) + language →
  calls deepseek-v4-flash, validates/parses JSON, stores quiz (collection `quizzes`).
  Rate-limited 30/hour/user. Input capped at 24k chars.
- `GET /api/quiz/list` — summaries for current user.
- `GET /api/quiz/{id}` — full quiz (owner only).
- `DELETE /api/quiz/{id}` — delete quiz + its attempts.
- `POST /api/quiz/{id}/attempt` — score answers, store attempt (`quiz_attempts`),
  update best_score.
- Env: `OPENMODEL_API_KEY`, `OPENMODEL_BASE_URL`, `OPENMODEL_QUIZ_MODEL`.

Frontend:
- `services/quizAPI.js` — axios instance + JWT interceptor, 120s timeout on generate.
- `components/quiz/QuizSection.jsx` — list + import CTA + empty state.
- `components/quiz/ImportLectureModal.jsx` — .txt/.md upload (drag&drop) + paste +
  title + questions slider + animated generation loader.
- `components/quiz/QuizPlayer.jsx` — one-question MCQ, lock/reveal (green/red) +
  explanation, progress, results score-ring, retry, confetti on ≥80%.
- Wired into `App.jsx` (5th tab `quiz`) + `BottomNavigation.jsx` (GraduationCap,
  violet→fuchsia gradient). Bottom-nav buttons have `data-testid="bottom-nav-*"`.

Status: Verified E2E by testing agent (iteration_6) — 100% frontend pass; backend
verified by curl (real LLM generation, valid MCQs with explanations).

## Setup notes (this pod)
- Repo cloned to /app; backend deps in /root/.venv, frontend deps via yarn.
- frontend/.env REACT_APP_BACKEND_URL points to this pod's preview URL.
- Fresh local Mongo: original env accounts don't exist; register on the fly.

## Implemented v2 — modes + file formats (2026-06-22) ✅
- Import **.pdf / .docx** (server-side extraction via pypdf + python-docx):
  new `POST /api/quiz/extract-text`; frontend uploads pdf/docx, reads txt/md client-side.
- Three generation **modes** (param `mode`): `multiple_choice`, `true_false`
  (2-option Верно/Неверно), `flashcard` (flip cards front→back, self-assessment
  знал/не знал scoring).
- **Answer review (разбор)** on the results screen for all modes (per-question
  correct vs your answer + explanation; flashcards show front/back + знал mark).
- Mode selector in the import modal; mode badge + count label on quiz cards.
- Verified E2E by testing agent (iteration_7) — 100%, no bugs.

## Backlog / Next action items
- P2: Don't show the "Подтвердите email" reminder modal on every load (it overlays
  Home and intercepts bottom-nav clicks for unverified accounts). Pre-existing.
- P2: QuizSection opens the player after import via setTimeout(200ms); make it
  event-driven (pending-quiz state) for robustness.
- P3: i18n — add proper `quiz.*` / `bottomNav.quizShort` keys to ru/en JSON
  (currently rendered via t(key, 'Russian default') fallbacks).
- P3: Per-attempt history view; share/export a generated quiz by link.
