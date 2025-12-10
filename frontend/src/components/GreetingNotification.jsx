import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

export const GreetingNotification = ({ userFirstName, testHour = null }) => {
  const [greeting, setGreeting] = useState(null);

  useEffect(() => {
    // Check if we already showed greeting this session (skip check if testing)
    if (!testHour && sessionStorage.getItem('greetingShown')) return;

    const checkTime = () => {
      const now = new Date();
      const hour = testHour !== null ? testHour : now.getHours();
      
      let type = null;
      let title = "";
      let message = "";

      // Morning: 04:00 - 11:59
      if (hour >= 4 && hour < 12) {
        type = 'morning';
        title = userFirstName ? `Доброе утро, ${userFirstName}!` : 'Доброе утро!';
        message = 'Желаем продуктивного дня и отличного настроения ✨';
      } 
      // Night: 22:00 - 04:59
      else if (hour >= 22 || hour < 4) {
        type = 'night';
        title = userFirstName ? `Доброй ночи, ${userFirstName}!` : 'Доброй ночи!';
        message = 'Пора отдыхать и набираться сил перед завтрашним днем 🌙';
      }

      if (type) {
        setGreeting({ type, title, message });
        if (!testHour) {
          sessionStorage.setItem('greetingShown', 'true');
        }
        
        // Hide after 6 seconds
        setTimeout(() => {
          setGreeting(null);
        }, 6000);
      }
    };

    // Small delay to ensure app is loaded and transition is smooth
    // If testing, run immediately
    const delay = testHour !== null ? 100 : 1000;
    const timer = setTimeout(checkTime, delay);
    return () => clearTimeout(timer);
  }, [userFirstName, testHour]);

  if (!greeting) return null;

  const isMorning = greeting.type === 'morning';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-20 left-0 right-0 mx-auto z-[90] w-[95%] md:w-auto md:max-w-md flex justify-center pointer-events-none"
      >
        <div className={`pointer-events-auto w-full max-w-sm backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3 border 
          ${isMorning 
            ? 'bg-gradient-to-r from-orange-500/90 to-amber-500/90 border-orange-200/20 text-white' 
            : 'bg-gradient-to-r from-indigo-900/90 to-blue-900/90 border-indigo-200/20 text-white'
          }`}
        >
          <div className={`p-2 rounded-full flex-shrink-0 ${isMorning ? 'bg-white/20' : 'bg-white/10'}`}>
            {isMorning ? (
              <Sun className="w-6 h-6 text-yellow-200" />
            ) : (
              <Moon className="w-6 h-6 text-blue-200" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm truncate">
              {greeting.title}
            </h3>
            <p className="text-xs text-white/90 leading-tight mt-0.5">
              {greeting.message}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
