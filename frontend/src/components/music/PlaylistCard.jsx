import React from 'react';
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className="bg-white/5 rounded-xl p-3 cursor-pointer hover:bg-white/10 transition-all group"
    >
      {/* Cover */}
      <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
        {playlist.cover ? (
          <img 
            src={playlist.cover} 
            alt="" 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <ListMusic className="w-8 h-8 text-purple-400" />
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
