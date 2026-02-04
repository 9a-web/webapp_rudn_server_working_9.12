/**
 * FriendSearchModal - Расширенный поиск пользователей
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, Building2, UserPlus, Check, Clock, Loader2 } from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';
import { scheduleAPI } from '../services/api';

const FriendSearchModal = ({ 
  isOpen, 
  onClose, 
  userSettings, 
  currentUserId, 
  onSendRequest 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [groups, setGroups] = useState([]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(null); // ID пользователя, которому отправляется запрос

  // Загрузка факультетов
  useEffect(() => {
    const loadFaculties = async () => {
      if (!isOpen) return;
      setLoadingFaculties(true);
      try {
        const data = await scheduleAPI.getFaculties();
        setFaculties(data || []);
      } catch (error) {
        console.error('Error loading faculties:', error);
      } finally {
        setLoadingFaculties(false);
      }
    };

    loadFaculties();
  }, [isOpen]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedFaculty(null);
      setSelectedGroup(null);
      setResults([]);
    }
  }, [isOpen]);

  // Поиск
  const handleSearch = useCallback(async () => {
    if (!currentUserId) return;
    
    setIsLoading(true);
    try {
      const data = await friendsAPI.searchUsers(
        currentUserId,
        searchQuery,
        selectedGroup,
        selectedFaculty,
        100
      );
      setResults(data.results || []);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, searchQuery, selectedFaculty, selectedGroup]);

  // Автопоиск при изменении фильтров
  useEffect(() => {
    if (isOpen && (selectedFaculty || selectedGroup || searchQuery)) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedFaculty, selectedGroup, searchQuery, handleSearch]);

  const handleSendRequest = async (targetId) => {
    setSendingRequest(targetId);
    try {
      await onSendRequest(targetId);
      // Обновляем статус в результатах
      setResults(prev => prev.map(r => 
        r.telegram_id === targetId 
          ? { ...r, friendship_status: 'pending_outgoing' }
          : r
      ));
    } catch (error) {
      console.error('Error sending request:', error);
    } finally {
      setSendingRequest(null);
    }
  };

  const getStatusButton = (result) => {
    const status = result.friendship_status;
    const isSending = sendingRequest === result.telegram_id;
    
    if (status === 'friend') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
          <Check className="w-4 h-4" />
          Друзья
        </span>
      );
    }
    
    if (status?.includes('pending')) {
      return (
        <motion.span 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-sm"
        >
          <Clock className="w-4 h-4" />
          Отправлено
        </motion.span>
      );
    }
    
    if (status === 'blocked' || status === 'blocked_by') {
      return null;
    }
    
    return (
      <motion.button
        onClick={() => handleSendRequest(result.telegram_id)}
        disabled={isSending}
        whileTap={{ scale: 0.9 }}
        className={`p-2 rounded-xl transition-colors ${
          isSending 
            ? 'bg-purple-500/10 text-purple-300' 
            : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
        }`}
      >
        {isSending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <UserPlus className="w-5 h-5" />
        )}
      </motion.button>
    );
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-gray-900 rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Расширенный поиск</h2>
              <button
                onClick={onClose}
                className="p-2 bg-white/10 rounded-xl text-gray-400 hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search input */}
            <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Имя или @username"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 pb-4 space-y-3">
              {/* Faculty filter */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Факультет</label>
                <select
                  value={selectedFaculty || ''}
                  onChange={(e) => setSelectedFaculty(e.target.value || null)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-purple-500/50 appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
                >
                  <option value="">Все факультеты</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Quick filters */}
              <div className="flex gap-2 flex-wrap">
                {userSettings?.group_id && (
                  <button
                    onClick={() => {
                      setSelectedGroup(userSettings.group_id);
                      setSelectedFaculty(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                      selectedGroup === userSettings.group_id
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-gray-300'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Моя группа
                  </button>
                )}
                {userSettings?.facultet_id && (
                  <button
                    onClick={() => {
                      setSelectedFaculty(userSettings.facultet_id);
                      setSelectedGroup(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                      selectedFaculty === userSettings.facultet_id
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-gray-300'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Мой факультет
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedFaculty(null);
                    setSelectedGroup(null);
                    setSearchQuery('');
                    setResults([]);
                  }}
                  className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl"
                >
                  Сбросить
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400 mb-3">
                    Найдено: {results.length}
                  </p>
                  {results.map((result) => (
                    <motion.div
                      key={result.telegram_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 rounded-2xl p-4 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium">
                          {(result.first_name?.[0] || result.username?.[0] || '?').toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white truncate">
                            {result.first_name} {result.last_name}
                          </h4>
                          <p className="text-sm text-gray-400 truncate">
                            {result.group_name || (result.username ? `@${result.username}` : '')}
                          </p>
                          {result.facultet_name && (
                            <p className="text-xs text-gray-500 truncate">
                              {result.facultet_name}
                            </p>
                          )}
                          {result.mutual_friends_count > 0 && (
                            <p className="text-xs text-purple-400 mt-0.5">
                              {result.mutual_friends_count} общих друзей
                            </p>
                          )}
                        </div>

                        {getStatusButton(result)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (searchQuery || selectedFaculty || selectedGroup) ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">Никого не найдено</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">Выберите фильтр или введите имя</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FriendSearchModal;
