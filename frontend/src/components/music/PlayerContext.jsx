import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { musicAPI } from '../../services/musicAPI';

const PlayerContext = createContext();

/**
 * Генерация обложки из градиента на основе названия трека
 * Возвращает data URL для использования в Media Session
 */
const generateGradientCover = (artist, title) => {
  const str = `${artist || ''}${title || ''}`;
  
  // Простой хеш для генерации цветов
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Палитра градиентов (hex цвета)
  const gradients = [
    ['#a855f7', '#ec4899'], // purple to pink
    ['#3b82f6', '#a855f7'], // blue to purple
    ['#22c55e', '#14b8a6'], // green to teal
    ['#f97316', '#ef4444'], // orange to red
    ['#ec4899', '#f43f5e'], // pink to rose
    ['#06b6d4', '#3b82f6'], // cyan to blue
    ['#8b5cf6', '#a855f7'], // violet to purple
    ['#f59e0b', '#f97316'], // amber to orange
    ['#10b981', '#22c55e'], // emerald to green
    ['#d946ef', '#ec4899'], // fuchsia to pink
    ['#6366f1', '#8b5cf6'], // indigo to violet
    ['#f43f5e', '#ef4444'], // rose to red
  ];
  
  const index = Math.abs(hash) % gradients.length;
  const [color1, color2] = gradients[index];
  
  // Создаем canvas с градиентом
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Градиент
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  
  // Добавляем музыкальную ноту в центре
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 200px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♪', 256, 256);
  
  // Декоративные круги
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.arc(100, 100, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(420, 400, 40, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toDataURL('image/png');
};

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
  
  // Кэш для сгенерированных обложек
  const coverCacheRef = useRef({});

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
   * Обновление Media Session метаданных (Lock Screen плеер)
   * Показывает обложку, название, исполнителя и кнопки управления
   */
  const updateMediaSession = useCallback((track) => {
    if (!('mediaSession' in navigator)) {
      console.log('⚠️ Media Session API not supported');
      return;
    }

    // Получаем или генерируем обложку
    let artworkUrl = track.cover;
    
    if (!artworkUrl) {
      // Генерируем обложку из градиента (с кэшированием)
      const cacheKey = `${track.artist || ''}_${track.title || ''}`;
      if (!coverCacheRef.current[cacheKey]) {
        coverCacheRef.current[cacheKey] = generateGradientCover(track.artist, track.title);
      }
      artworkUrl = coverCacheRef.current[cacheKey];
    }

    // Устанавливаем метаданные
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Неизвестный трек',
      artist: track.artist || 'Неизвестный исполнитель',
      album: track.album || '',
      artwork: [
        { src: artworkUrl, sizes: '96x96', type: 'image/png' },
        { src: artworkUrl, sizes: '128x128', type: 'image/png' },
        { src: artworkUrl, sizes: '192x192', type: 'image/png' },
        { src: artworkUrl, sizes: '256x256', type: 'image/png' },
        { src: artworkUrl, sizes: '384x384', type: 'image/png' },
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
      ]
    });

    console.log('🎵 Media Session updated:', track.title, '-', track.artist);
  }, []);

  /**
   * Обновление позиции воспроизведения в Media Session
   */
  const updateMediaSessionPositionState = useCallback(() => {
    if (!('mediaSession' in navigator) || !audioRef.current) return;
    
    try {
      if ('setPositionState' in navigator.mediaSession && duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: audioRef.current.playbackRate || 1,
          position: progress
        });
      }
    } catch (e) {
      // Игнорируем ошибки позиции
    }
  }, [duration, progress]);

  /**
   * Сброс позиции Media Session при смене трека
   * Вызывается в начале воспроизведения нового трека
   */
  const resetMediaSessionPositionState = useCallback((newDuration = 0) => {
    if (!('mediaSession' in navigator)) return;
    
    try {
      if ('setPositionState' in navigator.mediaSession) {
        if (newDuration > 0) {
          navigator.mediaSession.setPositionState({
            duration: newDuration,
            playbackRate: 1,
            position: 0
          });
        } else {
          // Сбрасываем состояние позиции (iOS/Android покажут индикатор загрузки)
          navigator.mediaSession.setPositionState(null);
        }
        console.log('🎵 Media Session position reset, duration:', newDuration);
      }
    } catch (e) {
      // Игнорируем ошибки - некоторые браузеры не поддерживают setPositionState(null)
      console.log('⚠️ Media Session position reset failed:', e.message);
    }
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
    
    // Обновляем Media Session (Lock Screen плеер)
    updateMediaSession(track);
    
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
  }, [volume, getTrackUrl, updateMediaSession]);

  // Пауза
  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  // Полная остановка и закрытие плеера
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsLoading(false);
    setProgress(0);
    setDuration(0);
    setQueue([]);
    setQueueIndex(0);
    setError(null);
    
    // Очищаем Media Session
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
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

  // Media Session обработчики (кнопки на Lock Screen)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    // Обработчик Play
    navigator.mediaSession.setActionHandler('play', () => {
      console.log('🎵 Media Session: play');
      if (audioRef.current && currentTrack) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error('Media Session play error:', err));
      }
    });

    // Обработчик Pause
    navigator.mediaSession.setActionHandler('pause', () => {
      console.log('🎵 Media Session: pause');
      pause();
    });

    // Обработчик Previous Track (кнопка ⏮)
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      console.log('🎵 Media Session: previoustrack');
      if (queue.length > 0 && queueIndex > 0) {
        prev();
      }
    });

    // Обработчик Next Track (кнопка ⏭)
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      console.log('🎵 Media Session: nexttrack');
      if (queue.length > 0 && queueIndex < queue.length - 1) {
        next();
      }
    });

    // Обработчик Seek To (перемотка)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      console.log('🎵 Media Session: seekto', details.seekTime);
      if (audioRef.current && details.seekTime !== undefined) {
        seek(details.seekTime);
      }
    });

    // Обработчик Stop
    navigator.mediaSession.setActionHandler('stop', () => {
      console.log('🎵 Media Session: stop');
      pause();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setProgress(0);
    });

    return () => {
      // Очистка обработчиков при размонтировании
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.setActionHandler('stop', null);
      }
    };
  }, [currentTrack, pause, prev, next, seek, queue, queueIndex]);

  // Обновление состояния воспроизведения в Media Session
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Периодическое обновление позиции в Media Session
  useEffect(() => {
    if (!isPlaying || !duration) return;
    
    const interval = setInterval(() => {
      updateMediaSessionPositionState();
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, duration, updateMediaSessionPositionState]);

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
    stop, // Полная остановка и закрытие плеера
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
