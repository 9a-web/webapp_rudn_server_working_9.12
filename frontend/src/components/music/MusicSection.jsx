import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Music, TrendingUp, ListMusic, Heart, Loader2, ChevronDown, UserPlus, CheckCircle2, Settings, Key, Link2, Radio, Users, Clock } from 'lucide-react';
import { Icon28LogoVkColor } from '@vkontakte/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { musicAPI } from '../../services/musicAPI';
import { TrackList } from './TrackList';
import { MusicSearch } from './MusicSearch';
import { PlaylistCard } from './PlaylistCard';
import { ArtistCard } from './ArtistCard';
import { usePlayer } from './PlayerContext';
import { VKAuthModal } from './VKAuthModal';
import ListeningRoomModal from './ListeningRoomModal';
import { SendTrackToFriendModal } from './SendTrackToFriendModal';

// Стили анимации пульсации
const pulseAnimation = {
  scale: [1, 1.02, 1],
  boxShadow: [
    '0 0 0 0 rgba(251, 146, 60, 0.4)',
    '0 0 0 12px rgba(251, 146, 60, 0)',
    '0 0 0 0 rgba(251, 146, 60, 0)'
  ]
};

// Анимация пульсации для иконки связи
const linkPulseAnimation = {
  scale: [1, 1.15, 1],
  opacity: [0.8, 1, 0.8]
};

export const MusicSection = ({ telegramId, onListeningRoomOpenChange, onSendTrackModalOpenChange, openListeningRoomRef, pendingListenInvite, onListenInviteHandled }) => {
  // По умолчанию открываем вкладку "Мои"
  const [activeTab, setActiveTab] = useState('my');
  const [welcomeImageLoaded, setWelcomeImageLoaded] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [artistCardOpen, setArtistCardOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const { play } = usePlayer();

  // VK Auth State
  const [vkAuthModalOpen, setVkAuthModalOpen] = useState(false);
  const [vkAuthStatus, setVkAuthStatus] = useState(null);
  const [checkingVkAuth, setCheckingVkAuth] = useState(true);
  
  // Listening Room State
  const [listeningRoomModalOpen, setListeningRoomModalOpen] = useState(false);
  const [activeListeningRoom, setActiveListeningRoom] = useState(null);
  const [pendingInviteCode, setPendingInviteCode] = useState(null);
  
  // Send to Friend State
  const [sendTrackModalOpen, setSendTrackModalOpen] = useState(false);
  const [trackToSend, setTrackToSend] = useState(null);
  
  // Expose openListeningRoom function via ref
  useEffect(() => {
    if (openListeningRoomRef) {
      openListeningRoomRef.current = () => setListeningRoomModalOpen(true);
    }
  }, [openListeningRoomRef]);
  
  // Уведомляем родительский компонент об изменении состояния модального окна
  useEffect(() => {
    onListeningRoomOpenChange?.(listeningRoomModalOpen);
  }, [listeningRoomModalOpen, onListeningRoomOpenChange]);

  // Уведомляем родительский компонент об изменении состояния модала отправки трека
  useEffect(() => {
    onSendTrackModalOpenChange?.(sendTrackModalOpen);
  }, [sendTrackModalOpen, onSendTrackModalOpenChange]);

  // Обработка приглашения в комнату прослушивания из чата
  useEffect(() => {
    if (pendingListenInvite) {
      setPendingInviteCode(pendingListenInvite);
      setListeningRoomModalOpen(true);
      onListenInviteHandled?.();
    }
  }, [pendingListenInvite, onListenInviteHandled]);

  // Используем useRef для offset чтобы избежать race conditions
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const TRACKS_PER_PAGE = 30;

  const tabs = [
    { id: 'search', icon: Search, label: 'Поиск' },
    { id: 'my', icon: Music, label: 'Мои' },
    { id: 'popular', icon: TrendingUp, label: 'Топ' },
    { id: 'playlists', icon: ListMusic, label: 'Плейлисты' },
    { id: 'favorites', icon: Heart, label: 'Избранное' },
    { id: 'history', icon: Clock, label: 'Недавние' },
  ];

  // Загрузка избранного при монтировании
  useEffect(() => {
    if (telegramId) {
      loadFavorites();
      checkVkAuthStatus();
    }
  }, [telegramId]);

  // Проверка статуса VK авторизации
  const checkVkAuthStatus = async () => {
    if (!telegramId) return;
    setCheckingVkAuth(true);
    try {
      const status = await musicAPI.getVKAuthStatus(telegramId);
      setVkAuthStatus(status);
    } catch (error) {
      console.error('Check VK auth status error:', error);
      setVkAuthStatus(null);
    } finally {
      setCheckingVkAuth(false);
    }
  };

  // Проверка подключен ли VK
  const isVkConnected = vkAuthStatus?.is_connected && vkAuthStatus?.token_valid && vkAuthStatus?.audio_access;

  // Загрузка контента при смене вкладки или изменении статуса VK
  useEffect(() => {
    // Не загружаем пока идёт проверка статуса VK для вкладки "Мои"
    if (activeTab === 'my' && checkingVkAuth) return;
    loadContent();
  }, [activeTab, isVkConnected, checkingVkAuth]);

  const loadFavorites = async () => {
    try {
      const result = await musicAPI.getFavorites(telegramId);
      setFavorites(result.tracks || []);
    } catch (error) {
      console.error('Load favorites error:', error);
    }
  };

  const loadContent = async (loadMore = false) => {
    if (activeTab === 'search') return;

    // Защита от двойного вызова при loadMore
    if (loadMore && loadingMoreRef.current) {
      return;
    }

    if (loadMore) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      setLoading(true);
      offsetRef.current = 0;
      setHasMore(false);
    }
    
    try {
      switch (activeTab) {
        case 'my': {
          // Загружаем треки ТОЛЬКО если VK подключен (персональный токен)
          // НЕ используем токен из .env
          if (!isVkConnected || !telegramId) {
            setTracks([]);
            setHasMore(false);
            break;
          }
          
          const currentOffset = loadMore ? offsetRef.current : 0;
          const my = await musicAPI.getMyVKAudio(telegramId, TRACKS_PER_PAGE, currentOffset);
          const newTracks = my.tracks || [];
          
          if (loadMore) {
            // Дедупликация по id трека
            setTracks(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const uniqueNewTracks = newTracks.filter(t => !existingIds.has(t.id));
              return [...prev, ...uniqueNewTracks];
            });
          } else {
            setTracks(newTracks);
          }
          
          setHasMore(my.has_more || newTracks.length === TRACKS_PER_PAGE);
          offsetRef.current = currentOffset + newTracks.length;
          break;
        }
        case 'popular': {
          const currentOffset = loadMore ? offsetRef.current : 0;
          const popular = await musicAPI.getPopular(TRACKS_PER_PAGE, currentOffset);
          const newTracks = popular.tracks || [];
          
          if (loadMore) {
            // Дедупликация по id трека
            setTracks(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const uniqueNewTracks = newTracks.filter(t => !existingIds.has(t.id));
              return [...prev, ...uniqueNewTracks];
            });
          } else {
            setTracks(newTracks);
          }
          
          setHasMore(popular.has_more || newTracks.length === TRACKS_PER_PAGE);
          offsetRef.current = currentOffset + newTracks.length;
          break;
        }
        case 'playlists': {
          // Пробуем персональный токен, fallback на общий
          try {
            const pl = await musicAPI.getPlaylistsVK(telegramId);
            setPlaylists(pl.playlists || []);
          } catch (vkErr) {
            console.warn('getPlaylistsVK failed, falling back:', vkErr.message);
            try {
              const pl = await musicAPI.getPlaylists();
              setPlaylists(pl.playlists || []);
            } catch (fallbackErr) {
              console.error('getPlaylists fallback also failed:', fallbackErr);
              setPlaylists([]);
            }
          }
          setHasMore(false);
          break;
        }
        case 'favorites': {
          // FIX: Получаем свежие данные и используем их напрямую
          try {
            const result = await musicAPI.getFavorites(telegramId);
            const freshFavorites = result.tracks || [];
            setFavorites(freshFavorites);
            setTracks(freshFavorites);
          } catch (favError) {
            console.error('Load favorites error:', favError);
            setTracks(favorites);
          }
          setHasMore(false);
          break;
        }
        case 'history': {
          try {
            const result = await musicAPI.getHistory(telegramId, 50);
            setTracks(result.tracks || []);
          } catch (histError) {
            console.error('Load history error:', histError);
            setTracks([]);
          }
          setHasMore(false);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error('Load content error:', error);
      if (!loadMore) {
        setTracks([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  };

  const handleLoadMore = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    loadContent(true);
  };

  const handleFavorite = async (track) => {
    if (!telegramId) return;

    const isFavorite = favorites.some(f => f.id === track.id);

    try {
      if (isFavorite) {
        await musicAPI.removeFavorite(telegramId, track.id);
        setFavorites(prev => prev.filter(f => f.id !== track.id));
      } else {
        await musicAPI.addFavorite(telegramId, track);
        setFavorites(prev => [...prev, track]);
      }
    } catch (error) {
      console.error('Favorite error:', error);
    }
  };

  const handlePlaylistClick = async (playlist) => {
    setSelectedPlaylist(playlist);
    setLoading(true);
    
    try {
      // Пробуем персональный токен пользователя
      const result = await musicAPI.getPlaylistTracksVK(
        telegramId,
        playlist.owner_id, 
        playlist.id,
        playlist.access_key || ''
      );
      setTracks(result.tracks || []);
    } catch (vkError) {
      console.warn('getPlaylistTracksVK failed, falling back:', vkError.message);
      // Fallback на общий эндпоинт (серверный токен)
      try {
        const result = await musicAPI.getPlaylistTracks(
          playlist.owner_id,
          playlist.id,
          playlist.access_key || ''
        );
        setTracks(result.tracks || []);
      } catch (fallbackError) {
        console.error('getPlaylistTracks fallback also failed:', fallbackError);
        setTracks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromPlaylist = () => {
    setSelectedPlaylist(null);
    setTracks([]);
    loadContent();
  };

  const handleTabChange = (tabId) => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    
    setSelectedPlaylist(null);
    setActiveTab(tabId);
  };

  // Открыть карточку артиста
  const handleArtistClick = useCallback((artistName) => {
    setSelectedArtist(artistName);
    setArtistCardOpen(true);
  }, []);

  // Закрыть карточку артиста
  const handleArtistCardClose = useCallback(() => {
    setArtistCardOpen(false);
    setSelectedArtist(null);
  }, []);

  // Обработка закрытия модального окна VK Auth
  const handleVkAuthModalClose = useCallback(() => {
    setVkAuthModalOpen(false);
    // Обновляем статус авторизации
    checkVkAuthStatus();
    // Если переключены на вкладку "Мои", перезагружаем контент
    if (activeTab === 'my') {
      loadContent();
    }
  }, [activeTab]);

  // Открыть модальное окно VK Auth
  const handleOpenVkAuth = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    setVkAuthModalOpen(true);
  };

  // Отправить трек другу
  const handleSendToFriend = useCallback((track) => {
    setTrackToSend(track);
    setSendTrackModalOpen(true);
  }, []);

  return (
    <div className="pb-36">
      {/* Компактная кнопка "Получить токен" - показывается на ВСЕХ вкладках КРОМЕ "Мои" и "Плейлисты" (если VK не подключен) */}
      {!checkingVkAuth && !isVkConnected && activeTab !== 'my' && activeTab !== 'playlists' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-2 mb-2"
        >
          <motion.button
            onClick={handleOpenVkAuth}
            animate={pulseAnimation}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-pink-400/20 to-orange-400/20 
                     border border-orange-400/30 hover:from-pink-400/30 hover:to-orange-400/30
                     transition-all flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-400">
              Получить токен для доступа к музыке
            </span>
          </motion.button>
        </motion.div>
      )}
      
      {/* Статус VK подключен - показывается на всех вкладках */}
      {!checkingVkAuth && isVkConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-2 mb-2"
        >
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">
                VK подключен • {vkAuthStatus?.audio_count || 0} треков
              </span>
            </div>
            <button
              onClick={handleOpenVkAuth}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Settings className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto overflow-y-visible scrollbar-hide -my-2 py-2">
        <div className="flex gap-2 px-4 py-2 w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-pink-400 to-red-400 text-white shadow-lg shadow-pink-500/25'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
              {/* Индикатор VK для вкладок "Мои" и "Плейлисты" */}
              {(tab.id === 'my' || tab.id === 'playlists') && isVkConnected && (
                <span className="relative flex items-center justify-center w-2 h-2">
                  {/* Один расходящийся круг */}
                  <span className="absolute w-2 h-2 rounded-full bg-green-400 animate-ping opacity-75" />
                  {/* Центральная точка */}
                  <span className="relative w-2 h-2 rounded-full bg-green-400" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected playlist header */}
      {selectedPlaylist && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 flex items-center gap-3"
        >
          <button
            onClick={handleBackFromPlaylist}
            className="text-pink-400 text-sm"
          >
            ← Назад
          </button>
          <span className="text-white font-medium truncate">
            {selectedPlaylist.title}
          </span>
        </motion.div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'search' && !selectedPlaylist ? (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <MusicSearch 
              favorites={favorites}
              onFavorite={handleFavorite}
              onArtistClick={handleArtistClick}
              onSendToFriend={handleSendToFriend}
              showSendToFriend={true}
            />
          </motion.div>
        ) : (activeTab === 'my' || activeTab === 'playlists') && !isVkConnected && !checkingVkAuth && !selectedPlaylist ? (
          /* Вкладка "Мои" или "Плейлисты" - крупная карточка по центру когда VK не подключен */
          <motion.div
            key="vk-not-connected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="music-welcome-card relative w-full md:max-w-2xl md:mx-auto lg:max-w-3xl rounded-2xl overflow-hidden"
            style={{ aspectRatio: 'auto', minHeight: '70vh', marginTop: '15px' }}
          >
            {/* Прелоадер пока изображение не загрузилось */}
            {!welcomeImageLoaded && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1c1c1e]">
                <div className="w-8 h-8 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
              </div>
            )}
            {/* Фоновое изображение: мобильное и десктопное */}
            <img 
              src="/music-welcome-owl-mobile.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover md:hidden"
              style={{ objectPosition: '58% center' }}
              onLoad={() => setWelcomeImageLoaded(true)}
            />
            <img 
              src="/music-welcome-owl.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover hidden md:block"
              style={{ objectPosition: '58% center' }}
              onLoad={() => setWelcomeImageLoaded(true)}
            />
            {/* Затемнение для читаемости текста */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Медиа-запрос: на md+ возвращаем aspect-ratio */}
            <style>{`
              @media (min-width: 768px) {
                .music-welcome-card { min-height: auto !important; aspect-ratio: 1536 / 1024 !important; }
                .music-welcome-content { justify-content: flex-start !important; padding-top: calc(3rem + 5px) !important; }
              }
            `}</style>
              
            <div className="music-welcome-content relative h-full flex flex-col items-center justify-end md:justify-center text-center space-y-4 sm:space-y-5 p-6 sm:p-8" style={{ paddingBottom: 'calc(2rem + 5px)' }}>
                {/* Логотипы VK и РУДН с иконкой связи */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <Icon28LogoVkColor width={48} height={48} className="sm:w-14 sm:h-14" />
                  <motion.div
                    animate={linkPulseAnimation}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Link2 className="w-6 h-6 sm:w-7 sm:h-7 text-green-400" />
                  </motion.div>
                  <img 
                    src="/retro-logo-rudn.png" 
                    alt="РУДН" 
                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                  />
                </div>
                
                {/* Заголовок */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    Добро пожаловать в Музыку
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-md mx-auto">
                    Для доступа к вашим аудиозаписям VK необходимо получить токен авторизации
                  </p>
                </div>
                
                {/* Кнопка с пульсацией */}
                <motion.button
                  onClick={handleOpenVkAuth}
                  animate={pulseAnimation}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-auto py-2.5 px-5 rounded-xl font-semibold text-white text-sm
                            bg-gradient-to-r from-pink-400 to-orange-400 
                            hover:from-pink-500 hover:to-orange-500
                            transition-all duration-300 flex items-center justify-center gap-2
                            shadow-lg shadow-orange-500/30"
                >
                  <Key className="w-4 h-4" />
                  <span>Получить токен</span>
                </motion.button>
                
                {/* Подсказка */}
                <p className="text-xs sm:text-sm text-white/50">
                  Нажмите, чтобы авторизоваться через VK
                </p>
              </div>
          </motion.div>
        ) : activeTab === 'playlists' && !selectedPlaylist ? (
          <motion.div
            key="playlists"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4">
                {playlists.map(playlist => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onClick={handlePlaylistClick}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={selectedPlaylist ? 'playlist-tracks' : activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TrackList
              tracks={activeTab === 'favorites' ? favorites : tracks}
              loading={loading}
              favorites={favorites}
              onFavorite={handleFavorite}
              onArtistClick={handleArtistClick}
              onSendToFriend={handleSendToFriend}
              showSendToFriend={true}
              emptyMessage={
                activeTab === 'favorites' 
                  ? 'Нет избранных треков' 
                  : activeTab === 'my'
                  ? (isVkConnected ? 'Нет аудиозаписей' : 'Получите токен для загрузки ваших треков')
                  : 'Треки не найдены'
              }
            />
            
            {/* Кнопка "Загрузить ещё" для разделов с пагинацией */}
            {(activeTab === 'my' || activeTab === 'popular') && !loading && tracks.length > 0 && hasMore && (
              <div className="px-4 pb-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 
                           border border-white/10 transition-all
                           flex items-center justify-center gap-2 text-white/70 hover:text-white"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Загрузка...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-5 h-5" />
                      <span>Загрузить ещё</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Artist Card Modal */}
      <ArtistCard
        isOpen={artistCardOpen}
        onClose={handleArtistCardClose}
        artistName={selectedArtist}
      />

      {/* VK Auth Modal */}
      <VKAuthModal
        isOpen={vkAuthModalOpen}
        onClose={handleVkAuthModalClose}
        telegramId={telegramId}
      />
      
      {/* Listening Room Modal */}
      <ListeningRoomModal
        isOpen={listeningRoomModalOpen}
        onClose={() => setListeningRoomModalOpen(false)}
        telegramId={telegramId}
        onActiveRoomChange={setActiveListeningRoom}
        pendingInviteCode={pendingInviteCode}
        onInviteHandled={() => setPendingInviteCode(null)}
      />
      
      {/* Send Track to Friend Modal */}
      <SendTrackToFriendModal
        isOpen={sendTrackModalOpen}
        onClose={() => { setSendTrackModalOpen(false); setTrackToSend(null); }}
        track={trackToSend}
        telegramId={telegramId}
      />
      
      {/* Floating Button for Listening Room - Premium Style */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        className="fixed bottom-36 right-6 z-50"
      >
        {/* Outer glow ring animation */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.2, 0.5]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute inset-0 rounded-full blur-xl ${
            activeListeningRoom 
              ? 'bg-gradient-to-r from-green-400 to-emerald-400' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500'
          }`}
        />
        
        {/* Secondary pulse ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.4, 1],
            opacity: [0.3, 0, 0.3]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.5
          }}
          className={`absolute inset-0 rounded-full ${
            activeListeningRoom 
              ? 'bg-green-400/30' 
              : 'bg-purple-400/30'
          }`}
        />
        
        {/* Main button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setListeningRoomModalOpen(true)}
          className={`relative p-4 rounded-full backdrop-blur-sm border transition-all duration-300 ${
            activeListeningRoom 
              ? 'bg-gradient-to-br from-green-500/90 via-emerald-500/90 to-teal-500/90 border-green-400/50 shadow-[0_0_30px_rgba(34,197,94,0.5)] hover:shadow-[0_0_40px_rgba(34,197,94,0.7)]' 
              : 'bg-gradient-to-br from-violet-500/90 via-purple-500/90 to-fuchsia-500/90 border-purple-400/50 shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(168,85,247,0.7)]'
          }`}
          title={activeListeningRoom ? `В комнате: ${activeListeningRoom.name}` : 'Совместное прослушивание'}
        >
          {/* Inner gradient overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-white/10" />
          
          {/* Icon - static, no animation */}
          <Users className="relative w-6 h-6 text-white drop-shadow-lg" />
        </motion.button>
      </motion.div>
    </div>
  );
};

export default MusicSection;
