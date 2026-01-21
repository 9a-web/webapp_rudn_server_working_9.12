/**
 * SelectFriendsModal - Модал выбора друзей для добавления в комнату или журнал
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, Users, Star } from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

const SelectFriendsModal = ({ 
  isOpen, 
  onClose, 
  telegramId,
  onSelectFriends,
  selectedIds = [],
  excludeIds = [],
  title = 'Выбрать из друзей'
}) => {
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(new Set(selectedIds));
  const [isLoading, setIsLoading] = useState(false);

  // Загрузка друзей
  useEffect(() => {
    const loadFriends = async () => {
      if (!isOpen || !telegramId) return;
      
      setIsLoading(true);
      try {
        const data = await friendsAPI.getFriends(telegramId);
        const friendsList = (data.friends || []).filter(
          f => !excludeIds.includes(f.telegram_id)
        );
        setFriends(friendsList);
        setFilteredFriends(friendsList);
      } catch (error) {
        console.error('Error loading friends:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFriends();
  }, [isOpen, telegramId, excludeIds]);

  // Фильтрация по поиску
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredFriends(
      friends.filter(f => {
        const name = `${f.first_name || ''} ${f.last_name || ''}`.toLowerCase();
        const username = (f.username || '').toLowerCase();
        return name.includes(query) || username.includes(query);
      })
    );
  }, [searchQuery, friends]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelected(new Set(selectedIds));
    }
  }, [isOpen, selectedIds]);

  const toggleSelect = useCallback((friendId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }, []);

  const handleConfirm = () => {
    const selectedFriends = friends.filter(f => selected.has(f.telegram_id));
    onSelectFriends?.(selectedFriends);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 rounded-t-3xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <p className="text-sm text-gray-400">
                  Выбрано: {selected.size}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/10 rounded-xl text-gray-400 hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск среди друзей"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            {/* Friends list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredFriends.length > 0 ? (
                <div className="space-y-2">
                  {filteredFriends.map((friend) => {
                    const isSelected = selected.has(friend.telegram_id);
                    return (
                      <motion.button
                        key={friend.telegram_id}
                        onClick={() => toggleSelect(friend.telegram_id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                          isSelected
                            ? 'bg-purple-500/20 border border-purple-500/50'
                            : 'bg-white/5 border border-transparent'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Avatar */}
                        <div className="relative">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
                            {(friend.first_name?.[0] || friend.username?.[0] || '?').toUpperCase()}
                          </div>
                          {friend.is_favorite && (
                            <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400" fill="currentColor" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className="font-medium text-white truncate">
                            {friend.first_name} {friend.last_name}
                          </h4>
                          <p className="text-sm text-gray-400 truncate">
                            {friend.group_name || (friend.username ? `@${friend.username}` : '')}
                          </p>
                        </div>

                        {/* Checkbox */}
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-gray-500'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">У вас пока нет друзей</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">Никого не найдено</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-6 pt-3 border-t border-white/10">
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className={`w-full py-3.5 rounded-2xl font-medium transition-all ${
                  selected.size > 0
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {selected.size > 0 
                  ? `Добавить ${selected.size} ${selected.size === 1 ? 'друга' : 'друзей'}`
                  : 'Выберите друзей'
                }
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SelectFriendsModal;
