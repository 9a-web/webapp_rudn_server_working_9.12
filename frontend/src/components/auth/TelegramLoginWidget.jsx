/**
 * TelegramLoginWidget — обёртка над telegram-widget.js.
 *
 * Важно: для работы widget домен сайта должен быть привязан к боту через
 * BotFather (/setdomain). Если домен не привязан — кнопка не появится (widget молчит).
 * Поэтому показываем fallback-подсказку через 3с если widget не рендерится.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';

const TelegramLoginWidget = ({ botUsername, onAuth, size = 'large', requestAccess = 'write' }) => {
  const containerRef = useRef(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [error, setError] = useState(null);
  const callbackName = useRef(`__tgOnAuth_${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (!botUsername || botUsername === 'bot') {
      setError('Bot username не настроен');
      return;
    }

    // Зарегистрируем глобальный callback для widget
    const cbName = callbackName.current;
    window[cbName] = (user) => {
      try { onAuth?.(user); } catch (e) { console.error('Telegram auth handler error:', e); }
    };

    // Удаляем старый script если был
    const existing = containerRef.current?.querySelector('script');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', size);
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', `${cbName}(user)`);
    script.setAttribute('data-request-access', requestAccess);
    script.setAttribute('data-userpic', 'false');

    script.onload = () => setWidgetLoaded(true);
    script.onerror = () => setError('Не удалось загрузить Telegram widget');

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    // Fallback timer: если через 3с нет iframe — показываем подсказку про /setdomain
    const fallbackTimer = setTimeout(() => {
      const iframe = containerRef.current?.querySelector('iframe');
      if (!iframe) {
        setError('Telegram widget не видит домен. Нужна привязка через @BotFather → /setdomain.');
      }
    }, 3500);

    return () => {
      clearTimeout(fallbackTimer);
      delete window[cbName];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botUsername]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="flex min-h-[44px] items-center justify-center"
        aria-label="Telegram Login Widget"
      />
      {!widgetLoaded && !error && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-white/40">
          <MessageCircle size={14} />
          <span>Загрузка Telegram...</span>
        </div>
      )}
      {error && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <div className="font-semibold">{error}</div>
          <div className="mt-1 text-amber-200/80">
            Откройте @BotFather → /mybots → Bot Settings → Domain и добавьте домен сайта.
          </div>
        </div>
      )}
    </div>
  );
};

export default TelegramLoginWidget;
