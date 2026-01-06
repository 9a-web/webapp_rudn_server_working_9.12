import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { usePlayer } from './PlayerContext';
import { TrackCover } from './TrackCover';

export const MiniPlayer = ({ onExpand, onClose }) => {
  const { currentTrack, isPlaying, progress, duration, toggle, next, prev, pause } = usePlayer();

  if (!currentTrack) return null;

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const handleClose = (e) => {
    e.stopPropagation();
    pause();
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-3"
      >
        <div
          className="w-full max-w-[420px] rounded-2xl border border-white/10 p-3 relative overflow-hidden"
          style={{
            backgroundColor: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
          onClick={onExpand}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            {/* Cover/Icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0">
              {currentTrack.cover ? (
                <img 
                  src={currentTrack.cover} 
                  alt="cover" 
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <Music className="w-6 h-6 text-purple-400" />
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-medium truncate text-sm">
                {currentTrack.title}
              </p>
              <p className="text-white/60 text-xs truncate">
                {currentTrack.artist}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={prev} 
                className="p-2 text-white/60 hover:text-white active:scale-95 transition-all"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={toggle}
                className="p-2.5 bg-white rounded-full active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-black" />
                ) : (
                  <Play className="w-5 h-5 text-black ml-0.5" />
                )}
              </button>
              <button 
                onClick={next} 
                className="p-2 text-white/60 hover:text-white active:scale-95 transition-all"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Time & Close */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-white/40 w-10 text-right">
                {formatTime(progress)}
              </span>
              <button
                onClick={handleClose}
                className="p-1.5 text-white/40 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MiniPlayer;
