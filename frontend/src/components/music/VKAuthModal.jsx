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
  Eye,
  EyeOff,
  User,
  Lock,
  KeyRound
} from 'lucide-react';
import { musicAPI } from '../../services/musicAPI';

/**
 * VKAuthModal - Модальное окно авторизации VK через логин/пароль (Kate Mobile)
 * 
 * Flow авторизации:
 * 1. Пользователь вводит логин (телефон/email) и пароль от VK
 * 2. Backend получает Kate Mobile токен через vkaudiotoken
 * 3. Токен даёт доступ к VK Audio API
 * 4. Пользователь получает доступ к своим аудиозаписям
 */
export const VKAuthModal = ({ isOpen, onClose, telegramId }) => {
  // Форма авторизации
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Состояние процесса
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twofaData, setTwofaData] = useState(null); // phone_mask, validation_type
  
  // Статус подключения
  const [authStatus, setAuthStatus] = useState(null);
  
  // Проверка статуса при открытии
  useEffect(() => {
    if (isOpen && telegramId) {
      checkAuthStatus();
    }
  }, [isOpen, telegramId]);
  
  // Сброс формы при закрытии
  useEffect(() => {
    if (!isOpen) {
      setLogin('');
      setPassword('');
      setTwoFaCode('');
      setError('');
      setSuccess('');
      setNeeds2FA(false);
      setTwofaData(null);
      setShowPassword(false);
    }
  }, [isOpen]);
  
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
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!login || !password) {
      setError('Введите логин и пароль');
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
        login: login.trim(),
        password: password,
        two_fa_code: twoFaCode || undefined
      });
      
      if (result.success) {
        // Успешная авторизация
        setSuccess(result.message || 'VK аккаунт подключен!');
        setNeeds2FA(false);
        
        // Haptic feedback
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        
        // Обновляем статус
        await checkAuthStatus();
        
        // Сбрасываем форму
        setLogin('');
        setPassword('');
        setTwoFaCode('');
        
      } else if (result.needs_2fa) {
        // Требуется 2FA
        setNeeds2FA(true);
        setError('');
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
        }
        
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
                  Для доступа к аудиозаписям
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
              /* Not connected - Login form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* What you get */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white/80">После подключения вы получите:</p>
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
                
                {/* Login Field */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Телефон или email</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type="text"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="+7 900 123 45 67"
                      disabled={loading}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                               text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                               disabled:opacity-50"
                      autoComplete="username"
                    />
                  </div>
                </div>
                
                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Пароль от VK</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full pl-11 pr-12 py-3 rounded-xl bg-white/5 border border-white/10
                               text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                               disabled:opacity-50"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/60"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                {/* 2FA Field */}
                {needs2FA && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm text-yellow-400">
                        Требуется код подтверждения из SMS или приложения-аутентификатора
                      </p>
                    </div>
                    <label className="text-sm text-white/60">Код подтверждения (2FA)</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        type="text"
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        disabled={loading}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                                 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                                 disabled:opacity-50 text-center text-xl tracking-widest"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                    </div>
                  </motion.div>
                )}
                
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
                  disabled={loading || !login || !password}
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
                  ) : needs2FA ? (
                    <span>Подтвердить код</span>
                  ) : (
                    <span>Подключить VK</span>
                  )}
                </button>
                
                {/* Security Note */}
                <div className="p-3 rounded-xl bg-white/5">
                  <div className="flex gap-2">
                    <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-white/50">
                      <p>Ваш пароль не сохраняется на сервере.</p>
                      <p className="mt-1">Он используется только для получения токена доступа к музыке.</p>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VKAuthModal;
