/**
 * Лента активности комнаты
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Check, UserPlus, UserMinus, Trash2, MessageSquare, Edit, Shield } from 'lucide-react';
import { getRoomActivity } from '../services/roomsAPI';

const ACTION_CONFIG = {
  task_created: {
    icon: Check,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    label: 'создал задачу'
  },
  task_completed: {
    icon: Check,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    label: 'выполнил задачу'
  },
  task_deleted: {
    icon: Trash2,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    label: 'удалил задачу'
  },
  comment_added: {
    icon: MessageSquare,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    label: 'прокомментировал'
  },
  user_joined: {
    icon: UserPlus,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    label: 'присоединился к комнате'
  },
  user_left: {
    icon: UserMinus,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    label: 'покинул комнату'
  },
  room_updated: {
    icon: Edit,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    label: 'обновил комнату'
  },
  role_changed: {
    icon: Shield,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    label: 'изменил роль участника'
  }
};

const RoomActivityFeed = ({ roomId, limit = 50 }) => {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setIsLoading(true);
        const data = await getRoomActivity(roomId, limit);
        setActivities(data);
      } catch (err) {
        console.error('Error fetching room activity:', err);
        setError('Не удалось загрузить историю активности');
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) {
      fetchActivities();
    }
  }, [roomId, limit]);

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  const renderActivityDetails = (activity) => {
    const details = activity.action_details || {};
    
    switch (activity.action_type) {
      case 'task_created':
      case 'task_completed':
      case 'task_deleted':
        return details.task_title ? (
          <span className="text-blue-300">«{details.task_title}»</span>
        ) : null;
      
      case 'role_changed':
        return details.target_name && details.new_role ? (
          <>
            <span className="text-gray-400">→</span>
            <span className="text-purple-300">{details.target_name}</span>
            <span className="text-gray-500">({details.new_role})</span>
          </>
        ) : null;
      
      case 'comment_added':
        return details.comment_text ? (
          <span className="text-xs text-gray-400 italic">"{details.comment_text}"</span>
        ) : null;
      
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <p className="text-sm text-red-200">{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          Пока нет активности в комнате
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Активность ({activities.length})
        </h4>
      </div>

      {/* Лента активности */}
      <div className="space-y-3">
        {activities.map((activity, index) => {
          const config = ACTION_CONFIG[activity.action_type] || {
            icon: Activity,
            color: 'text-gray-400',
            bgColor: 'bg-gray-500/10',
            label: 'выполнил действие'
          };
          const Icon = config.icon;

          return (
            <motion.div
              key={activity.activity_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex gap-3 group"
            >
              {/* Иконка действия */}
              <div className={`
                flex-shrink-0 w-10 h-10 ${config.bgColor} ${config.color}
                rounded-xl flex items-center justify-center
              `}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Описание */}
              <div className="flex-1 min-w-0 py-1">
                <div className="flex flex-wrap items-baseline gap-1 text-sm">
                  <span className="font-medium text-white">
                    {activity.first_name}
                  </span>
                  <span className="text-gray-400">
                    {config.label}
                  </span>
                  {renderActivityDetails(activity)}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatTimeAgo(activity.created_at)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default RoomActivityFeed;
