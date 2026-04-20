/**
 * QR Login Block.
 *
 * Алгоритм:
 *  1. POST /api/auth/login/qr/init → получаем qr_token + expires_at
 *  2. Показываем QR с deep-link `{PUBLIC_BASE_URL}/auth/qr/confirm?token={qr_token}`
 *  3. Каждые 2с поллим /api/auth/login/qr/{token}/status
 *  4. Когда status = confirmed → получаем access_token и вызываем onSuccess({access_token, user})
 *  5. expired → показываем кнопку "Обновить QR"
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, CheckCircle2, Smartphone, Copy, Check } from 'lucide-react';
import { authAPI } from '../../services/authAPI';
import { PUBLIC_BASE_URL } from '../../constants/publicBase';
import AuthButton from './AuthButton';

const QRLoginBlock = ({ onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [qrToken, setQrToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [status, setStatus] = useState('pending'); // pending | confirmed | expired | error
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const deepLink = useMemo(() => {
    if (!qrToken) return '';
    return `${PUBLIC_BASE_URL}/auth/qr/confirm?token=${qrToken}`;
  }, [qrToken]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const initSession = useCallback(async () => {
    stopPolling();
    setLoading(true);
    setError(null);
    setStatus('pending');
    setCopied(false);
    try {
      const resp = await authAPI.qrInit();
      setQrToken(resp.qr_token);
      setExpiresAt(new Date(resp.expires_at));
    } catch (e) {
      setError(e.message);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [stopPolling]);

  useEffect(() => { initSession(); return () => stopPolling(); // eslint-disable-next-line
  }, []);

  // Polling + countdown
  useEffect(() => {
    if (!qrToken || status !== 'pending') return;

    const poll = async () => {
      try {
        const resp = await authAPI.qrStatus(qrToken);
        if (resp.status === 'confirmed' && resp.access_token) {
          setStatus('confirmed');
          stopPolling();
          onSuccess?.({ access_token: resp.access_token, user: resp.user });
        } else if (resp.status === 'expired') {
          setStatus('expired');
          stopPolling();
        } else if (resp.status === 'consumed') {
          // уже использовано
          setStatus('expired');
          stopPolling();
        }
      } catch (e) {
        // тихо игнорируем временные ошибки
      }
    };

    pollRef.current = setInterval(poll, 2000);
    const tick = () => {
      if (!expiresAt) return;
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff <= 0) {
        setStatus('expired');
        stopPolling();
      }
    };
    tick();
    tickRef.current = setInterval(tick, 1000);
    return stopPolling;
  }, [qrToken, status, expiresAt, stopPolling, onSuccess]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = deepLink; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (loading && !qrToken) {
    return (
      <div className="flex h-64 items-center justify-center text-white/60">
        Загрузка QR...
      </div>
    );
  }

  if (status === 'confirmed') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-400" />
        <div className="text-lg font-semibold text-white">Вход подтверждён</div>
        <div className="text-sm text-white/60">Перенаправление...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-white/70">
          <Smartphone size={16} />
          <span>Отсканируйте QR с уже авторизованного устройства</span>
        </div>
      </div>

      <div className={`relative rounded-2xl bg-white p-4 shadow-2xl ${status === 'expired' ? 'opacity-40' : ''}`}>
        {qrToken ? (
          <QRCodeSVG value={deepLink} size={200} level="M" includeMargin={false} />
        ) : (
          <div className="h-[200px] w-[200px] animate-pulse rounded-xl bg-white/20" />
        )}
        {status === 'expired' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-white">
            <span className="font-semibold">QR истёк</span>
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        {status === 'pending' && (
          <div className="text-xs text-white/50">Истекает через {mm}:{ss}</div>
        )}
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      <div className="mt-4 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          disabled={!deepLink || status !== 'pending'}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Скопировано' : 'Копировать ссылку для подтверждения'}
        </button>

        {status === 'expired' && (
          <AuthButton icon={RefreshCw} onClick={initSession} variant="secondary">
            Обновить QR
          </AuthButton>
        )}
      </div>
    </div>
  );
};

export default QRLoginBlock;
