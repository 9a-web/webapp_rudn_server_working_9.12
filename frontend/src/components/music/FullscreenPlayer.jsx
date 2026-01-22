import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  Play, Pause, SkipBack, SkipForward, 
  ChevronDown, Volume2, VolumeX, 
  RotateCcw, RotateCw, Repeat, Shuffle,
  ListMusic
} from 'lucide-react';
import { usePlayer } from './PlayerContext';
import { TrackCover } from './TrackCover';

export const FullscreenPlayer = ({ isOpen, onClose, onArtistClick }) => {
  const { 
    currentTrack, 
    isPlaying, 
    isLoading,
    progress, 
    duration, 
    volume,
    queue,
    queueIndex,
    repeatMode,
    shuffle,
    toggle, 
    next, 
    prev, 
    seek, 
    changeVolume,
    toggleRepeat,
    toggleShuffle,
    error 
  } = usePlayer();

  const [showVolume, setShowVolume] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = useRef(null);
  const constraintsRef = useRef(null);
  
  // Motion value для отслеживания позиции свайпа
  const dragY = useMotionValue(0);
  
  // Трансформации для анимации при свайпе
  const backgroundOpacity = useTransform(dragY, [0, 300], [1, 0.3]);
  const scale = useTransform(dragY, [0, 300], [1, 0.92]);

  // Форматирование времени
  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  // Обработка клика по прогресс-бару
  const handleProgressClick = useCallback((e) => {
    if (!progressBarRef.current || !duration) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    
    seek(newTime);
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  }, [duration, seek]);

  // Обработка перетаскивания прогресс-бара
  const handleProgressDrag = useCallback((e, info) => {
    if (!progressBarRef.current || !duration) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    
    seek(newTime);
  }, [duration, seek]);

  // Перемотка на 10 секунд назад
  const seekBackward = useCallback(() => {
    const newTime = Math.max(0, progress - 10);
    seek(newTime);
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  }, [progress, seek]);

  // Перемотка на 10 секунд вперёд
  const seekForward = useCallback(() => {
    const newTime = Math.min(duration, progress + 10);
    seek(newTime);
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  }, [progress, duration, seek]);

  // Изменение громкости
  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    changeVolume(newVolume);
  }, [changeVolume]);

  // Закрытие плеера
  const handleClose = useCallback(() => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    onClose();
  }, [onClose]);

  // Обработка завершения свайпа вниз
  const handleDragEnd = useCallback((event, info) => {
    setIsDragging(false);
    
    // Порог для закрытия: смещение > 100px или скорость > 500
    const shouldClose = info.offset.y > 100 || info.velocity.y > 500;
    
    if (shouldClose) {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
      onClose();
    }
  }, [onClose]);

  // Начало свайпа
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  }, []);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={constraintsRef}
          initial={{ y: '100%' }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: '100%' }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{ 
            y: dragY,
            scale: isDragging ? scale : 1,
            backgroundColor: '#0a0a0b',
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 flex flex-col touch-none"
        >
          {/* Drag handle indicator - подсказка о свайпе */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
            <motion.div 
              className="w-10 h-1 bg-white/30 rounded-full"
              animate={{ opacity: isDragging ? 1 : 0.5 }}
            />
          </div>

          {/* Background gradient */}
          <motion.div 
            className="absolute inset-0"
            style={{
              opacity: isDragging ? backgroundOpacity : 0.6,
              background: 'radial-gradient(ellipse at 50% 0%, rgba(244, 114, 182, 0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(239, 68, 68, 0.2) 0%, transparent 40%)'
            }}
          />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between p-4 pt-safe">
            <button
              onClick={handleClose}
              className="p-2 text-white/60 hover:text-white active:scale-95 transition-all rounded-full hover:bg-white/10"
            >
              <ChevronDown className="w-7 h-7" />
            </button>
            
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider">Сейчас играет</p>
            </div>
            
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="p-2 text-white/60 hover:text-white active:scale-95 transition-all rounded-full hover:bg-white/10"
            >
              {volume === 0 ? (
                <VolumeX className="w-6 h-6" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Volume slider (if shown) */}
          <AnimatePresence>
            {showVolume && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative z-10 px-8 pb-4"
              >
                <div className="flex items-center gap-3">
                  <VolumeX className="w-4 h-4 text-white/40" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-white/20 cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgb(244, 114, 182) 0%, rgb(239, 68, 68) ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                  />
                  <Volume2 className="w-4 h-4 text-white/40" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main content */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-8">
            {/* Cover art */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="mb-8 relative"
            >
              {/* Glow effect behind cover */}
              <div 
                className="absolute inset-0 blur-3xl opacity-50 scale-110"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(236, 72, 153, 0.5) 100%)'
                }}
              />
              
              <TrackCover 
                cover={currentTrack.cover}
                artist={currentTrack.artist}
                title={currentTrack.title}
                size="xl"
                className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl shadow-2xl relative z-10"
              />
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl z-20">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </motion.div>

            {/* Track info */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8 w-full max-w-xs"
            >
              <h2 className="text-xl font-bold text-white truncate mb-1">
                {currentTrack.title}
              </h2>
              <p 
                className="text-white/60 truncate hover:text-purple-400 cursor-pointer transition-colors"
                onClick={() => {
                  if (onArtistClick && currentTrack.artist) {
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                    }
                    onArtistClick(currentTrack.artist);
                  }
                }}
              >
                {currentTrack.artist}
              </p>
              {error && (
                <p className="text-red-400 text-sm mt-2">{error}</p>
              )}
            </motion.div>

            {/* Progress bar */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="w-full max-w-xs mb-6"
            >
              <div 
                ref={progressBarRef}
                onClick={handleProgressClick}
                className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group"
              >
                {/* Progress fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{ width: `${progressPercent}%` }}
                />
                
                {/* Draggable thumb */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                  style={{ left: `calc(${progressPercent}% - 8px)` }}
                  drag="x"
                  dragConstraints={progressBarRef}
                  dragElastic={0}
                  onDrag={handleProgressDrag}
                  onDragStart={() => setIsSeeking(true)}
                  onDragEnd={() => setIsSeeking(false)}
                />
              </div>
              
              {/* Time labels */}
              <div className="flex justify-between mt-2">
                <span className="text-xs text-white/40">{formatTime(progress)}</span>
                <span className="text-xs text-white/40">{formatTime(duration)}</span>
              </div>
            </motion.div>

            {/* Controls */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-4"
            >
              {/* Shuffle */}
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-all active:scale-90 ${
                  shuffle 
                    ? 'text-purple-400' 
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Previous */}
              <button
                onClick={prev}
                disabled={queueIndex <= 0 && repeatMode !== 'queue'}
                className="p-3 text-white hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={toggle}
                disabled={isLoading}
                className="p-5 bg-white rounded-full shadow-lg shadow-white/25 hover:scale-105 active:scale-95 transition-all disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-8 h-8 border-3 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 text-black" />
                ) : (
                  <Play className="w-8 h-8 text-black ml-1" />
                )}
              </button>

              {/* Next */}
              <button
                onClick={next}
                disabled={(queue.length === 0 || queueIndex >= queue.length - 1) && repeatMode !== 'queue'}
                className="p-3 text-white hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              {/* Repeat */}
              <button
                onClick={toggleRepeat}
                className={`p-2 transition-all active:scale-90 relative ${
                  repeatMode !== 'off' 
                    ? 'text-purple-400' 
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Repeat className="w-5 h-5" />
                {repeatMode === 'track' && (
                  <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold text-purple-400">1</span>
                )}
              </button>
            </motion.div>

            {/* Repeat mode indicator */}
            {repeatMode !== 'off' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center"
              >
                <span className="text-xs text-purple-400/80 bg-purple-400/10 px-3 py-1 rounded-full">
                  {repeatMode === 'track' ? '🔂 Повтор трека' : '🔁 Повтор очереди'}
                </span>
              </motion.div>
            )}
          </div>

          {/* Queue indicator */}
          {queue.length > 1 && (
            <div className="relative z-10 pb-safe px-8 pb-6">
              <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                <ListMusic className="w-4 h-4" />
                <span>{queueIndex + 1} / {queue.length}</span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullscreenPlayer;
