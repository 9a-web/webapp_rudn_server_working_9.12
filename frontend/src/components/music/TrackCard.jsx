import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Heart } from 'lucide-react';
import { usePlayer } from './PlayerContext';
import { TrackCover } from './TrackCover';

export const TrackCard = ({ 
  track, 
  trackList = [], 
  onFavorite, 
  isFavorite = false,
  showFavorite = true 
}) => {
  const { currentTrack, isPlaying, play, toggle } = usePlayer();
  const [isHovered, setIsHovered] = useState(false);

  const isCurrentTrack = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

  const formatDuration = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (isCurrentTrack) {
      toggle();
    } else {
      play(track, trackList);
    }
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    if (onFavorite) {
      onFavorite(track);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handlePlay}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
        isCurrentTrack 
          ? 'bg-purple-500/20 border border-purple-500/30' 
          : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {/* Cover */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        {track.cover ? (
          <img 
            src={track.cover} 
            alt="" 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <Music className="w-5 h-5 text-purple-400" />
          </div>
        )}
        
        {/* Play/Pause overlay */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered || isCurrentTrack ? 1 : 0 }}
        >
          {isCurrentlyPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </motion.div>
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate text-sm ${
          isCurrentTrack ? 'text-purple-400' : 'text-white'
        }`}>
          {track.title}
        </p>
        <p className="text-white/60 text-xs truncate">
          {track.artist}
        </p>
      </div>

      {/* Duration */}
      <span className="text-white/40 text-xs">
        {formatDuration(track.duration)}
      </span>

      {/* Favorite button */}
      {showFavorite && (
        <button
          onClick={handleFavorite}
          className={`p-2 transition-all active:scale-90 ${
            isFavorite 
              ? 'text-pink-500' 
              : 'text-white/30 hover:text-white/60'
          }`}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}
    </motion.div>
  );
};

export default TrackCard;
