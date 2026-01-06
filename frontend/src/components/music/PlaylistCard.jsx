import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ListMusic, Play } from 'lucide-react';

export const PlaylistCard = ({ playlist, onClick }) => {
  const handleClick = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (onClick) {
      onClick(playlist);
    }
  };

  // Генерация уникального градиента для плейлиста
  const gradient = useMemo(() => {
    const str = playlist.title || '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const gradients = [
      'from-purple-600 via-purple-500 to-pink-500',
      'from-blue-600 via-blue-500 to-purple-500',
      'from-green-600 via-emerald-500 to-teal-500',
      'from-orange-600 via-orange-500 to-red-500',
      'from-pink-600 via-pink-500 to-rose-500',
      'from-cyan-600 via-cyan-500 to-blue-500',
      'from-violet-600 via-violet-500 to-purple-500',
      'from-amber-600 via-amber-500 to-orange-500',
      'from-indigo-600 via-indigo-500 to-violet-500',
      'from-fuchsia-600 via-fuchsia-500 to-pink-500',
    ];
    
    return gradients[Math.abs(hash) % gradients.length];
  }, [playlist.title]);

  // Получение первой буквы названия
  const initial = useMemo(() => {
    if (playlist.title && playlist.title.length > 0) {
      return playlist.title.charAt(0).toUpperCase();
    }
    return '♪';
  }, [playlist.title]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className="bg-white/5 rounded-xl p-3 cursor-pointer hover:bg-white/10 transition-all group"
    >
      {/* Cover */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
        {playlist.cover ? (
          <img 
            src={playlist.cover} 
            alt="" 
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            {/* Декоративные элементы */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-white/20" />
              <div className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-white/15" />
              <div className="absolute top-1/2 right-1/4 w-3 h-3 rounded-full bg-white/10" />
              <div className="absolute bottom-1/3 left-1/4 w-2 h-2 rounded-full bg-white/20" />
            </div>
            
            {/* Иконка и буква */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <span className="text-4xl font-bold text-white/90 drop-shadow-lg">
                {initial}
              </span>
              <ListMusic className="w-5 h-5 text-white/70" />
            </div>
            
            {/* Блик */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" />
          </div>
        )}
        
        {/* Play overlay */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <Play className="w-6 h-6 text-black ml-1" />
          </div>
        </motion.div>
      </div>

      {/* Info */}
      <h3 className="text-white font-medium text-sm truncate">
        {playlist.title}
      </h3>
      <p className="text-white/50 text-xs">
        {playlist.count} треков
      </p>
    </motion.div>
  );
};

export default PlaylistCard;
