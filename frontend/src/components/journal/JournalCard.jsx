import React from 'react';
import { motion } from 'framer-motion';
import { FileCheck, Users, Calendar, Crown, Clock } from 'lucide-react';

const COLORS = {
  purple: 'from-purple-400 to-pink-400',
  blue: 'from-blue-400 to-cyan-400',
  green: 'from-green-400 to-emerald-400',
  orange: 'from-orange-400 to-amber-400',
  red: 'from-red-400 to-rose-400',
  indigo: 'from-indigo-400 to-violet-400',
};

export const JournalCard = ({ journal, onClick, hapticFeedback }) => {
  const gradient = COLORS[journal.color] || COLORS.purple;
  
  const handleClick = () => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    onClick(journal);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
          <FileCheck className="w-6 h-6 text-white" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{journal.name}</h3>
            {journal.is_owner && (
              <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )}
          </div>
          
          <p className="text-sm text-gray-400 mt-0.5">{journal.group_name}</p>
          
          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Users className="w-3.5 h-3.5" />
              <span>{journal.linked_students}/{journal.total_students}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{journal.total_sessions} занятий</span>
            </div>
          </div>
          
          {/* Attendance Progress */}
          {journal.is_owner ? (
            journal.total_sessions > 0 && (
              <div className="mt-3">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all`}
                    style={{ width: `${Math.min(100, (journal.linked_students / Math.max(1, journal.total_students)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {journal.linked_students} из {journal.total_students} привязано
                </p>
              </div>
            )
          ) : (
            journal.my_attendance_percent !== null ? (
              <div className="mt-3">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all`}
                    style={{ width: `${journal.my_attendance_percent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Моя посещаемость: {journal.my_attendance_percent}%
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-yellow-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Ожидание привязки</span>
              </div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
};
