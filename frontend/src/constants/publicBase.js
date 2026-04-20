/**
 * Публичная база для shareable-ссылок профилей.
 *
 * По умолчанию совпадает с REACT_APP_BACKEND_URL, но может быть переопределена
 * через VITE_PUBLIC_BASE_URL (на случай отдельного домена для публичных страниц).
 */
import { getBackendURL } from '../utils/config';

export const getPublicBaseURL = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_BASE_URL) {
      return import.meta.env.VITE_PUBLIC_BASE_URL;
    }
  } catch (e) {
    // ignore
  }
  return getBackendURL();
};

export const PUBLIC_BASE_URL = getPublicBaseURL();

/**
 * Формирует публичную ссылку на профиль по UID.
 * @param {string|number} uid — 9-значный numeric UID
 * @returns {string} `{PUBLIC_BASE_URL}/u/{uid}`
 */
export const buildProfileUrl = (uid) => {
  if (!uid) return '';
  return `${PUBLIC_BASE_URL}/u/${uid}`;
};
