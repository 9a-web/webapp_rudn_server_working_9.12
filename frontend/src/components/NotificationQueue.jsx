import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

/**
 * Контекст для управления очередью уведомлений
 * Позволяет разным компонентам добавлять уведомления в очередь
 * и показывать их последовательно, а не одновременно
 */

const NotificationQueueContext = createContext(null);

export const useNotificationQueue = () => {
  const context = useContext(NotificationQueueContext);
  if (!context) {
    throw new Error('useNotificationQueue must be used within NotificationQueueProvider');
  }
  return context;
};

export const NotificationQueueProvider = ({ children }) => {
  // Очередь уведомлений: [{ id, type, component, priority, duration }]
  const [queue, setQueue] = useState([]);
  // Текущее активное уведомление
  const [activeNotification, setActiveNotification] = useState(null);
  // Флаг, показывающий что уведомление сейчас отображается
  const [isShowingNotification, setIsShowingNotification] = useState(false);

  /**
   * Добавить уведомление в очередь
   * @param {Object} notification - { id, type, component, priority, duration }
   * - id: уникальный идентификатор
   * - type: 'greeting' | 'achievement' | 'info' и т.д.
   * - component: React компонент для рендеринга
   * - priority: число (выше = приоритетнее), по умолчанию 0
   * - duration: время показа в мс, по умолчанию 6000
   */
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: notification.id || `notif-${Date.now()}-${Math.random()}`,
      type: notification.type || 'info',
      component: notification.component,
      priority: notification.priority || 0,
      duration: notification.duration || 6000,
      addedAt: Date.now(),
    };

    setQueue(prevQueue => {
      // Проверяем, нет ли уже такого уведомления в очереди
      if (prevQueue.some(n => n.id === newNotification.id)) {
        return prevQueue;
      }
      
      // Добавляем и сортируем по приоритету (высший приоритет первым)
      const updatedQueue = [...prevQueue, newNotification].sort(
        (a, b) => b.priority - a.priority
      );
      
      return updatedQueue;
    });
  }, []);

  /**
   * Удалить уведомление из очереди по id
   */
  const removeNotification = useCallback((id) => {
    setQueue(prevQueue => prevQueue.filter(n => n.id !== id));
  }, []);

  /**
   * Закрыть текущее активное уведомление
   */
  const closeActiveNotification = useCallback(() => {
    setIsShowingNotification(false);
    setActiveNotification(null);
  }, []);

  /**
   * Обработка очереди - показываем следующее уведомление
   */
  useEffect(() => {
    // Если уже показываем уведомление или очередь пуста - ничего не делаем
    if (isShowingNotification || queue.length === 0) {
      return;
    }

    // Берем первое уведомление из очереди (уже отсортировано по приоритету)
    const nextNotification = queue[0];
    
    // Удаляем его из очереди
    setQueue(prevQueue => prevQueue.slice(1));
    
    // Устанавливаем как активное
    setActiveNotification(nextNotification);
    setIsShowingNotification(true);

    // Автоматически закрываем через указанное время
    const timer = setTimeout(() => {
      closeActiveNotification();
    }, nextNotification.duration);

    return () => clearTimeout(timer);
  }, [queue, isShowingNotification, closeActiveNotification]);

  // Небольшая задержка перед показом следующего уведомления
  useEffect(() => {
    if (!isShowingNotification && !activeNotification && queue.length > 0) {
      const delayTimer = setTimeout(() => {
        // Триггерим обновление для показа следующего уведомления
        setQueue(prev => [...prev]);
      }, 500); // 500мс задержка между уведомлениями

      return () => clearTimeout(delayTimer);
    }
  }, [isShowingNotification, activeNotification, queue.length]);

  const value = {
    addNotification,
    removeNotification,
    closeActiveNotification,
    activeNotification,
    isShowingNotification,
    queueLength: queue.length,
  };

  return (
    <NotificationQueueContext.Provider value={value}>
      {children}
      {/* Рендерим активное уведомление */}
      {activeNotification && activeNotification.component}
    </NotificationQueueContext.Provider>
  );
};

export default NotificationQueueProvider;
