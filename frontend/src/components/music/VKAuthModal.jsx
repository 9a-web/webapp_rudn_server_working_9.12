import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Music,
  Shield,
  KeyRound,
  RefreshCw,
  Info
} from 'lucide-react';
import { musicAPI } from '../../services/musicAPI';

/**
 * VKAuthModal - Модальное окно авторизации VK для доступа к музыке
 * 
 * Позволяет пользователям:
 * - Авторизоваться через логин/пароль VK
 * - Вводить код 2FA если требуется
 * - Видеть статус подключения
 * - Отключать VK аккаунт
 */
export const VKAuthModal = ({ isOpen, onClose, telegramId }) => {
  // Состояние формы
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Состояние процесса
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Статус подключения
  const [authStatus, setAuthStatus] = useState(null);
  
  // Проверка статуса при открытии
  useEffect(() => {
    if (isOpen && telegramId) {
      checkAuthStatus();
    }
  }, [isOpen, telegramId]);
  
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
    
    if (!login.trim() || !password.trim()) {
      setError('Введите логин и пароль');
      return;
    }
    
    if (needs2FA && !twoFaCode.trim()) {
      setError('Введите код подтверждения');
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
        login: login.trim(),
        password: password.trim(),
        two_fa_code: needs2FA ? twoFaCode.trim() : undefined
      });
      
      if (result.success) {
        setSuccess(result.message || 'VK аккаунт подключен!');
        setNeeds2FA(false);
        setLogin('');
        setPassword('');
        setTwoFaCode('');
        
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
        
      } else if (result.needs_2fa) {
        setNeeds2FA(true);
        setError('');
        
        // Haptic warning
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
        }
        
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
    setLogin('');
    setPassword('');
    setTwoFaCode('');
    setError('');
    setSuccess('');
    setNeeds2FA(false);
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
          className="w-full max-w-md rounded-2xl overflow-hidden"
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
                  Авторизация VK
                </h2>
                <p className="text-sm text-white/50">
                  Подключите аккаунт для доступа к музыке
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
              /* Auth Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Info Block */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex gap-2">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-white/70">
                      <p>Введите данные от вашего аккаунта VK.</p>
                      <p className="mt-1 text-white/50">
                        Авторизация через официальный API VK.
                        Данные надёжно защищены.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Login Field */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Телефон или email</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="text"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="+7 или email"
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                               text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                               transition-colors"
                      disabled={loading}
                      autoComplete="username"
                    />
                  </div>
                </div>
                
                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Пароль от VK"
                      className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/5 border border-white/10
                               text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                               transition-colors"
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60"
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
                    <label className="text-sm text-white/60">Код подтверждения (2FA)</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <input
                        type="text"
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value)}
                        placeholder="Код из SMS или приложения"
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                                 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50
                                 transition-colors"
                        disabled={loading}
                        autoComplete="one-time-code"
                      />
                    </div>
                    <p className="text-xs text-yellow-400/80 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Код отправлен на ваш телефон или в приложение
                    </p>
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
                  disabled={loading || !login.trim() || !password.trim()}
                  className="w-full py-3.5 rounded-xl font-medium transition-all
                           bg-gradient-to-r from-blue-500 to-blue-600 text-white
                           hover:from-blue-600 hover:to-blue-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Авторизация...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>{needs2FA ? 'Подтвердить' : 'Войти через VK'}</span>
                    </>
                  )}
                </button>
                
                {/* Security Note */}
                <p className="text-xs text-center text-white/40">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Данные передаются напрямую в VK через защищённое соединение
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
