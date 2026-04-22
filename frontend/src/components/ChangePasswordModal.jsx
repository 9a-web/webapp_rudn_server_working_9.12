/**
 * ChangePasswordModal — смена пароля (требует старый пароль).
 *
 * После смены:
 *  - все остальные сессии отзываются (баекенд сам)
 *  - кастомное изменение сохраняется (пользователь продолжает работу)
 */
import React, { useState } from 'react';
import { X, Lock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ChangePasswordModal = ({ onClose }) => {
  const { changePassword } = useAuth();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const validate = () => {
    if (!oldPwd) return 'Введите текущий пароль';
    if (newPwd.length < 6) return 'Новый пароль: минимум 6 символов';
    if (newPwd !== confirm) return 'Пароли не совпадают';
    if (oldPwd === newPwd) return 'Новый пароль не должен совпадать с текущим';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true);
    setErr('');
    try {
      const res = await changePassword(oldPwd, newPwd);
      setOk(true);
      setTimeout(() => onClose?.(res), 1500);
    } catch (e2) {
      setErr(e2?.message || 'Не удалось сменить пароль');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-500/15 p-2">
              <Lock className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Смена пароля</h2>
              <p className="text-xs text-white/50">Требуется текущий пароль</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {ok ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
            <p className="text-sm text-white/70">Пароль успешно изменён</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-white/60">Текущий пароль</label>
              <input
                type="password"
                autoFocus
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-400 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Новый пароль</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-400 focus:outline-none"
                placeholder="Минимум 6 символов"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Повторите новый пароль</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-400 focus:outline-none"
                placeholder="Ещё раз"
              />
            </div>
            {err && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}
            <p className="text-xs text-white/40">
              После смены все другие устройства будут автоматически выйдут из аккаунта.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-60"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Сохранение…
                </span>
              ) : 'Сменить пароль'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ChangePasswordModal;
