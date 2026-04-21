/**
 * PublicProfilePage — публичная страница профиля по UID.
 *
 * Маршрут: /u/:uid
 * Доступность: БЕЗ авторизации (респектирует privacy настройки владельца).
 * Эндпоинты backend:
 *   GET  /api/u/{uid}          → UserProfilePublic
 *   GET  /api/u/{uid}/share-link
 *   POST /api/u/{uid}/view     (JWT optional; считается только для авторизованных)
 *
 * UX-принципы:
 *  - Лёгкая загрузка (skeleton), мягкий fade-in
 *  - Чёткие пустые состояния: 404 / 422 / hidden / private
 *  - Dark theme с градиентным glow, аватар-градиент, уровень/tier
 *  - CTA: Копировать ссылку, Открыть в приложении, Войти
 *  - Responsive (mobile-first + desktop)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ArrowLeft, Copy, Share2, Users, Trophy, Eye, EyeOff, Wifi,
  Loader2, AlertTriangle, Lock, CalendarDays, GraduationCap,
  CheckCircle2, Home, LogIn, UserPlus, ExternalLink, RefreshCw,
} from 'lucide-react';

import { getBackendURL } from '../utils/config';
import { buildProfileUrl } from '../constants/publicBase';
import { getTierConfig } from '../constants/levelConstants';
import { useAuth } from '../contexts/AuthContext';

// ============ Helpers ============

const API_BASE = `${getBackendURL()}/api`;

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-600',
];

const pickGradient = (seed) => {
  const n = Math.abs(Number(seed) || 0);
  return AVATAR_GRADIENTS[n % AVATAR_GRADIENTS.length];
};

const getInitials = (firstName, lastName, username) => {
  const parts = [];
  if (firstName) parts.push(String(firstName).trim()[0]);
  if (lastName) parts.push(String(lastName).trim()[0]);
  if (parts.length === 0 && username) parts.push(String(username).trim()[0]);
  return parts.join('').toUpperCase() || '?';
};

const formatRelativeTime = (iso) => {
  if (!iso) return '';
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return '';
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ч назад`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} дн назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

const formatMemberSince = (iso) => {
  if (!iso) return '';
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

// ============ Sub-components ============

const PageFrame = ({ children }) => (
  <div
    className="min-h-screen w-full text-white"
    style={{
      background:
        'radial-gradient(1200px 600px at 10% 0%, rgba(124,58,237,0.12) 0%, transparent 60%),' +
        'radial-gradient(900px 500px at 100% 100%, rgba(59,130,246,0.10) 0%, transparent 60%),' +
        '#0B0B0F',
    }}
  >
    <div className="mx-auto w-full max-w-[640px] px-4 pb-12 pt-6 sm:pt-10">
      {children}
    </div>
  </div>
);

const TopBar = ({ onBack, uid }) => (
  <div className="mb-6 flex items-center justify-between">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 text-[13px] font-medium text-white/70 transition hover:bg-white/[0.10] hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Назад
    </button>
    <div className="flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] font-mono tracking-wider text-white/50 border border-white/[0.06]">
      UID · {uid}
    </div>
  </div>
);

const LoadingSkeleton = () => (
  <div className="animate-pulse">
    <div className="flex items-start gap-4">
      <div className="h-[88px] w-[88px] rounded-[26px] bg-white/[0.06]" />
      <div className="flex-1 space-y-3 pt-2">
        <div className="h-5 w-2/3 rounded-md bg-white/[0.06]" />
        <div className="h-3 w-1/3 rounded-md bg-white/[0.05]" />
        <div className="h-3 w-1/2 rounded-md bg-white/[0.04]" />
      </div>
    </div>
    <div className="mt-6 grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
    <div className="mt-4 h-16 rounded-2xl bg-white/[0.03]" />
    <div className="mt-4 h-12 w-2/3 rounded-full bg-white/[0.04]" />
  </div>
);

const EmptyState = ({ icon: Icon, iconColor = 'text-white/40', title, description, actions }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-6 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-8 text-center"
  >
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
      <Icon className={`h-7 w-7 ${iconColor}`} />
    </div>
    <h2 className="text-[18px] font-semibold text-white">{title}</h2>
    {description && (
      <p className="mx-auto mt-2 max-w-[380px] text-[13px] leading-relaxed text-white/60">
        {description}
      </p>
    )}
    {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
  </motion.div>
);

const StatCard = ({ value, label, hidden, icon: Icon }) => (
  <div className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-3 text-center">
    {hidden ? (
      <>
        <EyeOff className="mb-1 h-5 w-5 text-white/30" />
        <span className="text-[10px] font-medium text-white/40">Скрыто</span>
      </>
    ) : (
      <>
        {Icon && <Icon className="mb-1 h-[18px] w-[18px] text-white/40" />}
        <span className="text-[20px] font-bold text-white leading-none">{value ?? 0}</span>
        <span className="mt-1 text-[11px] font-medium text-white/50">{label}</span>
      </>
    )}
  </div>
);

const FriendshipBadge = ({ status }) => {
  if (!status) return null;
  const map = {
    friend: { label: 'В друзьях', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/20' },
    pending_incoming: { label: 'Входящий запрос', color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-400/20' },
    pending_outgoing: { label: 'Запрос отправлен', color: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-400/20' },
    blocked: { label: 'Заблокирован', color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-400/20' },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <CheckCircle2 className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// ============ Main Component ============

const PublicProfilePage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user: currentUser, initializing: authInitializing } = useAuth();

  const [profile, setProfile] = useState(null);
  const [shareInfo, setShareInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { type: 'not_found' | 'not_configured' | 'hidden' | 'generic', message }
  const [copied, setCopied] = useState(false);

  const publicUrl = useMemo(() => buildProfileUrl(uid), [uid]);

  // ---- Page title / meta ----
  useEffect(() => {
    const displayName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
        (profile.username ? `@${profile.username}` : `User ${uid}`)
      : `Профиль ${uid}`;
    document.title = `${displayName} · RUDN`;

    // OG-like description (meta tag)
    const descContent = profile
      ? `${displayName} в расписании РУДН${profile.group_name ? ` · ${profile.group_name}` : ''}`
      : 'Публичный профиль в RUDN Schedule';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', descContent);
  }, [profile, uid]);

  // ---- Fetch profile ----
  const fetchProfile = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const profileRes = await axios.get(`${API_BASE}/u/${uid}`, { validateStatus: () => true });

      if (profileRes.status === 200) {
        setProfile(profileRes.data);
      } else if (profileRes.status === 404) {
        setError({ type: 'not_found', message: 'Пользователь с таким UID не найден' });
        return;
      } else if (profileRes.status === 422) {
        setError({ type: 'not_configured', message: 'Профиль не настроен владельцем' });
        return;
      } else if (profileRes.status === 401 || profileRes.status === 403) {
        setError({ type: 'hidden', message: 'Этот профиль скрыт от публичного просмотра' });
        return;
      } else {
        setError({
          type: 'generic',
          message: profileRes.data?.detail || `Ошибка ${profileRes.status}`,
        });
        return;
      }

      // Fetch share info (non-blocking for rendering)
      try {
        const shareRes = await axios.get(`${API_BASE}/u/${uid}/share-link`, { validateStatus: () => true });
        if (shareRes.status === 200) setShareInfo(shareRes.data);
      } catch {
        /* noop */
      }
    } catch (e) {
      setError({
        type: 'generic',
        message: e?.response?.data?.detail || e?.message || 'Не удалось загрузить профиль',
      });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ---- Register view (once, best-effort) ----
  useEffect(() => {
    if (!uid || !profile) return;
    // Только для авторизованных — иначе backend вернёт counted=false
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      axios.post(`${API_BASE}/u/${uid}/view`).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [uid, profile, isAuthenticated]);

  // ---- Derived display values ----
  const displayName = useMemo(() => {
    if (!profile) return '';
    const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (profile.username) return `@${profile.username}`;
    if (profile.uid) return `User ${profile.uid}`;
    return `User ${uid}`;
  }, [profile, uid]);

  const initials = useMemo(
    () => getInitials(profile?.first_name, profile?.last_name, profile?.username),
    [profile],
  );

  const avatarSeed = profile?.telegram_id || profile?.uid || uid;
  const gradient = pickGradient(avatarSeed);
  const tierCfg = profile?.level ? getTierConfig(profile.tier || 'base') : null;

  const isOwner = useMemo(() => {
    if (!isAuthenticated || !currentUser || !profile) return false;
    if (currentUser.uid && profile.uid && String(currentUser.uid) === String(profile.uid)) return true;
    if (currentUser.telegram_id && profile.telegram_id && Number(currentUser.telegram_id) === Number(profile.telegram_id)) return true;
    return false;
  }, [isAuthenticated, currentUser, profile]);

  // ---- Actions ----
  const handleBack = () => {
    // Если пришли из самого приложения — вернёмся назад, иначе — на главную
    if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = publicUrl;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
      catch { /* noop */ }
      document.body.removeChild(el);
    }
  };

  const handleShare = async () => {
    const text = displayName ? `Профиль ${displayName} в RUDN Schedule` : 'Профиль в RUDN Schedule';
    try {
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(
          `https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(text)}`,
        );
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'Профиль', text, url: publicUrl });
        return;
      }
    } catch {
      /* user cancelled or unsupported — fallback to copy */
    }
    handleCopy();
  };

  const handleOpenInApp = () => {
    // Если profile связан с telegram — можно открыть Telegram-бота с deep-link
    const tgLink = shareInfo?.telegram_link;
    if (tgLink) {
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(tgLink);
      } else {
        window.open(tgLink, '_blank', 'noopener,noreferrer');
      }
    } else {
      // fallback — открыть веб-приложение (главную)
      navigate('/');
    }
  };

  const goToLogin = () => {
    const cont = encodeURIComponent(`/u/${uid}`);
    navigate(`/login?continue=${cont}`);
  };

  // ============ Render states ============

  if (loading || authInitializing) {
    return (
      <PageFrame>
        <TopBar onBack={handleBack} uid={uid} />
        <LoadingSkeleton />
      </PageFrame>
    );
  }

  if (error) {
    const { type, message } = error;
    if (type === 'not_found') {
      return (
        <PageFrame>
          <TopBar onBack={handleBack} uid={uid} />
          <EmptyState
            icon={AlertTriangle}
            iconColor="text-amber-300"
            title="Профиль не найден"
            description={`UID «${uid}» не существует или был удалён.`}
            actions={
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.15]"
              >
                <Home className="h-4 w-4" /> На главную
              </button>
            }
          />
        </PageFrame>
      );
    }
    if (type === 'not_configured') {
      return (
        <PageFrame>
          <TopBar onBack={handleBack} uid={uid} />
          <EmptyState
            icon={AlertTriangle}
            iconColor="text-amber-300"
            title="Профиль ещё не настроен"
            description="Владелец UID пока не связал аккаунт с Telegram или не завершил регистрацию."
            actions={
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.15]"
              >
                <Home className="h-4 w-4" /> На главную
              </button>
            }
          />
        </PageFrame>
      );
    }
    if (type === 'hidden') {
      return (
        <PageFrame>
          <TopBar onBack={handleBack} uid={uid} />
          <EmptyState
            icon={Lock}
            iconColor="text-indigo-300"
            title="Этот профиль скрыт"
            description="Владелец настроил приватность: профиль недоступен для анонимного просмотра. Войдите, чтобы увидеть подробности (если у вас есть доступ)."
            actions={
              <>
                <button
                  onClick={goToLogin}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-400"
                >
                  <LogIn className="h-4 w-4" /> Войти
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.15]"
                >
                  <Home className="h-4 w-4" /> На главную
                </button>
              </>
            }
          />
        </PageFrame>
      );
    }
    return (
      <PageFrame>
        <TopBar onBack={handleBack} uid={uid} />
        <EmptyState
          icon={AlertTriangle}
          iconColor="text-rose-300"
          title="Не удалось загрузить профиль"
          description={message}
          actions={
            <button
              onClick={fetchProfile}
              disabled={loading}
              aria-label="Повторить загрузку профиля"
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.15] disabled:opacity-60 disabled:cursor-wait"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
              {loading ? 'Загрузка…' : 'Повторить'}
            </button>
          }
        />
      </PageFrame>
    );
  }

  // ============ Profile loaded ============

  return (
    <PageFrame>
      <TopBar onBack={handleBack} uid={uid} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* ===== Hero ===== */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
          {/* Ambient gradient glow */}
          <div
            className={`pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-gradient-to-br ${gradient} opacity-[0.12] blur-3xl`}
          />

          <div className="relative flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className={`flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[26px] bg-gradient-to-br ${gradient} text-white text-[30px] font-bold shadow-[0_8px_30px_rgba(0,0,0,0.4)]`}
              >
                {initials}
              </div>
              {profile.is_online && (
                <div className="absolute -bottom-1 -right-1">
                  <div
                    className="relative h-5 w-5 rounded-full border-[3px] bg-emerald-500"
                    style={{ borderColor: '#0B0B0F' }}
                  >
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-30" />
                  </div>
                </div>
              )}
            </div>

            {/* Name & meta */}
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-bold leading-tight text-white sm:text-[24px]">
                  {displayName}
                </h1>
                {isOwner && (
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 border border-indigo-400/20">
                    Это вы
                  </span>
                )}
              </div>
              {profile.username && (
                <p className="mt-1 text-[13px] text-white/50">@{profile.username}</p>
              )}
              {profile.group_name && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-purple-300">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {profile.group_name}
                </p>
              )}
              {profile.facultet_name && (
                <p className="mt-0.5 truncate text-[11px] text-white/40">{profile.facultet_name}</p>
              )}

              {/* Tier / Level */}
              {tierCfg && profile.level > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="rounded-lg border px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      background: tierCfg.bgTint,
                      color: tierCfg.color,
                      borderColor: tierCfg.borderTint,
                    }}
                  >
                    LV. {profile.level}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: tierCfg.color }}
                  >
                    {tierCfg.nameRu}
                  </span>
                  {profile.stars > 0 && (
                    <span
                      style={{ color: tierCfg.color, letterSpacing: '1px', fontSize: 10 }}
                    >
                      {'★'.repeat(Math.min(profile.stars || 1, 4))}
                    </span>
                  )}
                </div>
              )}

              {/* Online / last seen */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile.is_online ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
                    <Wifi className="h-3 w-3" /> в сети
                  </span>
                ) : profile.online_status_hidden ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40">
                    <EyeOff className="h-3 w-3" /> статус скрыт
                  </span>
                ) : profile.last_activity ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40">
                    был(а) {formatRelativeTime(profile.last_activity)}
                  </span>
                ) : null}
                <FriendshipBadge status={profile.friendship_status} />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatCard
              icon={Users}
              value={profile.friends_count}
              label="Друзей"
              hidden={profile.friends_list_hidden}
            />
            <StatCard
              icon={Users}
              value={profile.mutual_friends_count}
              label="Общих"
              hidden={!isAuthenticated}
            />
            <StatCard
              icon={Trophy}
              value={profile.achievements_count}
              label="Достижений"
              hidden={profile.achievements_hidden}
            />
          </div>

          {/* XP progress */}
          {tierCfg && profile.xp > 0 && profile.xp_progress > 0 && (
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-white/40">
                <span>{profile.xp || 0} XP</span>
                <span>LV. {profile.level} → {profile.level + 1}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max((profile.xp_progress || 0) * 100, 2)}%`,
                    background: tierCfg.gradient,
                  }}
                />
              </div>
            </div>
          )}

          {/* Meta info */}
          {(profile.created_at || isOwner) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
              {profile.created_at && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] px-2.5 py-1 border border-white/[0.05]">
                  <CalendarDays className="h-3 w-3" />
                  Участник с {formatMemberSince(profile.created_at)}
                </span>
              )}
              {isOwner && typeof profile.profile_views_count === 'number' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] px-2.5 py-1 border border-white/[0.05]">
                  <Eye className="h-3 w-3" />
                  {profile.profile_views_count} просмотров
                </span>
              )}
            </div>
          )}
        </div>

        {/* ===== Actions ===== */}
        <div className="mt-5 space-y-2.5">
          {/* Primary: open in app */}
          <button
            onClick={handleOpenInApp}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] transition hover:from-indigo-400 hover:to-purple-400 active:scale-[0.98]"
          >
            <ExternalLink className="h-4 w-4" />
            {shareInfo?.telegram_link ? 'Открыть в Telegram' : 'Открыть в приложении'}
          </button>

          {/* Secondary: share + copy */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" />
              Поделиться
            </button>
            <button
              onClick={handleCopy}
              className="relative flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="inline-flex items-center gap-2 text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Скопировано
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="inline-flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" /> Копировать
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* URL preview */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              URL
            </span>
            <span className="truncate font-mono text-[12px] text-white/70">{publicUrl}</span>
          </div>

          {/* Auth CTA */}
          {!isAuthenticated && (
            <button
              onClick={goToLogin}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] bg-transparent px-4 py-3 text-[13px] font-medium text-white/70 transition hover:border-white/[0.25] hover:text-white"
            >
              <UserPlus className="h-4 w-4" />
              Войти, чтобы добавить в друзья
            </button>
          )}
        </div>

        {/* Privacy note */}
        {(profile.schedule_hidden || profile.friends_list_hidden || profile.achievements_hidden) && (
          <p className="mt-5 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5 text-[11px] leading-relaxed text-white/40">
            <Lock className="mr-1.5 -mt-0.5 inline h-3 w-3" />
            Некоторые разделы скрыты владельцем в настройках приватности.
          </p>
        )}

        <div className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-white/25">
          RUDN · Schedule
        </div>
      </motion.div>
    </PageFrame>
  );
};

export default PublicProfilePage;
