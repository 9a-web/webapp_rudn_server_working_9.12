/**
 * 🌐 PublicProfilePage — публичная страница профиля по UID (`/u/{uid}`).
 *
 * Дизайн:
 *   1-в-1 повторяет owner-дизайн ProfileScreen (граффити-шапка, аватар 140×140,
 *   level/online pill, 3 колонки Друзей/Тир/$RDN, табы Общее/Друзья/Достижения/Материалы,
 *   bottom amber-glow), но адаптирован под просмотр другим пользователем.
 *
 * Поведение:
 *   * Если viewer == owner → авто-редирект на `/?openProfile=1` с заменой URL —
 *     владелец редактирует свой профиль через Header → ProfileScreen.
 *   * Не-владелец авторизованный → доступны действия дружбы (добавить/отозвать/
 *     принять/отклонить/удалить/блокировка) + Share + Open in app.
 *   * Аноним → Share + Login.
 *
 * Privacy:
 *   * Все поля (online, friends, achievements) учитывают privacy-флаги из API.
 *   * Backend дополнительно фильтрует /u/{uid}/friends и /u/{uid}/achievements
 *     на серверной стороне для не-друзей.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Trophy, QrCode, Share2, UserPlus, UserCheck, Clock,
  Loader2, Lock, Star, Sliders, Users, MessageCircle, LogIn, Copy, Check, X,
  ExternalLink, MoreVertical, ShieldX, UserX, EyeOff,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

import { friendsAPI } from '../services/friendsAPI';
import { useAuth } from '../contexts/AuthContext';
import { getTierConfig } from '../constants/levelConstants';
import { buildProfileUrl } from '../constants/publicBase';
import { isSameUser } from '../utils/userIdentity';
import WallGraffiti from '../components/WallGraffiti';
import LevelDetailModal from '../components/LevelDetailModal';
import { getBackendURL } from '../services/api';

// =============================================================================
// Константы
// =============================================================================

const TABS = [
  { id: 'general', label: 'Общее' },
  { id: 'friends', label: 'Друзья' },
  { id: 'achievements', label: 'Достижения' },
  { id: 'materials', label: 'Материалы' },
];

const PSEUDO_TID_OFFSET = 10_000_000_000;

// =============================================================================
// Хелперы
// =============================================================================

const pluralizeFriends = (n) => {
  const num = Number(n) || 0;
  const mod10 = num % 10;
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'Друзей';
  if (mod10 === 1) return 'Друг';
  if (mod10 >= 2 && mod10 <= 4) return 'Друга';
  return 'Друзей';
};

const formatLastSeen = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch { return null; }
};

const buildTelegramPhotoUrl = (telegramId) => {
  if (!telegramId) return null;
  const tid = Number(telegramId);
  if (!Number.isFinite(tid) || tid <= 0 || tid >= PSEUDO_TID_OFFSET) return null;
  const base = getBackendURL();
  return `${base}/api/user-profile-photo-proxy/${tid}`;
};

// =============================================================================
// Компонент
// =============================================================================

const PublicProfilePage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, isAuthenticated } = useAuth();

  // === Profile data ===
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // === Avatar / Header graffiti ===
  const [customAvatar, setCustomAvatar] = useState(null);  // base64 data URL
  const [headerGraffitiUrl, setHeaderGraffitiUrl] = useState(null);
  const [tgPhotoOk, setTgPhotoOk] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);

  // === Tabs ===
  const [activeTab, setActiveTab] = useState('general');
  const [friendsList, setFriendsList] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsHiddenByPrivacy, setFriendsHiddenByPrivacy] = useState(false);
  const [allAchievements, setAllAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [achievementsHiddenByPrivacy, setAchievementsHiddenByPrivacy] = useState(false);

  // === Overlays ===
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showLevelDetail, setShowLevelDetail] = useState(false);
  const [showFriendActions, setShowFriendActions] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [friendActionError, setFriendActionError] = useState(null);

  // === Refs ===
  const tabsContainerRef = useRef(null);
  const tabRefs = useRef({});
  const scrollContainerRef = useRef(null);
  const viewSentRef = useRef(false);
  const profileLoadedForUidRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Owner detection (использует isSameUser, корректно работает для VK/Email pseudo_tid)
  // ---------------------------------------------------------------------------
  const isOwner = useMemo(() => {
    if (!profile || !currentUser) return false;
    return isSameUser(currentUser, { uid: profile.uid, telegram_id: profile.telegram_id });
  }, [profile, currentUser]);

  // ---------------------------------------------------------------------------
  // OWNER REDIRECT (Choice 1.b): авто-редирект на / с авто-открытием ProfileScreen
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOwner) {
      navigate('/?openProfile=1', { replace: true });
    }
  }, [isOwner, navigate]);

  // ---------------------------------------------------------------------------
  // Загрузка основного профиля по UID
  // ---------------------------------------------------------------------------
  const loadProfile = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const base = getBackendURL();
      const resp = await axios.get(`${base}/api/u/${encodeURIComponent(uid)}`);
      setProfile(resp.data);
      profileLoadedForUidRef.current = uid;
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 404) {
        setError({ kind: 'not_found', message: 'Профиль не найден' });
      } else if (status === 422) {
        setError({ kind: 'not_configured', message: detail || 'Профиль ещё не настроен' });
      } else if (status === 403) {
        setError({ kind: 'hidden', message: detail || 'Профиль скрыт владельцем' });
      } else {
        setError({ kind: 'generic', message: 'Не удалось загрузить профиль' });
      }
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    profileLoadedForUidRef.current = null;
    viewSentRef.current = false;
    setActiveTab('general');
    setFriendsList([]);
    setUserAchievements([]);
    setAllAchievements([]);
    setHeaderGraffitiUrl(null);
    setCustomAvatar(null);
    setImgLoaded(false);
    setTgPhotoOk(true);
    setFriendsHiddenByPrivacy(false);
    setAchievementsHiddenByPrivacy(false);
    loadProfile();
  }, [uid, loadProfile]);

  // ---------------------------------------------------------------------------
  // Регистрация просмотра (1 раз на UID, debounced)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!profile || !currentUser?.id || isOwner || viewSentRef.current) return;
    viewSentRef.current = true;
    const base = getBackendURL();
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      axios.post(
        `${base}/api/u/${encodeURIComponent(uid)}/view`,
        { viewer_telegram_id: currentUser.id },
        { signal: ctrl.signal },
      ).catch(() => {});
    }, 800);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [profile, currentUser?.id, isOwner, uid]);

  // ---------------------------------------------------------------------------
  // Загрузка кастомного аватара и header-граффити (по UID — privacy-safe)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!profile || isOwner) return;
    let cancelled = false;
    (async () => {
      const [av, gr] = await Promise.all([
        friendsAPI.getPublicAvatarByUid(uid),
        friendsAPI.getPublicGraffitiByUid(uid),
      ]);
      if (cancelled) return;
      if (av?.avatar_data) setCustomAvatar(av.avatar_data);
      if (gr?.graffiti_data) setHeaderGraffitiUrl(gr.graffiti_data);
    })();
    return () => { cancelled = true; };
  }, [profile, isOwner, uid]);

  // ---------------------------------------------------------------------------
  // Друзья (lazy при переключении на таб)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'friends' || !profile) return;
    // Если фронт уже знает что friends_list_hidden — не дёргаем сеть
    if (profile.friends_list_hidden && !isOwner) {
      setFriendsHiddenByPrivacy(true);
      setFriendsList([]);
      return;
    }
    setFriendsLoading(true);
    friendsAPI.getPublicFriendsByUid(uid)
      .then(data => {
        const list = Array.isArray(data?.friends) ? data.friends : [];
        setFriendsList(list);
        // Если backend вернул пустой список но privacy_hidden — показываем плашку
        setFriendsHiddenByPrivacy(
          list.length === 0 && profile.friends_list_hidden && !isOwner,
        );
      })
      .catch(() => setFriendsList([]))
      .finally(() => setFriendsLoading(false));
  }, [activeTab, profile, uid, isOwner]);

  // ---------------------------------------------------------------------------
  // Достижения (lazy при переключении на таб)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'achievements' || !profile) return;
    setAchievementsLoading(true);
    friendsAPI.getPublicAchievementsByUid(uid)
      .then(data => {
        setAllAchievements(Array.isArray(data?.all) ? data.all : []);
        setUserAchievements(Array.isArray(data?.earned) ? data.earned : []);
        setAchievementsHiddenByPrivacy(!!data?.hidden && !isOwner);
      })
      .catch(() => {})
      .finally(() => setAchievementsLoading(false));
  }, [activeTab, profile, uid, isOwner]);

  // ---------------------------------------------------------------------------
  // QR
  // ---------------------------------------------------------------------------
  const loadQR = useCallback(async () => {
    if (!uid) return;
    setQrLoading(true);
    try {
      const base = getBackendURL();
      const resp = await axios.get(`${base}/api/u/${encodeURIComponent(uid)}/qr`);
      setQrData(resp.data);
    } catch {
      setQrData(null);
    } finally {
      setQrLoading(false);
    }
  }, [uid]);

  const handleQRClick = () => {
    if (!qrData) loadQR();
    setShowQR(true);
  };

  // ---------------------------------------------------------------------------
  // Share
  // ---------------------------------------------------------------------------
  const profileUrl = useMemo(() => buildProfileUrl(uid), [uid]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = profileUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleShare = async () => {
    const title = profile
      ? `${[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || 'Профиль'} в RUDN App`
      : 'Профиль RUDN App';
    if (navigator.share) {
      try {
        await navigator.share({ title, url: profileUrl });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    setShowShareSheet(true);
  };

  // ---------------------------------------------------------------------------
  // Действия дружбы (Choice 2.a — полная функциональность на публичной странице)
  // ---------------------------------------------------------------------------
  const refreshAfterFriendAction = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const handleSendFriendRequest = async () => {
    if (!currentUser?.id || !profile?.telegram_id) return;
    setFriendActionLoading(true); setFriendActionError(null);
    try {
      await friendsAPI.sendFriendRequest(currentUser.id, profile.telegram_id);
      await refreshAfterFriendAction();
    } catch (e) {
      setFriendActionError(e?.message || 'Не удалось отправить заявку');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!currentUser?.id || !profile?.telegram_id) return;
    if (!window.confirm('Удалить из друзей?')) return;
    setFriendActionLoading(true); setFriendActionError(null);
    try {
      await friendsAPI.removeFriend(currentUser.id, profile.telegram_id);
      await refreshAfterFriendAction();
      setShowFriendActions(false);
    } catch (e) {
      setFriendActionError(e?.message || 'Не удалось удалить из друзей');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!currentUser?.id || !profile?.telegram_id) return;
    if (!window.confirm('Заблокировать пользователя? Вы больше не будете видеть друг друга.')) return;
    setFriendActionLoading(true); setFriendActionError(null);
    try {
      await friendsAPI.blockUser(currentUser.id, profile.telegram_id);
      // После блока — назад
      navigate(-1);
    } catch (e) {
      setFriendActionError(e?.message || 'Не удалось заблокировать');
    } finally {
      setFriendActionLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Back navigation (надёжный, работает в iframe TG WebApp)
  // ---------------------------------------------------------------------------
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Login redirect (с возвратом на текущий профиль)
  // ---------------------------------------------------------------------------
  const handleLogin = () => {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?returnTo=${returnTo}`);
  };

  // ===========================================================================
  // Производные значения для рендера
  // ===========================================================================
  const displayName = profile
    ? (profile.username || profile.first_name || `User ${profile.uid}`).toUpperCase()
    : '';
  const fullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    : '';
  const initial = (
    profile?.first_name?.[0]
    || profile?.username?.[0]
    || (profile?.uid ? String(profile.uid)[0] : '?')
  ).toUpperCase();

  const showOnline = profile && !profile.online_status_hidden;
  const isOnline = !!profile?.is_online;
  const lastSeenLabel = !isOnline ? formatLastSeen(profile?.last_activity) : null;

  const tier = profile?.tier || 'base';
  const tc = getTierConfig(tier);
  const isHighTier = tier === 'legend' || tier === 'premium';
  const starCount = Math.min(profile?.stars || 0, 4);
  const xpProg = profile?.xp_progress ?? 0;

  const tgPhotoUrl = useMemo(
    () => (profile?.telegram_id ? buildTelegramPhotoUrl(profile.telegram_id) : null),
    [profile?.telegram_id],
  );
  const avatarSrc = customAvatar || (tgPhotoOk ? tgPhotoUrl : null);

  const friendsCount = profile?.friends_count ?? 0;
  const totalPoints = profile?.total_points ?? 0;
  const showAchievementsStat = !profile?.achievements_hidden;

  const friendshipStatus = profile?.friendship_status; // 'friend' | 'pending_outgoing' | 'pending_incoming' | null

  // ===========================================================================
  // RENDER: Loading / Error / Page
  // ===========================================================================

  if (loading) {
    return <PublicProfileSkeleton onBack={handleBack} />;
  }

  if (error) {
    return <PublicProfileError error={error} onBack={handleBack} onLogin={!isAuthenticated ? handleLogin : null} />;
  }

  if (!profile) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ backgroundColor: '#000000', overscrollBehavior: 'contain' }}
    >
      {/* ============== Верхняя панель ============== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.25 }}
        className="flex items-center justify-between px-4"
        style={{
          paddingTop: 'calc(var(--header-safe-padding, 0px) + 16px)',
          paddingBottom: '8px',
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <button onClick={handleBack} aria-label="Назад">
          <ChevronLeft style={{ width: '31px', height: '31px', color: 'rgba(255,255,255,0.7)' }} />
        </button>

        <div className="flex items-center gap-3">
          <button onClick={handleQRClick} aria-label="QR-код">
            <QrCode style={{ width: '24px', height: '24px', color: 'rgba(255,255,255,0.7)' }} />
          </button>
          <button onClick={handleShare} aria-label="Поделиться">
            <Share2 style={{ width: '22px', height: '22px', color: 'rgba(255,255,255,0.7)' }} />
          </button>
          {/* Действия зависят от статуса дружбы */}
          {isAuthenticated ? (
            <FriendshipButton
              status={friendshipStatus}
              loading={friendActionLoading}
              onSendRequest={handleSendFriendRequest}
              onMore={() => setShowFriendActions(true)}
            />
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center gap-1.5 px-3"
              style={{
                height: '32px',
                borderRadius: '16px',
                background: 'rgba(248,185,76,0.12)',
                border: '1px solid rgba(248,185,76,0.25)',
                color: '#F8B94C',
                fontSize: '12.5px',
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
              }}
              aria-label="Войти"
            >
              <LogIn style={{ width: '14px', height: '14px' }} />
              Войти
            </button>
          )}
        </div>
      </motion.div>

      {friendActionError && (
        <div style={{
          margin: '0 16px 8px', padding: '8px 12px', borderRadius: '10px',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#FCA5A5', fontSize: '12px', fontFamily: "'Poppins', sans-serif",
        }}>
          {friendActionError}
        </div>
      )}

      {/* ============== Скроллируемый контейнер ============== */}
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        {/* ===== ШАПКА с граффити-фоном ===== */}
        <div style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden',
          paddingBottom: '18px',
        }}>
          {headerGraffitiUrl && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              opacity: 0.55,
              pointerEvents: 'none',
            }}>
              <img
                src={headerGraffitiUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: 'linear-gradient(to top, #000000, transparent)',
              }} />
            </div>
          )}

          {/* Аватар */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260, delay: 0.08 }}
            style={{ marginTop: '12px', position: 'relative', zIndex: 1 }}
          >
            <div
              className="overflow-hidden relative"
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '44px',
                border: '3px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 0 60px rgba(255, 255, 255, 0.06)',
              }}
            >
              {/* Fallback initials gradient */}
              <div
                className="absolute inset-0 flex items-center justify-center text-4xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#FFFFFF',
                }}
              >
                {initial}
              </div>

              {avatarSrc && (
                <img
                  src={avatarSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
                  referrerPolicy="no-referrer"
                  onLoad={() => setImgLoaded(true)}
                  onError={() => {
                    if (avatarSrc === tgPhotoUrl) setTgPhotoOk(false);
                  }}
                />
              )}
            </div>
          </motion.div>

          {/* Online + Level pills */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="flex items-center"
            style={{ marginTop: '12px', gap: '16px', position: 'relative', zIndex: 1 }}
          >
            {showOnline ? (
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                }}
                title={lastSeenLabel ? `Был(а) ${lastSeenLabel}` : undefined}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isOnline ? '#4ADE80' : '#EF4444',
                    boxShadow: isOnline ? '0 0 6px rgba(74, 222, 128, 0.5)' : '0 0 6px rgba(239, 68, 68, 0.5)',
                  }}
                />
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '12px',
                  color: '#FFFFFF',
                }}>
                  {isOnline ? 'Online' : (lastSeenLabel || 'Offline')}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5"
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <EyeOff style={{ width: '12px', height: '12px', color: 'rgba(255,255,255,0.4)' }} />
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  Скрыто
                </span>
              </div>
            )}

            {/* Level pill — кликабельный для всех (детали уровня публичны) */}
            <div
              onClick={() => setShowLevelDetail(true)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '6px 14px',
                borderRadius: '20px',
                background: isHighTier ? tc.gradient : tc.color,
                animation: isHighTier ? 'levelPulse 2s ease-in-out infinite' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  pointerEvents: 'none', overflow: 'hidden', borderRadius: '20px',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-20%', left: '-50%',
                    width: '45%', height: '140%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    animation: 'badgeShimmer 2.8s ease-in-out infinite',
                    animationDelay: '0.5s',
                  }} />
                </div>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 700,
                  fontSize: '12px',
                  color: '#1c1c1c',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  LV. {profile.level ?? 1}
                </span>
                {starCount > 0 && (
                  <span style={{ display: 'inline-flex', gap: '1px', position: 'relative', zIndex: 1 }}>
                    {Array.from({ length: starCount }).map((_, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.12, type: 'spring', stiffness: 400, damping: 12 }}
                        style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: '10px',
                          color: '#1c1c1c',
                          display: 'inline-block',
                          animation: `starTwinkle ${1.8 + i * 0.2}s ease-in-out infinite`,
                          animationDelay: `${1 + i * 0.3}s`,
                        }}
                      >★</motion.span>
                    ))}
                  </span>
                )}
              </div>
              <div style={{
                width: '80%',
                height: '3px',
                borderRadius: '2px',
                backgroundColor: 'rgba(255, 255, 255, 0.10)',
                marginTop: '4px',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.max(xpProg * 100, 2)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                  style={{
                    height: '100%',
                    borderRadius: '2px',
                    background: tc.gradient,
                    boxShadow: `0 0 6px ${tc.color}55`,
                    animation: 'xpBarGlow 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Большое имя */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            style={{
              marginTop: '8px',
              fontFamily: "'Proxima Nova ExCn', sans-serif",
              fontWeight: 800,
              fontSize: '47px',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1.1,
              position: 'relative',
              zIndex: 1,
              padding: '0 16px',
              wordBreak: 'break-word',
            }}
          >
            {displayName}
          </motion.div>

          {fullName && fullName !== displayName && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.22, duration: 0.3 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '14px',
                color: 'rgba(255,255,255,0.55)',
                textAlign: 'center',
                marginTop: '2px',
                position: 'relative',
                zIndex: 1,
                padding: '0 16px',
              }}
            >
              {fullName}
            </motion.div>
          )}

          {/* Группа + streak */}
          {profile.group_name && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              style={{
                marginTop: '6px',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                color: '#FF4E9D',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {profile.group_name}
              {(profile.visit_streak_current ?? 0) > 0 && (
                <>
                  <Trophy style={{ width: '14.5px', height: '14.5px', color: '#FFB54E', marginLeft: '8px', flexShrink: 0 }} />
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '14.5px',
                    color: '#FFB54E',
                    marginLeft: '3px',
                  }}>
                    🔥{profile.visit_streak_current}
                  </span>
                </>
              )}
            </motion.div>
          )}

          {/* 3-колонка: Друзья / Тир / $RDN */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="flex items-start justify-center"
            style={{ marginTop: '10px', gap: '40px', position: 'relative', zIndex: 1 }}
          >
            {/* Друзей */}
            <div className="flex flex-col items-center">
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '21px',
                color: profile.friends_list_hidden ? 'rgba(255,255,255,0.4)' : '#FFBE4E',
                lineHeight: 1.2,
              }}>
                {profile.friends_list_hidden ? '—' : friendsCount}
              </span>
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '14px',
                color: '#FFFFFF',
                marginTop: '2px',
              }}>
                {pluralizeFriends(friendsCount)}
              </span>
            </div>

            {/* Уровень/Тир */}
            <div
              className="flex flex-col items-center"
              onClick={() => setShowLevelDetail(true)}
              style={{ cursor: 'pointer' }}
            >
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '24px',
                lineHeight: 1.2,
                ...(isHighTier ? {
                  background: tc.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                } : { color: tc.color }),
              }}>
                {tc.nameRu}
              </span>
              {starCount > 0 && (
                <div style={{ display: 'flex', gap: '2px', marginTop: '1px' }}>
                  {Array.from({ length: starCount }).map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 350, damping: 14 }}
                      style={{
                        fontSize: '12px',
                        color: tc.color,
                        display: 'inline-block',
                        animation: `starTwinkle ${2 + i * 0.25}s ease-in-out infinite`,
                        animationDelay: `${1.5 + i * 0.4}s`,
                        filter: `drop-shadow(0 0 2px ${tc.color}66)`,
                      }}
                    >★</motion.span>
                  ))}
                </div>
              )}
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '14px',
                color: '#FFFFFF',
                marginTop: '2px',
              }}>
                Уровень
              </span>
              <div style={{
                width: '52px',
                height: '3px',
                borderRadius: '2px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                marginTop: '4px',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.max(xpProg * 100, 2)}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
                  style={{
                    height: '100%',
                    borderRadius: '2px',
                    background: tc.gradient,
                    boxShadow: `0 0 4px ${tc.color}44`,
                    animation: 'xpBarGlow 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>

            {/* $RDN */}
            <div className="flex flex-col items-center">
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '21px',
                color: showAchievementsStat ? '#FFBE4E' : 'rgba(255,255,255,0.4)',
                lineHeight: 1.2,
              }}>
                {showAchievementsStat ? totalPoints : '—'}
              </span>
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '14px',
                color: '#FFFFFF',
                marginTop: '2px',
              }}>
                $RDN
              </span>
            </div>
          </motion.div>
        </div>
        {/* ===== КОНЕЦ ШАПКИ ===== */}

        {/* Табы */}
        <div
          ref={tabsContainerRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            padding: '15px 20px',
            backgroundColor: '#000000',
            width: '100%',
            flexShrink: 0,
            minHeight: '56px',
            scrollBehavior: 'smooth',
          }}
          className="scrollbar-hide"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              onClick={() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
                }
                setActiveTab(tab.id);
                const btn = tabRefs.current[tab.id];
                const container = tabsContainerRef.current;
                if (btn && container) {
                  const btnRect = btn.getBoundingClientRect();
                  const containerRect = container.getBoundingClientRect();
                  const target = container.scrollLeft + (btnRect.left - containerRect.left) - (containerRect.width / 2) + (btnRect.width / 2);
                  container.scrollTo({ left: target, behavior: 'smooth' });
                }
              }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '15px',
                color: activeTab === tab.id ? '#F8B94C' : '#88888B',
                background: activeTab === tab.id ? 'rgba(248, 185, 76, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: activeTab === tab.id ? '1px solid rgba(248, 185, 76, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                padding: '10px 22px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.25s ease',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент табов */}
        <div style={{ width: '100%', padding: '16px 20px 100px' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}
              >
                {/* Bio */}
                {profile.bio && (
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 500,
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      О себе
                    </div>
                    <div style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 400,
                      fontSize: '14px',
                      color: '#F4F3FC',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {profile.bio}
                    </div>
                  </div>
                )}

                {/* Faculty */}
                {profile.facultet_name && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '10px',
                      background: 'rgba(248,185,76,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Trophy style={{ width: '16px', height: '16px', color: '#F8B94C' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 400,
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                      }}>
                        Факультет{profile.kurs ? ` · ${profile.kurs} курс` : ''}
                      </div>
                      <div style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 500,
                        fontSize: '13px',
                        color: '#F4F3FC',
                        lineHeight: 1.3,
                        marginTop: '2px',
                      }}>
                        {profile.facultet_name}
                      </div>
                    </div>
                  </div>
                )}

                {/* Стена граффити (read-only для не-владельца, write-mode только если access enabled) */}
                <WallGraffiti
                  user={currentUser}
                  profileOwnerId={profile.telegram_id}
                  hapticFeedback={null}
                />
              </motion.div>
            )}

            {activeTab === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {friendsLoading ? (
                  <SpinnerInline />
                ) : friendsHiddenByPrivacy ? (
                  <PrivacyHiddenBlock
                    icon={<Users style={{ width: '32px', height: '32px', color: 'rgba(255,255,255,0.2)' }} />}
                    title="Список друзей скрыт"
                    subtitle="Владелец профиля скрыл свой список друзей"
                  />
                ) : friendsList.length > 0 ? (
                  friendsList.map((friend) => (
                    <FriendRow
                      key={friend.telegram_id}
                      friend={friend}
                      onClick={() => {
                        // Перейти на страницу профиля друга
                        const targetUid = String(friend.uid || friend.telegram_id);
                        navigate(`/u/${targetUid}`);
                      }}
                    />
                  ))
                ) : (
                  <PrivacyHiddenBlock
                    icon={<Users style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.15)' }} />}
                    title="Пока нет друзей"
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'achievements' && (
              <motion.div
                key="achievements"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {achievementsLoading ? (
                  <SpinnerInline />
                ) : achievementsHiddenByPrivacy ? (
                  <PrivacyHiddenBlock
                    icon={<Trophy style={{ width: '32px', height: '32px', color: 'rgba(255,255,255,0.2)' }} />}
                    title="Достижения скрыты"
                    subtitle="Владелец профиля скрыл свои достижения"
                  />
                ) : (
                  <AchievementsBlock
                    allAchievements={allAchievements}
                    userAchievements={userAchievements}
                    totalPoints={totalPoints}
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'materials' && (
              <motion.div
                key="materials"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <PrivacyHiddenBlock
                  icon={<Sliders style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.15)' }} />}
                  title="Скоро появится"
                  subtitle="Учебные материалы, заметки и файлы"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Свечение внизу */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '300px',
        background: 'linear-gradient(180deg, rgba(248, 185, 76, 0) 0%, rgba(248, 185, 76, 0.30) 100%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ============== Overlays ============== */}
      <AnimatePresence>
        {showQR && (
          <QROverlay
            qrData={qrData}
            qrLoading={qrLoading}
            profileUrl={profileUrl}
            displayName={displayName}
            initial={initial}
            avatarSrc={avatarSrc}
            onClose={() => setShowQR(false)}
            onCopy={copyLink}
            copied={copiedLink}
          />
        )}

        {showShareSheet && (
          <ShareSheet
            url={profileUrl}
            onClose={() => setShowShareSheet(false)}
            onCopy={copyLink}
            copied={copiedLink}
          />
        )}

        {showLevelDetail && (
          <LevelDetailModal
            isOpen={showLevelDetail}
            onClose={() => setShowLevelDetail(false)}
            levelData={{
              level: profile.level || 1,
              tier: profile.tier || 'base',
              xp: profile.xp || 0,
              xp_progress: profile.xp_progress || 0,
              xp_current_level: profile.xp_current_level || 0,
              xp_next_level: profile.xp_next_level || 100,
              stars: profile.stars || 0,
              level_title: profile.level_title || '',
              total_points: profile.total_points || 0,
            }}
            telegramId={isOwner ? profile.telegram_id : null}
          />
        )}

        {showFriendActions && (
          <FriendActionsSheet
            friendshipStatus={friendshipStatus}
            displayName={displayName}
            loading={friendActionLoading}
            onClose={() => setShowFriendActions(false)}
            onRemoveFriend={handleRemoveFriend}
            onBlock={handleBlock}
            onOpenChat={() => {
              // TODO: open chat — пока редирект на главную, чат поднимется через FriendProfileModal
              setShowFriendActions(false);
              navigate('/');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const FriendshipButton = ({ status, loading, onSendRequest, onMore }) => {
  if (loading) {
    return (
      <button disabled aria-label="Загрузка" style={iconBtnStyle()}>
        <Loader2 style={{ width: '20px', height: '20px', color: 'rgba(255,255,255,0.5)', animation: 'spin 0.8s linear infinite' }} />
      </button>
    );
  }
  if (status === 'friend') {
    return (
      <button onClick={onMore} aria-label="Действия" style={iconBtnStyle('rgba(74,222,128,0.18)', 'rgba(74,222,128,0.35)')}>
        <UserCheck style={{ width: '18px', height: '18px', color: '#4ADE80' }} />
      </button>
    );
  }
  if (status === 'pending_outgoing') {
    return (
      <button onClick={onMore} aria-label="Заявка отправлена" style={iconBtnStyle('rgba(168,85,247,0.18)', 'rgba(168,85,247,0.35)')}>
        <Clock style={{ width: '18px', height: '18px', color: '#C084FC' }} />
      </button>
    );
  }
  if (status === 'pending_incoming') {
    return (
      <button onClick={onMore} aria-label="Входящая заявка" style={iconBtnStyle('rgba(248,185,76,0.18)', 'rgba(248,185,76,0.35)')}>
        <UserPlus style={{ width: '18px', height: '18px', color: '#F8B94C' }} />
      </button>
    );
  }
  return (
    <button onClick={onSendRequest} aria-label="Добавить в друзья" style={iconBtnStyle('rgba(248,185,76,0.18)', 'rgba(248,185,76,0.35)')}>
      <UserPlus style={{ width: '18px', height: '18px', color: '#F8B94C' }} />
    </button>
  );
};

const iconBtnStyle = (bg = 'rgba(255,255,255,0.06)', border = 'rgba(255,255,255,0.1)') => ({
  width: '34px',
  height: '34px',
  borderRadius: '12px',
  background: bg,
  border: `1px solid ${border}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
});

const SpinnerInline = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
    <div style={{
      width: '32px',
      height: '32px',
      border: '2px solid rgba(248,185,76,0.3)',
      borderTopColor: '#F8B94C',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  </div>
);

const PrivacyHiddenBlock = ({ icon, title, subtitle }) => (
  <div style={{ padding: '40px 16px', textAlign: 'center' }}>
    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
    <div style={{
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 600,
      fontSize: '15px',
      color: 'rgba(255,255,255,0.5)',
    }}>
      {title}
    </div>
    {subtitle && (
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 400,
        fontSize: '12px',
        color: 'rgba(255,255,255,0.3)',
        marginTop: '4px',
        maxWidth: '280px',
        margin: '4px auto 0',
      }}>
        {subtitle}
      </div>
    )}
  </div>
);

const FriendRow = ({ friend, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: '12px 16px',
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
  >
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '14px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {friend.photo_url ? (
        <img src={friend.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
          {(friend.first_name?.[0] || friend.username?.[0] || '?').toUpperCase()}
        </span>
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 600,
        fontSize: '14px',
        color: '#F4F3FC',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {[friend.first_name, friend.last_name].filter(Boolean).join(' ') || friend.username || 'Пользователь'}
      </span>
      {friend.group_name && (
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 400,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.35)',
        }}>
          {friend.group_name}
        </span>
      )}
    </div>
    {friend.is_online && (
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#4ADE80',
        boxShadow: '0 0 6px rgba(74,222,128,0.5)',
        flexShrink: 0,
      }} />
    )}
  </div>
);

const AchievementsBlock = ({ allAchievements, userAchievements, totalPoints }) => {
  const earnedIds = new Set(userAchievements.map(ua => ua.achievement?.id));
  const sorted = [...allAchievements].sort((a, b) => {
    const ae = earnedIds.has(a.id) ? 1 : 0;
    const be = earnedIds.has(b.id) ? 1 : 0;
    if (ae !== be) return be - ae;
    return a.points - b.points;
  });

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
        <div style={{
          flex: 1,
          background: 'linear-gradient(135deg, rgba(248,185,76,0.1) 0%, rgba(248,185,76,0.04) 100%)',
          borderRadius: '16px',
          padding: '14px',
          border: '1px solid rgba(248,185,76,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Star style={{ width: '14px', height: '14px', color: '#F8B94C' }} />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Очки</span>
          </div>
          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#F4F3FC' }}>
            {totalPoints || 0}
          </span>
        </div>
        <div style={{
          flex: 1,
          background: 'linear-gradient(135deg, rgba(163,247,191,0.1) 0%, rgba(163,247,191,0.04) 100%)',
          borderRadius: '16px',
          padding: '14px',
          border: '1px solid rgba(163,247,191,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Trophy style={{ width: '14px', height: '14px', color: '#A3F7BF' }} />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Получено</span>
          </div>
          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#F4F3FC' }}>
            {userAchievements.length}/{allAchievements.length}
          </span>
        </div>
      </div>

      {sorted.map((ach) => {
        const earned = userAchievements.find(ua => ua.achievement?.id === ach.id);
        const isEarned = !!earned;
        return (
          <div
            key={ach.id}
            style={{
              padding: '14px 16px',
              borderRadius: '16px',
              background: isEarned
                ? 'linear-gradient(135deg, rgba(163,247,191,0.08) 0%, rgba(248,185,76,0.06) 100%)'
                : 'rgba(255,255,255,0.03)',
              border: isEarned
                ? '1px solid rgba(163,247,191,0.2)'
                : '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <div style={{
              fontSize: '32px',
              lineHeight: 1,
              flexShrink: 0,
              opacity: isEarned ? 1 : 0.3,
              filter: isEarned ? 'none' : 'grayscale(1)',
            }}>
              {ach.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isEarned ? '#F4F3FC' : 'rgba(255,255,255,0.35)',
                }}>
                  {ach.name}
                </span>
                {!isEarned && <Lock style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />}
              </div>
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 400,
                fontSize: '12px',
                color: isEarned ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                display: 'block',
                marginBottom: '6px',
              }}>
                {ach.description}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star style={{ width: '13px', height: '13px', color: isEarned ? '#F8B94C' : 'rgba(255,255,255,0.2)' }} />
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '12px',
                    color: isEarned ? '#F8B94C' : 'rgba(255,255,255,0.2)',
                  }}>
                    {ach.points} $RDN
                  </span>
                </div>
                {isEarned && earned.earned_at && (
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 400,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.3)',
                  }}>
                    {new Date(earned.earned_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {allAchievements.length === 0 && (
        <PrivacyHiddenBlock
          icon={<Trophy style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.15)' }} />}
          title="Достижения загружаются..."
        />
      )}
    </>
  );
};

const QROverlay = ({ qrData, qrLoading, profileUrl, displayName, initial, avatarSrc, onClose, onCopy, copied }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="fixed inset-0 z-[250] flex items-center justify-center"
    style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#1C1C1C',
        borderRadius: '24px',
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        position: 'relative',
        minWidth: '300px',
        maxWidth: '340px',
      }}
    >
      <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
        <X style={{ width: '20px', height: '20px', color: '#888' }} />
      </button>
      <div style={{
        background: '#fff',
        padding: '12px',
        borderRadius: '16px',
        position: 'relative',
        minWidth: '236px',
        minHeight: '236px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {qrLoading ? (
          <Loader2 style={{ width: '32px', height: '32px', color: '#1C1C1C', animation: 'spin 0.8s linear infinite' }} />
        ) : (
          <QRCodeSVG
            value={qrData?.share_url || profileUrl}
            size={212}
            level="H"
            includeMargin={false}
            imageSettings={avatarSrc ? {
              src: avatarSrc,
              height: 44,
              width: 44,
              excavate: true,
            } : undefined}
          />
        )}
      </div>
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 700,
        fontSize: '15px',
        color: '#F4F3FC',
        textAlign: 'center',
      }}>
        {displayName}
      </div>
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 400,
        fontSize: '11px',
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        wordBreak: 'break-all',
      }}>
        {profileUrl}
      </div>
      <button
        onClick={onCopy}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '14px',
          background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(248,185,76,0.15)',
          border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(248,185,76,0.3)'}`,
          color: copied ? '#4ADE80' : '#F8B94C',
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {copied ? <Check style={{ width: '16px', height: '16px' }} /> : <Copy style={{ width: '16px', height: '16px' }} />}
        {copied ? 'Скопировано' : 'Копировать ссылку'}
      </button>
    </motion.div>
  </motion.div>
);

const ShareSheet = ({ url, onClose, onCopy, copied }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[260] flex items-end justify-center"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: '500px',
        background: '#1C1C1C',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '20px 20px calc(env(safe-area-inset-bottom, 12px) + 16px)',
      }}
    >
      <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 700,
        fontSize: '16px',
        color: '#F4F3FC',
        marginBottom: '14px',
      }}>
        Поделиться профилем
      </div>
      <div style={{
        padding: '12px 14px',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        marginBottom: '12px',
        fontFamily: "'Poppins', sans-serif",
        fontSize: '12px',
        color: 'rgba(255,255,255,0.7)',
        wordBreak: 'break-all',
      }}>
        {url}
      </div>
      <button
        onClick={onCopy}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(248,185,76,0.15)',
          border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(248,185,76,0.3)'}`,
          color: copied ? '#4ADE80' : '#F8B94C',
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {copied ? <Check style={{ width: '16px', height: '16px' }} /> : <Copy style={{ width: '16px', height: '16px' }} />}
        {copied ? 'Скопировано' : 'Копировать ссылку'}
      </button>
    </motion.div>
  </motion.div>
);

const FriendActionsSheet = ({ friendshipStatus, displayName, loading, onClose, onRemoveFriend, onBlock, onOpenChat }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[260] flex items-end justify-center"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: '500px',
        background: '#1C1C1C',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '20px 20px calc(env(safe-area-inset-bottom, 12px) + 16px)',
      }}
    >
      <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 700,
        fontSize: '15px',
        color: '#F4F3FC',
        marginBottom: '14px',
        textAlign: 'center',
      }}>
        {displayName}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {friendshipStatus === 'friend' && (
          <ActionRow
            icon={<MessageCircle style={{ width: '18px', height: '18px', color: '#3B82F6' }} />}
            label="Написать"
            onClick={onOpenChat}
            disabled={loading}
          />
        )}

        {friendshipStatus === 'friend' && (
          <ActionRow
            icon={<UserX style={{ width: '18px', height: '18px', color: '#F8B94C' }} />}
            label="Удалить из друзей"
            onClick={onRemoveFriend}
            disabled={loading}
          />
        )}

        <ActionRow
          icon={<ShieldX style={{ width: '18px', height: '18px', color: '#EF4444' }} />}
          label="Заблокировать"
          onClick={onBlock}
          disabled={loading}
          danger
        />

        <button
          onClick={onClose}
          disabled={loading}
          style={{
            marginTop: '6px',
            padding: '14px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Отмена
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const ActionRow = ({ icon, label, onClick, disabled, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '100%',
      padding: '14px 16px',
      borderRadius: '14px',
      background: danger ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
      color: danger ? '#FCA5A5' : '#F4F3FC',
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 500,
      fontSize: '14px',
      cursor: disabled ? 'wait' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'background 0.15s ease',
    }}
  >
    {icon}
    {label}
  </button>
);

// =============================================================================
// Skeleton & Error
// =============================================================================

const PublicProfileSkeleton = ({ onBack }) => (
  <div className="fixed inset-0 z-[200] flex flex-col" style={{ backgroundColor: '#000000' }}>
    <div className="flex items-center justify-between px-4" style={{
      paddingTop: 'calc(var(--header-safe-padding, 0px) + 16px)',
      paddingBottom: '8px',
    }}>
      <button onClick={onBack}>
        <ChevronLeft style={{ width: '31px', height: '31px', color: 'rgba(255,255,255,0.7)' }} />
      </button>
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 16px' }}>
      <SkelBlock w={140} h={140} r={44} />
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <SkelBlock w={84} h={28} r={14} />
        <SkelBlock w={84} h={28} r={14} />
      </div>
      <SkelBlock w={220} h={42} r={8} mt={12} />
      <SkelBlock w={140} h={18} r={6} mt={8} />
      <div style={{ display: 'flex', gap: 36, marginTop: 14 }}>
        <SkelBlock w={56} h={48} r={8} />
        <SkelBlock w={72} h={48} r={8} />
        <SkelBlock w={56} h={48} r={8} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 24, width: '100%', maxWidth: 360, paddingLeft: 8, overflow: 'hidden' }}>
        {[0, 1, 2, 3].map(i => <SkelBlock key={i} w={86} h={36} r={14} />)}
      </div>
      <div style={{ width: '100%', maxWidth: 380, marginTop: 16 }}>
        <SkelBlock w={'100%'} h={120} r={16} />
      </div>
    </div>
  </div>
);

const SkelBlock = ({ w, h, r, mt }) => (
  <div style={{
    width: w,
    height: h,
    borderRadius: r,
    marginTop: mt || 0,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
    backgroundSize: '200% 100%',
    animation: 'skelShimmer 1.4s ease-in-out infinite',
  }} />
);

const PublicProfileError = ({ error, onBack, onLogin }) => {
  const cfg = {
    not_found: { title: 'Профиль не найден', subtitle: 'Возможно, ссылка неверна или профиль был удалён.', icon: '🔍' },
    not_configured: { title: 'Профиль ещё не настроен', subtitle: 'Владелец ещё не завершил настройку публичной страницы.', icon: '⚙️' },
    hidden: { title: 'Профиль скрыт', subtitle: 'Владелец сделал свой профиль приватным.', icon: '🔒' },
    generic: { title: 'Не удалось загрузить', subtitle: 'Проверьте соединение и попробуйте снова.', icon: '⚠️' },
  }[error.kind] || { title: 'Ошибка', subtitle: error.message, icon: '⚠️' };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ backgroundColor: '#000000' }}>
      <div className="flex items-center justify-between px-4" style={{
        paddingTop: 'calc(var(--header-safe-padding, 0px) + 16px)',
        paddingBottom: '8px',
      }}>
        <button onClick={onBack}>
          <ChevronLeft style={{ width: '31px', height: '31px', color: 'rgba(255,255,255,0.7)' }} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>{cfg.icon}</div>
        <h2 style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 700,
          fontSize: '20px',
          color: '#F4F3FC',
          marginBottom: '8px',
        }}>
          {cfg.title}
        </h2>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 400,
          fontSize: '14px',
          color: 'rgba(255,255,255,0.5)',
          maxWidth: '320px',
          lineHeight: 1.5,
          marginBottom: '24px',
        }}>
          {cfg.subtitle}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '12px 22px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#F4F3FC',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Назад
          </button>
          {onLogin && (
            <button
              onClick={onLogin}
              style={{
                padding: '12px 22px',
                borderRadius: '14px',
                background: 'rgba(248,185,76,0.15)',
                border: '1px solid rgba(248,185,76,0.3)',
                color: '#F8B94C',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogIn style={{ width: '14px', height: '14px' }} />
              Войти
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProfilePage;
