/**
 * EditUsernameModal — модальное окно изменения username (никнейма).
 *
 * Используется для:
 *  - сценария «пришёл из Telegram, мой ник уже занят» (вынос редактирования
 *    из RegisterWizard в любую точку приложения);
 *  - простой смены никнейма из ProfileScreen.
 *
 * Использует:
 *  - UsernameField (с поддержкой suggestBase и автогенерации подсказок).
 *  - useAuth().updateProfile — PATCH /api/auth/profile-step.
 *
 * Props:
 *  - isOpen, onClose
 *  - currentUsername?: текущий username (для предзаполнения)
 *  - suggestBase?: исходный base для подсказок (напр. конфликтный TG-ник)
 *  - onSuccess?: callback после успешного сохранения (получает новый username)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AtSign, Check } from 'lucide-react';
import UsernameField from './UsernameField';
import { useAuth } from '../../contexts/AuthContext';

const EditUsernameModal = ({
  isOpen,
  onClose,
  currentUsername = '',
  suggestBase = '',
  onSuccess,
}) => {
  const { updateProfile } = useAuth();
  const [username, setUsername] = useState(currentUsername || '');
  const [valid, setValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Сброс при каждом открытии
  useEffect(() => {
    if (isOpen) {
      setUsername(currentUsername || '');
      setValid(false);
      setError(null);
      setSuccess(false);
      setSaving(false);
    }
  }, [isOpen, currentUsername]);

  // ESC для закрытия
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, saving, onClose]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const next = (username || '').trim().toLowerCase();
    // Если значение не изменилось — просто закрыть
    if (next === (currentUsername || '').toLowerCase()) {
      onClose?.();
      return;
    }
    if (!next || !valid) {
      setError('Введите корректный username (3–32 символа, a-z, 0-9, _)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // ВАЖНО: complete_step НЕ передаём — это не шаг wizard, это просто
      // обновление поля профиля. Backend (auth_routes.update_profile_step)
      // обновляет переданные поля и при отсутствии complete_step не
      // двигает registration_step.
      await updateProfile({ username: next });
      setSuccess(true);
      // Показать успех 700ms, затем закрыть
      setTimeout(() => {
        onSuccess?.(next);
        onClose?.();
      }, 700);
    } catch (e) {
      const code = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message;
      if (code === 409) setError('Этот никнейм уже занят. Выберите другой.');
      else if (code === 422 || code === 400) setError(detail || 'Некорректный никнейм');
      else if (code === 429) setError('Слишком много изменений. Подождите немного.');
      else setError(detail || 'Не удалось сохранить. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }, [saving, username, currentUsername, valid, updateProfile, onSuccess, onClose]);

  // Можно сохранять, если: значение валидно ИЛИ пустое и поле было заполнено
  // (т.к. можно «очистить» ник). Backend позволяет null для username, что
  // означает «удалить». Но для простоты в этой модалке требуем непустое.
  const canSave = !saving && valid && (username || '').trim().toLowerCase() !== (currentUsername || '').toLowerCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl bg-[#1a1c2e] border border-white/10 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-username-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-pink-500/20 flex items-center justify-center">
                  <AtSign size={18} className="text-pink-300" />
                </div>
                <div>
                  <h2 id="edit-username-title" className="text-base font-semibold text-white">
                    {currentUsername ? 'Изменить никнейм' : 'Выбрать никнейм'}
                  </h2>
                  <p className="text-[11px] text-white/50">
                    Будет виден в публичном профиле
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !saving && onClose?.()}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
                aria-label="Закрыть"
              >
                <X size={18} className="text-white/70" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {!!suggestBase && !currentUsername && (
                <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-2.5 text-xs text-amber-200/95">
                  <span className="font-mono">@{suggestBase}</span>{' '}
                  занят. Подберите свободный вариант ниже или введите свой.
                </div>
              )}

              <UsernameField
                value={username}
                onChange={setUsername}
                onValidChange={setValid}
                suggestBase={suggestBase || ''}
              />

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-1.5">
                  <Check size={14} />
                  <span>Никнейм сохранён</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5 pt-1">
              <button
                type="button"
                onClick={() => !saving && onClose?.()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-sm font-medium transition-colors disabled:opacity-40"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="flex-[2] py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-pink-500/30 hover:from-pink-400 hover:to-purple-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EditUsernameModal;
