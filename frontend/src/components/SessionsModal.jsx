/**
 * SessionsModal — управление активными сессиями (устройствами).
 *
 * Позволяет:
 *  - увидеть список активных сессий (GET /auth/sessions)
 *  - отозвать одну (DELETE /auth/sessions/{jti})
 *  - отозвать все кроме текущей (POST /auth/logout-all?keep_current=true)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Monitor, Smartphone, Tablet, LogOut, AlertTriangle,
  Loader2, ShieldCheck, Clock, Globe,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const formatRelative = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const s = Math.max(0, Math.floor(diff / 1000));
    if (s < 60) return 'только что';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} мин назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч назад`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days} дн. назад`;
    return d.toLocaleDateString('ru-RU');
  } catch { return ''; }
};

const DeviceIcon = ({ label = '' }) => {
  const l = (label || '').toLowerCase();
  if (l.includes('ios') || l.includes('android') || l.includes('iphone')) return <Smartphone className="h-5 w-5" />;
  if (l.includes('ipad') || l.includes('tablet')) return <Tablet className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
};

const providerBadge = (p) => {
  const map = {
    email: { label: 'Email', color: 'bg-indigo-500/20 text-indigo-300' },
    telegram: { label: 'Telegram', color: 'bg-sky-500/20 text-sky-300' },
    vk: { label: 'VK', color: 'bg-blue-500/20 text-blue-300' },
    qr: { label: 'QR', color: 'bg-purple-500/20 text-purple-300' },
  };
  const v = map[p] || { label: p || '—', color: 'bg-white/10 text-white/60' };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${v.color}`}>
      {v.label}
    </span>
  );
};

const SessionsModal = ({ onClose }) => {
  const { getSessions, revokeSession, logoutAll } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revokingJti, setRevokingJti] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setError('');
    try {
      const res = await getSessions();
      setSessions(res?.sessions || []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить сессии');
    } finally {
      setLoading(false);
    }
  }, [getSessions]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleRevoke = async (jti, isCurrent) => {
    if (isCurrent) {
      if (!window.confirm('Это ваша текущая сессия. Вы выйдете из системы. Продолжить?')) return;
    }
    setRevokingJti(jti);
    try {
      await revokeSession(jti);
      if (isCurrent) {
        window.location.href = '/login?reason=revoked';
      } else {
        await loadSessions();
      }
    } catch (e) {
      setError(e?.message || 'Не удалось отозвать сессию');
    } finally {
      setRevokingJti(null);
    }
  };

  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    setError('');
    try {
      await logoutAll(true); // keep_current=true
      await loadSessions();
      setConfirmAll(false);
    } catch (e) {
      setError(e?.message || 'Не удалось выйти со всех устройств');
    } finally {
      setLoggingOutAll(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  return (
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-emerald-500/15 p-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Активные сессии</h2>
              <p className="text-xs text-white/50">Устройства, вошедшие в ваш аккаунт</p>
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            </div>
          )}
          {!loading && error && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && sessions.length === 0 && (
            <p className="text-center text-sm text-white/40 py-8">Нет активных сессий</p>
          )}

          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.jti}
                className={`rounded-xl border p-3.5 transition-colors ${
                  s.is_current
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 rounded-lg p-2 ${s.is_current ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/60'}`}>
                    <DeviceIcon label={s.device_label} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">
                        {s.device_label || 'Неизвестное устройство'}
                      </span>
                      {s.is_current && (
                        <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                          текущая
                        </span>
                      )}
                      {providerBadge(s.provider)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                      {s.ip && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {s.ip}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> активно{' '}
                        {formatRelative(s.last_active_at || s.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(s.jti, s.is_current)}
                    disabled={revokingJti === s.jti}
                    className="shrink-0 rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                    title={s.is_current ? 'Выйти отсюда' : 'Отозвать'}
                  >
                    {revokingJti === s.jti ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {otherSessionsCount > 0 && (
          <div className="border-t border-white/10 px-5 py-3 bg-white/[0.02]">
            {confirmAll ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAll(false)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleLogoutAll}
                  disabled={loggingOutAll}
                  className="flex-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {loggingOutAll ? 'Завершаем…' : 'Подтвердить'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAll(true)}
                className="w-full rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
              >
                Завершить сессии на других устройствах ({otherSessionsCount})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionsModal;
