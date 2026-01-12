import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { modalVariants, backdropVariants } from '../utils/animations';

/**
 * Модальное окно подтверждения удаления задачи
 * Красное оформление для предупреждения пользователя
 */
export const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  taskText,
  hapticFeedback,
  isDeleting = false
}) => {
  // Блокируем скролл страницы при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleConfirm = () => {
    hapticFeedback && hapticFeedback('impact', 'heavy');
    onConfirm();
  };

  const handleClose = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Backdrop с красноватым оттенком */}
          <motion.div
            variants={backdropVariants}
            className="absolute inset-0 bg-black/60"
            onClick={handleClose}
          />
          
          {/* Модальное окно */}
          <motion.div
            variants={modalVariants}
            className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
          >
            {/* Красный заголовок */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Удалить задачу?
                  </h3>
                  <p className="text-red-100 text-sm">
                    Это действие нельзя отменить
                  </p>
                </div>
              </div>
            </div>
            
            {/* Содержимое */}
            <div className="p-6">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">Вы собираетесь удалить:</p>
                <p className="text-gray-900 font-medium line-clamp-3">
                  {taskText || 'Задача'}
                </p>
              </div>
              
              {/* Кнопки действий */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Удаление...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Удалить
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Кнопка закрытия */}
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteConfirmModal;
