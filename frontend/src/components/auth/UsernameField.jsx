/**
 * UsernameField — поле выбора username с debounced-проверкой доступности.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Check, X, Loader2 } from 'lucide-react';
import AuthInput from './AuthInput';
import { authAPI } from '../../services/authAPI';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

const UsernameField = ({ value, onChange, onValidChange }) => {
  const [status, setStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const [reason, setReason] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setStatus('idle'); setReason(null);
      onValidChange?.(false);
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setStatus('invalid');
      setReason('3–32 символа, только a-z, 0-9, _');
      onValidChange?.(false);
      return;
    }
    setStatus('checking'); setReason(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await authAPI.checkUsername(value);
        if (res.available) {
          setStatus('available'); setReason(null); onValidChange?.(true);
        } else {
          setStatus('taken'); setReason(res.reason || 'Занято'); onValidChange?.(false);
        }
      } catch (e) {
        setStatus('invalid'); setReason(e.message); onValidChange?.(false);
      }
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [value, onValidChange]);

  const rightSlot =
    status === 'checking' ? <Loader2 size={16} className="animate-spin text-white/40" />
    : status === 'available' ? <Check size={16} className="text-emerald-400" />
    : status === 'taken' || status === 'invalid' ? <X size={16} className="text-red-400" />
    : null;

  return (
    <AuthInput
      icon={AtSign}
      type="text"
      label="Username"
      placeholder="john_doe"
      autoComplete="username"
      value={value}
      onChange={(e) => onChange(e.target.value.toLowerCase())}
      rightSlot={rightSlot}
      error={status === 'taken' || status === 'invalid' ? reason : null}
      hint={status === 'available' ? 'Доступно' : status === 'idle' ? 'Будет виден в публичном профиле (ссылка — всегда по UID)' : null}
    />
  );
};

export default UsernameField;
