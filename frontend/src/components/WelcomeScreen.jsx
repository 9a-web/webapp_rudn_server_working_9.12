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
    <div className="h-screen min-h-screen bg-[#1E1E1E] flex flex-col items-center justify-center overflow-hidden relative px-4 sm:px-6 md:px-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 right-5 sm:right-10 w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 bg-[#A3F7BF]/10 rounded-full blur-3xl"
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
          className="absolute bottom-1/4 left-5 sm:left-10 w-28 h-28 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-[#A3F7BF]/10 rounded-full blur-3xl"
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

      {/* Centered Content Container */}
      <div className="flex flex-col items-center justify-center gap-6 sm:gap-8 md:gap-10 w-full max-w-[490px] sm:max-w-md md:max-w-lg lg:max-w-xl z-10">
        
        {/* Let's go logo - Fixed 470px on mobile, responsive on other devices */}
        <motion.div
          className="w-full flex justify-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="w-[470px] max-w-full sm:w-[400px] md:w-[450px] lg:w-[500px] aspect-square">
            <img 
              src="/letsgo.png"
              alt="Let's go"
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div>

        {/* Ready text image - Manage your RUDN schedule */}
        <motion.div
          className="w-full px-2 sm:px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <img 
            src="/ready_text.png"
            alt="Manage your RUDN schedule - Store and view your schedule on your phone"
            className="w-full h-auto object-contain mx-auto"
            style={{ 
              maxHeight: 'clamp(120px, 20vh, 250px)',
              maxWidth: '100%'
            }}
          />
        </motion.div>

        {/* Get Started Button - Responsive sizing */}
        <motion.button
          onClick={handleGetStarted}
          className="relative w-full max-w-xs sm:max-w-sm bg-[#A3F7BF] text-black font-semibold text-base sm:text-lg md:text-xl py-3 sm:py-4 md:py-5 px-6 rounded-full shadow-lg overflow-hidden"
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
