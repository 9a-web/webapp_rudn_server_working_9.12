/**
 * Welcome Screen - Приветственный экран
 * Новый ретро-дизайн
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from '../contexts/TelegramContext';
import { createWebSession, createSessionWebSocket, linkWebSession, notifySessionScanned } from '../services/webSessionAPI';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, CheckCircle, Loader2 } from 'lucide-react';

const WelcomeScreen = ({ onGetStarted, onSyncComplete }) => {
  const { hapticFeedback, webApp, user } = useTelegram();
  const [showQRModal, setShowQRModal] = useState(false);
  const [session, setSession] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('loading'); // loading, ready, scanned, linked, expired, error
  const [scannedUser, setScannedUser] = useState(null);
  const wsRef = useRef(null);

  const handleGetStarted = () => {
    if (hapticFeedback) {
      hapticFeedback('impact', 'medium');
    }
    onGetStarted();
  };

  const handleSyncClick = async () => {
    if (hapticFeedback) {
      hapticFeedback('impact', 'light');
    }
    setShowQRModal(true);
    setSessionStatus('loading');
    
    try {
      const newSession = await createWebSession();
      setSession(newSession);
      setSessionStatus('ready');
      
      // Подключаем WebSocket для отслеживания статуса
      wsRef.current = createSessionWebSocket(newSession.session_token, {
        onConnected: () => {
          console.log('WebSocket connected for session');
        },
        onScanned: (data) => {
          setSessionStatus('scanned');
          setScannedUser(data);
          if (hapticFeedback) {
            hapticFeedback('impact', 'medium');
          }
        },
        onLinked: (data) => {
          setSessionStatus('linked');
          if (hapticFeedback) {
            hapticFeedback('notification', 'success');
          }
          // Через 2 секунды закрываем модал и переходим дальше
          setTimeout(() => {
            setShowQRModal(false);
            onGetStarted();
          }, 2000);
        },
        onRejected: () => {
          setSessionStatus('ready');
          setScannedUser(null);
        },
        onExpired: () => {
          setSessionStatus('expired');
        },
        onError: (error) => {
          console.error('Session error:', error);
          setSessionStatus('error');
        }
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      setSessionStatus('error');
    }
  };

  const closeModal = () => {
    setShowQRModal(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSession(null);
    setSessionStatus('loading');
    setScannedUser(null);
  };

  // Если пользователь уже в Telegram Web App, автоматически привязываем сессию при сканировании
  useEffect(() => {
    if (sessionStatus === 'scanned' && user && session) {
      // Это значит QR отсканирован, но мы ещё не подтвердили
      // В реальном сценарии это происходит на другом устройстве
    }
  }, [sessionStatus, user, session]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

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
        className="mt-3"
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
        className="mt-4 cursor-pointer active:scale-95 transition-transform"
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

      {/* Sync with Telegram Button */}
      <motion.button
        onClick={handleSyncClick}
        className="mt-4 cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.1, ease: "easeOut" }}
      >
        <motion.span
          className="text-blue-400 text-sm font-medium flex items-center gap-2"
          animate={{ 
            opacity: [0.6, 1, 0.6],
            scale: [1, 1.02, 1]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          <Smartphone className="w-4 h-4" />
          Синхронизировать с Telegram аккаунтом
        </motion.span>
      </motion.button>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1C1C1E] rounded-3xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Синхронизация</h3>
                    <p className="text-xs text-gray-400">Отсканируйте QR-код</p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center">
                {sessionStatus === 'loading' && (
                  <div className="w-64 h-64 bg-white/5 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  </div>
                )}

                {sessionStatus === 'ready' && session && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white p-4 rounded-2xl"
                  >
                    <QRCodeSVG
                      value={session.qr_url}
                      size={220}
                      level="M"
                      includeMargin={false}
                    />
                  </motion.div>
                )}

                {sessionStatus === 'scanned' && scannedUser && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-64 h-64 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex flex-col items-center justify-center"
                  >
                    <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mb-4" />
                    <p className="text-yellow-400 font-medium">Подтверждение...</p>
                    {scannedUser.first_name && (
                      <p className="text-gray-400 text-sm mt-1">{scannedUser.first_name}</p>
                    )}
                  </motion.div>
                )}

                {sessionStatus === 'linked' && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-64 h-64 bg-green-500/10 border border-green-500/30 rounded-2xl flex flex-col items-center justify-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10 }}
                    >
                      <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                    </motion.div>
                    <p className="text-green-400 font-medium">Успешно!</p>
                    <p className="text-gray-400 text-sm mt-1">Аккаунт синхронизирован</p>
                  </motion.div>
                )}

                {sessionStatus === 'expired' && (
                  <div className="w-64 h-64 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center">
                    <p className="text-red-400 font-medium mb-3">QR-код истёк</p>
                    <button
                      onClick={handleSyncClick}
                      className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium"
                    >
                      Обновить
                    </button>
                  </div>
                )}

                {sessionStatus === 'error' && (
                  <div className="w-64 h-64 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center">
                    <p className="text-red-400 font-medium mb-3">Ошибка</p>
                    <button
                      onClick={handleSyncClick}
                      className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium"
                    >
                      Попробовать снова
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              {(sessionStatus === 'ready' || sessionStatus === 'loading') && (
                <div className="mt-6 text-center">
                  <p className="text-gray-400 text-sm">
                    Откройте приложение RUDN GO на телефоне и отсканируйте QR-код
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WelcomeScreen;
