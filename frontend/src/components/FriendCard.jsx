/**
 * FriendCard - Карточка друга в списке
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronRight } from 'lucide-react';

// Получение URL для фото профиля
const getBackendURL = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }
  return window.location.origin;
};

const FriendCard = ({ friend, onPress, onToggleFavorite }) => {
  const {
    telegram_id,
    first_name,
    last_name,
    username,
    group_name,
    facultet_name,
    is_online,
    is_favorite,
    mutual_friends_count
  } = friend;

  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = `${getBackendURL()}/api/user-profile-photo-proxy/${telegram_id}`;

  const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || 'Пользователь';
  const initials = (first_name?.[0] || username?.[0] || '?').toUpperCase();

  // Сброс ошибки при смене друга
  useEffect(() => {
    setAvatarError(false);
  }, [telegram_id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer"
      onClick={onPress}
    >
      <div className="flex items-center gap-3">
        {/* Аватар с индикатором онлайн */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
            {!avatarError ? (
              <img 
                src={avatarUrl} 
                alt={displayName}
                className="w-full h-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              initials
            )}
          </div>
          {is_online && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
          )}
        </div>

        {/* Информация */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white truncate">{displayName}</h3>
            {is_favorite && (
              <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" />
            )}
          </div>
          <p className="text-sm text-gray-400 truncate">
            {group_name || (username ? `@${username}` : '')}
          </p>
          {mutual_friends_count > 0 && (
            <p className="text-xs text-purple-400 mt-0.5">
              {mutual_friends_count} общих {mutual_friends_count === 1 ? 'друг' : 'друзей'}
            </p>
          )}
        </div>

        {/* Действия */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            className={`p-2 rounded-xl transition-colors ${
              is_favorite 
                ? 'bg-yellow-500/20 text-yellow-400' 
                : 'bg-white/5 text-gray-500 hover:text-yellow-400'
            }`}
          >
            <Star className="w-5 h-5" fill={is_favorite ? 'currentColor' : 'none'} />
          </button>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </div>
      </div>
    </motion.div>
  );
};

export default FriendCard;
