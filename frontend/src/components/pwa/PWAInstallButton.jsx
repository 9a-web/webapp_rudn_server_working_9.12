/**
 * PWAInstallButton — M1 fix (2026-07)
 *
 * Ловит beforeinstallprompt и показывает красивую кнопку «Установить приложение».
 *
 * Появляется только если:
 *  - Браузер поддерживает PWA install (Chrome/Edge/Samsung Internet/Opera)
 *  - Приложение ещё не установлено (display-mode: standalone проверка)
 *  - Не запущено как Telegram WebApp (там свой install)
 *
 * Использование:
 *   <PWAInstallButton variant="compact" />  // только иконка
 *   <PWAInstallButton variant="full" />     // кнопка с текстом
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';

export default function PWAInstallButton({
  variant = 'full',
  className = '',
  onInstalled = null,
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  // Проверяем «уже установлено» по media query
  useEffect(() => {
    const checkStandalone = () => {
      const mql = window.matchMedia?.('(display-mode: standalone)');
      // iOS Safari: navigator.standalone === true
      const iosStandalone = typeof window !== 'undefined' && window.navigator?.standalone === true;
      if ((mql && mql.matches) || iosStandalone) {
        setInstalled(true);
      }
    };
    checkStandalone();

    // В Telegram WebApp скрываем (там свой install flow)
    if (window.Telegram?.WebApp?.initData) {
      setInstalled(true); // не показываем кнопку
    }
  }, []);

  // Слушаем beforeinstallprompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      if (onInstalled) {
        try { onInstalled(); } catch (_) {}
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [onInstalled]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstalled(true);
      }
    } catch (e) {
      console.warn('[PWAInstall] prompt failed:', e);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  if (installed || !deferredPrompt) return null;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        aria-label="Установить приложение"
        title="Установить приложение"
        onClick={handleInstall}
        className={`inline-flex items-center justify-center rounded-full p-2 bg-blue-500 text-white hover:bg-blue-600 shadow-md ${className}`}
      >
        <Download className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 font-medium text-sm shadow-md transition-colors ${className}`}
    >
      <Download className="w-4 h-4" />
      <span>Установить приложение</span>
    </button>
  );
}
