/**
 * FriendCard - Карточка друга с красивым дизайном и анимациями
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronRight, Wifi } from 'lucide-react';

// Получение URL backend из env
const getBackendURL = () => {
  let envBackendUrl = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envBackendUrl = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || '';
    }
    if (!envBackendUrl && typeof process !== 'undefined' && process.env) {
      envBackendUrl = process.env.REACT_APP_BACKEND_URL || '';
    }
  } catch (e) { /* env not available */ }
  if (envBackendUrl && envBackendUrl.trim() !== '') return envBackendUrl;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8001';
  return window.location.origin;
};

// Русское склонение
const pluralFriends = (n) => {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return `${n} друзей`;
  if (n1 > 1 && n1 < 5) return `${n} друга`;
  if (n1 === 1) return `${n} друг`;
  return `${n} друзей`;
};

// Время "был в сети"
const getLastSeen = (lastActivity) => {
  if (!lastActivity) return '';
  const now = new Date();
  const last = new Date(lastActivity);
  const diffMs = now - last;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;
  return last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

// Генерация уникального градиента по ID
const getAvatarGradient = (id) => {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-indigo-500 to-blue-600',
    'from-fuchsia-500 to-pink-600',
    'from-cyan-500 to-blue-500',
  ];
  return gradients[Math.abs(id || 0) % gradients.length];
};

const FriendCard = ({ friend, onPress, onToggleFavorite, index = 0 }) => {
  const {
    telegram_id,
    first_name,
    last_name,
    username,
    group_name,
    facultet_name,
    is_online,
    is_favorite,
    mutual_friends_count,
    last_activity
  } = friend;

  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = `${getBackendURL()}/api/user-profile-photo-proxy/${telegram_id}`;

  const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || 'Пользователь';
  const initials = (first_name?.[0] || username?.[0] || '?').toUpperCase();

  useEffect(() => {
    setAvatarError(false);
  }, [telegram_id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl cursor-pointer"
      onClick={onPress}
    >
      {/* Glass card background */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.06] to-white/[0.02] backdrop-blur-xl" />
      <div className="absolute inset-0 border border-white/[0.08] rounded-2xl group-hover:border-purple-500/30 transition-all duration-300" />
      
      {/* Favorite glow effect */}
      {is_favorite && (
        <div className="absolute -top-8 -right-8 w-20 h-20 bg-yellow-500/10 rounded-full blur-2xl" />
      )}
      
      <div className="relative p-4 flex items-center gap-3.5">
        {/* Avatar with online indicator */}
        <div className="relative flex-shrink-0">
          <div className={`w-13 h-13 rounded-[18px] bg-gradient-to-br ${getAvatarGradient(telegram_id)} flex items-center justify-center text-white font-bold text-lg overflow-hidden shadow-lg`}
               style={{ width: '52px', height: '52px' }}>
            {!avatarError ? (
              <img 
                src={avatarUrl} 
                alt={displayName}
                className="w-full h-full object-cover"
                onError={() => setAvatarError(true)}
                loading="lazy"
              />
            ) : (
              <span className="drop-shadow-sm">{initials}</span>
            )}
          </div>
          
          {/* Online indicator with pulse */}
          {is_online && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <div className="w-4 h-4 bg-emerald-500 rounded-full border-[2.5px] border-gray-900 relative">
                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-40" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-[15px] text-white truncate leading-tight">
              {displayName}
            </h3>
            {is_favorite && (
              <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="currentColor" />
            )}
          </div>
          
          <p className="text-[13px] text-gray-400 truncate mt-0.5 leading-tight">
            {group_name || (username ? `@${username}` : '')}
          </p>
          
          <div className="flex items-center gap-2 mt-1">
            {is_online ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <Wifi className="w-3 h-3" />
                в сети
              </span>
            ) : last_activity ? (
              <span className="text-[11px] text-gray-500">
                {getLastSeen(last_activity)}
              </span>
            ) : null}
            
            {mutual_friends_count > 0 && (
              <>
                {(is_online || last_activity) && <span className="text-gray-600 text-[11px]">·</span>}
                <span className="text-[11px] text-purple-400/80">
                  {pluralFriends(mutual_friends_count)} общ.
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            className={`p-2 rounded-xl transition-all duration-200 ${
              is_favorite 
                ? 'bg-yellow-500/15 text-yellow-400' 
                : 'bg-white/[0.04] text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10'
            }`}
          >
            <Star className="w-[18px] h-[18px]" fill={is_favorite ? 'currentColor' : 'none'} />
          </motion.button>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
};

export default FriendCard;
