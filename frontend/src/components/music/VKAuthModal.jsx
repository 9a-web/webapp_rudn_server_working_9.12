import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Music,
  Shield,
  RefreshCw,
  ExternalLink,
  Copy,
  ClipboardPaste,
  ArrowRight,
  Link2
} from 'lucide-react';
import { musicAPI } from '../../services/musicAPI';

/**
 * VKAuthModal - Модальное окно авторизации VK через OAuth (Kate Mobile)
 * 
 * Flow авторизации (как на vkserv.ru):
 * 1. Пользователь нажимает "Получить токен" → открывается VK OAuth
 * 2. Авторизуется в VK и даёт разрешения
 * 3. VK редиректит на blank.html#access_token=XXX&user_id=YYY
 * 4. Пользователь копирует URL из адресной строки
 * 5. Вставляет URL в приложение
 * 6. Backend парсит токен и сохраняет
 */
export const VKAuthModal = ({ isOpen, onClose, telegramId }) => {
  // OAuth flow state
  const [step, setStep] = useState(1); // 1 = инструкция, 2 = ввод URL
  const [tokenUrl, setTokenUrl] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  
  // Состояние процесса
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Статус подключения
  const [authStatus, setAuthStatus] = useState(null);
  
  // Проверка статуса при открытии
  useEffect(() => {
    if (isOpen && telegramId) {
      checkAuthStatus();
      loadAuthConfig();
    }
  }, [isOpen, telegramId]);
  
  // Сброс формы при закрытии
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setTokenUrl('');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);
  
  const loadAuthConfig = async () => {
    setLoadingConfig(true);
    try {
      const config = await musicAPI.getVKAuthConfig();
      setAuthUrl(config.auth_url);
    } catch (err) {
      console.error('Load auth config error:', err);
    } finally {
      setLoadingConfig(false);
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
  
  const handleOpenAuthUrl = () => {
    if (!authUrl) return;
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    // Открываем VK OAuth внутри Telegram (in-app browser)
    if (window.Telegram?.WebApp?.openLink) {
      // try_instant_view: false - открывает как обычную веб-страницу, не Instant View
      window.Telegram.WebApp.openLink(authUrl, { try_instant_view: false });
    } else {
      // Fallback для обычного браузера
      window.open(authUrl, '_blank');
    }
    
    // Переходим к шагу ввода URL
    setStep(2);
  };
  
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTokenUrl(text);
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
      }
    } catch (err) {
      console.error('Clipboard read error:', err);
      setError('Не удалось прочитать буфер обмена. Вставьте ссылку вручную.');
    }
  };
  
  const handleSubmitToken = async () => {
    if (!tokenUrl.trim()) {
      setError('Вставьте ссылку с токеном');
      return;
    }
    
    // Проверяем что это правильная ссылка
    if (!tokenUrl.includes('access_token=') && !tokenUrl.includes('blank.html')) {
      setError('Неверная ссылка. Скопируйте полный URL из адресной строки после авторизации.');
      return;
    }
    
    // Haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await musicAPI.vkAuth(telegramId, {
        token_url: tokenUrl.trim()
      });
      
      if (result.success) {
        // Успешная авторизация
        setSuccess(result.message || 'VK аккаунт подключен!');
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        
        // Обновляем статус
        await checkAuthStatus();
        
        // Сбрасываем форму
        setStep(1);
        setTokenUrl('');
        
      } else {
        // Ошибка
        setError(result.message || 'Ошибка авторизации');
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
      }
      
    } catch (err) {
      console.error('VK auth error:', err);
      setError(err.response?.data?.detail || 'Ошибка подключения к серверу');
      
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
    setError('');
    setSuccess('');
    setLoading(false);
    onClose();
  };
  
  const copyAuthUrl = async () => {
    if (!authUrl) return;
    try {
      await navigator.clipboard.writeText(authUrl);
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (err) {
      console.error('Copy error:', err);
    }
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
                  Получение токена VK
                </h2>
                <p className="text-sm text-white/50">
                  Для доступа к вашим аудиозаписям
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
            ) : (
              /* Not connected - OAuth Flow */
              <div className="space-y-4">
                {/* Step indicators */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step === 1 ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/50'
                  }`}>
                    1
                  </div>
                  <div className="w-8 h-0.5 bg-white/10" />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step === 2 ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/50'
                  }`}>
                    2
                  </div>
                </div>
                
                {step === 1 ? (
                  /* Step 1: Instructions and get token */
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <h3 className="text-sm font-medium text-blue-400 mb-3">
                        Как получить токен:
                      </h3>
                      <ol className="space-y-2 text-sm text-white/70">
                        <li className="flex gap-2">
                          <span className="text-blue-400 font-medium">1.</span>
                          <span>Нажмите кнопку «Получить токен»</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-blue-400 font-medium">2.</span>
                          <span>Авторизуйтесь в VK (если нужно)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-blue-400 font-medium">3.</span>
                          <span>Разрешите доступ приложению</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-blue-400 font-medium">4.</span>
                          <span>Скопируйте <strong>всю ссылку</strong> из адресной строки</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-blue-400 font-medium">5.</span>
                          <span>Вернитесь сюда и вставьте её</span>
                        </li>
                      </ol>
                    </div>
                    
                    {/* What you get */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white/80">После подключения:</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span>Доступ к вашим аудиозаписям VK</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span>Прослушивание музыки в приложении</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Get Token Button - используем <a> для открытия внутри Telegram */}
                    {loadingConfig ? (
                      <div className="w-full py-3.5 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white opacity-50 flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Загрузка...</span>
                      </div>
                    ) : authUrl ? (
                      <a
                        href={authUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          // Haptic feedback
                          if (window.Telegram?.WebApp?.HapticFeedback) {
                            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                          }
                          // Переходим к шагу ввода URL через небольшую задержку
                          setTimeout(() => setStep(2), 300);
                        }}
                        className="w-full py-3.5 rounded-xl font-medium transition-all
                                 bg-gradient-to-r from-blue-500 to-blue-600 text-white
                                 hover:from-blue-600 hover:to-blue-700
                                 flex items-center justify-center gap-2 no-underline"
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span>Получить токен</span>
                      </a>
                    ) : (
                      <div className="w-full py-3.5 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white opacity-50 flex items-center justify-center gap-2">
                        <ExternalLink className="w-5 h-5" />
                        <span>Получить токен</span>
                      </div>
                    )}
                    
                    {/* Copy URL button */}
                    {authUrl && (
                      <button
                        onClick={copyAuthUrl}
                        className="w-full py-2.5 rounded-xl text-sm text-white/50 hover:text-white/70
                                 bg-white/5 hover:bg-white/10 transition-colors
                                 flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Скопировать ссылку</span>
                      </button>
                    )}
                    
                    {/* Skip to step 2 */}
                    <button
                      onClick={() => setStep(2)}
                      className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors
                               flex items-center justify-center gap-1"
                    >
                      <span>У меня уже есть ссылка с токеном</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Step 2: Paste token URL */
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-start gap-3">
                        <Link2 className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-400">
                            Вставьте ссылку с токеном
                          </p>
                          <p className="text-xs text-yellow-400/70 mt-1">
                            Скопируйте всю адресную строку после авторизации в VK
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* URL Input */}
                    <div className="space-y-2">
                      <label className="text-sm text-white/60">Ссылка с токеном</label>
                      <div className="relative">
                        <textarea
                          value={tokenUrl}
                          onChange={(e) => setTokenUrl(e.target.value)}
                          placeholder="https://api.vk.com/blank.html#access_token=..."
                          disabled={loading}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                                   text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                                   disabled:opacity-50 resize-none text-sm"
                          rows={3}
                        />
                      </div>
                      
                      {/* Paste button */}
                      <button
                        onClick={handlePasteFromClipboard}
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl text-sm text-white/70 
                                 bg-white/5 hover:bg-white/10 transition-colors
                                 flex items-center justify-center gap-2"
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
                      onClick={handleSubmitToken}
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
                          <span>Подключение...</span>
                        </>
                      ) : (
                        <span>Подключить VK</span>
                      )}
                    </button>
                    
                    {/* Back to step 1 */}
                    <button
                      onClick={() => {
                        setStep(1);
                        setError('');
                      }}
                      disabled={loading}
                      className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
                    >
                      ← Вернуться к инструкции
                    </button>
                  </div>
                )}
                
                {/* Security Note */}
                <div className="p-3 rounded-xl bg-white/5">
                  <div className="flex gap-2">
                    <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-white/50">
                      <p>Мы не сохраняем ваш пароль.</p>
                      <p className="mt-1">Авторизация происходит напрямую через VK.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VKAuthModal;
