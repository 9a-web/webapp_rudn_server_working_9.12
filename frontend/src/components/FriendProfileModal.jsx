/**
 * FriendProfileModal - Профиль друга с красивым дизайном
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Star, UserMinus, Calendar, Users, 
  MapPin, ChevronRight, AlertTriangle,
  EyeOff, ChevronLeft, ChevronDown, Wifi, Trophy, MessageCircle
} from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';
import { groupScheduleItems } from '../utils/scheduleUtils';
import { getBackendURL } from '../utils/config';

const getAvatarGradient = (id) => {
  const gradients = [
    'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500', 'from-indigo-500 to-blue-600',
  ];
  return gradients[Math.abs(id || 0) % gradients.length];
};

const FriendProfileModal = ({ 
  isOpen, onClose, friend, currentUserId, userSettings, onRemoveFriend, onToggleFavorite, onMessage
}) => {
  const [profile, setProfile] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('info');
  const [isLoading, setIsLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const groupedSchedule = useMemo(() => {
    if (!schedule?.schedule?.length) return [];
    return groupScheduleItems(schedule.schedule);
  }, [schedule]);

  useEffect(() => {
    if (friend) setIsFavorite(friend.is_favorite || false);
  }, [friend]);

  useEffect(() => {
    if (isOpen && friend?.telegram_id) {
      setAvatarError(false);
      setAvatarUrl(`${getBackendURL()}/api/user-profile-photo-proxy/${friend.telegram_id}`);
    }
  }, [isOpen, friend?.telegram_id]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!isOpen || !friend?.telegram_id || !currentUserId) return;
      setIsLoading(true);
      try {
        const [profileData, mutualData] = await Promise.all([
          friendsAPI.getUserProfile(friend.telegram_id, currentUserId),
          friendsAPI.getMutualFriends(currentUserId, friend.telegram_id)
        ]);
        setProfile(profileData);
        setMutualFriends(mutualData.mutual_friends || []);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [isOpen, friend?.telegram_id, currentUserId]);

  const loadSchedule = useCallback(async (date) => {
    if (!friend?.telegram_id || !currentUserId) return;
    setScheduleLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const scheduleData = await friendsAPI.getFriendSchedule(friend.telegram_id, currentUserId, dateStr);
      setSchedule(scheduleData);
    } catch (error) {
      setSchedule({ error: true, message: error.message || 'Ошибка загрузки' });
    } finally {
      setScheduleLoading(false);
    }
  }, [friend?.telegram_id, currentUserId]);

  useEffect(() => {
    if (activeTab === 'schedule' && friend?.telegram_id && currentUserId) {
      loadSchedule(selectedDate);
    }
  }, [activeTab, selectedDate, friend?.telegram_id, currentUserId, loadSchedule]);

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const formatDate = (date) => {
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = date.toDateString();
    if (dateStr === today.toDateString()) return 'Сегодня';
    if (dateStr === tomorrow.toDateString()) return 'Завтра';
    if (dateStr === yesterday.toDateString()) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  useEffect(() => {
    if (!isOpen) {
      setProfile(null); setSchedule(null); setMutualFriends([]);
      setActiveTab('info'); setShowRemoveConfirm(false);
      setAvatarUrl(null); setAvatarError(false);
      setSelectedDate(new Date()); setScheduleLoading(false); setExpandedIndex(null);
    }
  }, [isOpen]);

  const handleToggleFavorite = async () => {
    const newValue = !isFavorite;
    setIsFavorite(newValue);
    try {
      await onToggleFavorite?.(friend.telegram_id, newValue);
    } catch (error) {
      setIsFavorite(!newValue);
    }
  };

  if (!friend) return null;

  const displayName = [friend.first_name, friend.last_name].filter(Boolean).join(' ') || friend.username || 'Пользователь';
  const initials = (friend.first_name?.[0] || friend.username?.[0] || '?').toUpperCase();

  const tabs = [
    { id: 'info', name: 'Профиль', icon: Users },
    { id: 'schedule', name: 'Расписание', icon: Calendar },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] max-h-[92vh] overflow-hidden"
            style={{ backgroundColor: 'rgba(18, 18, 24, 0.98)', backdropFilter: 'blur(40px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            {/* Header with gradient background */}
            <div className="relative px-5 pb-5">
              {/* Subtle gradient glow */}
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-gradient-to-br ${getAvatarGradient(friend.telegram_id)} opacity-[0.06] rounded-full blur-3xl`} />
              
              <div className="relative flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring' }}
                    className={`w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br ${getAvatarGradient(friend.telegram_id)} flex items-center justify-center text-white font-bold text-2xl overflow-hidden shadow-xl`}
                  >
                    {avatarUrl && !avatarError ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
                    ) : initials}
                  </motion.div>
                  {profile?.is_online && (
                    <div className="absolute -bottom-1 -right-1">
                      <div className="w-5 h-5 bg-emerald-500 rounded-full border-[3px] relative" style={{ borderColor: 'rgba(18, 18, 24, 0.98)' }}>
                        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[20px] font-bold text-white truncate">{displayName}</h2>
                    {isFavorite && <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" />}
                  </div>
                  {friend.username && <p className="text-[13px] text-gray-400 mt-0.5">@{friend.username}</p>}
                  <p className="text-[13px] text-purple-400 mt-1 font-medium">
                    {friend.group_name || profile?.group_name || 'Группа не указана'}
                  </p>
                  {(friend.facultet_name || profile?.facultet_name) && (
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {friend.facultet_name || profile?.facultet_name}
                    </p>
                  )}
                  {profile?.is_online && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
                      <Wifi className="w-3 h-3" /> в сети
                    </span>
                  )}
                </div>

                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={onClose}
                  className="p-2 bg-white/[0.06] rounded-xl text-gray-500 hover:bg-white/10 flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Stats */}
              {profile && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex gap-3 mt-5"
                >
                  <div className="flex-1 bg-white/[0.04] rounded-2xl p-3 text-center border border-white/[0.05]">
                    <p className="text-xl font-bold text-white">{profile.friends_count || 0}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Друзей</p>
                  </div>
                  <div className="flex-1 bg-white/[0.04] rounded-2xl p-3 text-center border border-white/[0.05]">
                    <p className="text-xl font-bold text-white">{mutualFriends.length}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Общих</p>
                  </div>
                  {profile.privacy?.show_achievements !== false && (
                    <div className="flex-1 bg-white/[0.04] rounded-2xl p-3 text-center border border-white/[0.05]">
                      <p className="text-xl font-bold text-white">{profile.achievements_count || 0}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Достижений</p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Tabs */}
            <div className="relative flex gap-1 px-5 pb-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 relative flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all z-10 ${
                      isActive ? 'text-white' : 'text-gray-500 bg-white/[0.03]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="profileTabBg"
                        className="absolute inset-0 bg-purple-500/90 rounded-xl shadow-md shadow-purple-500/15"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon className="w-4 h-4" />
                      <span className="text-[13px] font-semibold">{tab.name}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Content */}
            <div className="px-5 pb-6 overflow-y-auto max-h-[45vh]">
              <AnimatePresence mode="wait">
                {activeTab === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    {/* Mutual Friends */}
                    {mutualFriends.length > 0 && (
                      <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
                        <h3 className="text-[12px] font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                          Общие друзья · {mutualFriends.length}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {mutualFriends.slice(0, 6).map((mf) => (
                            <div key={mf.telegram_id} className="flex items-center gap-2 bg-white/[0.04] rounded-full px-3 py-1.5 border border-white/[0.05]">
                              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarGradient(mf.telegram_id)} flex items-center justify-center text-white text-[10px] font-bold`}>
                                {(mf.first_name?.[0] || '?').toUpperCase()}
                              </div>
                              <span className="text-[12px] text-gray-300 font-medium">{mf.first_name}</span>
                            </div>
                          ))}
                          {mutualFriends.length > 6 && (
                            <div className="flex items-center px-3 py-1.5 text-[12px] text-gray-500 font-medium">
                              +{mutualFriends.length - 6}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-2">
                      {/* Написать сообщение */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          onMessage?.(friend);
                          onClose();
                        }}
                        className="w-full flex items-center gap-3.5 p-4 bg-purple-500/[0.08] rounded-2xl text-left hover:bg-purple-500/[0.14] transition-all border border-purple-500/15"
                      >
                        <div className="p-2.5 rounded-xl bg-purple-500/15">
                          <MessageCircle className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[14px] text-purple-400">Написать сообщение</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">Начать диалог</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-purple-400/50" />
                      </motion.button>

                      {/* Открыть в Telegram */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const url = friend.username 
                            ? `https://t.me/${friend.username}` 
                            : `tg://user?id=${friend.telegram_id}`;
                          try {
                            window.Telegram?.WebApp?.openTelegramLink?.(url) 
                              || window.open(url, '_blank');
                          } catch {
                            window.open(url, '_blank');
                          }
                        }}
                        className="w-full flex items-center gap-3.5 p-4 bg-[#2AABEE]/[0.08] rounded-2xl text-left hover:bg-[#2AABEE]/[0.14] transition-all border border-[#2AABEE]/15"
                      >
                        <div className="p-2.5 rounded-xl bg-[#2AABEE]/15">
                          <svg className="w-5 h-5 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[14px] text-[#2AABEE]">Открыть в Telegram</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">
                            {friend.username ? `@${friend.username}` : 'Перейти в профиль'}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#2AABEE]/50" />
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleToggleFavorite}
                        className="w-full flex items-center gap-3.5 p-4 bg-white/[0.03] rounded-2xl text-left hover:bg-white/[0.06] transition-all border border-white/[0.06]"
                      >
                        <div className={`p-2.5 rounded-xl ${isFavorite ? 'bg-yellow-500/15' : 'bg-white/[0.06]'}`}>
                          <Star className={`w-5 h-5 ${isFavorite ? 'text-yellow-400' : 'text-gray-500'}`} fill={isFavorite ? 'currentColor' : 'none'} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[14px] text-white">
                            {isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                          </p>
                          <p className="text-[12px] text-gray-500 mt-0.5">
                            {isFavorite ? 'Уберёт из начала списка' : 'Будет в начале списка'}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowRemoveConfirm(true)}
                        className="w-full flex items-center gap-3.5 p-4 bg-red-500/[0.06] rounded-2xl text-left hover:bg-red-500/[0.1] transition-all border border-red-500/10"
                      >
                        <div className="p-2.5 rounded-xl bg-red-500/15">
                          <UserMinus className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[14px] text-red-400">Удалить из друзей</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">Можно добавить снова</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'schedule' && (
                  <motion.div
                    key="schedule"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    {/* Date navigation */}
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-2xl p-2.5 border border-white/[0.06]">
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeDate(-1)} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors">
                        <ChevronLeft className="w-5 h-5 text-gray-400" />
                      </motion.button>
                      <div className="text-center">
                        <p className="font-semibold text-[14px] text-white">{formatDate(selectedDate)}</p>
                        <p className="text-[11px] text-gray-500">{selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
                      </div>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeDate(1)} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </motion.button>
                    </div>

                    {/* Quick buttons */}
                    <div className="flex gap-2">
                      {[
                        { label: 'Сегодня', date: new Date() },
                        { label: 'Завтра', date: new Date(Date.now() + 86400000) }
                      ].map(btn => (
                        <motion.button
                          key={btn.label}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedDate(btn.date)}
                          className={`flex-1 py-2 rounded-xl text-[13px] font-medium transition-all ${
                            selectedDate.toDateString() === btn.date.toDateString()
                              ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                              : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.06]'
                          }`}
                        >
                          {btn.label}
                        </motion.button>
                      ))}
                    </div>

                    {/* Schedule content */}
                    {scheduleLoading ? (
                      <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : schedule?.error ? (
                      <div className="text-center py-10">
                        <EyeOff className="w-10 h-10 mx-auto text-gray-600 mb-3" />
                        <p className="text-gray-400 text-[14px]">Расписание недоступно</p>
                        <p className="text-[12px] text-gray-600 mt-1">{schedule.message}</p>
                      </div>
                    ) : groupedSchedule.length > 0 ? (
                      <>
                        <p className="text-[12px] text-gray-500 mb-1">
                          {schedule.friend_name} • {schedule.group_name}
                        </p>
                        {groupedSchedule.map((event, index) => {
                          const timeParts = event.time?.split(' - ') || [];
                          const startTime = timeParts[0] || event.time_start?.slice(0, 5) || '';
                          const endTime = timeParts[1] || event.time_end?.slice(0, 5) || '';
                          const isExpanded = expandedIndex === index;
                          const hasMultiple = event.subItems && event.subItems.length > 1;
                          
                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] ${hasMultiple ? 'cursor-pointer' : ''}`}
                              onClick={() => hasMultiple && setExpandedIndex(isExpanded ? null : index)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="bg-purple-500/12 rounded-xl px-3 py-2 text-center min-w-[60px] border border-purple-500/10">
                                  <p className="text-base font-bold text-purple-400">{startTime}</p>
                                  <p className="text-[10px] text-gray-500">{endTime}</p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-[14px] text-white truncate">
                                    {event.discipline || event.title || event.subject}
                                  </h4>
                                  {event.lessonType && <p className="text-[11px] text-purple-400 mb-1">{event.lessonType}</p>}
                                  {hasMultiple ? (
                                    <>
                                      <p className="text-[12px] text-gray-500">{event.subItems.length} варианта</p>
                                      <AnimatePresence>
                                        {isExpanded && (
                                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-2 overflow-hidden">
                                            {event.subItems.map((sub, si) => (
                                              <div key={si} className={si > 0 ? 'pt-2 border-t border-white/[0.06]' : ''}>
                                                {sub.teacher && <p className="text-[13px] text-gray-300">{sub.teacher}</p>}
                                                {sub.auditory && (
                                                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{sub.auditory}</p>
                                                )}
                                              </div>
                                            ))}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </>
                                  ) : (
                                    <>
                                      {event.subItems?.[0]?.teacher && <p className="text-[13px] text-gray-400 truncate">{event.subItems[0].teacher}</p>}
                                      {event.subItems?.[0]?.auditory && (
                                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{event.subItems[0].auditory}</p>
                                      )}
                                    </>
                                  )}
                                </div>
                                {hasMultiple && (
                                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="flex-shrink-0">
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="text-center py-10">
                        <Calendar className="w-10 h-10 mx-auto text-gray-600 mb-3" />
                        <p className="text-gray-400 text-[14px]">Нет пар на {formatDate(selectedDate).toLowerCase()}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Remove Confirmation */}
            <AnimatePresence>
              {showRemoveConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-end justify-center z-10"
                >
                  <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="rounded-t-[28px] p-6 w-full"
                    style={{ backgroundColor: 'rgba(28, 28, 36, 0.98)' }}
                  >
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="p-3 bg-red-500/15 rounded-2xl">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-[17px] font-bold text-white">Удалить из друзей?</h3>
                        <p className="text-[13px] text-gray-500 mt-0.5">Это действие можно отменить позже</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowRemoveConfirm(false)}
                        className="flex-1 py-3.5 bg-white/[0.06] text-white rounded-2xl font-semibold text-[14px]"
                      >
                        Отмена
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          onRemoveFriend?.(friend.telegram_id);
                          setShowRemoveConfirm(false);
                        }}
                        className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-semibold text-[14px] shadow-lg shadow-red-500/20"
                      >
                        Удалить
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FriendProfileModal;
