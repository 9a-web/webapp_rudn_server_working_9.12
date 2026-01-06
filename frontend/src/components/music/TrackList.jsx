import React from 'react';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';
import { TrackCard } from './TrackCard';

export const TrackList = ({ 
  tracks = [], 
  loading = false, 
  favorites = [],
  onFavorite,
  emptyMessage = 'Треки не найдены'
}) => {
  const favoriteIds = new Set(favorites.map(f => f.id));

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-pulse"
          >
            <div className="w-12 h-12 rounded-lg bg-white/10" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-white/10 rounded mb-2" />
              <div className="h-3 w-24 bg-white/10 rounded" />
            </div>
            <div className="h-3 w-10 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-16 px-4"
      >
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Music className="w-8 h-8 text-white/30" />
        </div>
        <p className="text-white/50 text-center">{emptyMessage}</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {tracks.map((track, index) => (
        <TrackCard
          key={track.id || index}
          track={track}
          trackList={tracks}
          isFavorite={favoriteIds.has(track.id)}
          onFavorite={onFavorite}
        />
      ))}
    </div>
  );
};

export default TrackList;
