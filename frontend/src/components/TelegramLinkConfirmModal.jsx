/**
 * TelegramLinkConfirmModal - Модальное окно подтверждения связки профиля
 * Показывается в Telegram Web App когда пользователь сканирует QR-код
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, User, Shield, CheckCircle, X, Loader2, AlertCircle } from 'lucide-react';
import { linkWebSession } from '../services/webSessionAPI';
import { useTelegram } from '../contexts/TelegramContext';

const TelegramLinkConfirmModal = ({ isOpen, onClose, sessionToken, onSuccess }) => {
  const { user, hapticFeedback } = useTelegram();
  const [status, setStatus] = useState('confirm'); // confirm, loading, success, error
  const [error, setError] = useState(null);
  const [fetchedPhotoUrl, setFetchedPhotoUrl] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Используем фото из user или загруженное через API
  const photoUrl = user?.photo_url || fetchedPhotoUrl;

  // Сбрасываем состояние при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setStatus('confirm');
      setError(null);
      setFetchedPhotoUrl(null);
    }
  }, [isOpen]);

  // Загружаем фото профиля через API только если нет в user
  useEffect(() => {
    if (!isOpen || !user?.id || user?.photo_url || photoLoading) return;
    
    let isCancelled = false;
    setPhotoLoading(true);
    
    // Получаем фото через API
    const loadPhoto = async () => {
      try {
        // Определяем базовый URL для API
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 
          (window.location.hostname === 'localhost' ? 'http://localhost:8001' : '');
        const apiUrl = `${backendUrl}/api/user-profile-photo-proxy/${user.id}`;
        
        console.log('Loading profile photo from:', apiUrl);
        
        const res = await fetch(apiUrl);
        if (res.ok && !isCancelled) {
          const blob = await res.blob();
          if (blob && blob.size > 0 && !isCancelled) {
            const url = URL.createObjectURL(blob);
            setFetchedPhotoUrl(url);
            console.log('Profile photo loaded successfully');
          }
        }
      } catch (err) {
        console.log('Could not load profile photo:', err);
      } finally {
        if (!isCancelled) {
          setPhotoLoading(false);
        }
      }
    };
    
    loadPhoto();
    
    return () => {
      isCancelled = true;
    };
  }, [isOpen, user?.id, user?.photo_url, photoLoading]);

  const handleConfirm = async () => {
    if (!user?.id || !sessionToken) return;
    
    hapticFeedback('impact', 'medium');
    setStatus('loading');
    
    try {
      const result = await linkWebSession(sessionToken, {
        telegram_id: user.id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
        photo_url: user.photo_url || photoUrl || null
      });
      
      if (result.success) {
        setStatus('success');
        hapticFeedback('notification', 'success');
        
        // Закрываем через 2 секунды
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 2000);
      } else {
        setError(result.message || 'Не удалось подключить профиль');
        setStatus('error');
        hapticFeedback('notification', 'error');
      }
    } catch (err) {
      console.error('Link session error:', err);
      setError('Произошла ошибка при подключении');
      setStatus('error');
      hapticFeedback('notification', 'error');
    }
  };

  const handleCancel = () => {
    hapticFeedback('impact', 'light');
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && status === 'confirm' && handleCancel()}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-xl"
        >
          {/* Кнопка закрытия */}
          {status === 'confirm' && (
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}

          <AnimatePresence mode="wait">
            {/* Подтверждение */}
            {status === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                {/* Иконка */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6"
                >
                  <Link2 className="w-10 h-10 text-white" />
                </motion.div>

                {/* Заголовок */}
                <h2 className="text-xl font-bold text-white mb-2">
                  Подключить профиль?
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  Веб-версия приложения запрашивает доступ к вашему профилю Telegram
                </p>

                {/* Информация о профиле */}
                <div className="bg-gray-700/50 rounded-2xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    {/* Аватар профиля */}
                    <div className="relative w-14 h-14 flex-shrink-0">
                      {photoLoading ? (
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-indigo-500/30 animate-pulse">
                          <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
                        </div>
                      ) : photoUrl ? (
                        <img 
                          src={photoUrl} 
                          alt={user?.first_name}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-indigo-500/50"
                          onError={(e) => {
                            e.target.onerror = null;
                            setFetchedPhotoUrl(null);
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-indigo-500/30">
                          <User className="w-7 h-7 text-white" />
                        </div>
                      )}}
                      {/* Индикатор верификации */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-800">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-semibold text-white text-lg truncate">
                        {user?.first_name} {user?.last_name}
                      </p>
                      {user?.username && (
                        <p className="text-indigo-400 text-sm">@{user.username}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Разрешения */}
                <div className="bg-gray-700/30 rounded-xl p-4 mb-6 text-left">
                  <p className="text-gray-400 text-xs font-medium mb-3 uppercase tracking-wide">
                    Будет передано:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Имя и фамилия</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Username</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Ваши настройки приложения</span>
                    </div>
                  </div>
                </div>

                {/* Кнопки */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Разрешить
                  </button>
                </div>
              </motion.div>
            )}

            {/* Загрузка */}
            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-white font-medium">Подключение...</p>
              </motion.div>
            )}

            {/* Успех */}
            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                {/* Аватар с галочкой успеха */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="relative w-24 h-24 mx-auto mb-4"
                >
                  {photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt={user?.first_name}
                      className="w-24 h-24 rounded-full object-cover ring-4 ring-green-500/30"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center ring-4 ring-green-500/30">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.3 }}
                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                  >
                    <CheckCircle className="w-6 h-6 text-white" />
                  </motion.div>
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Профиль подключен!
                </h2>
                <p className="text-gray-400 text-sm">
                  Теперь вы можете использовать приложение в браузере
                </p>
              </motion.div>
            )}

            {/* Ошибка */}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">
                  Ошибка
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                  {error}
                </p>
                <button
                  onClick={() => setStatus('confirm')}
                  className="py-2 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                >
                  Попробовать снова
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TelegramLinkConfirmModal;
