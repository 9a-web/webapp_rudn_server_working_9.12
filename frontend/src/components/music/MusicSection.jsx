import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Music, TrendingUp, ListMusic, Heart, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { musicAPI } from '../../services/musicAPI';
import { TrackList } from './TrackList';
import { MusicSearch } from './MusicSearch';
import { PlaylistCard } from './PlaylistCard';
import { ArtistCard } from './ArtistCard';
import { usePlayer } from './PlayerContext';

export const MusicSection = ({ telegramId }) => {
  const [activeTab, setActiveTab] = useState('search');
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
    }
  }, [telegramId]);

  // Загрузка контента при смене вкладки
  useEffect(() => {
    loadContent();
  }, [activeTab]);

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
          const currentOffset = loadMore ? offsetRef.current : 0;
          const my = await musicAPI.getMyAudio(TRACKS_PER_PAGE, currentOffset);
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

  return (
    <div className="pb-36">
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
                  ? 'Нет аудиозаписей'
                  : 'Треки не найдены'
              }
            />
            
            {/* Кнопка "Загрузить ещё" для раздела "Мои" */}
            {activeTab === 'my' && !loading && tracks.length > 0 && hasMore && (
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
    </div>
  );
};

export default MusicSection;
