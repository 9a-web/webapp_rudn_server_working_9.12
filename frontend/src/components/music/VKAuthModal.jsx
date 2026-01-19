import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ExternalLink,
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Music,
  Shield,
  RefreshCw,
  Info
} from 'lucide-react';
import { musicAPI } from '../../services/musicAPI';

/**
 * VKAuthModal - Модальное окно авторизации VK через OAuth
 * 
 * Новый flow через VK ID:
 * 1. Пользователь нажимает "Войти через VK"
 * 2. Открывается страница авторизации VK
 * 3. После авторизации VK перенаправляет на callback URL
 * 4. Backend обрабатывает callback и сохраняет токен
 * 5. Пользователь возвращается в приложение
 */
export const VKAuthModal = ({ isOpen, onClose, telegramId }) => {
  // Состояние процесса
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [oauthUrl, setOauthUrl] = useState('');
  
  // Статус подключения
  const [authStatus, setAuthStatus] = useState(null);
  
  // Загрузка OAuth конфигурации и проверка статуса при открытии
  useEffect(() => {
    if (isOpen && telegramId) {
      checkAuthStatus();
      loadOAuthConfig();
    }
  }, [isOpen, telegramId]);
  
  // Периодическая проверка статуса после открытия OAuth
  useEffect(() => {
    let interval;
    if (isOpen && loading) {
      // Проверяем статус каждые 3 секунды пока ожидаем авторизации
      interval = setInterval(() => {
        checkAuthStatusSilent();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, loading, telegramId]);
  
  const loadOAuthConfig = async () => {
    try {
      const config = await musicAPI.getVKOAuthConfig(telegramId);
      setOauthUrl(config.auth_url);
    } catch (err) {
      console.error('Load OAuth config error:', err);
      setError('Не удалось загрузить конфигурацию VK');
    }
  };
  
  const checkAuthStatus = async () => {
    setCheckingStatus(true);
    try {
      const status = await musicAPI.getVKAuthStatus(telegramId);
      setAuthStatus(status);
      
      // Если статус изменился на подключен - останавливаем loading
      if (status?.is_connected && status?.token_valid) {
        setLoading(false);
        setSuccess('VK аккаунт подключен!');
      }
    } catch (err) {
      console.error('Check auth status error:', err);
      setAuthStatus(null);
    } finally {
      setCheckingStatus(false);
    }
  };
  
  const checkAuthStatusSilent = async () => {
    try {
      const status = await musicAPI.getVKAuthStatus(telegramId);
      if (status?.is_connected && status?.token_valid) {
        setAuthStatus(status);
        setLoading(false);
        setSuccess('VK аккаунт успешно подключен!');
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
      }
    } catch (err) {
      // Игнорируем ошибки silent проверки
    }
  };
  
  const handleOpenVkAuth = () => {
    if (!oauthUrl) {
      setError('URL авторизации не загружен');
      return;
    }
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    setLoading(true);
    setError('');
    
    // Открываем OAuth ссылку
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(oauthUrl);
    } else {
      window.open(oauthUrl, '_blank');
    }
  };
  
  const handleDisconnect = async () => {
    if (!window.confirm('Отключить VK аккаунт?')) return;
    
    setLoading(true);
    
    try {
      await musicAPI.vkAuthDisconnect(telegramId);
      setAuthStatus(null);
      setSuccess('VK аккаунт отключен');
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
      
    } catch (err) {
      setError('Ошибка отключения');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    setError('');
    setSuccess('');
    setLoading(false);
    onClose();
  };
  
  if (!isOpen) return null;
  
  const isConnected = authStatus?.is_connected && authStatus?.token_valid;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: '#1c1c1e' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Подключение VK
                </h2>
                <p className="text-sm text-white/50">
                  Авторизация через VK ID
                </p>
              </div>
            </div>
            
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4">
            {checkingStatus ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : isConnected ? (
              /* Connected State */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    <div className="flex-1">
                      <p className="text-green-400 font-medium">VK аккаунт подключен</p>
                      <p className="text-sm text-white/50">
                        {authStatus.vk_user_info?.first_name} {authStatus.vk_user_info?.last_name}
                      </p>
                    </div>
                    {authStatus.vk_user_info?.photo && (
                      <img 
                        src={authStatus.vk_user_info.photo} 
                        alt="VK" 
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40">VK ID</p>
                    <p className="text-white font-medium">{authStatus.vk_user_id}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40">Аудиозаписей</p>
                    <p className="text-white font-medium">{authStatus.audio_count || 0}</p>
                  </div>
                </div>
                
                {authStatus.audio_access ? (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Доступ к аудио подтверждён</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>Нет доступа к аудио API</span>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={checkAuthStatus}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors
                             flex items-center justify-center gap-2 text-white/70"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>Обновить</span>
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors
                             flex items-center justify-center gap-2 text-red-400"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Отключить</span>
                  </button>
                </div>
              </div>
            ) : loading ? (
              /* Waiting for authorization */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    <div>
                      <p className="text-blue-400 font-medium">Ожидание авторизации...</p>
                      <p className="text-sm text-white/50">
                        Завершите авторизацию в открывшемся окне VK
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-sm text-white/70">
                    После успешной авторизации эта страница обновится автоматически
                  </p>
                </div>
                
                <button
                  onClick={() => setLoading(false)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors
                           text-white/60 text-sm"
                >
                  Отмена
                </button>
              </div>
            ) : (
              /* Not connected - Authorization form */
              <div className="space-y-4">
                {/* Info Block */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex gap-2">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-white/70">
                      <p>Авторизация через официальный VK ID</p>
                      <p className="mt-1 text-white/50">
                        Вы будете перенаправлены на страницу VK для входа в аккаунт
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* What you get */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white/80">После подключения вы получите:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>Доступ к вашим аудиозаписям</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>Прослушивание музыки в приложении</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>Сохранение плейлистов</span>
                    </div>
                  </div>
                </div>
                
                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </motion.div>
                )}
                
                {/* Success Message */}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-400">{success}</p>
                  </motion.div>
                )}
                
                {/* Authorization Button */}
                <button
                  onClick={handleOpenVkAuth}
                  disabled={!oauthUrl}
                  className="w-full py-3.5 rounded-xl font-medium transition-all
                           bg-gradient-to-r from-blue-500 to-blue-600 text-white
                           hover:from-blue-600 hover:to-blue-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Войти через VK</span>
                </button>
                
                {/* Security Note */}
                <p className="text-xs text-center text-white/40">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Безопасная авторизация через VK ID
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VKAuthModal;
