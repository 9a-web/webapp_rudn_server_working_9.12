/**
 * FriendSearchModal - Расширенный поиск пользователей (обновлённый дизайн)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, Building2, UserPlus, Check, Clock, Loader2, Sparkles } from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';
import { scheduleAPI } from '../services/api';

// URL backend из env
const getBackendURL = () => {
  let url = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      url = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || '';
    }
    if (!url && typeof process !== 'undefined' && process.env) {
      url = process.env.REACT_APP_BACKEND_URL || '';
    }
  } catch (e) { /* env not available */ }
  if (url && url.trim() !== '') return url;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8001';
  return window.location.origin;
};

const getAvatarGradient = (id) => {
  const gradients = [
    'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500', 'from-indigo-500 to-blue-600',
  ];
  return gradients[Math.abs(id || 0) % gradients.length];
};

// Компонент аватарки с фото
const UserAvatar = ({ telegramId, firstName, username, size = 48, className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = `${getBackendURL()}/api/user-profile-photo-proxy/${telegramId}`;
  const initials = (firstName?.[0] || username?.[0] || '?').toUpperCase();
  const gradient = getAvatarGradient(telegramId);

  return (
    <div 
      className={`bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold overflow-hidden shadow-lg ${className}`}
      style={{ width: size, height: size }}
    >
      {!imgError ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} loading="lazy" />
      ) : (
        <span className="drop-shadow-sm" style={{ fontSize: size * 0.38 }}>{initials}</span>
      )}
    </div>
  );
};

const pluralize = (n, one, few, many) => {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${many}`;
  if (n1 > 1 && n1 < 5) return `${n} ${few}`;
  if (n1 === 1) return `${n} ${one}`;
  return `${n} ${many}`;
};

const FriendSearchModal = ({ isOpen, onClose, userSettings, currentUserId, onSendRequest }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(null);

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

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery(''); setSelectedFaculty(null);
      setSelectedGroup(null); setResults([]);
    }
  }, [isOpen]);

  const handleSearch = useCallback(async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    try {
      const data = await friendsAPI.searchUsers(currentUserId, searchQuery, selectedGroup, selectedFaculty, 100);
      setResults(data.results || []);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, searchQuery, selectedFaculty, selectedGroup]);

  useEffect(() => {
    if (isOpen && (selectedFaculty || selectedGroup || searchQuery)) {
      const timer = setTimeout(handleSearch, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedFaculty, selectedGroup, searchQuery, handleSearch]);

  const handleSendRequest = async (targetId) => {
    setSendingRequest(targetId);
    try {
      await onSendRequest(targetId);
      setResults(prev => prev.map(r =>
        r.telegram_id === targetId ? { ...r, friendship_status: 'pending_outgoing' } : r
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
        <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-full text-[12px] font-medium">
          <Check className="w-3.5 h-3.5" /> Друзья
        </span>
      );
    }
    if (status?.includes('pending')) {
      return (
        <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-full text-[12px] font-medium">
          <Clock className="w-3.5 h-3.5" /> Отправлено
        </motion.span>
      );
    }
    if (status === 'blocked' || status === 'blocked_by') return null;
    
    return (
      <motion.button onClick={() => handleSendRequest(result.telegram_id)} disabled={isSending} whileTap={{ scale: 0.85 }}
        className={`p-2.5 rounded-xl transition-all ${isSending ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25'}`}>
        {isSending ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <UserPlus className="w-[18px] h-[18px]" />}
      </motion.button>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60]" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[60] rounded-t-[28px] max-h-[92vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: 'rgba(18, 18, 24, 0.98)', backdropFilter: 'blur(40px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            <div className="px-5 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-[18px] font-bold text-white">Расширенный поиск</h2>
              </div>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
                className="p-2 bg-white/[0.06] rounded-xl text-gray-400 hover:bg-white/10">
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Search */}
            <div className="px-5 pb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-500" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Имя или @username"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white text-[14px] placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="px-5 pb-4 space-y-3">
              <div>
                <label className="text-[12px] text-gray-500 mb-1.5 block font-medium uppercase tracking-wider">Факультет</label>
                <select value={selectedFaculty || ''} onChange={(e) => setSelectedFaculty(e.target.value || null)}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white text-[14px] focus:outline-none focus:border-purple-500/40 appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239ca3af\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2rem' }}>
                  <option value="">Все факультеты</option>
                  {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div className="flex gap-2 flex-wrap">
                {userSettings?.group_id && (
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => { setSelectedGroup(userSettings.group_id); setSelectedFaculty(null); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                      selectedGroup === userSettings.group_id ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'bg-white/[0.04] text-gray-400 border border-white/[0.06]'
                    }`}>
                    <Users className="w-3.5 h-3.5" /> Моя группа
                  </motion.button>
                )}
                {userSettings?.facultet_id && (
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => { setSelectedFaculty(userSettings.facultet_id); setSelectedGroup(null); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                      selectedFaculty === userSettings.facultet_id ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'bg-white/[0.04] text-gray-400 border border-white/[0.06]'
                    }`}>
                    <Building2 className="w-3.5 h-3.5" /> Мой факультет
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => { setSelectedFaculty(null); setSelectedGroup(null); setSearchQuery(''); setResults([]); }}
                  className="px-4 py-2 bg-white/[0.04] text-gray-500 rounded-xl text-[13px] font-medium border border-white/[0.06]">
                  Сбросить
                </motion.button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[12px] text-gray-500 font-medium mb-2">
                    Найдено: {results.length}
                  </p>
                  {results.map((result, idx) => (
                    <motion.div key={result.telegram_id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="relative overflow-hidden rounded-2xl">
                      <div className="absolute inset-0 bg-white/[0.03]" />
                      <div className="absolute inset-0 border border-white/[0.06] rounded-2xl" />
                      <div className="relative p-4">
                        <div className="flex items-center gap-3.5">
                          <UserAvatar
                            telegramId={result.telegram_id}
                            firstName={result.first_name}
                            username={result.username}
                            size={48}
                            className="rounded-2xl flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-[14px] text-white truncate">{result.first_name} {result.last_name}</h4>
                            <p className="text-[12px] text-gray-400 truncate mt-0.5">
                              {result.group_name || (result.username ? `@${result.username}` : '')}
                            </p>
                            {result.facultet_name && <p className="text-[11px] text-gray-500 truncate">{result.facultet_name}</p>}
                            {result.mutual_friends_count > 0 && (
                              <p className="text-[11px] text-purple-400/70 mt-0.5">
                                {pluralize(result.mutual_friends_count, 'общий друг', 'общих друга', 'общих друзей')}
                              </p>
                            )}
                          </div>
                          {getStatusButton(result)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (searchQuery || selectedFaculty || selectedGroup) ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                    <Search className="w-7 h-7 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-[14px]">Никого не найдено</p>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-7 h-7 text-purple-400/40" />
                  </div>
                  <p className="text-gray-400 text-[14px]">Выберите фильтр или введите имя</p>
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
