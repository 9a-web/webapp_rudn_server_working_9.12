import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, CheckCircle, AlertCircle, Loader2, Link2, Unlink, RefreshCw, User, Phone, Calendar, Building2 } from 'lucide-react';

// Определяем URL backend в зависимости от окружения (аналогично api.js)
const getBackendURL = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }
  return window.location.origin;
};

const LKConnectionModal = ({ isOpen, onClose, telegramId, hapticFeedback, onConnectionChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lkData, setLkData] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const backendUrl = useMemo(() => getBackendURL(), []);

  // Проверка статуса подключения при открытии
  useEffect(() => {
    let isCancelled = false;
    
    const checkConnectionStatus = async () => {
      if (!isOpen || !telegramId) return;
      
      setCheckingStatus(true);
      try {
        const response = await fetch(`${backendUrl}/api/lk/data/${telegramId}`);
        
        if (isCancelled) return;
        
        if (response.ok) {
          // Читаем тело ответа безопасно
          const responseText = await response.text();
          let data = {};
          try {
            data = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            data = {};
          }
          
          if (!isCancelled) {
            // Проверяем поле lk_connected из ответа API
            const isLkConnected = data.lk_connected === true;
            setIsConnected(isLkConnected);
            setLkData(isLkConnected ? data.personal_data : null);
          }
        } else if (response.status === 404) {
          if (!isCancelled) {
            setIsConnected(false);
            setLkData(null);
          }
        } else {
          if (!isCancelled) {
            setIsConnected(false);
            setLkData(null);
          }
        }
      } catch (err) {
        console.error('Ошибка проверки статуса ЛК:', err);
        if (!isCancelled) {
          setIsConnected(false);
        }
      } finally {
        if (!isCancelled) {
          setCheckingStatus(false);
        }
      }
    };

    checkConnectionStatus();
    
    return () => {
      isCancelled = true;
    };
  }, [isOpen, telegramId, backendUrl]);

  // Сброс состояния при закрытии
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/lk/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_id: telegramId,
          email,
          password
        })
      });

      // Читаем тело ответа как текст сначала
      const responseText = await response.text();
      let data = {};
      
      // Пробуем распарсить JSON
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        data = { detail: 'Ошибка обработки ответа сервера' };
      }

      if (response.ok) {
        setSuccess(true);
        setIsConnected(true);
        setLkData(data.personal_data);
        if (hapticFeedback) hapticFeedback('notification', 'success');
        if (onConnectionChange) onConnectionChange(true, data.personal_data);
        
        setTimeout(() => {
          setSuccess(false);
        }, 2000);
      } else {
        // Укорачиваем длинные сообщения об ошибках
        let errorMessage = data.detail || 'Ошибка подключения';
        if (errorMessage.length > 100) {
          // Извлекаем первую строку или первые 100 символов
          const firstLine = errorMessage.split('\n')[0];
          errorMessage = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      setError(err.message || 'Ошибка подключения');
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/lk/disconnect/${telegramId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsConnected(false);
        setLkData(null);
        if (hapticFeedback) hapticFeedback('notification', 'success');
        if (onConnectionChange) onConnectionChange(false, null);
      } else {
        // Читаем тело ответа безопасно
        const responseText = await response.text();
        let data = {};
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          data = { detail: 'Ошибка отключения' };
        }
        throw new Error(data.detail || 'Ошибка отключения');
      }
    } catch (err) {
      setError(err.message);
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendUrl}/api/lk/data/${telegramId}?refresh=true`);

      // Читаем тело ответа безопасно
      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        data = { detail: 'Ошибка обработки ответа' };
      }

      if (response.ok) {
        setLkData(data.personal_data);
        if (hapticFeedback) hapticFeedback('impact', 'medium');
        if (onConnectionChange) onConnectionChange(true, data.personal_data);
      } else {
        throw new Error(data.detail || 'Ошибка обновления');
      }
    } catch (err) {
      setError(err.message);
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4"
        onClick={onClose}
        onTouchStart={(e) => {
          // Предотвращаем закрытие при касании overlay, если цель - не сам overlay
          if (e.target !== e.currentTarget) {
            e.stopPropagation();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          className="w-full max-w-md overflow-hidden"
          style={{
            backgroundColor: 'rgba(42, 42, 42, 0.95)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            className="p-5 flex justify-between items-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                }}
              >
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Личный кабинет РУДН</h2>
                <p className="text-xs text-gray-400">lk.rudn.ru</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {checkingStatus ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                <p className="text-sm text-gray-400">Проверка подключения...</p>
              </div>
            ) : isConnected && lkData ? (
              // Подключено - показываем данные
              <div className="space-y-4">
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-green-400 bg-green-500/10 p-3 rounded-xl border border-green-500/20"
                  >
                    <CheckCircle size={18} />
                    <span className="text-sm font-medium">Данные успешно обновлены!</span>
                  </motion.div>
                )}

                {/* Статус подключения */}
                <div 
                  className="flex items-center gap-2 p-3 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">ЛК подключен</span>
                </div>

                {/* Персональные данные */}
                <div className="space-y-2">
                  {lkData.full_name && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <User className="w-4 h-4 text-indigo-400" />
                      <div>
                        <p className="text-xs text-gray-500">ФИО</p>
                        <p className="text-sm text-white font-medium">{lkData.full_name}</p>
                      </div>
                    </div>
                  )}

                  {lkData.email && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <Mail className="w-4 h-4 text-indigo-400" />
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm text-white font-medium">{lkData.email}</p>
                      </div>
                    </div>
                  )}

                  {lkData.phone && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <Phone className="w-4 h-4 text-indigo-400" />
                      <div>
                        <p className="text-xs text-gray-500">Телефон</p>
                        <p className="text-sm text-white font-medium">{lkData.phone}</p>
                      </div>
                    </div>
                  )}

                  {lkData.birth_date && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <div>
                        <p className="text-xs text-gray-500">Дата рождения</p>
                        <p className="text-sm text-white font-medium">{lkData.birth_date}</p>
                      </div>
                    </div>
                  )}

                  {(lkData.faculty || lkData.group_name) && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      <div>
                        <p className="text-xs text-gray-500">Учёба</p>
                        <p className="text-sm text-white font-medium">
                          {lkData.group_name && <span>{lkData.group_name}</span>}
                          {lkData.group_name && lkData.course && <span> • </span>}
                          {lkData.course && <span>{lkData.course} курс</span>}
                        </p>
                        {lkData.faculty && (
                          <p className="text-xs text-gray-400 mt-0.5">{lkData.faculty}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                    <AlertCircle size={18} />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Кнопки действий */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    <RefreshCw className={`w-4 h-4 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-medium text-indigo-400">
                      {refreshing ? 'Обновление...' : 'Обновить'}
                    </span>
                  </button>
                  
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <Unlink className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-400">
                      {disconnecting ? 'Отключение...' : 'Отключить'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              // Не подключено - форма авторизации
              <form onSubmit={handleConnect} className="space-y-4">
                <p className="text-sm text-gray-400 text-center mb-4">
                  Подключите ЛК РУДН для автоматического получения данных о вашей группе и расписании
                </p>

                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">
                    Email или логин RUDN ID
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full text-white rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                      placeholder="email@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">
                    Пароль
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full text-white rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20"
                  >
                    <AlertCircle size={18} />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}

                <div 
                  className="flex items-start gap-2 p-3 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                  }}
                >
                  <Lock className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-400">
                    Ваш пароль будет зашифрован и храниться в безопасности. 
                    Мы используем его только для получения данных из ЛК.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 font-semibold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Подключение...</span>
                    </>
                  ) : (
                    <>
                      <Link2 size={18} />
                      <span>Подключить ЛК</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LKConnectionModal;
