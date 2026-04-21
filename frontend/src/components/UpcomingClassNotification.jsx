import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { translateDiscipline } from '../i18n/subjects';
import { useTranslation } from 'react-i18next';

export const UpcomingClassNotification = ({ schedule }) => {
  const { t, i18n } = useTranslation();
  const [nextClass, setNextClass] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [dismissedClassId, setDismissedClassId] = useState(null);

  useEffect(() => {
    const checkUpcomingClass = () => {
      if (!schedule || schedule.length === 0) {
        setNextClass(null);
        return;
      }

      const now = new Date();
      const currentDayName = now.toLocaleDateString('ru-RU', { weekday: 'long' });
      const formattedDayName = currentDayName.charAt(0).toUpperCase() + currentDayName.slice(1);

      const todayClasses = schedule.filter(item => item.day === formattedDayName);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      let upcoming = null;
      let minDiff = Infinity;

      for (const classItem of todayClasses) {
        if (!classItem.time) continue;
        const timeRange = classItem.time.split('-');
        if (timeRange.length !== 2) continue;

        const [startHour, startMin] = timeRange[0].trim().split(':').map(Number);
        const startTimeInMinutes = startHour * 60 + startMin;

        const diff = startTimeInMinutes - currentMinutes;

        // Show if starting in 20 minutes or less
        if (diff > 0 && diff <= 20) {
           if (diff < minDiff) {
             minDiff = diff;
             upcoming = classItem;
           }
        }
      }

      if (upcoming) {
        // Если это новая пара (отличается от скрытой), показываем уведомление
        const classId = `${upcoming.discipline}-${upcoming.time}`;
        if (classId !== dismissedClassId) {
          setIsDismissed(false);
        }
        setNextClass(upcoming);
        setTimeLeft(minDiff);
      } else {
        setNextClass(null);
        setTimeLeft(null);
        // Сбрасываем скрытие когда нет предстоящих пар
        setIsDismissed(false);
        setDismissedClassId(null);
      }
    };

    checkUpcomingClass();
    const interval = setInterval(checkUpcomingClass, 10000); // Check every 10 sec
    return () => clearInterval(interval);
  }, [schedule, dismissedClassId]);

  // Функция скрытия уведомления
  const handleDismiss = () => {
    if (nextClass) {
      const classId = `${nextClass.discipline}-${nextClass.time}`;
      setDismissedClassId(classId);
      setIsDismissed(true);
    }
  };

  if (!nextClass || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-4 left-0 right-0 mx-auto z-[100] w-[95%] md:w-auto md:max-w-md flex justify-center pointer-events-none"
      >
        <div 
          onClick={handleDismiss}
          className="pointer-events-auto w-full max-w-sm bg-black/80 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3 border border-white/10 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="bg-blue-500/20 p-2 rounded-full flex-shrink-0">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-xs text-gray-300 font-medium">
              {t('classStatus.upcomingIn', { minutes: timeLeft })}
            </p>
            <p className="text-sm font-bold truncate">
              {translateDiscipline(nextClass.discipline, i18n.language)}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
               {nextClass.auditory && <span>{nextClass.auditory}</span>}
               {nextClass.auditory && nextClass.teacher && <span>•</span>}
               {nextClass.teacher && <span>{nextClass.teacher}</span>}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
