import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Droplets, Wind } from 'lucide-react';
import { weatherAPI } from '../services/api';

// Standalone версия компонента для показа в очереди
export const GreetingNotificationContent = ({ greeting, onClose }) => {
  const weather = greeting.weather;
  const isMorning = greeting.type === 'morning';
  
  return (
    <motion.div
      key={greeting.type}
      initial={{ y: -20, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ 
        opacity: 0, 
        scale: 0.9,
        transition: { duration: 0.4, ease: "easeInOut" } 
      }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed top-4 left-0 right-0 mx-auto z-[90] w-[95%] md:w-auto md:max-w-md flex justify-center pointer-events-none"
    >
      <div 
        onClick={onClose}
        className={`cursor-pointer active:scale-95 transition-transform pointer-events-auto w-full max-w-sm px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl backdrop-saturate-150
        ${isMorning 
          ? 'bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 border-orange-300/30 text-white shadow-orange-500/25' 
          : 'bg-gradient-to-br from-indigo-800 via-blue-900 to-slate-900 border-indigo-400/30 text-white shadow-indigo-500/25'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full flex-shrink-0 ${isMorning ? 'bg-white/25' : 'bg-white/15'}`}>
            {isMorning ? (
              <Sun className="w-6 h-6 text-yellow-100" />
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

        {/* Weather info - for both morning and night */}
        {weather && (
          <div className={`mt-3 pt-3 border-t ${isMorning ? 'border-white/25' : 'border-white/20'}`}>
            <div className="flex items-center justify-between">
              {/* Temperature with icon */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{weather.icon}</span>
                <div>
                  <div className="text-xl font-bold">{weather.temperature}°C</div>
                  <div className="text-xs text-white/80">
                    ощущается {weather.feels_like}°C
                  </div>
                </div>
              </div>
              
              {/* Humidity and wind */}
              <div className="flex flex-col gap-1 text-xs text-white/90">
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5" />
                  <span>{weather.wind_speed} км/ч</span>
                </div>
              </div>
            </div>
            
            {/* Weather description */}
            <div className="mt-2 text-xs text-white/80 text-center">
              Москва • Хорошего дня!
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const GreetingNotification = ({ userFirstName, testHour = null, onRequestShow }) => {
  const [greeting, setGreeting] = useState(null);

  useEffect(() => {
    // Check if we already showed greeting this session (skip check if testing)
    if (!testHour && sessionStorage.getItem('greetingShown')) return;

    const checkTime = async () => {
      const now = new Date();
      const hour = testHour !== null ? testHour : now.getHours();
      
      let type = null;
      let title = "";
      let message = "";
      let weather = null;

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

      // Fetch weather for both morning and night greetings
      if (type) {
        try {
          weather = await weatherAPI.getWeather();
        } catch (error) {
          console.warn('Failed to fetch weather:', error);
        }

        const greetingData = { type, title, message, weather };
        
        if (!testHour) {
          sessionStorage.setItem('greetingShown', 'true');
        }
        
        // Если есть callback для очереди - используем его
        if (onRequestShow) {
          onRequestShow(greetingData);
        } else {
          // Fallback на старое поведение
          setGreeting(greetingData);
          setTimeout(() => {
            setGreeting(null);
          }, 10000); // 10 seconds display time
        }
      }
    };

    // Small delay to ensure app is loaded and transition is smooth
    // If testing, run immediately
    const delay = testHour !== null ? 100 : 1000;
    const timer = setTimeout(checkTime, delay);
    return () => clearTimeout(timer);
  }, [userFirstName, testHour, onRequestShow]);

  // Если используем очередь, не рендерим ничего здесь
  if (onRequestShow) {
    return null;
  }

  // Fallback рендеринг для обратной совместимости
  return (
    <AnimatePresence>
      {greeting && (
        <GreetingNotificationContent 
          greeting={greeting} 
          onClose={() => setGreeting(null)} 
        />
      )}
    </AnimatePresence>
  );
};
