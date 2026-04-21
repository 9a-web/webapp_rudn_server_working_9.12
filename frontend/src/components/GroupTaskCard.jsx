import React from 'react';
import { Users, Calendar, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Карточка групповой задачи
 */
export const GroupTaskCard = ({ task, onClick, hapticFeedback }) => {
  // Вычисляем процент выполнения
  const completionPercentage = task.completion_percentage || 0;
  
  // Определяем цвет прогресс-бара
  const getProgressColor = (percentage) => {
    if (percentage === 100) return 'from-green-400 to-emerald-500';
    if (percentage >= 70) return 'from-blue-400 to-indigo-500';
    if (percentage >= 30) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  // Определяем бейдж статуса
  const getStatusBadge = () => {
    if (task.status === 'completed') {
      return (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
          Завершено
        </span>
      );
    }
    if (task.status === 'overdue') {
      return (
        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
          Просрочено
        </span>
      );
    }
    // Проверяем, новая ли задача (создана менее 24 часов назад)
    const createdAt = new Date(task.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      return (
        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
          Новая
        </span>
      );
    }
    return null;
  };

  // Форматируем дату дедлайна
  const formatDeadline = (deadline) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const now = new Date();
    const diffHours = (date - now) / (1000 * 60 * 60);
    
    if (diffHours < 0) return 'Просрочено';
    if (diffHours < 24) return `Через ${Math.floor(diffHours)}ч`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const handleClick = () => {
    if (hapticFeedback) hapticFeedback('impact', 'light');
    onClick(task);
  };

  return (
    <motion.div
      onClick={handleClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#2B2B3A]/90 to-[#1E1E28]/90 backdrop-blur-sm rounded-2xl p-4 cursor-pointer
                 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300
                 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98]"
    >
      {/* Заголовок с иконкой и статусом */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                        flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
          <Users className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-white text-sm leading-tight break-words">
              {task.title}
            </h3>
            {getStatusBadge()}
          </div>
          
          {task.description && (
            <p className="text-gray-400 text-xs line-clamp-1 break-words">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Прогресс выполнения */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-400">
            {task.completed_participants}/{task.total_participants} выполнили
          </span>
          <span className="text-white font-medium">
            {completionPercentage}%
          </span>
        </div>
        
        {/* Прогресс-бар */}
        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${getProgressColor(completionPercentage)} rounded-full`}
          />
        </div>
      </div>

      {/* Участники (аватары) */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex -space-x-2">
          {task.participants.slice(0, 5).map((participant, index) => (
            <div
              key={participant.telegram_id}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 
                         border-2 border-[#2B2B3A] flex items-center justify-center
                         shadow-lg"
              style={{ zIndex: 5 - index }}
            >
              <span className="text-white text-xs font-medium">
                {participant.first_name.charAt(0).toUpperCase()}
              </span>
              {/* Индикатор выполнения */}
              {participant.completed && (
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full 
                                border-2 border-[#2B2B3A] flex items-center justify-center">
                  <span className="text-[8px]">✓</span>
                </div>
              )}
            </div>
          ))}
          
          {task.total_participants > 5 && (
            <div className="w-7 h-7 rounded-full bg-gray-700 border-2 border-[#2B2B3A] 
                            flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-medium">
                +{task.total_participants - 5}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Дополнительная информация */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {/* Дедлайн */}
          {task.deadline && (
            <div className={`flex items-center gap-1 ${
              task.status === 'overdue' ? 'text-red-400' : 'text-gray-400'
            }`}>
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDeadline(task.deadline)}</span>
            </div>
          )}
          
          {/* Комментарии (пока показываем заглушку) */}
          <div className="flex items-center gap-1 text-gray-400">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>0</span>
          </div>
        </div>

        {/* Владелец */}
        <div className="text-gray-500 text-xs">
          👑 {task.participants.find(p => p.role === 'owner')?.first_name || 'Владелец'}
        </div>
      </div>
    </motion.div>
  );
};
