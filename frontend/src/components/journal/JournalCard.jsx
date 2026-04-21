import React from 'react';
import { motion } from 'framer-motion';
import { FileCheck, Crown } from 'lucide-react';

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
      className="bg-gray-50 rounded-2xl p-4 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center justify-start gap-3">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
          <FileCheck className="w-6 h-6 text-white" />
        </div>
        
        {/* Content */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[#1C1C1E] truncate">{journal.group_name}</h3>
            {journal.is_owner && (
              <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          
          {journal.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{journal.description}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
