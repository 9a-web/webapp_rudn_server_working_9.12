/**
 * Welcome Screen - Первый экран приветствия при регистрации
 * Дизайн: темный фон с неоновым зеленым акцентом
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useTelegram } from '../contexts/TelegramContext';

const WelcomeScreen = ({ onGetStarted }) => {
  const { hapticFeedback } = useTelegram();

  const handleGetStarted = () => {
    if (hapticFeedback) {
      hapticFeedback('impact', 'medium');
    }
    onGetStarted();
  };

  return (
    <div className="h-screen min-h-screen bg-[#1E1E1E] flex flex-col items-center justify-between overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 right-10 w-32 h-32 bg-[#A3F7BF]/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-40 left-10 w-40 h-40 bg-[#A3F7BF]/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </div>

      {/* Let's go logo - Full width */}
      <motion.div
        className="w-full mt-12 mb-8 z-10"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <img 
          src="/letsgo.png"
          alt="Let's go"
          className="w-full h-auto object-cover"
          style={{ maxHeight: '300px' }}
        />
      </motion.div>

      {/* Content Container */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md px-6 z-10">

        {/* Ready text image - Manage your RUDN schedule */}
        <motion.div
          className="w-full px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <img 
            src="/ready_text.png"
            alt="Manage your RUDN schedule - Store and view your schedule on your phone"
            className="w-full h-auto object-contain"
            style={{ maxWidth: '100%' }}
          />
        </motion.div>
      </div>

      {/* Get Started Button */}
      <div className="w-full px-6 pb-12 z-10">
        <motion.button
          onClick={handleGetStarted}
          className="relative w-full max-w-sm mx-auto block bg-[#A3F7BF] text-black font-semibold text-lg py-4 rounded-full shadow-lg overflow-hidden"
          style={{
            boxShadow: '0 10px 30px rgba(163, 247, 191, 0.4), 0 0 20px rgba(163, 247, 191, 0.3)'
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 1
            }}
          />
          <span className="relative z-10">Get Started</span>
        </motion.button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
