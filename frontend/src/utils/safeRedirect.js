/**
 * Stage 7: P0/P1/P2 hardening (B-01) — Open Redirect protection.
 *
 * Sanitize continue/redirect URL для предотвращения Open Redirect.
 * Принимает только internal pathname:
 *   ✓ "/profile/123"
 *   ✓ "/settings?tab=privacy"
 *   ✗ "//evil.com" (protocol-relative)
 *   ✗ "https://evil.com"
 *   ✗ "javascript:..."
 *   ✗ "data:..."
 *   ✗ "\evil.com" (backslash tricks)
 *   ✗ URL с control-характеристиками
 *
 * @param {string} raw      исходный URL (обычно ?continue=...)
 * @param {string} fallback fallback, если URL невалидный
 * @returns {string}        безопасный internal path
 */
export const safeContinueUrl = (raw, fallback = '/') => {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  // Должен начинаться со слэша, но НЕ с двух (protocol-relative)
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  // Запрещаем backslashes (некоторые браузеры превращают \ в /)
  if (trimmed.includes('\\')) return fallback;
  // Запрещаем control chars
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return fallback;
  // Длина — sane upper bound
  if (trimmed.length > 2048) return fallback;
  return trimmed;
};

export default safeContinueUrl;
