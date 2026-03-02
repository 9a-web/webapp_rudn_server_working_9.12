import React from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp } from 'lucide-react';

/**
 * Компонент для визуализации дерева рефералов
 */
export const ReferralTree = ({ tree, level = 1 }) => {
  if (!tree) return null;

  const levelColors = {
    1: {
      bg: 'from-green-500/20 to-emerald-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: 'text-green-500'
    },
    2: {
      bg: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: 'text-blue-500'
    },
    3: {
      bg: 'from-purple-500/20 to-pink-500/20',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      icon: 'text-purple-500'
    }
  };

  const colors = levelColors[level] || levelColors[1];
  const hasChildren = tree.children && tree.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Текущий узел */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: level * 0.1 }}
        className={`relative bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl p-3 min-w-[160px] backdrop-blur-sm`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-sm font-bold ${colors.text}`}>
              {tree.first_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">
                {tree.first_name || 'Пользователь'}
              </p>
              {tree.username && (
                <p className="text-xs text-gray-400">@{tree.username}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <TrendingUp className={`w-3 h-3 ${colors.icon}`} />
            <span className="text-gray-300">{tree.total_points || 0} $RDN</span>
          </div>
          {hasChildren && (
            <div className="flex items-center gap-1">
              <Users className={`w-3 h-3 ${colors.icon}`} />
              <span className="text-gray-300">{tree.children.length}</span>
            </div>
          )}
        </div>

        {/* Индикатор уровня */}
        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center text-xs font-bold ${colors.text}`}>
          {level}
        </div>
      </motion.div>

      {/* Линия к детям */}
      {hasChildren && (
        <div className={`w-0.5 h-6 ${colors.bg}`} />
      )}

      {/* Дети */}
      {hasChildren && (
        <div className="flex gap-4 mt-2">
          {tree.children.map((child, index) => (
            <div key={child.telegram_id || index} className="flex flex-col items-center">
              {/* Горизонтальная линия */}
              {tree.children.length > 1 && (
                <div className={`w-full h-6 border-l ${index === 0 ? 'border-t border-r' : index === tree.children.length - 1 ? 'border-t' : 'border-t'} ${colors.border}`} />
              )}
              {/* Рекурсивный вызов для потомков */}
              <ReferralTree tree={child} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
