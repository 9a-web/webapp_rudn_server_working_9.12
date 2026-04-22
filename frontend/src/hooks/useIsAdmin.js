/**
 * 🔐 useIsAdmin — определение админских прав текущего пользователя.
 *
 * Единый источник правды — backend `GET /api/auth/me/is_admin`.
 * Раньше ADMIN_UIDS был захардкожен на фронте в 5+ местах как массив
 * Telegram ID → для VK/Email/QR-юзеров со связанным админским TG это
 * работало некорректно (фронт сверял с user.id = pseudo_tid).
 *
 * Правила:
 *   - Пока не авторизован → { isAdmin: false, loading: false }
 *   - Авторизован → единый запрос к /me/is_admin
 *   - Ответ кэшируется на время жизни сессии (AuthContext)
 *   - UX: во время loading возвращаем { isAdmin: false, loading: true } —
 *     компоненты могут показать skeleton вместо мерцания admin-controls.
 */
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getBackendURL } from '../utils/config';

// Кэш уровня модуля — чтобы при монтировании нескольких компонентов
// (AdminPanel + FriendsSection + ProfileScreen одновременно) не делать
// N запросов. Инвалидируется при logout/login через `useAuth.user?.uid`.
const _cache = new Map(); // key: uid → { isAdmin, ts }
const _TTL_MS = 5 * 60 * 1000; // 5 минут

const _readCached = (uid) => {
  if (!uid) return null;
  const hit = _cache.get(uid);
  if (!hit) return null;
  if (Date.now() - hit.ts > _TTL_MS) {
    _cache.delete(uid);
    return null;
  }
  return hit.isAdmin;
};

const _writeCached = (uid, isAdmin) => {
  if (!uid) return;
  _cache.set(uid, { isAdmin: Boolean(isAdmin), ts: Date.now() });
};

export const invalidateAdminCache = () => _cache.clear();

/**
 * @returns {{ isAdmin: boolean, loading: boolean, refresh: () => Promise<void> }}
 */
export const useIsAdmin = () => {
  const { user, token, isAuthenticated } = useAuth();
  const uid = user?.uid || user?.user_uid || null;

  // Инициализируем из кэша, чтобы не мерцать при ре-маунте компонента.
  const cached = _readCached(uid);
  const [isAdmin, setIsAdmin] = useState(cached ?? false);
  const [loading, setLoading] = useState(cached === null);

  const check = useCallback(
    async (opts = {}) => {
      if (!isAuthenticated || !token || !uid) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (!opts.force) {
        const fromCache = _readCached(uid);
        if (fromCache !== null) {
          setIsAdmin(fromCache);
          setLoading(false);
          return;
        }
      }

      try {
        const res = await axios.get(
          `${getBackendURL()}/api/auth/me/is_admin`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const val = Boolean(res.data?.is_admin);
        _writeCached(uid, val);
        setIsAdmin(val);
      } catch (err) {
        // На любой ошибке — не админ (безопасный дефолт)
        // 401/403 → значит точно не админ; 500/network → тоже не даём доступ.
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, token, uid],
  );

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, token, isAuthenticated]);

  return {
    isAdmin,
    loading,
    refresh: () => check({ force: true }),
  };
};

export default useIsAdmin;
