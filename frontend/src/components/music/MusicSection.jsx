import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Music, TrendingUp, ListMusic, Heart, Loader2, ChevronDown, UserPlus, CheckCircle2, Settings, Key, Music2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { musicAPI } from '../../services/musicAPI';
import { TrackList } from './TrackList';
import { MusicSearch } from './MusicSearch';
import { PlaylistCard } from './PlaylistCard';
import { ArtistCard } from './ArtistCard';
import { usePlayer } from './PlayerContext';
import { VKAuthModal } from './VKAuthModal';

// Стили анимации пульсации
const pulseAnimation = {
  scale: [1, 1.02, 1],
  boxShadow: [
    '0 0 0 0 rgba(59, 130, 246, 0.4)',
    '0 0 0 12px rgba(59, 130, 246, 0)',
    '0 0 0 0 rgba(59, 130, 246, 0)'
  ]
};

export const MusicSection = ({ telegramId }) => {
  // По умолчанию открываем вкладку "Мои"
  const [activeTab, setActiveTab] = useState('my');
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
          const pl = await musicAPI.getPlaylists();
          setPlaylists(pl.playlists || []);
          setHasMore(false);
          break;
        }
        case 'favorites': {
          await loadFavorites();
          setTracks(favorites);
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
      const result = await musicAPI.getPlaylistTracks(
        playlist.owner_id, 
        playlist.id,
        playlist.access_key || ''
      );
      setTracks(result.tracks || []);
    } catch (error) {
      console.error('Load playlist tracks error:', error);
      setTracks([]);
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

  return (
    <div className="pb-36">
      {/* Компактная кнопка "Получить токен" - показывается на ВСЕХ вкладках КРОМЕ "Мои" (если VK не подключен) */}
      {!checkingVkAuth && !isVkConnected && activeTab !== 'my' && (
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
            className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-blue-600/20 
                     border border-blue-500/30 hover:from-blue-500/30 hover:to-blue-600/30
                     transition-all flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">
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
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{tab.label}</span>
            {/* Индикатор VK для вкладки "Мои" */}
            {tab.id === 'my' && isVkConnected && (
              <span className="w-2 h-2 rounded-full bg-green-400" />
            )}
          </button>
        ))}
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
            className="text-purple-400 text-sm"
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
            />
          </motion.div>
        ) : activeTab === 'my' && !isVkConnected && !checkingVkAuth ? (
          /* Вкладка "Мои" - крупная карточка по центру когда VK не подключен */
          <motion.div
            key="my-not-connected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center px-4 py-8 min-h-[50vh]"
          >
            <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 
                            border border-blue-500/30 backdrop-blur-sm">
              <div className="flex flex-col items-center text-center space-y-5 sm:space-y-6">
                {/* Иконка */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 
                                flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Music2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
                
                {/* Заголовок */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    Добро пожаловать в Музыку
                  </h2>
                  <p className="text-sm sm:text-base text-white/60 leading-relaxed max-w-md mx-auto">
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
                  className="w-full sm:w-auto sm:min-w-[320px] py-4 px-6 sm:px-8 rounded-xl font-semibold text-white text-base sm:text-lg
                            bg-gradient-to-r from-blue-500 to-blue-600 
                            hover:from-blue-600 hover:to-blue-700
                            transition-all duration-300 flex items-center justify-center gap-3
                            shadow-lg shadow-blue-500/30"
                >
                  <Key className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Получить токен для доступа к музыке</span>
                </motion.button>
                
                {/* Подсказка */}
                <p className="text-xs sm:text-sm text-white/40">
                  Нажмите, чтобы авторизоваться через VK
                </p>
              </div>
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
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
    </div>
  );
};

export default MusicSection;
