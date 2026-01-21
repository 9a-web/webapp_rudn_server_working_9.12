/**
 * FriendProfileModal - Модальное окно профиля друга
 * Показывает: информацию о друге, расписание, общих друзей
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Star, UserMinus, Calendar, Users, 
  Clock, MapPin, ChevronRight, AlertTriangle,
  Eye, EyeOff, Shield, Ban
} from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

const FriendProfileModal = ({ 
  isOpen, 
  onClose, 
  friend, 
  currentUserId,
  userSettings,
  onRemoveFriend,
  onToggleFavorite
}) => {
  const [profile, setProfile] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('info');
  const [isLoading, setIsLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Синхронизация is_favorite при открытии
  useEffect(() => {
    if (friend) {
      setIsFavorite(friend.is_favorite || false);
    }
  }, [friend]);

  // Загрузка данных профиля
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

  // Загрузка расписания
  const loadSchedule = async () => {
    if (!friend?.telegram_id || !currentUserId) return;
    
    try {
      const scheduleData = await friendsAPI.getFriendSchedule(friend.telegram_id, currentUserId);
      setSchedule(scheduleData);
    } catch (error) {
      console.error('Error loading schedule:', error);
      setSchedule({ error: true, message: error.message });
    }
  };

  useEffect(() => {
    if (activeTab === 'schedule' && !schedule) {
      loadSchedule();
    }
  }, [activeTab]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setProfile(null);
      setSchedule(null);
      setMutualFriends([]);
      setActiveTab('info');
      setShowRemoveConfirm(false);
    }
  }, [isOpen]);

  // Обработка переключения избранного
  const handleToggleFavorite = async () => {
    const newValue = !isFavorite;
    setIsFavorite(newValue); // Оптимистичное обновление UI
    
    try {
      await onToggleFavorite?.(friend.telegram_id, newValue);
    } catch (error) {
      setIsFavorite(!newValue); // Откат при ошибке
      console.error('Error toggling favorite:', error);
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
            className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 rounded-t-3xl max-h-[90vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4">
              <div className="flex items-start gap-4">
                {/* Аватар */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
                    {initials}
                  </div>
                  {profile?.is_online && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-gray-900" />
                  )}
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white truncate">{displayName}</h2>
                    {isFavorite && (
                      <Star className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="currentColor" />
                    )}
                  </div>
                  {friend.username && (
                    <p className="text-gray-400">@{friend.username}</p>
                  )}
                  <p className="text-sm text-purple-400 mt-1">
                    {friend.group_name || profile?.group_name || 'Группа не указана'}
                  </p>
                  {(friend.facultet_name || profile?.facultet_name) && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {friend.facultet_name || profile?.facultet_name}
                    </p>
                  )}
                </div>

                {/* Кнопка закрытия */}
                <button
                  onClick={onClose}
                  className="p-2 bg-white/10 rounded-xl text-gray-400 hover:bg-white/20 flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Статистика */}
              {profile && (
                <div className="flex gap-4 mt-4">
                  <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-white">{profile.friends_count || 0}</p>
                    <p className="text-xs text-gray-400">Друзей</p>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-white">{mutualFriends.length}</p>
                    <p className="text-xs text-gray-400">Общих</p>
                  </div>
                  {profile.privacy?.show_achievements !== false && (
                    <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-white">{profile.achievements_count || 0}</p>
                      <p className="text-xs text-gray-400">Достижений</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-4 pb-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="px-4 pb-4 overflow-y-auto max-h-[45vh]">
              {/* Info Tab */}
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {/* Общие друзья */}
                  {mutualFriends.length > 0 && (
                    <div className="bg-white/5 rounded-2xl p-4">
                      <h3 className="text-sm font-medium text-gray-400 mb-3">
                        Общие друзья ({mutualFriends.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {mutualFriends.slice(0, 5).map((mf) => (
                          <div
                            key={mf.telegram_id}
                            className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5"
                          >
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-medium">
                              {(mf.first_name?.[0] || '?').toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-300">{mf.first_name}</span>
                          </div>
                        ))}
                        {mutualFriends.length > 5 && (
                          <div className="flex items-center px-3 py-1.5 text-sm text-gray-400">
                            +{mutualFriends.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Действия */}
                  <div className="space-y-2">
                    <button
                      onClick={handleToggleFavorite}
                      className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl text-left hover:bg-white/10 transition-colors"
                    >
                      <div className={`p-2 rounded-xl ${isFavorite ? 'bg-yellow-500/20' : 'bg-white/10'}`}>
                        <Star className={`w-5 h-5 ${isFavorite ? 'text-yellow-400' : 'text-gray-400'}`} fill={isFavorite ? 'currentColor' : 'none'} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          {isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {isFavorite ? 'Уберет из начала списка' : 'Будет в начале списка'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>

                    <button
                      onClick={() => setShowRemoveConfirm(true)}
                      className="w-full flex items-center gap-3 p-4 bg-red-500/10 rounded-2xl text-left hover:bg-red-500/20 transition-colors"
                    >
                      <div className="p-2 rounded-xl bg-red-500/20">
                        <UserMinus className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-red-400">Удалить из друзей</p>
                        <p className="text-sm text-gray-500">Можно добавить снова</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Tab */}
              {activeTab === 'schedule' && (
                <div className="space-y-3">
                  {!schedule ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : schedule.error ? (
                    <div className="text-center py-8">
                      <EyeOff className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400">Расписание недоступно</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {schedule.message || 'Пользователь скрыл расписание или группа не настроена'}
                      </p>
                    </div>
                  ) : schedule.schedule?.length > 0 ? (
                    <>
                      <p className="text-sm text-gray-400 mb-2">
                        Расписание {schedule.friend_name} • {schedule.group_name}
                      </p>
                      {schedule.schedule.map((event, index) => (
                        <div
                          key={index}
                          className="bg-white/5 rounded-2xl p-4 border border-white/10"
                        >
                          <div className="flex items-start gap-3">
                            <div className="bg-purple-500/20 rounded-xl px-3 py-2 text-center min-w-[60px]">
                              <p className="text-lg font-bold text-purple-400">
                                {event.time_start?.split(':').slice(0, 2).join(':') || event.startTime?.slice(0, 5)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {event.time_end?.split(':').slice(0, 2).join(':') || event.endTime?.slice(0, 5)}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white truncate">
                                {event.discipline || event.title || event.subject}
                              </h4>
                              {(event.teacher || event.professor) && (
                                <p className="text-sm text-gray-400 truncate">{event.teacher || event.professor}</p>
                              )}
                              {(event.auditory || event.room || event.location) && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.auditory || event.room || event.location}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400">Сегодня нет пар</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Remove Confirmation */}
            <AnimatePresence>
              {showRemoveConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center z-10"
                >
                  <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="bg-gray-800 rounded-t-3xl p-6 w-full"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/20 rounded-2xl">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Удалить из друзей?</h3>
                        <p className="text-sm text-gray-400">Это действие можно отменить</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRemoveConfirm(false)}
                        className="flex-1 py-3 bg-white/10 text-white rounded-xl font-medium"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={() => {
                          onRemoveFriend?.(friend.telegram_id);
                          setShowRemoveConfirm(false);
                        }}
                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium"
                      >
                        Удалить
                      </button>
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
