import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, FileQuestion, Play, Trash2, Loader2, GraduationCap, Trophy, ListChecks, ToggleRight, Layers } from 'lucide-react';
import { quizAPI } from '../../services/quizAPI';
import { ImportLectureModal } from './ImportLectureModal';
import { QuizPlayer } from './QuizPlayer';

const MODE_META = {
  multiple_choice: { label: 'Тест', icon: ListChecks },
  true_false: { label: 'Верно/неверно', icon: ToggleRight },
  flashcard: { label: 'Карточки', icon: Layers },
};

const cardStyle = {
  backgroundColor: 'rgba(40, 40, 44, 0.6)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch (_) { return ''; }
};

export const QuizSection = ({ onModalStateChange }) => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [playerQuizId, setPlayerQuizId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const anyModal = showImport || !!playerQuizId;
  useEffect(() => { onModalStateChange?.(anyModal); }, [anyModal, onModalStateChange]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await quizAPI.list();
      setQuizzes(data?.quizzes || []);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить тесты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (quiz) => {
    setShowImport(false);
    if (quiz?.id) {
      setQuizzes((prev) => [{
        id: quiz.id, title: quiz.title, mode: quiz.mode, num_questions: quiz.num_questions,
        language: quiz.language, source_preview: quiz.source_preview,
        created_at: quiz.created_at, best_score: null, best_percent: null, attempts_count: 0,
      }, ...prev]);
      // сразу открываем прохождение
      setTimeout(() => setPlayerQuizId(quiz.id), 200);
    } else {
      load();
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Удалить этот тест?')) return;
    setDeletingId(id);
    try {
      await quizAPI.remove(id);
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
    } catch (_) {
      /* мягко игнорируем */
    } finally {
      setDeletingId(null);
    }
  };

  const closePlayer = () => { setPlayerQuizId(null); load(); };

  return (
    <div className="pb-28" data-testid="quiz-section">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 mt-1">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 p-2.5 rounded-2xl shadow-lg shadow-violet-500/20">
            <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="text-foreground text-xl font-bold leading-tight">Тесты по лекциям</h1>
            <p className="text-muted-foreground text-[12px]">Загрузи лекцию — ИИ соберёт тест</p>
          </div>
        </div>
      </div>

      {/* Import CTA card */}
      <motion.button
        whileTap={{ scale: 0.985 }}
        onClick={() => setShowImport(true)}
        className="w-full rounded-3xl border border-violet-400/25 p-5 mb-6 text-left relative overflow-hidden group"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(217,70,239,0.10))' }}
        data-testid="quiz-import-cta"
      >
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-violet-500/20 blur-2xl group-hover:bg-violet-500/30 transition-colors" />
        <div className="relative flex items-center gap-4">
          <div className="bg-white/10 border border-white/15 rounded-2xl p-3.5">
            <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-foreground font-semibold text-[15px] flex items-center gap-1.5">
              Импортировать лекцию <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            </p>
            <p className="text-muted-foreground text-[12.5px] mt-0.5">
              Файл .txt или вставь текст — получишь тест с вопросами
            </p>
          </div>
        </div>
      </motion.button>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={load} className="text-violet-300 text-sm mt-2 underline">Повторить</button>
        </div>
      ) : quizzes.length === 0 ? (
        <EmptyState onImport={() => setShowImport(true)} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {quizzes.map((q) => (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={() => setPlayerQuizId(q.id)}
                className="rounded-3xl border border-white/10 p-4 cursor-pointer hover:border-white/20 transition-colors"
                style={cardStyle}
                data-testid="quiz-card"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-400/20 flex items-center justify-center">
                    {React.createElement((MODE_META[q.mode] || MODE_META.multiple_choice).icon, { className: 'w-5 h-5 text-violet-300', strokeWidth: 2.2 })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-[14.5px] truncate" data-testid="quiz-card-title">{q.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-muted-foreground">
                      <span className="text-violet-300/90">{(MODE_META[q.mode] || MODE_META.multiple_choice).label}</span>
                      <span className="opacity-40">•</span>
                      <span>{q.num_questions} {q.mode === 'flashcard' ? 'карточек' : 'вопросов'}</span>
                      <span className="opacity-40">•</span>
                      <span>{formatDate(q.created_at)}</span>
                      {q.best_percent != null && (
                        <>
                          <span className="opacity-40">•</span>
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Trophy className="w-3 h-3" /> {q.best_percent}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(q.id, e)}
                    className="p-2 rounded-full hover:bg-red-500/15 transition-colors"
                    data-testid="quiz-card-delete"
                  >
                    {deletingId === q.id
                      ? <Loader2 className="w-4 h-4 text-red-300 animate-spin" />
                      : <Trash2 className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ImportLectureModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onCreated={handleCreated}
      />
      <QuizPlayer
        quizId={playerQuizId}
        isOpen={!!playerQuizId}
        onClose={closePlayer}
      />
    </div>
  );
};

const EmptyState = ({ onImport }) => (
  <div className="flex flex-col items-center text-center py-12 px-6" data-testid="quiz-empty-state">
    <div className="relative mb-5">
      <div className="absolute -inset-4 rounded-full bg-violet-500/15 blur-2xl" />
      <div className="relative bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 border border-violet-400/20 rounded-3xl p-6">
        <GraduationCap className="w-10 h-10 text-violet-300" strokeWidth={1.8} />
      </div>
    </div>
    <h3 className="text-foreground font-bold text-[17px]">Пока нет тестов</h3>
    <p className="text-muted-foreground text-[13px] mt-1.5 max-w-xs">
      Импортируй текст лекции, и нейросеть составит тест с вопросами для самопроверки.
    </p>
    <button
      onClick={onImport}
      className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold text-[14px] rounded-2xl px-5 py-3 active:scale-[0.97] transition-transform"
      data-testid="quiz-empty-import-btn"
    >
      <Plus className="w-4 h-4" strokeWidth={2.5} /> Импортировать лекцию
    </button>
  </div>
);

export default QuizSection;
