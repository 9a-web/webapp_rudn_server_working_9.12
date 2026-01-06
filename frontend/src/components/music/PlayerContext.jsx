import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  // Создаем Audio объект сразу (не в useEffect) для избежания race condition
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState(null);

  // Инициализация Audio элемента и установка громкости
  useEffect(() => {
    if (!audioRef.current && typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
    }
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Воспроизведение трека
  const play = useCallback((track, trackList = []) => {
    console.log('🎵 Play called:', { track: track?.title, hasUrl: !!track?.url });
    setError(null);
    
    // Создаем audio если его нет
    if (!audioRef.current && typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    
    if (!audioRef.current) {
      console.error('❌ Audio API not available');
      setError('Audio не поддерживается');
      return;
    }
    
    // Telegram haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (trackList.length > 0) {
      setQueue(trackList);
      const index = trackList.findIndex(t => t.id === track.id);
      setQueueIndex(index >= 0 ? index : 0);
    }
    
    setCurrentTrack(track);
    
    if (track.url) {
      console.log('🔗 Setting audio src:', track.url.substring(0, 80) + '...');
      
      // Останавливаем текущее воспроизведение
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Устанавливаем новый источник
      audioRef.current.src = track.url;
      audioRef.current.load(); // Явно загружаем аудио
      
      // Воспроизводим
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('✅ Playback started successfully');
            setIsPlaying(true);
            setError(null);
          })
          .catch(err => {
            console.error('❌ Play error:', err.name, err.message);
            setIsPlaying(false);
            
            // Обработка различных ошибок
            if (err.name === 'NotAllowedError') {
              setError('Нажмите еще раз для воспроизведения');
            } else if (err.name === 'NotSupportedError') {
              setError('Формат не поддерживается');
            } else if (err.name === 'AbortError') {
              // Игнорируем - это нормально при быстром переключении треков
              console.log('⚠️ Playback aborted (normal during quick track changes)');
            } else {
              setError('Ошибка воспроизведения');
            }
          });
      }
    } else {
      console.error('❌ Track has no URL:', track);
      setError('Трек недоступен');
    }
  }, [volume]);

  // Пауза
  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  // Переключение play/pause
  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (isPlaying) {
      pause();
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Toggle play error:', err));
    }
  }, [isPlaying, pause]);

  // Следующий трек
  const next = useCallback(() => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (queue.length > 0 && queueIndex < queue.length - 1) {
      const nextTrack = queue[queueIndex + 1];
      setQueueIndex(queueIndex + 1);
      setCurrentTrack(nextTrack);
      
      if (audioRef.current && nextTrack.url) {
        audioRef.current.src = nextTrack.url;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error('Next track error:', err));
      }
    }
  }, [queue, queueIndex]);

  // Предыдущий трек
  const prev = useCallback(() => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (queue.length > 0 && queueIndex > 0) {
      const prevTrack = queue[queueIndex - 1];
      setQueueIndex(queueIndex - 1);
      setCurrentTrack(prevTrack);
      
      if (audioRef.current && prevTrack.url) {
        audioRef.current.src = prevTrack.url;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error('Prev track error:', err));
      }
    }
  }, [queue, queueIndex]);

  // Перемотка
  const seek = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setProgress(time);
  }, []);

  // Изменение громкости
  const changeVolume = useCallback((newVolume) => {
    if (!audioRef.current) return;
    const vol = Math.max(0, Math.min(1, newVolume));
    audioRef.current.volume = vol;
    setVolume(vol);
  }, []);

  // Audio события
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      // Автоматически играть следующий трек
      if (queue.length > 0 && queueIndex < queue.length - 1) {
        next();
      } else {
        setIsPlaying(false);
      }
    };
    const onError = (e) => {
      console.error('❌ Audio error event:', {
        code: audio.error?.code,
        message: audio.error?.message,
        src: audio.src?.substring(0, 80)
      });
      setIsPlaying(false);
      
      // Более детальная обработка ошибок
      if (audio.error) {
        switch (audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            setError('Загрузка прервана');
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            setError('Ошибка сети');
            break;
          case MediaError.MEDIA_ERR_DECODE:
            setError('Ошибка декодирования');
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            setError('Формат не поддерживается');
            break;
          default:
            setError('Ошибка воспроизведения');
        }
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [next, queue, queueIndex]);

  const value = {
    currentTrack,
    isPlaying,
    progress,
    duration,
    queue,
    queueIndex,
    volume,
    error,
    play,
    pause,
    toggle,
    next,
    prev,
    seek,
    changeVolume,
    setQueue,
    clearError: () => setError(null),
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export default PlayerContext;
