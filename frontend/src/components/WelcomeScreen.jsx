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
    <div className="h-screen min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Top Content - Logo and Text */}
      <div className="flex flex-col items-center -mt-16">
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
            style={{ width: '65px', height: '65px' }}
            className="object-contain"
          />
        </motion.div>

        {/* Welcome Text */}
        <motion.div
          className="mt-3 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        >
          <h1 
            className="text-white text-[32px] leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}
          >
            Welcome
          </h1>
          <h2 
            className="text-white text-[32px] leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}
          >
            to RUDN GO
          </h2>
        </motion.div>

        {/* Bot Username */}
        <motion.p
          className="mt-1 text-[16px]"
          style={{ 
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", 
            fontWeight: 500,
            color: '#B9B9B9'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        >
          @rudn_mosbot
        </motion.p>
      </div>

      {/* Shapes Image */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
      >
        <img 
          src="/shapes-rudn-go.png"
          alt="RUDN GO Shapes"
          style={{ width: '420px', height: '188px' }}
          className="object-contain"
        />
      </motion.div>

      {/* Get Started Button */}
      <motion.button
        onClick={handleGetStarted}
        className="mt-8 cursor-pointer active:scale-95 transition-transform"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.9, ease: "easeOut" }}
        whileTap={{ scale: 0.95 }}
      >
        <img 
          src="/button-rudn-go.png"
          alt="Погрузиться в RUDN GO"
          style={{ width: '280px', height: 'auto' }}
          className="object-contain"
        />
      </motion.button>
    </div>
  );
};

export default WelcomeScreen;
