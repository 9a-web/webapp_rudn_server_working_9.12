/**
 * searchAPI — клиент для /api/search/*.
 *
 * Отдельный модуль, чтобы не смешивать публичный поиск с auth-роутами.
 * Все методы поддерживают AbortController через `signal`.
 */
import axios from 'axios';
import { getBackendURL } from '../utils/config';
import { getToken } from '../utils/authStorage';

const BASE = `${getBackendURL()}/api`;

const withAuth = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const unwrap = async (promise) => {
  try {
    const res = await promise;
    return res.data;
  } catch (e) {
    if (e?.name === 'CanceledError' || e?.name === 'AbortError') throw e;
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map((d) => `${(d.loc || []).join('.')}: ${d.msg}`).join('; '));
    }
    throw new Error(detail || e?.response?.data?.error || e.message || 'Ошибка поиска');
  }
};

export const searchAPI = {
  /**
   * Глобальный поиск пользователей.
   * @param {{q?: string, group_id?: string, facultet_id?: string, kurs?: string, limit?: number, offset?: number}} params
   * @param {{signal?: AbortSignal}} opts
   * @returns {Promise<{results: Array, total: number, has_more: boolean, query: string, limit: number, offset: number}>}
   */
  global: (params = {}, opts = {}) =>
    unwrap(
      axios.get(`${BASE}/search/global`, {
        params: Object.fromEntries(
          Object.entries({
            q: params.q || '',
            group_id: params.group_id || undefined,
            facultet_id: params.facultet_id || undefined,
            kurs: params.kurs || undefined,
            limit: params.limit ?? 20,
            offset: params.offset ?? 0,
          }).filter(([, v]) => v !== undefined && v !== '' && v !== null),
        ),
        headers: withAuth(),
        signal: opts.signal,
      }),
    ),
};

export default searchAPI;
