import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Sparkles, Loader2, AlertCircle, ListChecks, ToggleRight, Layers } from 'lucide-react';
import { quizAPI } from '../../services/quizAPI';

const MAX_CHARS = 24000;

const cardStyle = {
  backgroundColor: 'rgba(28, 28, 30, 0.92)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
};

const MODES = [
  { id: 'multiple_choice', label: 'Тест', icon: ListChecks },
  { id: 'true_false', label: 'Верно / неверно', icon: ToggleRight },
  { id: 'flashcard', label: 'Карточки', icon: Layers },
];

const LOADING_PHRASES = [
  'Читаю лекцию…',
  'Выделяю главные идеи…',
  'Формулирую вопросы…',
  'Подбираю варианты ответов…',
  'Почти готово…',
];

export const ImportLectureModal = ({ isOpen, onClose, onCreated }) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [mode, setMode] = useState('multiple_choice');
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setText(''); setTitle(''); setNumQuestions(10); setMode('multiple_choice');
      setError(null); setLoading(false); setDragging(false); setExtracting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length), 2600);
    return () => clearInterval(id);
  }, [loading]);

  const titleFromFile = useCallback((name) => name.replace(/\.[^.]+$/, '').slice(0, 80), []);

  const readFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    const name = file.name || '';
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

    if (['txt', 'md', 'text'].includes(ext) || file.type.startsWith('text')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setText(String(e.target?.result || '').slice(0, MAX_CHARS));
        if (!title) setTitle(titleFromFile(name));
      };
      reader.onerror = () => setError('Не удалось прочитать файл');
      reader.readAsText(file, 'utf-8');
      return;
    }

    if (['pdf', 'docx'].includes(ext)) {
      setExtracting(true);
      try {
        const res = await quizAPI.extractText(file);
        setText((res?.text || '').slice(0, MAX_CHARS));
        if (!title) setTitle(titleFromFile(name));
        if (res?.truncated) setError('Текст длинный — взяты первые 24 000 символов.');
      } catch (err) {
        setError(err.message || 'Не удалось извлечь текст из файла.');
      } finally {
        setExtracting(false);
      }
      return;
    }

    setError('Поддерживаются файлы .txt, .md, .pdf, .docx');
  }, [title, titleFromFile]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleGenerate = async () => {
    const clean = text.trim();
    if (clean.length < 40) {
      setError('Вставьте или загрузите текст лекции (не менее 40 символов).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const quiz = await quizAPI.generate({
        text: clean,
        title: title.trim() || undefined,
        num_questions: numQuestions,
        language: 'ru',
        mode,
      });
      onCreated?.(quiz);
    } catch (err) {
      setError(err.message || 'Не удалось сгенерировать тест.');
      setLoading(false);
    }
  };

  const charCount = text.length;
  const isFlash = mode === 'flashcard';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-testid="import-lecture-modal"
        >
          <div className="absolute inset-0 bg-black/70" onClick={() => !loading && onClose?.()} />
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden max-h-[92vh] flex flex-col"
            style={cardStyle}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 p-2 rounded-xl">
                  <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-foreground font-semibold text-[15px] leading-tight">
                    {isFlash ? 'Новые карточки из лекции' : 'Новый тест из лекции'}
                  </h2>
                  <p className="text-muted-foreground text-[11px]">ИИ deepseek-v4-flash</p>
                </div>
              </div>
              <button
                onClick={() => !loading && onClose?.()}
                disabled={loading}
                className="p-2 rounded-full hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                data-testid="import-modal-close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center min-h-[320px]">
                <div className="relative mb-6">
                  <motion.div
                    className="absolute -inset-5 rounded-full blur-2xl bg-violet-500/30"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="relative bg-gradient-to-br from-violet-500 to-fuchsia-500 p-5 rounded-3xl">
                    <Loader2 className="w-8 h-8 text-white animate-spin" strokeWidth={2.5} />
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={phraseIdx}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="text-foreground font-medium text-[15px]"
                  >
                    {LOADING_PHRASES[phraseIdx]}
                  </motion.p>
                </AnimatePresence>
                <p className="text-muted-foreground text-[12px] mt-2">Обычно занимает 10–30 секунд</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Mode selector */}
                <div>
                  <label className="block text-[12px] text-muted-foreground mb-1.5">Формат</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-white/[0.04] border border-white/10 rounded-2xl p-1">
                    {MODES.map((m) => {
                      const Icon = m.icon;
                      const active = mode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMode(m.id)}
                          className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                            active ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20' : 'text-muted-foreground hover:text-foreground'
                          }`}
                          data-testid={`import-mode-${m.id}`}
                        >
                          <Icon className="w-4 h-4" strokeWidth={2.2} />
                          <span className="text-[10.5px] font-medium leading-none text-center">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dropzone / file */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => !extracting && fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    dragging ? 'border-violet-400 bg-violet-400/10' : 'border-white/15 hover:border-white/25 bg-white/[0.02]'
                  }`}
                  data-testid="import-dropzone"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.text,.pdf,.docx,text/plain,application/pdf"
                    className="hidden"
                    onChange={(e) => readFile(e.target.files?.[0])}
                    data-testid="import-file-input"
                  />
                  {extracting ? (
                    <>
                      <Loader2 className="w-6 h-6 mx-auto text-violet-300 mb-2 animate-spin" />
                      <p className="text-foreground text-[13px] font-medium">Извлекаю текст из файла…</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mx-auto text-violet-300 mb-2" />
                      <p className="text-foreground text-[13px] font-medium">
                        Перетащите файл лекции или нажмите для выбора
                      </p>
                      <p className="text-muted-foreground text-[11px] mt-1">.txt · .md · .pdf · .docx</p>
                    </>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[12px] text-muted-foreground mb-1.5">Название</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isFlash ? 'Например: Закон Ома' : 'Например: Лекция 5 — Термодинамика'}
                    maxLength={120}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-foreground text-[14px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-400/60 transition-colors"
                    data-testid="import-title-input"
                  />
                </div>

                {/* Text */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Текст лекции
                    </label>
                    <span className={`text-[11px] ${charCount > MAX_CHARS ? 'text-red-400' : 'text-muted-foreground/70'}`}>
                      {charCount.toLocaleString('ru')} / {MAX_CHARS.toLocaleString('ru')}
                    </span>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                    rows={6}
                    placeholder="Вставьте текст лекции сюда или загрузите файл выше…"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-foreground text-[13px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-400/60 transition-colors resize-none"
                    data-testid="import-text-area"
                  />
                </div>

                {/* Count slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] text-muted-foreground">
                      {isFlash ? 'Количество карточек' : 'Количество вопросов'}
                    </label>
                    <span className="text-violet-300 font-semibold text-[15px]" data-testid="import-num-value">{numQuestions}</span>
                  </div>
                  <input
                    type="range" min={3} max={20} step={1}
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                    data-testid="import-num-slider"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5" data-testid="import-error">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-[12.5px] leading-snug">{error}</p>
                  </div>
                )}
              </div>
            )}

            {!loading && (
              <div className="px-5 py-4 border-t border-white/[0.06]">
                <button
                  onClick={handleGenerate}
                  disabled={text.trim().length < 40 || extracting}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[15px] rounded-2xl py-3.5 transition-all active:scale-[0.98] shadow-lg shadow-violet-500/20"
                  data-testid="import-generate-btn"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={2.5} />
                  {isFlash ? 'Создать карточки' : 'Сгенерировать тест'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImportLectureModal;
