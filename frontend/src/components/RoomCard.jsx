/**
 * Компонент карточки комнаты
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronRight } from 'lucide-react';
import { getRoomColor } from '../constants/roomColors';

const RoomCard = ({ room, onClick }) => {
  const {
    name,
    total_participants = 0,
    total_tasks = 0,
    completed_tasks = 0,
    completion_percentage = 0,
    color = 'blue'
  } = room;
  
  const colorScheme = getRoomColor(color);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex-shrink-0 w-[160px] min-w-[160px] h-[200px] bg-gradient-to-br ${colorScheme.cardGradient} 
                 rounded-[24px] p-4 cursor-pointer shadow-lg ${colorScheme.shadowColor} 
                 border ${colorScheme.borderColor} flex flex-col
                 ${colorScheme.hoverShadow} transition-shadow snap-start`}
    >
      {/* Заголовок с иконкой */}
      <div className="flex items-start gap-2 mb-3">
        <div className={`flex-shrink-0 w-8 h-8 bg-gradient-to-br ${colorScheme.buttonGradient} 
                       rounded-xl flex items-center justify-center shadow-md`}>
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">
            {name}
          </h3>
        </div>
      </div>

      {/* Прогресс выполнения */}
      <div className="flex-1 flex flex-col justify-center space-y-2">
        {/* Круговой прогресс */}
        <div className="flex items-center justify-center">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              {/* Фоновый круг */}
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                style={{ color: `${colorScheme.accentColor}33` }}
              />
              {/* Прогресс круг */}
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke={colorScheme.accentColor}
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - completion_percentage / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold" style={{ color: colorScheme.accentColor }}>
                {completion_percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="text-center">
          <p className="text-xs text-gray-600">
            {completed_tasks}/{total_tasks} задач
          </p>
        </div>
      </div>

      {/* Участники */}
      <div className={`flex items-center justify-between mt-auto pt-2 border-t ${colorScheme.borderColor}`}>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" style={{ color: colorScheme.accentColor }} />
          <span className="text-xs font-medium text-gray-700">
            {total_participants}
          </span>
        </div>
        <ChevronRight className="w-4 h-4" style={{ color: `${colorScheme.accentColor}99` }} />
      </div>
    </motion.div>
  );
};

export default RoomCard;
