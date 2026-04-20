/**
 * VK ID Login Button.
 *
 * Принцип работы:
 *  1. Пользователь кликает кнопку → мы генерируем state + code_verifier (PKCE) и кладём в sessionStorage
 *  2. redirect на VK ID OAuth
 *  3. VK возвращает на {PUBLIC_BASE_URL}/auth/vk/callback?code=...
 *  4. VKCallbackPage делает POST /api/auth/login/vk с этим code
 */
import React, { useCallback, useState } from 'react';
import AuthButton from './AuthButton';
import { PUBLIC_BASE_URL } from '../../constants/publicBase';

const VK_LOGO = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M21.579 6.855c.14-.465 0-.806-.661-.806h-2.19c-.558 0-.813.295-.953.619 0 0-1.115 2.719-2.695 4.482-.51.513-.743.675-1.021.675-.139 0-.341-.162-.341-.627V6.855c0-.558-.161-.806-.626-.806H9.642c-.348 0-.557.258-.557.504 0 .528.79.65.871 2.138v3.228c0 .707-.127.836-.407.836-.742 0-2.551-2.732-3.624-5.858-.213-.617-.425-.85-.986-.85h-2.19c-.626 0-.75.294-.75.619 0 .58.742 3.462 3.46 7.271 1.811 2.604 4.361 4.014 6.685 4.014 1.393 0 1.566-.314 1.566-.854v-1.964c0-.627.132-.752.574-.752.325 0 .883.164 2.185 1.418 1.487 1.488 1.732 2.152 2.57 2.152h2.19c.626 0 .94-.314.759-.932-.197-.618-.906-1.515-1.846-2.579-.51-.604-1.276-1.253-1.509-1.577-.325-.417-.232-.604 0-.974.001.001 2.672-3.76 2.95-5.04z" />
  </svg>
);

// Generate PKCE code verifier + challenge
const _generateRandom = (len = 64) => {
  const arr = new Uint8Array(len);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, len);
};

const _sha256 = async (input) => {
  const buf = new TextEncoder().encode(input);
  const hash = await window.crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hash);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const VK_ID_AUTHORIZE = 'https://id.vk.com/authorize';

const VkLoginButton = ({ appId, redirectUri, referralCode, disabled }) => {
  const [preparing, setPreparing] = useState(false);

  const handleClick = useCallback(async () => {
    if (!appId) {
      alert('VK App ID не сконфигурирован');
      return;
    }
    setPreparing(true);
    try {
      const finalRedirect =
        redirectUri || `${PUBLIC_BASE_URL}/auth/vk/callback`;

      const state = _generateRandom(32);
      const codeVerifier = _generateRandom(64);
      const codeChallenge = await _sha256(codeVerifier);

      sessionStorage.setItem('vk_oauth_state', state);
      sessionStorage.setItem('vk_oauth_verifier', codeVerifier);
      sessionStorage.setItem('vk_oauth_redirect', finalRedirect);
      if (referralCode) sessionStorage.setItem('vk_oauth_referral', referralCode);

      const params = new URLSearchParams({
        client_id: appId,
        response_type: 'code',
        redirect_uri: finalRedirect,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 's256',
        scope: 'email',
      });

      window.location.href = `${VK_ID_AUTHORIZE}?${params.toString()}`;
    } catch (e) {
      console.error('VK auth prepare error', e);
      alert('Не удалось запустить VK OAuth: ' + e.message);
      setPreparing(false);
    }
  }, [appId, redirectUri, referralCode]);

  return (
    <AuthButton
      variant="vk"
      loading={preparing}
      disabled={disabled}
      icon={VK_LOGO}
      onClick={handleClick}
    >
      Войти через VK ID
    </AuthButton>
  );
};

export default VkLoginButton;
