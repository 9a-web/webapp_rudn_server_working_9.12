import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronRight, RotateCcw, Trophy, Loader2, Lightbulb } from 'lucide-react';
import confetti from 'canvas-confetti';
import { quizAPI } from '../../services/quizAPI';

const sheetStyle = {
  backgroundColor: 'rgba(20, 20, 22, 0.96)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
};

const OPTION_LABELS = ['А', 'Б', 'В', 'Г'];

export const QuizPlayer = ({ quizId, isOpen, onClose }) => {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);     // выбранный индекс на каждый вопрос
  const [locked, setLocked] = useState(false);    // ответ зафиксирован (показываем правильный)
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState(null);

  const reset = useCallback(() => {
    setIndex(0); setAnswers([]); setLocked(false); setFinished(false); setResult(null);
  }, []);

  useEffect(() => {
    if (!isOpen || !quizId) return;
    let cancelled = false;
    reset();
    setLoading(true); setError(null); setQuiz(null);
    quizAPI.get(quizId)
      .then((data) => { if (!cancelled) { setQuiz(data); setAnswers(new Array((data?.questions || []).length).fill(null)); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Не удалось загрузить тест'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, quizId, reset]);

  const questions = quiz?.questions || [];
  const current = questions[index];
  const total = questions.length;
  const selected = answers[index];

  const handleSelect = (optIdx) => {
    if (locked) return;
    const next = [...answers];
    next[index] = optIdx;
    setAnswers(next);
    setLocked(true);
  };

  const finish = useCallback(async (finalAnswers) => {
    setFinished(true);
    try {
      const res = await quizAPI.submitAttempt(quizId, finalAnswers);
      setResult(res);
      if (res && res.total > 0 && res.percent >= 80) {
        setTimeout(() => {
          try {
            confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 }, zIndex: 200 });
          } catch (_) { /* noop */ }
        }, 250);
      }
    } catch (_) {
      // локальный подсчёт как fallback
      const correct = questions.reduce((acc, q, i) => acc + (finalAnswers[i] === q.correct_index ? 1 : 0), 0);
      setResult({ score: correct, total, percent: total ? Math.round((correct / total) * 100) : 0, results: [] });
    }
  }, [quizId, questions, total]);

  const handleNext = () => {
    if (index < total - 1) {
      setIndex(index + 1);
      setLocked(answers[index + 1] != null);
    } else {
      finish(answers);
    }
  };

  const handleRetry = () => reset();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[130] flex flex-col"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={sheetStyle}
        data-testid="quiz-player"
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 pt-[calc(var(--header-safe-padding,12px))] pb-3 border-b border-white/[0.06]">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/[0.06] transition-colors"
            data-testid="quiz-player-close"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-semibold text-[14px] truncate">{quiz?.title || 'Тест'}</p>
            {!finished && total > 0 && (
              <p className="text-muted-foreground text-[11px]">Вопрос {index + 1} из {total}</p>
            )}
          </div>
        </div>

        {/* Progress */}
        {!finished && total > 0 && (
          <div className="h-1 bg-white/[0.06]">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
              animate={{ width: `${((index + (locked ? 1 : 0)) / total) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="h-full flex items-center justify-center py-24">
              <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="px-6 py-24 text-center">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Results */}
          {!loading && !error && finished && (
            <div className="max-w-md mx-auto px-6 py-10 text-center" data-testid="quiz-results">
              <ScoreRing percent={result?.percent ?? 0} />
              <h3 className="text-foreground text-xl font-bold mt-6">
                {(result?.percent ?? 0) >= 80 ? 'Отличный результат!' : (result?.percent ?? 0) >= 50 ? 'Неплохо!' : 'Есть над чем поработать'}
              </h3>
              <p className="text-muted-foreground text-[14px] mt-1.5">
                Правильных ответов: <span className="text-foreground font-semibold">{result?.score ?? 0}</span> из {result?.total ?? total}
              </p>

              <div className="flex flex-col gap-2.5 mt-8">
                <button
                  onClick={handleRetry}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold text-[15px] rounded-2xl py-3.5 active:scale-[0.98] transition-transform"
                  data-testid="quiz-retry-btn"
                >
                  <RotateCcw className="w-4.5 h-4.5" strokeWidth={2.5} /> Пройти заново
                </button>
                <button
                  onClick={onClose}
                  className="w-full text-muted-foreground hover:text-foreground font-medium text-[14px] py-2.5 transition-colors"
                  data-testid="quiz-results-close"
                >
                  Вернуться к списку
                </button>
              </div>
            </div>
          )}

          {/* Question */}
          {!loading && !error && !finished && current && (
            <div className="max-w-2xl mx-auto px-4 py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id || index}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                >
                  <div
                    className="rounded-3xl border border-white/10 p-5 mb-4"
                    style={{ backgroundColor: 'rgba(40, 40, 44, 0.6)' }}
                  >
                    <h2 className="text-foreground text-[17px] font-semibold leading-snug" data-testid="quiz-question-text">
                      {current.question}
                    </h2>
                  </div>

                  <div className="space-y-2.5">
                    {current.options.map((opt, i) => {
                      const isSelected = selected === i;
                      const isCorrect = i === current.correct_index;
                      let cls = 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]';
                      if (locked) {
                        if (isCorrect) cls = 'border-green-400/60 bg-green-400/15';
                        else if (isSelected) cls = 'border-red-400/60 bg-red-400/15';
                        else cls = 'border-white/10 bg-white/[0.02] opacity-60';
                      } else if (isSelected) {
                        cls = 'border-violet-400/60 bg-violet-400/15';
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => handleSelect(i)}
                          disabled={locked}
                          className={`w-full text-left flex items-center gap-3 border rounded-2xl px-4 py-3.5 transition-all active:scale-[0.99] ${cls}`}
                          data-testid={`quiz-option-${i}`}
                        >
                          <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
                            locked && isCorrect ? 'bg-green-400 text-black'
                              : locked && isSelected ? 'bg-red-400 text-black'
                              : isSelected ? 'bg-violet-400 text-black' : 'bg-white/10 text-foreground'
                          }`}>
                            {locked && isCorrect ? <Check className="w-4 h-4" strokeWidth={3} /> : OPTION_LABELS[i]}
                          </span>
                          <span className="text-foreground text-[14px] leading-snug">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <AnimatePresence>
                    {locked && current.explanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-start gap-2.5 mt-4 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-3">
                          <Lightbulb className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                          <p className="text-amber-100/90 text-[13px] leading-relaxed" data-testid="quiz-explanation">
                            {current.explanation}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Bottom action */}
        {!loading && !error && !finished && current && (
          <div className="px-4 py-4 border-t border-white/[0.06]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
            <button
              onClick={handleNext}
              disabled={!locked}
              className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-[15px] rounded-2xl py-3.5 active:scale-[0.98] transition-all"
              data-testid="quiz-next-btn"
            >
              {index < total - 1 ? (<>Следующий вопрос <ChevronRight className="w-4.5 h-4.5" strokeWidth={2.5} /></>) : (<><Trophy className="w-4.5 h-4.5" strokeWidth={2.5} /> Завершить тест</>)}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

const ScoreRing = ({ percent }) => {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const color = percent >= 80 ? '#34d399' : percent >= 50 ? '#a78bfa' : '#f87171';
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <motion.circle
          cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-foreground text-3xl font-bold">{percent}%</span>
        <span className="text-muted-foreground text-[11px]">результат</span>
      </div>
    </div>
  );
};

export default QuizPlayer;
