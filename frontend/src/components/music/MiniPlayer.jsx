import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, X, Repeat, Users, Sparkles } from 'lucide-react';
import { usePlayer } from './PlayerContext';
import { TrackCover } from './TrackCover';

export const MiniPlayer = ({ onExpand, isHidden = false, onArtistClick, onOpenListeningRoom }) => {
  const { currentTrack, isPlaying, isLoading, progress, duration, toggle, next, prev, stop, error, repeatMode, toggleRepeat } = usePlayer();
  
  // Состояние для промо-карточки
  const [showPromo, setShowPromo] = useState(false);
  const promoTimerRef = useRef(null);
  const lastPromoTrackRef = useRef(null);
  const promoShownCountRef = useRef(0);

  // Показываем промо-карточку рандомно при смене трека
  useEffect(() => {
    if (!currentTrack || !isPlaying) {
      // Скрываем промо при остановке
      if (showPromo) {
        setShowPromo(false);
      }
      return;
    }
    
    // Не показываем для того же трека
    if (lastPromoTrackRef.current === currentTrack.id) return;
    
    // Не показываем слишком часто (максимум 3 раза за сессию)
    if (promoShownCountRef.current >= 3) return;
    
    // Рандомный шанс показа (30%)
    const shouldShow = Math.random() < 0.3;
    
    if (shouldShow) {
      // Рандомная задержка от 2 до 8 секунд после начала трека
      const delay = 2000 + Math.random() * 6000;
      
      promoTimerRef.current = setTimeout(() => {
        setShowPromo(true);
        lastPromoTrackRef.current = currentTrack.id;
        promoShownCountRef.current += 1;
        
        // Автоматически скрываем через 10 секунд
        setTimeout(() => {
          setShowPromo(false);
        }, 10000);
      }, delay);
    }
    
    return () => {
      if (promoTimerRef.current) {
        clearTimeout(promoTimerRef.current);
      }
    };
  }, [currentTrack?.id, isPlaying, showPromo]);

  // Не рендерим если нет трека
  if (!currentTrack) return null;

  // Скрываем плеер при открытии модальных окон
  const shouldShow = !isHidden;

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const handleClose = (e) => {
    e.stopPropagation();
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    stop();
  };

  const handleExpand = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    if (onExpand) onExpand();
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="mini-player"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-3"
        >
        <div
          className="w-full max-w-[420px] rounded-2xl border border-white/10 p-3 relative overflow-hidden cursor-pointer"
          style={{
            backgroundColor: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
          onClick={handleExpand}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-pink-400 to-red-400"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            {/* Cover/Icon */}
            <TrackCover 
              cover={currentTrack.cover}
              artist={currentTrack.artist}
              title={currentTrack.title}
              size="md"
              className="rounded-xl"
            />

            {/* Track info */}
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-medium truncate text-sm">
                {currentTrack.title}
              </p>
              {error ? (
                <p className="text-red-400 text-xs truncate">
                  {error}
                </p>
              ) : (
                <p 
                  className="text-white/60 text-xs truncate hover:text-pink-400 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
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
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              {/* Repeat button - compact */}
              <button 
                onClick={toggleRepeat}
                className={`p-1.5 transition-all active:scale-95 relative ${
                  repeatMode !== 'off' 
                    ? 'text-pink-400' 
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Repeat className="w-4 h-4" />
                {repeatMode === 'track' && (
                  <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-pink-400">1</span>
                )}
              </button>
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
          
          {/* Promo Card - Listen Together */}
          <AnimatePresence>
            {showPromo && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="overflow-hidden"
              >
                <motion.button
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPromo(false);
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                    }
                    onOpenListeningRoom?.();
                  }}
                  className="w-full p-3 rounded-xl relative overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}
                >
                  {/* Animated background shimmer */}
                  <motion.div
                    className="absolute inset-0 opacity-30"
                    animate={{
                      background: [
                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                        'linear-gradient(90deg, transparent 100%, rgba(255,255,255,0.1) 150%, transparent 200%)'
                      ],
                      x: ['-100%', '100%']
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-purple-500/30">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium text-sm flex items-center gap-1.5">
                        Слушай вместе с друзьями
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      </p>
                      <p className="text-white/50 text-xs">
                        Синхронное прослушивание в реальном времени
                      </p>
                    </div>
                    <div className="text-purple-400 text-xs font-medium">
                      Открыть →
                    </div>
                  </div>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MiniPlayer;
