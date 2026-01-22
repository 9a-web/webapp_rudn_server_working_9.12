import React, { useState, useCallback, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { musicAPI } from '../../services/musicAPI';
import { TrackList } from './TrackList';

export const MusicSearch = ({ favorites = [], onFavorite, onArtistClick }) => {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimeout = useRef(null);

  const handleSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setTracks([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    
    try {
      const result = await musicAPI.search(searchQuery, 30);
      setTracks(result.tracks || []);
    } catch (error) {
      console.error('Search error:', error);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      handleSearch(value);
    }, 500);
  };

  const handleClear = () => {
    setQuery('');
    setTracks([]);
    setSearched(false);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    handleSearch(query);
  };

  return (
    <div>
      {/* Search input */}
      <form onSubmit={handleSubmit} className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Поиск музыки..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder-white/40 focus:outline-none focus:border-pink-500/50 transition-colors"
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={handleClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/60"
              >
                <X className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <TrackList
          tracks={tracks}
          favorites={favorites}
          onFavorite={onFavorite}
          onArtistClick={onArtistClick}
          emptyMessage="Ничего не найдено"
        />
      )}

      {/* Initial state */}
      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
            <Search className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-white/50 text-center">Введите название песни или исполнителя</p>
        </div>
      )}
    </div>
  );
};

export default MusicSearch;
