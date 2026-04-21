/**
 * SelectFriendsModal - Модал выбора друзей (обновлённый дизайн)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, Users, Star } from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

const getAvatarGradient = (id) => {
  const gradients = [
    'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500', 'from-indigo-500 to-blue-600',
  ];
  return gradients[Math.abs(id || 0) % gradients.length];
};

const pluralize = (n, one, few, many) => {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${many}`;
  if (n1 > 1 && n1 < 5) return `${n} ${few}`;
  if (n1 === 1) return `${n} ${one}`;
  return `${n} ${many}`;
};

const SelectFriendsModal = ({ 
  isOpen, onClose, telegramId, onSelectFriends,
  selectedIds = [], excludeIds = [], title = 'Выбрать из друзей'
}) => {
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(new Set(selectedIds));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadFriends = async () => {
      if (!isOpen || !telegramId) return;
      setIsLoading(true);
      try {
        const data = await friendsAPI.getFriends(telegramId);
        const friendsList = (data.friends || []).filter(f => !excludeIds.includes(f.telegram_id));
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

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredFriends(friends); return; }
    const query = searchQuery.toLowerCase();
    setFilteredFriends(friends.filter(f => {
      const name = `${f.first_name || ''} ${f.last_name || ''}`.toLowerCase();
      const username = (f.username || '').toLowerCase();
      return name.includes(query) || username.includes(query);
    }));
  }, [searchQuery, friends]);

  useEffect(() => {
    if (!isOpen) { setSearchQuery(''); setSelected(new Set(selectedIds)); }
  }, [isOpen, selectedIds]);

  const toggleSelect = useCallback((friendId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] max-h-[82vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: 'rgba(18, 18, 24, 0.98)', backdropFilter: 'blur(40px)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            <div className="px-5 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-white">{title}</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {selected.size > 0 
                    ? pluralize(selected.size, 'выбран', 'выбрано', 'выбрано')
                    : 'Никто не выбран'
                  }
                </p>
              </div>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
                className="p-2 bg-white/[0.06] rounded-xl text-gray-400 hover:bg-white/10">
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-500" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск среди друзей"
                  className="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white text-[14px] placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredFriends.length > 0 ? (
                <div className="space-y-1.5">
                  {filteredFriends.map((friend, idx) => {
                    const isSelected = selected.has(friend.telegram_id);
                    return (
                      <motion.button key={friend.telegram_id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        onClick={() => toggleSelect(friend.telegram_id)}
                        className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl transition-all ${
                          isSelected ? 'bg-purple-500/12 border border-purple-500/25' : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
                        }`}
                        whileTap={{ scale: 0.98 }}>
                        <div className="relative">
                          <div className={`w-11 h-11 rounded-[14px] bg-gradient-to-br ${getAvatarGradient(friend.telegram_id)} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                            {(friend.first_name?.[0] || friend.username?.[0] || '?').toUpperCase()}
                          </div>
                          {friend.is_favorite && <Star className="absolute -top-1 -right-1 w-3.5 h-3.5 text-yellow-400" fill="currentColor" />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className="font-semibold text-[14px] text-white truncate">{friend.first_name} {friend.last_name}</h4>
                          <p className="text-[12px] text-gray-400 truncate">{friend.group_name || (friend.username ? `@${friend.username}` : '')}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-purple-500 border-purple-500 shadow-md shadow-purple-500/30' : 'border-gray-600'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                    <Users className="w-7 h-7 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-[14px]">У вас пока нет друзей</p>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                    <Search className="w-7 h-7 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-[14px]">Никого не найдено</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-white/[0.06]">
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={handleConfirm} disabled={selected.size === 0}
                className={`w-full py-3.5 rounded-2xl font-semibold text-[14px] transition-all ${
                  selected.size > 0 ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/[0.06] text-gray-500'
                }`}>
                {selected.size > 0 
                  ? `Добавить ${pluralize(selected.size, 'друга', 'друга', 'друзей')}`
                  : 'Выберите друзей'
                }
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SelectFriendsModal;
