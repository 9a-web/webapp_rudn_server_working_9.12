import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { musicAPI } from '../../services/musicAPI';

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  // Создаем Audio объект сразу (не в useEffect) для избежания race condition
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Новое состояние загрузки
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

  /**
   * Получение прямой ссылки на трек
   * Если url уже есть (например, из избранного) - используем его
   * Иначе запрашиваем через API
   */
  const getTrackUrl = useCallback(async (track) => {
    // Если URL уже есть и он валидный - используем его
    if (track.url && track.url.startsWith('http')) {
      console.log('🔗 Using existing URL:', track.url.substring(0, 60) + '...');
      return track.url;
    }
    
    // Иначе запрашиваем через API
    console.log('🔄 Fetching stream URL for track:', track.id);
    try {
      const response = await musicAPI.getStreamUrl(track.id);
      console.log('✅ Got stream URL:', response.url?.substring(0, 60) + '...');
      return response.url;
    } catch (err) {
      console.error('❌ Failed to get stream URL:', err);
      throw err;
    }
  }, []);

  // Воспроизведение трека
  const play = useCallback(async (track, trackList = []) => {
    console.log('🎵 Play called:', { track: track?.title, hasUrl: !!track?.url });
    setError(null);
    setIsLoading(true);
    
    // Создаем audio если его нет
    if (!audioRef.current && typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    
    if (!audioRef.current) {
      console.error('❌ Audio API not available');
      setError('Audio не поддерживается');
      setIsLoading(false);
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
    
    try {
      // Получаем URL (из кэша трека или через API)
      const url = await getTrackUrl(track);
      
      if (!url) {
        console.error('❌ No URL available for track:', track.id);
        setError('Трек недоступен');
        setIsLoading(false);
        return;
      }
      
      console.log('🔗 Setting audio src:', url.substring(0, 80) + '...');
      
      // Останавливаем текущее воспроизведение
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Устанавливаем новый источник
      audioRef.current.src = url;
      audioRef.current.load(); // Явно загружаем аудио
      
      // Воспроизводим
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('✅ Playback started successfully');
            setIsPlaying(true);
            setIsLoading(false);
            setError(null);
            
            // Обновляем URL в треке для будущего использования
            track.url = url;
          })
          .catch(err => {
            console.error('❌ Play error:', err.name, err.message);
            setIsPlaying(false);
            setIsLoading(false);
            
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
    } catch (err) {
      console.error('❌ Error getting track URL:', err);
      setIsLoading(false);
      
      // Проверяем тип ошибки
      if (err.response?.status === 404) {
        setError('Трек заблокирован правообладателем');
      } else {
        setError('Не удалось загрузить трек');
      }
    }
  }, [volume, getTrackUrl]);

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
  const next = useCallback(async () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (queue.length > 0 && queueIndex < queue.length - 1) {
      const nextTrack = queue[queueIndex + 1];
      setQueueIndex(queueIndex + 1);
      
      // Используем play для загрузки URL
      await play(nextTrack, queue);
    }
  }, [queue, queueIndex, play]);

  // Предыдущий трек
  const prev = useCallback(async () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (queue.length > 0 && queueIndex > 0) {
      const prevTrack = queue[queueIndex - 1];
      setQueueIndex(queueIndex - 1);
      
      // Используем play для загрузки URL
      await play(prevTrack, queue);
    }
  }, [queue, queueIndex, play]);

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
      setIsLoading(false);
      
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
            setError('Трек недоступен');
            break;
          default:
            setError('Ошибка воспроизведения');
        }
      }
    };
    
    // Событие начала загрузки
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [next, queue, queueIndex]);

  const value = {
    currentTrack,
    isPlaying,
    isLoading, // Новое состояние
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
