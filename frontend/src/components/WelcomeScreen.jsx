/**
 * Welcome Screen - Приветственный экран
 * Новый ретро-дизайн
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
    <div className="h-screen min-h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* Centered Logo */}
      <motion.div
        className="flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <img 
          src="/retro-logo-rudn.png"
          alt="RUDN Logo"
          className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain"
        />
      </motion.div>
    </div>
  );
};

export default WelcomeScreen;
