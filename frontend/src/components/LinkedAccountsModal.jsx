/**
 * LinkedAccountsModal — UI «Способы входа».
 *
 * Безопасная ручная линковка/отвязка провайдеров аутентификации
 * (Email / Telegram / VK) к текущему аккаунту.
 *
 * Логика:
 *  - Авто-линковка по совпадению username НЕ ПРОИЗВОДИТСЯ (см. auth_routes.py).
 *  - Привязка делается явно, пока пользователь авторизован в целевом аккаунте
 *    (JWT передаётся на бэкенд, бэкенд проверяет что провайдер свободен).
 *  - Нельзя отвязать ПОСЛЕДНИЙ способ входа — проверяем на фронте и бэке.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Mail, MessageCircle, Link2, Link2Off, ShieldCheck,
  CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff, Lock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import authAPI from '../services/authAPI';
import useIsInsideTelegram from '../hooks/useIsInsideTelegram';
import TelegramLoginWidget from './auth/TelegramLoginWidget';
import VkLoginButton from './auth/VkLoginButton';

// ====== VK logo (inline svg) ======
const VkIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M21.579 6.855c.14-.465 0-.806-.661-.806h-2.19c-.558 0-.813.295-.953.619 0 0-1.115 2.719-2.695 4.482-.51.513-.743.675-1.021.675-.139 0-.341-.162-.341-.627V6.855c0-.558-.161-.806-.626-.806H9.642c-.348 0-.557.258-.557.504 0 .528.79.65.871 2.138v3.228c0 .707-.127.836-.407.836-.742 0-2.551-2.732-3.624-5.858-.213-.617-.425-.85-.986-.85h-2.19c-.626 0-.75.294-.75.619 0 .58.742 3.462 3.46 7.271 1.811 2.604 4.361 4.014 6.685 4.014 1.393 0 1.566-.314 1.566-.854v-1.964c0-.627.132-.752.574-.752.325 0 .883.164 2.185 1.418 1.487 1.488 1.732 2.152 2.57 2.152h2.19c.626 0 .94-.314.759-.932-.197-.618-.906-1.515-1.846-2.579-.51-.604-1.276-1.253-1.509-1.577-.325-.417-.232-.604 0-.974.001.001 2.672-3.76 2.95-5.04z" />
  </svg>
);

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
};

// ====================================================================
// Email link sub-modal
// ====================================================================
const EmailLinkModal = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwdValid = password.length >= 8;
  const canSubmit = emailValid && pwdValid && !busy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await authAPI.linkEmail(email.trim().toLowerCase(), password);
      onSuccess?.();
    } catch (e2) {
      setErr(e2.message || 'Не удалось привязать email');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-500/15 p-2">
              <Mail className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Привязать Email</h3>
              <p className="text-[11px] text-white/50">Станет возможен вход по паролю</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
                  className="rounded-lg p-1 text-white/50 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-white/70">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400/60 focus:bg-white/[0.06]"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-white/70">Пароль (мин. 8 симв.)</span>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 pr-10 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400/60 focus:bg-white/[0.06]"
            />
            <button
              type="button"
              onClick={() => setShowPwd(s => !s)}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        {err && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {busy ? 'Привязываем...' : 'Привязать'}
        </button>
      </form>
    </div>
  );
};

// ====================================================================
// Telegram link sub-modal (обычно показываем когда пользователь на web)
// ====================================================================
const TelegramLinkModal = ({ botUsername, onClose, onSuccess }) => {
  const { initData } = useIsInsideTelegram();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Если мы ВНУТРИ Telegram WebApp — автоматически предлагаем initData-линк
  const handleWebAppLink = useCallback(async () => {
    if (!initData) return;
    setBusy(true);
    setErr(null);
    try {
      await authAPI.linkTelegramWebApp(initData);
      onSuccess?.();
    } catch (e) {
      setErr(e.message || 'Не удалось привязать Telegram');
      setBusy(false);
    }
  }, [initData, onSuccess]);

  const handleWidgetAuth = useCallback(async (widgetUser) => {
    setBusy(true);
    setErr(null);
    try {
      await authAPI.linkTelegramWidget(widgetUser);
      onSuccess?.();
    } catch (e) {
      setErr(e.message || 'Не удалось привязать Telegram');
      setBusy(false);
    }
  }, [onSuccess]);

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-sky-500/15 p-2">
              <MessageCircle className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Привязать Telegram</h3>
              <p className="text-[11px] text-white/50">Вход по клику внутри Telegram</p>
            </div>
          </div>
          <button onClick={onClose}
                  className="rounded-lg p-1 text-white/50 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {initData ? (
          <>
            <div className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-xs text-emerald-200">
              Вы внутри Telegram — можно привязать одним кликом.
            </div>
            <button
              type="button"
              onClick={handleWebAppLink}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#229ED9] to-[#1B8AC0] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:shadow-xl hover:shadow-sky-500/30 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {busy ? 'Привязываем...' : 'Привязать этот Telegram'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/70">
              Нажмите кнопку ниже и подтвердите в Telegram.
            </div>
            <div className="flex justify-center">
              <TelegramLoginWidget
                botUsername={botUsername}
                onAuth={handleWidgetAuth}
                size="large"
              />
            </div>
          </>
        )}

        {err && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {err}
          </div>
        )}
      </div>
    </div>
  );
};

// ====================================================================
// Confirm unlink sub-modal
// ====================================================================
const ConfirmUnlinkModal = ({ provider, onCancel, onConfirm, busy }) => {
  const names = {
    email: { title: 'Отвязать Email?', desc: 'Вы не сможете входить по email и паролю.' },
    telegram: { title: 'Отвязать Telegram?', desc: 'Вход через Telegram перестанет работать.' },
    vk: { title: 'Отвязать VK?', desc: 'Вход через VK ID перестанет работать.' },
  };
  const info = names[provider] || { title: 'Отвязать провайдер?', desc: '' };

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-2.5">
          <div className="rounded-xl bg-red-500/15 p-2">
            <AlertTriangle className="h-5 w-5 text-red-300" />
          </div>
          <h3 className="text-base font-semibold text-white">{info.title}</h3>
        </div>
        <p className="mb-4 text-sm text-white/70">{info.desc}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/90 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            Отвязать
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// Main modal
// ====================================================================
const LinkedAccountsModal = ({ onClose }) => {
  const { user, refreshMe } = useAuth();
  const [config, setConfig] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', text }
  const [linkingProvider, setLinkingProvider] = useState(null); // email|telegram|null (vk → redirect)
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    authAPI.config().then((cfg) => { if (mounted) setConfig(cfg); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const providers = useMemo(() => ({
    email: {
      key: 'email',
      label: 'Email и пароль',
      icon: Mail,
      accent: 'indigo',
      linked: !!user?.email,
      value: user?.email ? maskEmail(user.email) : null,
    },
    telegram: {
      key: 'telegram',
      label: 'Telegram',
      icon: MessageCircle,
      accent: 'sky',
      linked: !!user?.telegram_id,
      value: user?.telegram_id ? `ID ${user.telegram_id}` : null,
    },
    vk: {
      key: 'vk',
      label: 'VK ID',
      icon: VkIcon,
      accent: 'blue',
      linked: !!user?.vk_id,
      value: user?.vk_id ? `ID ${user.vk_id}` : null,
    },
  }), [user]);

  const linkedCount = Object.values(providers).filter(p => p.linked).length;

  const showToast = (type, text, ms = 3500) => {
    setToast({ type, text });
    if (ms) setTimeout(() => setToast(null), ms);
  };

  // Unified after-link handler
  const handleLinkedOk = async (providerName) => {
    setLinkingProvider(null);
    await refreshMe?.();
    showToast('success', `${providerName} успешно привязан`);
  };

  const handleUnlinkConfirm = async () => {
    if (!unlinkTarget) return;
    setUnlinkBusy(true);
    try {
      await authAPI.unlinkProvider(unlinkTarget);
      await refreshMe?.();
      showToast('success', 'Провайдер отвязан');
      setUnlinkTarget(null);
    } catch (e) {
      showToast('error', e.message || 'Не удалось отвязать');
    } finally {
      setUnlinkBusy(false);
    }
  };

  const renderProviderCard = (p) => {
    const Icon = p.icon;
    const accent = {
      indigo: {
        bg: 'bg-indigo-500/15',
        text: 'text-indigo-300',
        btn: 'from-indigo-500 to-violet-500 shadow-indigo-500/20',
      },
      sky: {
        bg: 'bg-sky-500/15',
        text: 'text-sky-300',
        btn: 'from-[#229ED9] to-[#1B8AC0] shadow-sky-500/20',
      },
      blue: {
        bg: 'bg-blue-500/15',
        text: 'text-blue-300',
        btn: 'from-[#0077FF] to-[#0069E0] shadow-blue-500/20',
      },
    }[p.accent];

    const isLastLinked = p.linked && linkedCount <= 1;

    return (
      <div
        key={p.key}
        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.015] p-4 transition hover:border-white/15"
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.bg}`}>
            <Icon className={`h-5 w-5 ${accent.text}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{p.label}</span>
              {p.linked ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Привязан
                </span>
              ) : (
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/50">
                  Не привязан
                </span>
              )}
            </div>
            {p.value && (
              <div className="mt-0.5 truncate text-xs text-white/50">{p.value}</div>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {p.linked ? (
            <button
              type="button"
              disabled={isLastLinked}
              onClick={() => setUnlinkTarget(p.key)}
              title={isLastLinked ? 'Нельзя отвязать последний способ входа' : undefined}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03] disabled:hover:text-white/80"
            >
              <Link2Off className="h-3.5 w-3.5" />
              Отвязать
            </button>
          ) : p.key === 'vk' ? (
            <div className="flex-1">
              <VkLoginButton
                appId={config?.vk_app_id}
                mode="link"
                label="Привязать VK ID"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLinkingProvider(p.key)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r ${accent.btn} px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:opacity-95`}
            >
              <Link2 className="h-3.5 w-3.5" />
              Привязать
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 sm:h-auto sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl"
      >
        {/* Header */}
        <div className="relative flex items-start justify-between border-b border-white/5 bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 p-2.5">
              <ShieldCheck className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Способы входа</h2>
              <p className="text-xs text-white/50">Управление привязанными провайдерами</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-xl p-2 text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pb-24 sm:pb-5">
          {/* Info banner */}
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="text-[12px] leading-relaxed text-amber-100/90">
              Привязка происходит <b>вручную</b>: никакого авто-объединения аккаунтов
              по совпадению username. Отвязать последний способ входа нельзя —
              это защищает от потери доступа.
            </div>
          </div>

          <div className="space-y-3">
            {renderProviderCard(providers.email)}
            {renderProviderCard(providers.telegram)}
            {renderProviderCard(providers.vk)}
          </div>

          {linkedCount === 1 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/50">
              У вас только один способ входа. Для безопасности рекомендуем привязать
              минимум два — чтобы не потерять доступ при проблемах с одним из них.
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-[10070] -translate-x-1/2 px-4">
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur ${
              toast.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100'
                : 'border-red-500/30 bg-red-500/15 text-red-100'
            }`}>
              {toast.type === 'success'
                ? <CheckCircle2 className="h-4 w-4" />
                : <AlertTriangle className="h-4 w-4" />}
              {toast.text}
            </div>
          </div>
        )}
      </div>

      {/* Sub-modals */}
      {linkingProvider === 'email' && (
        <EmailLinkModal
          onClose={() => setLinkingProvider(null)}
          onSuccess={() => handleLinkedOk('Email')}
        />
      )}
      {linkingProvider === 'telegram' && (
        <TelegramLinkModal
          botUsername={config?.telegram_bot_username}
          onClose={() => setLinkingProvider(null)}
          onSuccess={() => handleLinkedOk('Telegram')}
        />
      )}
      {unlinkTarget && (
        <ConfirmUnlinkModal
          provider={unlinkTarget}
          busy={unlinkBusy}
          onCancel={() => !unlinkBusy && setUnlinkTarget(null)}
          onConfirm={handleUnlinkConfirm}
        />
      )}
    </div>
  );
};

export default LinkedAccountsModal;
