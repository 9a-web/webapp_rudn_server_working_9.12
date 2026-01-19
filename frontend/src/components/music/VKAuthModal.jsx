import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ExternalLink,
  Copy,
  ClipboardPaste,
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Music,
  Shield,
  RefreshCw,
  Info,
  ChevronRight,
  Link2
} from 'lucide-react';
import { musicAPI } from '../../services/musicAPI';

/**
 * VKAuthModal - Модальное окно авторизации VK через OAuth
 * 
 * Позволяет пользователям:
 * - Открыть OAuth ссылку VK для авторизации
 * - Вставить полученный URL с токеном
 * - Видеть статус подключения
 * - Отключать VK аккаунт
 */
export const VKAuthModal = ({ isOpen, onClose, telegramId }) => {
  // Состояние формы
  const [tokenUrl, setTokenUrl] = useState('');
  const [step, setStep] = useState(1); // 1 - инструкция, 2 - ввод токена
  
  // Состояние процесса
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [oauthUrl, setOauthUrl] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Статус подключения
  const [authStatus, setAuthStatus] = useState(null);
  
  // Загрузка OAuth конфигурации и проверка статуса при открытии
  useEffect(() => {
    if (isOpen && telegramId) {
      checkAuthStatus();
      loadOAuthConfig();
    }
  }, [isOpen, telegramId]);
  
  const loadOAuthConfig = async () => {
    try {
      const config = await musicAPI.getVKOAuthConfig();
      setOauthUrl(config.auth_url);
    } catch (err) {
      console.error('Load OAuth config error:', err);
      // Fallback URL
      setOauthUrl('https://id.vk.com/auth?app_id=2685278&redirect_uri=https%3A%2F%2Fapi.vk.com%2Fblank.html&response_type=token&scope=140491999');
    }
  };
  
  const checkAuthStatus = async () => {
    setCheckingStatus(true);
    try {
      const status = await musicAPI.getVKAuthStatus(telegramId);
      setAuthStatus(status);
    } catch (err) {
      console.error('Check auth status error:', err);
      setAuthStatus(null);
    } finally {
      setCheckingStatus(false);
    }
  };
  
  const handleOpenVkAuth = () => {
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    // Открываем OAuth ссылку
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(oauthUrl);
    } else {
      window.open(oauthUrl, '_blank');
    }
    
    // Переходим к шагу ввода токена
    setStep(2);
  };
  
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(oauthUrl);
      setCopied(true);
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };
  
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTokenUrl(text);
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    } catch (err) {
      console.error('Paste failed:', err);
      setError('Не удалось вставить из буфера обмена');
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!tokenUrl.trim()) {
      setError('Вставьте URL из адресной строки');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    try {
      const result = await musicAPI.vkAuth(telegramId, {
        token_url: tokenUrl.trim()
      });
      
      if (result.success) {
        setSuccess(result.message || 'VK аккаунт подключен!');
        setTokenUrl('');
        setStep(1);
        
        // Haptic success
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        
        // Обновляем статус
        await checkAuthStatus();
        
        // Закрываем через 2 секунды
        setTimeout(() => {
          onClose();
        }, 2000);
        
      } else {
        setError(result.message || 'Ошибка авторизации');
        
        // Haptic error
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
      }
      
    } catch (err) {
      console.error('VK auth error:', err);
      setError(err.response?.data?.detail || 'Ошибка подключения');
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setLoading(false);
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
    setTokenUrl('');
    setError('');
    setSuccess('');
    setStep(1);
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
            ) : step === 1 ? (
              /* Step 1: Instructions */
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
                
                {/* Steps */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-blue-400">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Откройте ссылку VK</p>
                      <p className="text-sm text-white/50">Нажмите кнопку ниже для авторизации</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-blue-400">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Войдите в VK</p>
                      <p className="text-sm text-white/50">Разрешите доступ приложению</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-blue-400">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Скопируйте URL</p>
                      <p className="text-sm text-white/50">После авторизации скопируйте адрес из браузера</p>
                    </div>
                  </div>
                </div>
                
                {/* Open VK Button */}
                <button
                  onClick={handleOpenVkAuth}
                  className="w-full py-3.5 rounded-xl font-medium transition-all
                           bg-gradient-to-r from-blue-500 to-blue-600 text-white
                           hover:from-blue-600 hover:to-blue-700
                           flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Открыть VK для авторизации</span>
                </button>
                
                {/* Alternative: Copy URL */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-white/40">или</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                
                <button
                  onClick={handleCopyUrl}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors
                           flex items-center justify-center gap-2 text-white/70"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Скопировать ссылку</span>
                    </>
                  )}
                </button>
                
                {/* Already have token */}
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-2 text-sm text-white/50 hover:text-white/70 transition-colors
                           flex items-center justify-center gap-1"
                >
                  <span>У меня уже есть URL с токеном</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Step 2: Enter Token URL */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ← Назад к инструкции
                </button>
                
                {/* Info */}
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex gap-2">
                    <Link2 className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-white/70">
                      <p>После авторизации в VK скопируйте <strong>полный URL</strong> из адресной строки браузера.</p>
                      <p className="mt-1 text-white/50">
                        URL должен содержать <code className="text-yellow-400/80">access_token</code>
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Token URL Input */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">URL из адресной строки</label>
                  <div className="relative">
                    <textarea
                      value={tokenUrl}
                      onChange={(e) => setTokenUrl(e.target.value)}
                      placeholder="https://api.vk.com/blank.html#access_token=..."
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                               text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                               transition-colors resize-none h-24 text-sm font-mono"
                      disabled={loading}
                    />
                  </div>
                  
                  {/* Paste button */}
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors
                             flex items-center justify-center gap-2 text-white/70"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>Вставить из буфера обмена</span>
                  </button>
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
                
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !tokenUrl.trim()}
                  className="w-full py-3.5 rounded-xl font-medium transition-all
                           bg-gradient-to-r from-blue-500 to-blue-600 text-white
                           hover:from-blue-600 hover:to-blue-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Проверка...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Подключить VK</span>
                    </>
                  )}
                </button>
                
                {/* Security Note */}
                <p className="text-xs text-center text-white/40">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Токен безопасно хранится на сервере
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VKAuthModal;
