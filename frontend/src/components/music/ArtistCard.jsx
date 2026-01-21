import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Music2, Play, Loader2 } from 'lucide-react';
import { musicAPI } from '../../services/musicAPI';
import { usePlayer } from './PlayerContext';
import { TrackCover } from './TrackCover';

/**
 * ArtistCard - модальное окно с треками артиста
 * Открывается при клике на имя артиста в TrackCard/FullscreenPlayer/MiniPlayer
 */
export const ArtistCard = ({ 
  isOpen, 
  onClose, 
  artistName 
}) => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { currentTrack, isPlaying, play, toggle } = usePlayer();
  
  // Motion value для свайпа вниз
  const dragY = useMotionValue(0);
  const backgroundOpacity = useTransform(dragY, [0, 300], [1, 0.3]);
  const scale = useTransform(dragY, [0, 300], [1, 0.95]);
  const [isDragging, setIsDragging] = useState(false);

  // Загрузка треков артиста
  const loadArtistTracks = useCallback(async () => {
    if (!artistName) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await musicAPI.getArtistTracks(artistName, 50);
      setTracks(data.tracks || []);
    } catch (err) {
      console.error('Failed to load artist tracks:', err);
      setError('Не удалось загрузить треки');
    } finally {
      setLoading(false);
    }
  }, [artistName]);

  // Загрузка при открытии
  useEffect(() => {
    if (isOpen && artistName) {
      loadArtistTracks();
    }
  }, [isOpen, artistName, loadArtistTracks]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setTracks([]);
      setError(null);
    }
  }, [isOpen]);

  // Форматирование длительности
  const formatDuration = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Воспроизведение трека
  const handlePlayTrack = (track) => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (currentTrack?.id === track.id) {
      toggle();
    } else {
      play(track, tracks);
    }
  };

  // Закрытие модалки
  const handleClose = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    onClose();
  };

  // Обработка свайпа вниз
  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    
    // Закрыть если свайп > 100px или скорость > 500
    if (info.offset.y > 100 || info.velocity.y > 500) {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
      onClose();
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  // Воспроизвести все треки
  const handlePlayAll = () => {
    if (tracks.length > 0) {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
      play(tracks[0], tracks);
    }
  };

  if (!artistName) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            style={{ 
              y: dragY,
              scale: isDragging ? scale : 1,
              backgroundColor: 'rgba(20, 20, 22, 0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-3xl overflow-hidden touch-none"
          >
            {/* Drag handle */}
            <div className="sticky top-0 z-10 pt-3 pb-2 bg-inherit">
              <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />
              
              {/* Header */}
              <div className="px-5 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Artist avatar */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Music2 className="w-7 h-7 text-white" />
                  </div>
                  
                  <div>
                    <h2 className="text-xl font-bold text-white">{artistName}</h2>
                    <p className="text-sm text-white/60">
                      {loading ? 'Загрузка...' : `${tracks.length} треков`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Play all button */}
              {tracks.length > 0 && (
                <div className="px-5 pb-4">
                  <button
                    onClick={handlePlayAll}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-purple-500/30"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Воспроизвести все
                  </button>
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-white/10" />
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-180px)] pb-safe">
              {/* Loading state */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                  <p className="text-white/60">Загрузка треков...</p>
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <div className="flex flex-col items-center justify-center py-16 px-5">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-white/60 text-center">{error}</p>
                  <button
                    onClick={loadArtistTracks}
                    className="mt-4 px-6 py-2 bg-white/10 rounded-xl text-white font-medium active:scale-95 transition-transform"
                  >
                    Попробовать снова
                  </button>
                </div>
              )}

              {/* Tracks list */}
              {!loading && !error && tracks.length > 0 && (
                <div className="px-3 py-2">
                  {tracks.map((track, index) => {
                    const isCurrentTrack = currentTrack?.id === track.id;
                    const isCurrentlyPlaying = isCurrentTrack && isPlaying;
                    const isBlocked = track.is_blocked === true;

                    return (
                      <motion.div
                        key={track.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: isBlocked ? 0.5 : 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => !isBlocked && handlePlayTrack(track)}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isBlocked
                            ? 'bg-white/5 cursor-not-allowed'
                            : isCurrentTrack
                              ? 'bg-purple-500/20 border border-purple-500/30 cursor-pointer'
                              : 'hover:bg-white/5 cursor-pointer active:bg-white/10'
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
                          
                          {/* Play indicator */}
                          {isCurrentlyPlaying && !isBlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                              <div className="flex gap-0.5">
                                <span className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Track info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate text-sm ${
                            isCurrentTrack ? 'text-purple-400' : 'text-white'
                          }`}>
                            {track.title}
                          </p>
                          <p className="text-xs text-white/50 truncate">
                            {isBlocked ? 'Заблокировано' : track.artist}
                          </p>
                        </div>

                        {/* Duration */}
                        <span className="text-white/40 text-xs">
                          {formatDuration(track.duration)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && tracks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <Music2 className="w-8 h-8 text-white/40" />
                  </div>
                  <p className="text-white/60">Треки не найдены</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ArtistCard;
