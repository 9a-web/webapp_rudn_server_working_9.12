/**
 * 🪶 logoPreload — кэш SVG-текста 3D-логотипа.
 *
 * Предотвращает повторные HTTP-запросы при каждом монтировании Logo3D.
 * Пакет `3dsvg` внутри использует `useFetchSvg()` — хук, который делает
 * `fetch(url)` при КАЖДОМ монтировании (без межкомпонентного кэша).
 *
 * Решение: один раз загружаем SVG-текст глобально, передаём его в Logo3D
 * через проп `svgString` → `3dsvg` видит готовую строку и не делает fetch.
 *
 * Дополнительно кэшируем в sessionStorage, чтобы при переходах между
 * страницами (hard reload в Telegram WebView) SVG не тянулся заново.
 */

export const DEFAULT_LOGO_SVG_URL = '/rudn-logo-3d-simplified.svg';

const SESSION_KEY = 'rudn_logo3d_svg_v1';

let _cachedSvgString = null;
let _preloadPromise = null;

/**
 * Пытается достать SVG из sessionStorage (быстрый путь между перезагрузками).
 */
function _loadFromSession() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw && raw.length > 100 && raw.includes('<svg')) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function _saveToSession(svg) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    // SVG упрощённого логотипа — ~70KB. Безопасно хранить.
    sessionStorage.setItem(SESSION_KEY, svg);
  } catch {
    /* quota exceeded — не критично */
  }
}

/**
 * Preload SVG-текста в кэш. Идемпотентно (повторные вызовы возвращают
 * тот же Promise / уже кэшированное значение).
 *
 * @param {string} url — URL SVG файла (default: /rudn-logo-3d-simplified.svg)
 * @returns {Promise<string|null>} — текст SVG или null при ошибке
 */
export async function preloadLogoSvg(url = DEFAULT_LOGO_SVG_URL) {
  if (_cachedSvgString) return _cachedSvgString;

  // Пробуем session cache
  const session = _loadFromSession();
  if (session) {
    _cachedSvgString = session;
    return session;
  }

  // Запрос уже в полёте — возвращаем тот же Promise
  if (_preloadPromise) return _preloadPromise;

  _preloadPromise = (async () => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (!text || !text.includes('<svg')) {
        throw new Error('Empty or invalid SVG');
      }
      _cachedSvgString = text;
      _saveToSession(text);
      return text;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[logoPreload] Failed to preload SVG:', e);
      _preloadPromise = null; // позволим retry
      return null;
    }
  })();

  return _preloadPromise;
}

/**
 * Синхронный доступ к кэшу. Возвращает null если SVG ещё не загружен.
 */
export function getCachedLogoSvg() {
  return _cachedSvgString || _loadFromSession();
}

/**
 * Сброс кэша (для тестов / ручной инвалидации).
 */
export function clearLogoSvgCache() {
  _cachedSvgString = null;
  _preloadPromise = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

export default {
  preloadLogoSvg,
  getCachedLogoSvg,
  clearLogoSvgCache,
  DEFAULT_LOGO_SVG_URL,
};
