/**
 * TelegramLinkScreen - Экран связки с Telegram профилем через QR-код
 * Показывается при открытии в браузере без Telegram WebApp
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, RefreshCw, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { createWebSession, createSessionWebSocket, getWebSessionStatus } from '../services/webSessionAPI';

const TelegramLinkScreen = ({ onLinked }) => {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, pending, linked, expired, error
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  // Создание новой сессии
  const createSession = useCallback(async () => {
    setStatus('loading');
    setError(null);
    
    try {
      const sessionData = await createWebSession();
      console.log('📱 Created session:', sessionData);
      setSession(sessionData);
      setStatus('pending');
      
      // Вычисляем оставшееся время
      const expiresAt = new Date(sessionData.expires_at);
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(diff);
      
      // Подключаемся к WebSocket
      connectWebSocket(sessionData.session_token);
      
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Не удалось создать сессию');
      setStatus('error');
    }
  }, []);

  // Подключение к WebSocket
  const connectWebSocket = useCallback((sessionToken) => {
    // Закрываем предыдущее соединение
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    wsRef.current = createSessionWebSocket(sessionToken, {
      onConnected: () => {
        console.log('✅ WebSocket connected for session');
      },
      onLinked: (userData) => {
        console.log('🎉 Session linked!', userData);
        setStatus('linked');
        
        // Сохраняем данные пользователя в localStorage
        localStorage.setItem('telegram_user', JSON.stringify({
          id: userData.telegram_id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          photo_url: userData.photo_url
        }));
        
        if (userData.user_settings) {
          localStorage.setItem('user_settings', JSON.stringify(userData.user_settings));
        }
        
        // Вызываем callback
        setTimeout(() => {
          onLinked?.(userData);
        }, 1500);
      },
      onExpired: () => {
        console.log('⏰ Session expired');
        setStatus('expired');
      },
      onError: (message) => {
        console.error('❌ WebSocket error:', message);
        setError(message);
        setStatus('error');
      }
    });
  }, [onLinked]);

  // Таймер обратного отсчёта
  useEffect(() => {
    if (status !== 'pending' || timeLeft === null) return;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, timeLeft]);

  // Создаём сессию при монтировании
  useEffect(() => {
    createSession();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [createSession]);

  // Форматирование времени
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800/80 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-700/50"
      >
        {/* Заголовок */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <Smartphone className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Подключите Telegram
          </h1>
          <p className="text-gray-400 text-sm">
            Отсканируйте QR-код в приложении Telegram для входа
          </p>
        </div>

        {/* QR-код или статус */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {/* Загрузка */}
            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-400">Создание сессии...</p>
              </motion.div>
            )}

            {/* QR-код */}
            {status === 'pending' && session && (
              <motion.div
                key="qr"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center"
              >
                <div className="bg-white p-4 rounded-2xl shadow-lg mb-4">
                  <QRCodeSVG
                    value={session.qr_url}
                    size={200}
                    level="H"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#1a1a1a"
                  />
                </div>
                
                {/* Таймер */}
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                  <Clock className="w-4 h-4" />
                  <span>Действителен: {formatTime(timeLeft || 0)}</span>
                </div>

                {/* Инструкция */}
                <div className="bg-gray-700/50 rounded-xl p-4 w-full">
                  <ol className="text-sm text-gray-300 space-y-2">
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">1.</span>
                      <span>Откройте камеру Telegram</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">2.</span>
                      <span>Наведите на QR-код</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">3.</span>
                      <span>Подтвердите подключение</span>
                    </li>
                  </ol>
                </div>
              </motion.div>
            )}

            {/* Успешно подключено */}
            {status === 'linked' && (
              <motion.div
                key="linked"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4"
                >
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Профиль подключен!
                </h2>
                <p className="text-gray-400 text-sm">
                  Загрузка приложения...
                </p>
              </motion.div>
            )}

            {/* Сессия истекла */}
            {status === 'expired' && (
              <motion.div
                key="expired"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">
                  Время истекло
                </h2>
                <p className="text-gray-400 text-sm mb-4 text-center">
                  QR-код больше не действителен
                </p>
                <button
                  onClick={createSession}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Создать новый QR-код
                </button>
              </motion.div>
            )}

            {/* Ошибка */}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">
                  Ошибка
                </h2>
                <p className="text-gray-400 text-sm mb-4 text-center">
                  {error || 'Произошла ошибка'}
                </p>
                <button
                  onClick={createSession}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Попробовать снова
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ссылка на бота */}
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center"
          >
            <p className="text-gray-500 text-xs mb-2">
              Или откройте бота напрямую:
            </p>
            <a
              href={session?.qr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Открыть в Telegram
            </a>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default TelegramLinkScreen;
