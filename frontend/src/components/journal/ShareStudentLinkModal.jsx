import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, Check, Link2, Share2 } from 'lucide-react';

const COLORS = {
  purple: 'from-purple-400 to-pink-400',
  blue: 'from-blue-400 to-cyan-400',
  green: 'from-green-400 to-emerald-400',
  orange: 'from-orange-400 to-amber-400',
  red: 'from-red-400 to-rose-400',
  indigo: 'from-indigo-400 to-violet-400',
};

/**
 * Модальное окно для отправки персональных ссылок студентам через Telegram
 * При выборе студента открывается системный диалог Telegram для отправки ссылки
 */
export const ShareStudentLinkModal = ({
  isOpen,
  onClose,
  students,
  journalName,
  gradient = 'from-purple-400 to-pink-400',
  hapticFeedback,
  webApp, // Telegram WebApp instance
}) => {
  // Фильтруем только непривязанных студентов
  const unlinkedStudents = useMemo(() => {
    return students
      .filter(s => !s.is_linked)
      .sort((a, b) => {
        const getLastName = (name) => {
          if (!name) return '';
          return name.trim().split(' ')[0].toLowerCase();
        };
        return getLastName(a.full_name).localeCompare(getLastName(b.full_name), 'ru');
      });
  }, [students]);

  // Открыть диалог отправки ссылки в Telegram
  const handleShareStudentLink = (student) => {
    const link = student.invite_link_webapp || student.invite_link;
    if (!link) return;

    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }

    // Формируем текст сообщения
    const messageText = `Привет! Перейди по ссылке, чтобы привязаться к журналу «${journalName}» как "${student.full_name}"`;
    
    // Создаем URL для шаринга через Telegram
    // Формат: https://t.me/share/url?url=LINK&text=TEXT
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(messageText)}`;

    // Если мы внутри Telegram WebApp - используем openTelegramLink для лучшего UX
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else if (webApp?.openLink) {
      // Fallback на openLink
      webApp.openLink(shareUrl);
    } else {
      // Если не в Telegram - открываем в новой вкладке
      window.open(shareUrl, '_blank');
    }

    // Закрываем модальное окно после отправки
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-[#1C1C1E] rounded-t-3xl overflow-hidden max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`bg-gradient-to-br ${gradient} p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Привязать студента</h2>
                  <p className="text-white/70 text-sm">Отправьте ссылку через Telegram</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {unlinkedStudents.length === 0 ? (
              <div className="text-center py-10">
                <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-medium">Все студенты привязаны!</p>
                <p className="text-gray-400 text-sm mt-1">
                  Нет студентов, ожидающих привязки
                </p>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-4">
                  Выберите студента и отправьте ему персональную ссылку для привязки к журналу
                </p>
                <div className="space-y-2">
                  {unlinkedStudents.map((student, index) => (
                    <motion.button
                      key={student.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleShareStudentLink(student)}
                      className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left group"
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{student.full_name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          Не привязан
                        </p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${gradient} rounded-lg text-white text-sm opacity-80 group-hover:opacity-100 transition-opacity`}>
                        <Share2 className="w-4 h-4" />
                        <span>Отправить</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="p-4 bg-white/5 border-t border-white/10">
            <p className="text-center text-gray-500 text-xs">
              После получения ссылки студент должен открыть её в Telegram
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ShareStudentLinkModal;
