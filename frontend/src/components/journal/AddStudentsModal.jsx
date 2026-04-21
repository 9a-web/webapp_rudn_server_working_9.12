import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, UserPlus, ListPlus, UserCheck, Search, Check, Star } from 'lucide-react';
import { friendsAPI } from '../../services/friendsAPI';

export const AddStudentsModal = ({ 
  isOpen, 
  onClose, 
  onAddSingle, 
  onAddBulk, 
  onAddFromFriends,
  hapticFeedback,
  telegramId
}) => {
  const [mode, setMode] = useState('single'); // 'single' | 'bulk' | 'friends'
  const [singleName, setSingleName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Friends tab state
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Load friends when switching to friends tab
  useEffect(() => {
    const loadFriends = async () => {
      if (mode !== 'friends' || !telegramId) return;
      
      setLoadingFriends(true);
      try {
        const data = await friendsAPI.getFriends(telegramId);
        const friendsList = data.friends || [];
        setFriends(friendsList);
        setFilteredFriends(friendsList);
      } catch (error) {
        console.error('Error loading friends:', error);
      } finally {
        setLoadingFriends(false);
      }
    };

    loadFriends();
  }, [mode, telegramId]);

  // Filter friends by search
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

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSingleName('');
      setBulkNames('');
      setSearchQuery('');
      setSelectedFriends(new Set());
      setMode('single');
    }
  }, [isOpen]);

  const toggleSelectFriend = useCallback((friendId) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }, []);

  const handleAddSingle = async () => {
    if (!singleName.trim()) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onAddSingle(singleName.trim());
      setSingleName('');
    } catch (error) {
      console.error('Error adding student:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBulk = async () => {
    const names = bulkNames.split('\n').map(n => n.trim()).filter(n => n);
    if (names.length === 0) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onAddBulk(names);
      setBulkNames('');
      onClose();
    } catch (error) {
      console.error('Error adding students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFromFriends = async () => {
    if (selectedFriends.size === 0) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      const selectedFriendsList = friends.filter(f => selectedFriends.has(f.telegram_id));
      await onAddFromFriends?.(selectedFriendsList);
      
      if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred('success');
      }
      
      setSelectedFriends(new Set());
      onClose();
    } catch (error) {
      console.error('Error adding students from friends:', error);
      if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#1C1C1E] w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Добавить студентов</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-5 flex-shrink-0">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
                mode === 'single'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span className="font-medium">По одному</span>
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
                mode === 'bulk'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              <ListPlus className="w-4 h-4" />
              <span className="font-medium">Списком</span>
            </button>
            <button
              onClick={() => setMode('friends')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all text-xs sm:text-sm ${
                mode === 'friends'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span className="font-medium">Из друзей</span>
            </button>
          </div>

          {/* Content area with scroll */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Single Mode */}
            {mode === 'single' && (
              <div>
                <label className="text-sm text-gray-400 mb-2 block">ФИО студента</label>
                <input
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
                />
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddSingle}
                  disabled={!singleName.trim() || isLoading}
                  className={`w-full mt-4 py-3.5 rounded-xl font-semibold transition-all ${
                    singleName.trim() && !isLoading
                      ? 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white'
                      : 'bg-white/10 text-gray-500'
                  }`}
                >
                  {isLoading ? 'Добавление...' : 'Добавить'}
                </motion.button>
              </div>
            )}

            {/* Bulk Mode */}
            {mode === 'bulk' && (
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Список студентов (каждый с новой строки)</label>
                <textarea
                  value={bulkNames}
                  onChange={(e) => setBulkNames(e.target.value)}
                  placeholder="Касымова Камилла Алишеровна
Морозов Артём Анатольевич
Анисимов Дмитрий Владимирович
Шкаралевич Никита Витальевич"
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {bulkNames.split('\n').filter(n => n.trim()).length} студентов
                </p>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddBulk}
                  disabled={!bulkNames.trim() || isLoading}
                  className={`w-full mt-4 py-3.5 rounded-xl font-semibold transition-all ${
                    bulkNames.trim() && !isLoading
                      ? 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white'
                      : 'bg-white/10 text-gray-500'
                  }`}
                >
                  {isLoading ? 'Добавление...' : 'Добавить всех'}
                </motion.button>
              </div>
            )}

            {/* Friends Mode */}
            {mode === 'friends' && (
              <div className="flex flex-col h-full">
                {/* Info banner */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-4 flex-shrink-0">
                  <p className="text-xs text-purple-300">
                    💡 Выберите друзей для добавления в журнал. Они будут добавлены с автоматической привязкой к Telegram.
                  </p>
                </div>

                {/* Search */}
                <div className="relative mb-4 flex-shrink-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск среди друзей"
                    className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 text-sm"
                  />
                </div>

                {/* Friends list */}
                <div className="flex-1 overflow-y-auto -mx-1 px-1">
                  {loadingFriends ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredFriends.length > 0 ? (
                    <div className="space-y-2">
                      {filteredFriends.map((friend) => {
                        const isSelected = selectedFriends.has(friend.telegram_id);
                        return (
                          <motion.button
                            key={friend.telegram_id}
                            onClick={() => toggleSelectFriend(friend.telegram_id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                              isSelected
                                ? 'bg-purple-500/20 border border-purple-500/50'
                                : 'bg-white/5 border border-transparent hover:bg-white/10'
                            }`}
                            whileTap={{ scale: 0.98 }}
                          >
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-sm">
                                {(friend.first_name?.[0] || friend.username?.[0] || '?').toUpperCase()}
                              </div>
                              {friend.is_favorite && (
                                <Star className="absolute -top-1 -right-1 w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-left">
                              <h4 className="font-medium text-white truncate text-sm">
                                {friend.first_name} {friend.last_name}
                              </h4>
                              <p className="text-xs text-gray-400 truncate">
                                {friend.group_name || (friend.username ? `@${friend.username}` : '')}
                              </p>
                            </div>

                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                              isSelected
                                ? 'bg-purple-500 border-purple-500'
                                : 'border-gray-500'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400 text-sm">У вас пока нет друзей</p>
                      <p className="text-gray-500 text-xs mt-1">Добавьте друзей в разделе "Друзья"</p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400 text-sm">Никого не найдено</p>
                    </div>
                  )}
                </div>

                {/* Add button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddFromFriends}
                  disabled={selectedFriends.size === 0 || isLoading}
                  className={`w-full mt-4 py-3.5 rounded-xl font-semibold transition-all flex-shrink-0 ${
                    selectedFriends.size > 0 && !isLoading
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/10 text-gray-500'
                  }`}
                >
                  {isLoading 
                    ? 'Добавление...' 
                    : selectedFriends.size > 0
                      ? `Добавить ${selectedFriends.size} ${selectedFriends.size === 1 ? 'друга' : 'друзей'}`
                      : 'Выберите друзей'
                  }
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
