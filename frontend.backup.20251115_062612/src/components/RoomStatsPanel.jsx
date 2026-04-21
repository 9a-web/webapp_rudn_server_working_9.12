/**
 * Панель со статистикой комнаты
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getRoomStats } from '../services/roomsAPI';

const RoomStatsPanel = ({ roomId }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const data = await getRoomStats(roomId);
        setStats(data);
      } catch (err) {
        console.error('Error fetching room stats:', err);
        setError('Не удалось загрузить статистику');
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) {
      fetchStats();
    }
  }, [roomId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <p className="text-sm text-red-200">{error || 'Нет данных'}</p>
      </div>
    );
  }

  const statCards = [
    {
      icon: CheckCircle,
      label: 'Всего задач',
      value: stats.total_tasks,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: TrendingUp,
      label: 'Выполнено',
      value: stats.completed_tasks,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    {
      icon: Clock,
      label: 'В работе',
      value: stats.in_progress_tasks,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10'
    },
    {
      icon: AlertCircle,
      label: 'Просрочено',
      value: stats.overdue_tasks,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Статистика
        </h4>
        <span className="text-xs text-gray-500">
          {stats.completion_percentage}% завершено
        </span>
      </div>

      {/* Прогресс бар */}
      <div className="relative">
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.completion_percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-green-500 to-emerald-600"
          />
        </div>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {stats.completion_percentage}%
        </span>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                p-3 ${card.bgColor} rounded-xl
                border border-current/20
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-xs text-gray-400">
                  {card.label}
                </span>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Статистика участников */}
      {stats.participants_stats && stats.participants_stats.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Топ участников
          </h5>
          <div className="space-y-2">
            {stats.participants_stats.slice(0, 5).map((participant, index) => (
              <div
                key={participant.telegram_id}
                className="flex items-center gap-2 p-2
                         bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                {/* Место */}
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  text-xs font-bold
                  ${index === 0 
                    ? 'bg-yellow-500/20 text-yellow-400' 
                    : index === 1
                    ? 'bg-gray-400/20 text-gray-400'
                    : index === 2
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-gray-600/20 text-gray-500'
                  }
                `}>
                  {index + 1}
                </div>

                {/* Имя */}
                <span className="flex-1 text-sm text-gray-300 truncate">
                  {participant.first_name}
                </span>

                {/* Статистика */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {participant.tasks_completed > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      {participant.tasks_completed}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomStatsPanel;
