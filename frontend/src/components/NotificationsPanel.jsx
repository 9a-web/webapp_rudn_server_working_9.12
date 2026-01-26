/**
 * NotificationsPanel - Панель уведомлений
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Bell, Check, CheckCheck, Settings, Trash2,
  Users, Calendar, Home, Trophy, MessageSquare, AlertCircle,
  ChevronRight, RefreshCw, UserPlus, UserCheck, Clock,
  ListTodo, ClipboardCheck, Award, Star, Megaphone, Send,
  BookOpen, GraduationCap, Sparkles, Gift, Zap, Info
} from 'lucide-react';
import { notificationsAPI } from '../services/notificationsAPI';
import { friendsAPI } from '../services/friendsAPI';
import NotificationSettingsPanel from './NotificationSettingsPanel';

// Конфиг категорий
const CATEGORY_CONFIG = {
  study: { icon: Calendar, color: 'blue', label: 'Учебные' },
  social: { icon: Users, color: 'purple', label: 'Социальные' },
  rooms: { icon: Home, color: 'green', label: 'Комнаты' },
  journal: { icon: BookOpen, color: 'indigo', label: 'Журнал' },
  achievements: { icon: Trophy, color: 'yellow', label: 'Достижения' },
  system: { icon: AlertCircle, color: 'gray', label: 'Системные' }
};

// Маппинг типов уведомлений на иконки
const TYPE_ICONS = {
  // Учебные
  class_starting: Clock,
  schedule_changed: Calendar,
  task_deadline: ListTodo,
  
  // Социальные
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  friend_joined: Users,
  
  // Комнаты
  room_invite: Home,
  room_task_new: ListTodo,
  room_task_assigned: ClipboardCheck,
  room_task_completed: CheckCheck,
  room_member_joined: Users,
  
  // Журнал
  journal_attendance: BookOpen,
  journal_invite: GraduationCap,
  
  // Достижения
  achievement_earned: Award,
  level_up: Star,
  
  // Системные
  app_update: Sparkles,
  announcement: Megaphone,
  admin_message: Send,
  
  // Дефолт
  default: Bell
};

// Получить иконку по типу уведомления
const getNotificationIcon = (type) => {
  return TYPE_ICONS[type] || TYPE_ICONS.default;
};

const NotificationsPanel = ({ 
  isOpen, 
  onClose, 
  telegramId, 
  hapticFeedback,
  onNavigate 
}) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Загрузка уведомлений
  const loadNotifications = useCallback(async () => {
    if (!telegramId) return;
    
    setIsLoading(true);
    try {
      const data = await notificationsAPI.getNotifications(telegramId, 50);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [telegramId]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Отметить как прочитанное
  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId, telegramId);
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Отметить все как прочитанные
  const handleMarkAllAsRead = async () => {
    hapticFeedback?.('impact', 'medium');
    try {
      await notificationsAPI.markAllAsRead(telegramId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Скрыть уведомление
  const handleDismiss = async (notificationId, e) => {
    e?.stopPropagation();
    hapticFeedback?.('impact', 'light');
    try {
      await notificationsAPI.dismissNotification(notificationId, telegramId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  // Выполнить действие
  const handleAction = async (notification, actionId, e) => {
    e?.stopPropagation();
    hapticFeedback?.('impact', 'medium');
    setActionLoading(`${notification.id}-${actionId}`);
    
    try {
      // Выполняем действие на бэкенде
      await notificationsAPI.performAction(notification.id, telegramId, actionId);
      
      // Специальная обработка для разных типов
      if (notification.type === 'friend_request') {
        const requestId = notification.data?.request_id;
        if (actionId === 'accept' && requestId) {
          await friendsAPI.acceptFriendRequest(requestId, telegramId);
        } else if (actionId === 'reject' && requestId) {
          await friendsAPI.rejectFriendRequest(requestId, telegramId);
        }
      }
      
      // Обновляем UI
      setNotifications(prev => prev.map(n => 
        n.id === notification.id ? { ...n, action_taken: actionId, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      hapticFeedback?.('notification', 'success');
    } catch (error) {
      console.error('Error performing action:', error);
      hapticFeedback?.('notification', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Группировка по дням
  const groupedNotifications = notifications.reduce((groups, notification) => {
    const date = new Date(notification.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let key;
    if (date.toDateString() === today.toDateString()) {
      key = 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Вчера';
    } else {
      key = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(notification);
    return groups;
  }, {});

  // Рендер карточки уведомления
  const renderNotification = (notification) => {
    const config = CATEGORY_CONFIG[notification.category] || CATEGORY_CONFIG.system;
    const NotifIcon = getNotificationIcon(notification.type);
    const hasActions = notification.actions?.length > 0 && !notification.action_taken;
    
    // Цвета для иконок по категориям
    const iconColors = {
      study: 'text-blue-400',
      social: 'text-purple-400',
      rooms: 'text-green-400',
      journal: 'text-indigo-400',
      achievements: 'text-yellow-400',
      system: 'text-gray-400'
    };
    
    const bgColors = {
      study: 'bg-blue-500/20',
      social: 'bg-purple-500/20',
      rooms: 'bg-green-500/20',
      journal: 'bg-indigo-500/20',
      achievements: 'bg-yellow-500/20',
      system: 'bg-gray-500/20'
    };
    
    return (
      <motion.div
        key={notification.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className={`relative p-4 rounded-2xl transition-all ${
          notification.read 
            ? 'bg-white/5' 
            : 'bg-white/10 border border-white/20'
        }`}
        onClick={() => !notification.read && handleMarkAsRead(notification.id)}
      >
        {/* Индикатор непрочитанного */}
        {!notification.read && (
          <div className="absolute top-4 right-4 w-2 h-2 bg-purple-500 rounded-full" />
        )}
        
        <div className="flex gap-3">
          {/* Иконка */}
          <div className={`w-10 h-10 rounded-xl ${bgColors[notification.category] || bgColors.system} flex items-center justify-center flex-shrink-0`}>
            <NotifIcon className={`w-5 h-5 ${iconColors[notification.category] || iconColors.system}`} />
          </div>
          
          {/* Контент */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-white">{notification.title}</h4>
              <span className="text-xs text-gray-500 flex-shrink-0">{notification.time_ago}</span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{notification.message}</p>
            
            {/* Действия */}
            {hasActions && (
              <div className="flex gap-2 mt-3">
                {notification.actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={(e) => handleAction(notification, action.id, e)}
                    disabled={actionLoading === `${notification.id}-${action.id}`}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      action.type === 'primary'
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    } ${actionLoading === `${notification.id}-${action.id}` ? 'opacity-50' : ''}`}
                  >
                    {actionLoading === `${notification.id}-${action.id}` ? '...' : action.label}
                  </button>
                ))}
              </div>
            )}
            
            {/* Показываем выполненное действие */}
            {notification.action_taken && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-green-400">
                <Check className="w-4 h-4" />
                {notification.actions?.find(a => a.id === notification.action_taken)?.label || 'Выполнено'}
              </div>
            )}
          </div>
          
          {/* Кнопка удаления */}
          <button
            onClick={(e) => handleDismiss(notification.id, e)}
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-white/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  if (showSettings) {
    return (
      <NotificationSettingsPanel
        isOpen={true}
        onClose={() => setShowSettings(false)}
        telegramId={telegramId}
        hapticFeedback={hapticFeedback}
      />
    );
  }

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

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-gray-900 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-xl">
                  <Bell className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Уведомления</h2>
                  {unreadCount > 0 && (
                    <p className="text-sm text-gray-400">{unreadCount} непрочитанных</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                    title="Прочитать все"
                  >
                    <CheckCheck className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(groupedNotifications).map(([date, items]) => (
                    <div key={date}>
                      <h3 className="text-sm font-medium text-gray-500 mb-3">{date}</h3>
                      <div className="space-y-2">
                        {items.map(renderNotification)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-white/5 rounded-2xl mb-4">
                    <Bell className="w-12 h-12 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-400 mb-2">Нет уведомлений</h3>
                  <p className="text-sm text-gray-500">
                    Здесь будут появляться ваши уведомления
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationsPanel;
