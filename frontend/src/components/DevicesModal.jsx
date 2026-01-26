/**
 * DevicesModal - Модальное окно управления устройствами
 * Показывает список подключенных устройств и позволяет:
 * - Сканировать QR для подключения нового устройства
 * - Отключать существующие устройства
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Smartphone, Monitor, Tablet, Globe, 
  Trash2, QrCode, Loader2, AlertCircle, 
  CheckCircle, Clock, RefreshCw, Camera
} from 'lucide-react';
import { getUserDevices, revokeDevice, linkWebSession } from '../services/webSessionAPI';
import { useTelegram } from '../contexts/TelegramContext';

const DevicesModal = ({ isOpen, onClose, user }) => {
  const { hapticFeedback, webApp } = useTelegram();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revokingToken, setRevokingToken] = useState(null);
  const [scanningQR, setScanningQR] = useState(false);
  const [linkStatus, setLinkStatus] = useState(null); // null, 'linking', 'success', 'error'
  const [linkMessage, setLinkMessage] = useState('');

  // Получаем текущий session_token из localStorage
  const currentSessionToken = localStorage.getItem('session_token');

  // Загрузка списка устройств
  const loadDevices = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getUserDevices(user.id, currentSessionToken);
      setDevices(data.devices || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
      setError('Не удалось загрузить список устройств');
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentSessionToken]);

  // Загружаем устройства при открытии
  useEffect(() => {
    if (isOpen && user?.id) {
      loadDevices();
    }
  }, [isOpen, user?.id, loadDevices]);

  // Отключение устройства
  const handleRevokeDevice = async (sessionToken) => {
    if (!user?.id) return;
    
    hapticFeedback?.('impact', 'medium');
    setRevokingToken(sessionToken);
    
    try {
      await revokeDevice(sessionToken, user.id);
      hapticFeedback?.('notification', 'success');
      
      // Удаляем из списка
      setDevices(prev => prev.filter(d => d.session_token !== sessionToken));
      
      // Если отключили текущее устройство - очищаем localStorage
      if (sessionToken === currentSessionToken) {
        localStorage.removeItem('telegram_user');
        localStorage.removeItem('session_token');
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to revoke device:', err);
      hapticFeedback?.('notification', 'error');
      setError('Не удалось отключить устройство');
    } finally {
      setRevokingToken(null);
    }
  };

  // Сканирование QR через Telegram
  const handleScanQR = async () => {
    if (!webApp?.showScanQrPopup) {
      setError('Сканирование QR недоступно в этой версии Telegram');
      return;
    }
    
    hapticFeedback?.('impact', 'light');
    setScanningQR(true);
    setLinkStatus(null);
    
    try {
      webApp.showScanQrPopup({ text: 'Наведите камеру на QR-код устройства' }, async (data) => {
        console.log('QR scanned:', data);
        setScanningQR(false);
        
        if (!data) {
          // Пользователь закрыл сканер
          return;
        }
        
        // Парсим QR-код - ожидаем формат с link_{session_token}
        // Например: https://t.me/rudn_pro_bot/app?startapp=link_abc123
        let sessionToken = null;
        
        if (data.includes('startapp=link_')) {
          const match = data.match(/startapp=link_([a-f0-9-]+)/i);
          if (match) {
            sessionToken = match[1];
          }
        } else if (data.match(/^[a-f0-9-]{36}$/i)) {
          // Просто UUID
          sessionToken = data;
        }
        
        if (!sessionToken) {
          setLinkStatus('error');
          setLinkMessage('Неверный QR-код');
          hapticFeedback?.('notification', 'error');
          return;
        }
        
        // Связываем сессию
        setLinkStatus('linking');
        
        try {
          const result = await linkWebSession(sessionToken, {
            telegram_id: user.id,
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            username: user.username || '',
            photo_url: user.photo_url || null
          });
          
          if (result.success) {
            setLinkStatus('success');
            setLinkMessage('Устройство подключено!');
            hapticFeedback?.('notification', 'success');
            
            // Обновляем список устройств
            setTimeout(() => {
              loadDevices();
              setLinkStatus(null);
            }, 2000);
          } else {
            setLinkStatus('error');
            setLinkMessage(result.message || 'Не удалось подключить устройство');
            hapticFeedback?.('notification', 'error');
          }
        } catch (err) {
          console.error('Link error:', err);
          setLinkStatus('error');
          setLinkMessage('Ошибка при подключении');
          hapticFeedback?.('notification', 'error');
        }
      });
    } catch (err) {
      console.error('QR scan error:', err);
      setScanningQR(false);
      setError('Ошибка при сканировании');
    }
  };

  // Иконка устройства по ОС
  const getDeviceIcon = (device) => {
    const os = (device.os || '').toLowerCase();
    if (os.includes('android') || os.includes('ios')) {
      return <Smartphone className="w-5 h-5" />;
    } else if (os.includes('windows') || os.includes('macos') || os.includes('linux')) {
      return <Monitor className="w-5 h-5" />;
    } else if (os.includes('ipad')) {
      return <Tablet className="w-5 h-5" />;
    }
    return <Globe className="w-5 h-5" />;
  };

  // Форматирование даты
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Неизвестно';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
    
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Заголовок */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl">
                <Smartphone className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Устройства</h2>
                <p className="text-xs text-gray-400">
                  {devices.length} {devices.length === 1 ? 'устройство' : 'устройств'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Контент */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Кнопка сканирования QR */}
            {webApp?.showScanQrPopup && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleScanQR}
                disabled={scanningQR || linkStatus === 'linking'}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
              >
                {scanningQR || linkStatus === 'linking' ? (
                  <>
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                    <span className="text-white font-medium">
                      {linkStatus === 'linking' ? 'Подключение...' : 'Сканирование...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5 text-white" />
                    <span className="text-white font-medium">Сканировать QR-код</span>
                  </>
                )}
              </motion.button>
            )}

            {/* Статус связки */}
            <AnimatePresence>
              {linkStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-300 text-sm">{linkMessage}</span>
                </motion.div>
              )}
              {linkStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-300 text-sm">{linkMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ошибка загрузки */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-300 text-sm">{error}</span>
                <button 
                  onClick={loadDevices}
                  className="ml-auto p-1 hover:bg-red-500/20 rounded"
                >
                  <RefreshCw className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )}

            {/* Загрузка */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                <p className="text-gray-400 text-sm">Загрузка устройств...</p>
              </div>
            )}

            {/* Список устройств */}
            {!loading && devices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mb-4">
                  <Smartphone className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 text-sm">Нет подключенных устройств</p>
                <p className="text-gray-500 text-xs mt-1">
                  Отсканируйте QR-код на другом устройстве
                </p>
              </div>
            )}

            {!loading && devices.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Активные сессии
                </p>
                
                {devices.map((device, index) => (
                  <motion.div
                    key={device.session_token}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-xl border transition-all ${
                      device.is_current 
                        ? 'bg-blue-500/10 border-blue-500/30' 
                        : 'bg-gray-700/30 border-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Иконка устройства */}
                      <div className={`p-2 rounded-lg ${
                        device.is_current ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-600/50 text-gray-400'
                      }`}>
                        {getDeviceIcon(device)}
                      </div>
                      
                      {/* Информация */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white truncate">
                            {device.device_name || 'Неизвестное устройство'}
                          </p>
                          {device.is_current && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                              Текущее
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            {device.last_active 
                              ? `Активность: ${formatDate(device.last_active)}`
                              : device.linked_at 
                                ? `Подключено: ${formatDate(device.linked_at)}`
                                : 'Время неизвестно'
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* Кнопка отключения */}
                      <button
                        onClick={() => handleRevokeDevice(device.session_token)}
                        disabled={revokingToken === device.session_token}
                        className={`p-2 rounded-lg transition-colors ${
                          device.is_current
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                            : 'bg-gray-600/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400'
                        }`}
                        title={device.is_current ? 'Выйти' : 'Отключить'}
                      >
                        {revokingToken === device.session_token ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Подсказка внизу */}
          <div className="p-4 border-t border-gray-700/50">
            <p className="text-xs text-gray-500 text-center">
              Отключите устройства, которыми больше не пользуетесь, для безопасности
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DevicesModal;
