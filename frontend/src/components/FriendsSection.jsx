/**
 * FriendsSection - Главный компонент раздела "Друзья"
 * Вкладки: Друзья | Запросы | Поиск
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, UserPlus, Bell, Star, 
  ChevronRight, RefreshCw, Filter,
  UserCheck, UserX, Clock, Send
} from 'lucide-react';
import { useTelegram } from '../contexts/TelegramContext';
import { friendsAPI } from '../services/friendsAPI';
import FriendCard from './FriendCard';
import FriendProfileModal from './FriendProfileModal';
import FriendSearchModal from './FriendSearchModal';

const TABS = [
  { id: 'friends', name: 'Друзья', icon: Users },
  { id: 'requests', name: 'Запросы', icon: Bell },
  { id: 'search', name: 'Поиск', icon: Search }
];

const FriendsSection = ({ userSettings }) => {
  const { user, webApp } = useTelegram();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hapticFeedback = useCallback((type = 'impact', style = 'light') => {
    if (webApp?.HapticFeedback) {
      if (type === 'impact') {
        webApp.HapticFeedback.impactOccurred(style);
      } else if (type === 'notification') {
        webApp.HapticFeedback.notificationOccurred(style);
      }
    }
  }, [webApp]);

  // Загрузка данных
  const loadFriends = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await friendsAPI.getFriends(user.id, showFavoritesOnly);
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  }, [user?.id, showFavoritesOnly]);

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await friendsAPI.getFriendRequests(user.id);
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  }, [user?.id]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadFriends(), loadRequests()]);
    } finally {
      setIsLoading(false);
    }
  }, [loadFriends, loadRequests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Обновить данные
  const handleRefresh = async () => {
    setRefreshing(true);
    hapticFeedback('impact', 'medium');
    await loadData();
    setRefreshing(false);
  };

  // Действия с друзьями
  const handleAcceptRequest = async (requestId) => {
    try {
      hapticFeedback('impact', 'medium');
      await friendsAPI.acceptFriendRequest(requestId, user.id);
      hapticFeedback('notification', 'success');
      await loadData();
    } catch (error) {
      hapticFeedback('notification', 'error');
      console.error('Error accepting request:', error);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      hapticFeedback('impact', 'light');
      await friendsAPI.rejectFriendRequest(requestId, user.id);
      await loadRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      hapticFeedback('impact', 'light');
      await friendsAPI.cancelFriendRequest(requestId, user.id);
      await loadRequests();
    } catch (error) {
      console.error('Error canceling request:', error);
    }
  };

  const handleToggleFavorite = async (friendId, isFavorite) => {
    try {
      hapticFeedback('impact', 'light');
      await friendsAPI.toggleFavorite(user.id, friendId, isFavorite);
      await loadFriends();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      hapticFeedback('impact', 'medium');
      await friendsAPI.removeFriend(user.id, friendId);
      hapticFeedback('notification', 'success');
      await loadFriends();
      setSelectedProfile(null);
    } catch (error) {
      hapticFeedback('notification', 'error');
      console.error('Error removing friend:', error);
    }
  };

  const handleSendRequest = async (targetId) => {
    try {
      hapticFeedback('impact', 'medium');
      await friendsAPI.sendFriendRequest(user.id, targetId);
      hapticFeedback('notification', 'success');
      await loadData();
    } catch (error) {
      hapticFeedback('notification', 'error');
      console.error('Error sending request:', error);
    }
  };

  // Поиск пользователей
  const handleSearch = async (query) => {
    if (!user?.id) return;
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await friendsAPI.searchUsers(user.id, query);
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Открыть профиль
  const handleOpenProfile = (friend) => {
    hapticFeedback('impact', 'light');
    setSelectedProfile(friend);
  };

  // Рендер карточки запроса
  const renderRequestCard = (request, isIncoming) => (
    <motion.div
      key={request.request_id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
    >
      <div className="flex items-center gap-3">
        {/* Аватар */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
          {(request.first_name?.[0] || request.username?.[0] || '?').toUpperCase()}
        </div>
        
        {/* Информация */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">
            {request.first_name} {request.last_name}
          </h4>
          <p className="text-sm text-gray-400 truncate">
            {request.group_name || request.username ? `@${request.username}` : 'Группа не указана'}
          </p>
          {request.mutual_friends_count > 0 && (
            <p className="text-xs text-purple-400 mt-0.5">
              {request.mutual_friends_count} общих друзей
            </p>
          )}
        </div>

        {/* Действия */}
        <div className="flex gap-2">
          {isIncoming ? (
            <>
              <button
                onClick={() => handleAcceptRequest(request.request_id)}
                className="p-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-colors"
              >
                <UserCheck className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleRejectRequest(request.request_id)}
                className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
              >
                <UserX className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => handleCancelRequest(request.request_id)}
              className="p-2 bg-gray-500/20 text-gray-400 rounded-xl hover:bg-gray-500/30 transition-colors"
            >
              <Clock className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );

  // Рендер результата поиска
  const renderSearchResult = (result) => {
    const isFriend = result.friendship_status === 'friend';
    const isPending = result.friendship_status?.includes('pending');
    
    return (
      <motion.div
        key={result.telegram_id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
      >
        <div className="flex items-center gap-3">
          {/* Аватар */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium">
            {(result.first_name?.[0] || result.username?.[0] || '?').toUpperCase()}
          </div>
          
          {/* Информация */}
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
          </div>

          {/* Действия */}
          {isFriend ? (
            <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
              Друзья
            </span>
          ) : isPending ? (
            <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
              Ожидание
            </span>
          ) : (
            <button
              onClick={() => handleSendRequest(result.telegram_id)}
              className="p-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  const totalRequests = requests.incoming?.length || 0;

  return (
    <div className="min-h-screen pb-24">
      {/* Заголовок */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Друзья</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-white/10 rounded-xl text-white/70 hover:bg-white/20 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Табы */}
        <div className="flex gap-2 bg-white/5 p-1 rounded-2xl">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === 'requests' && totalRequests > 0;
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  hapticFeedback('impact', 'light');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all relative ${
                  isActive
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.name}</span>
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {totalRequests}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Контент */}
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {/* Вкладка: Друзья */}
          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              {/* Фильтр избранных */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">
                  {friends.length} {friends.length === 1 ? 'друг' : 'друзей'}
                </span>
                <button
                  onClick={() => {
                    setShowFavoritesOnly(!showFavoritesOnly);
                    hapticFeedback('impact', 'light');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                    showFavoritesOnly
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  <Star className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                  <span className="text-sm">Избранные</span>
                </button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : friends.length > 0 ? (
                friends.map((friend) => (
                  <FriendCard
                    key={friend.telegram_id}
                    friend={friend}
                    onPress={() => handleOpenProfile(friend)}
                    onToggleFavorite={() => handleToggleFavorite(friend.telegram_id, !friend.is_favorite)}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">
                    {showFavoritesOnly ? 'Нет избранных друзей' : 'Пока нет друзей'}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {showFavoritesOnly 
                      ? 'Отметьте друзей звёздочкой' 
                      : 'Найдите одногруппников и добавьте их в друзья'}
                  </p>
                  {!showFavoritesOnly && (
                    <button
                      onClick={() => setActiveTab('search')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl"
                    >
                      <Search className="w-4 h-4" />
                      Найти друзей
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Вкладка: Запросы */}
          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Входящие запросы */}
              {requests.incoming?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Входящие ({requests.incoming.length})
                  </h3>
                  <div className="space-y-2">
                    {requests.incoming.map((req) => renderRequestCard(req, true))}
                  </div>
                </div>
              )}

              {/* Исходящие запросы */}
              {requests.outgoing?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Отправленные ({requests.outgoing.length})
                  </h3>
                  <div className="space-y-2">
                    {requests.outgoing.map((req) => renderRequestCard(req, false))}
                  </div>
                </div>
              )}

              {/* Пусто */}
              {(!requests.incoming?.length && !requests.outgoing?.length) && (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">Нет запросов</h3>
                  <p className="text-gray-500 text-sm">
                    Здесь будут появляться запросы на дружбу
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Вкладка: Поиск */}
          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Поле поиска */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Поиск по имени или @username"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Быстрые фильтры */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl whitespace-nowrap"
                >
                  <Filter className="w-4 h-4" />
                  Расширенный поиск
                </button>
                {userSettings?.group_id && (
                  <button
                    onClick={async () => {
                      const data = await friendsAPI.searchUsers(user.id, '', userSettings.group_id);
                      setSearchResults(data.results || []);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 rounded-xl whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    Моя группа
                  </button>
                )}
              </div>

              {/* Результаты поиска */}
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map(renderSearchResult)}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">Никого не найдено</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">Введите имя или @username</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Модалки */}
      <FriendProfileModal
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        friend={selectedProfile}
        currentUserId={user?.id}
        userSettings={userSettings}
        onRemoveFriend={handleRemoveFriend}
        onToggleFavorite={handleToggleFavorite}
      />

      <FriendSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        userSettings={userSettings}
        currentUserId={user?.id}
        onSendRequest={handleSendRequest}
      />
    </div>
  );
};

export default FriendsSection;
