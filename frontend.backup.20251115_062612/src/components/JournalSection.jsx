import React from 'react';
import { motion } from 'framer-motion';
import { FileCheck } from 'lucide-react';

export const JournalSection = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-[calc(100vh-140px)] bg-white rounded-t-[40px] mt-6 p-6"
    >
      {/* Header секции */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
          <FileCheck className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1C1C1E]">Журнал</h2>
          <p className="text-sm text-[#999999]">Электронный журнал посещений</p>
        </div>
      </div>

      {/* Placeholder контент */}
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400/10 to-pink-400/10 flex items-center justify-center mb-4">
          <FileCheck className="w-12 h-12 text-purple-500" strokeWidth={2} />
        </div>
        <h3 className="text-lg font-semibold text-[#1C1C1E] mb-2">
          Раздел в разработке
        </h3>
        <p className="text-sm text-[#999999] text-center max-w-xs">
          Здесь будет журнал ваших действий
        </p>
      </div>
    </motion.div>
  );
};
