import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Heart, Ban } from 'lucide-react';
import { usePlayer } from './PlayerContext';
import { TrackCover } from './TrackCover';

export const TrackCard = ({ 
  track, 
  trackList = [], 
  onFavorite, 
  isFavorite = false,
  showFavorite = true,
  onArtistClick
}) => {
  const { currentTrack, isPlaying, play, toggle } = usePlayer();
  const [isHovered, setIsHovered] = useState(false);

  const isCurrentTrack = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;
  
  // Проверка на заблокированный трек (is_blocked от backend или fallback на старые поля)
  const isBlocked = track.is_blocked === true || track.content_restricted === true || track.is_licensed === false;

  const formatDuration = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    
    // Не воспроизводить заблокированные треки
    if (isBlocked) {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
      return;
    }
    
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
      animate={{ opacity: isBlocked ? 0.5 : 1, y: 0 }}
      whileTap={{ scale: isBlocked ? 1 : 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handlePlay}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
        isBlocked
          ? 'bg-white/5 cursor-not-allowed'
          : isCurrentTrack 
            ? 'bg-purple-500/20 border border-purple-500/30 cursor-pointer' 
            : 'bg-white/5 hover:bg-white/10 cursor-pointer'
      }`}
    >
      {/* Cover */}
      <div className="relative w-12 h-12 flex-shrink-0">
        <TrackCover 
          cover={track.cover} 
          artist={track.artist} 
          title={track.title}
          size="md"
          className={`rounded-lg ${isBlocked ? 'grayscale' : ''}`}
        />
        
        {/* Blocked overlay */}
        {isBlocked ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
            <Ban className="w-5 h-5 text-red-400/80" />
          </div>
        ) : (
          /* Play/Pause overlay */
          <motion.div 
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered || isCurrentTrack ? 1 : 0 }}
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </motion.div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate text-sm ${
          isBlocked 
            ? 'text-white/50' 
            : isCurrentTrack 
              ? 'text-purple-400' 
              : 'text-white'
        }`}>
          {track.title}
        </p>
        {isBlocked ? (
          <p className="text-xs truncate text-red-400/60">
            Заблокировано правообладателем
          </p>
        ) : (
          <p 
            className="text-xs truncate text-white/60 hover:text-purple-400 cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (onArtistClick && track.artist) {
                if (window.Telegram?.WebApp?.HapticFeedback) {
                  window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                }
                onArtistClick(track.artist);
              }
            }}
          >
            {track.artist}
          </p>
        )}
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
