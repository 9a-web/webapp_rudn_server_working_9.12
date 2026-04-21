/**
 * Logo3D — единый компонент 3D-логотипа РУДН для прелоадера и auth-экранов.
 *
 * Обёртка над <SVG3D> из пакета `3dsvg` с:
 *  • ленивым импортом (не тащим three.js до монтирования)
 *  • детекцией WebGL
 *  • ErrorBoundary (если 3D упадёт — fallback на 2D <img>)
 *  • использованием УПРОЩЁННОГО SVG (1448 точек вместо 13316 → мгновенный рендер)
 *
 * 🎯 Критично: ВО ВРЕМЯ загрузки 3dsvg-пакета и сборки геометрии НЕ показываем
 * 2D-силуэт (иначе пользователь видит «мигание» 2D→3D). Вместо этого —
 * нейтральный круговой спиннер. 2D-silhouette используется ТОЛЬКО как fallback
 * при реальных ошибках (нет WebGL, runtime error в three.js).
 *
 * Props:
 *   size       — ширина/высота контейнера (px)
 *   material   — 'metal' | 'chrome' | 'gold' | 'plastic' | 'glass' | 'holographic' | 'default'
 *   animate    — 'spin' | 'float' | 'pulse' | 'none'
 *   animateSpeed — скорость анимации
 *   smoothness — 0..1 (детализация геометрии)
 *   metalness  — 0..1
 *   roughness  — 0..1
 *   color      — hex цвет
 *   lightPosition — [x,y,z]
 *   svg        — путь к SVG или inline-строка
 *   fallbackSrc — 2D SVG для fallback при ошибках
 *   onReady    — колбэк после полной загрузки 3D
 *   style, className — стилизация контейнера
 */
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';

// Lazy load 3dsvg — чтобы бандл страницы был лёгким.
const SVG3DLazy = lazy(() =>
  import('3dsvg').then((m) => ({ default: m.SVG3D }))
);

const DEFAULT_SVG_URL = '/rudn-logo-3d-simplified.svg';

// Кеш результата WebGL-детекции
let _webglSupportedCache = null;
function isWebGLSupported() {
  if (_webglSupportedCache !== null) return _webglSupportedCache;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      canvas.getContext('webgl2');
    _webglSupportedCache = !!gl;
  } catch {
    _webglSupportedCache = false;
  }
  return _webglSupportedCache;
}

/**
 * Fallback 2D-логотип (img с упрощённым SVG).
 * Используется ТОЛЬКО при ошибках (WebGL отсутствует / 3D упал).
 */
function Fallback2DLogo({ size, src, style, className }) {
  return (
    <img
      src={src}
      alt="RUDN Logo"
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 20px rgba(79,70,229,0.35))',
        ...style,
      }}
      draggable={false}
    />
  );
}

/**
 * Нейтральный круговой спиннер. Показывается пока 3dsvg-пакет импортируется
 * И пока three.js строит геометрию (между onLoadingChange(true/false)).
 */
function Logo3DLoader({ size }) {
  // Размер спиннера = ~30% от контейнера, чтобы визуально не конкурировать с 3D
  const s = Math.max(28, Math.round(size * 0.28));
  const stroke = Math.max(2, Math.round(s * 0.08));
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
      aria-label="Загрузка 3D-логотипа"
    >
      <svg
        width={s}
        height={s}
        viewBox="0 0 50 50"
        style={{
          animation: 'logo3d-spin 0.9s linear infinite',
          filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.45))',
        }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="rgba(168,148,255,0.9)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray="80 40"
        />
      </svg>
      {/* глобальная keyframes-анимация, безопасно инжектится один раз */}
      <style>{`
        @keyframes logo3d-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * ErrorBoundary: при падении 3D — рендерит 2D-fallback.
 */
class Logo3DErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.warn('[Logo3D] 3D render failed, falling back to 2D:', error);
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Fallback2DLogo
          size={this.props.size}
          src={this.props.fallbackSrc}
        />
      );
    }
    return this.props.children;
  }
}

const Logo3D = ({
  size = 200,
  material = 'metal',
  animate = 'float',
  animateSpeed = 1.6,
  smoothness = 0.2,
  metalness = 0.9,
  roughness = 0.2,
  color,
  lightPosition = [-0.5, 2, 4],
  svg = DEFAULT_SVG_URL,
  fallbackSrc = DEFAULT_SVG_URL,
  onReady,
  onError,
  style,
  className,
}) => {
  // 🎯 Инициализируем СИНХРОННО через lazy-init, чтобы на первом рендере
  // уже знать, есть ли WebGL. Иначе первый кадр покажет 2D-fallback
  // (мелькание), что нам не нужно.
  const [webglReady] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR-safe: не блокируем
    return isWebGLSupported();
  });
  const [useFallback, setUseFallback] = useState(false);
  // isBuilding = true пока 3dsvg строит геометрию (сигнал от SVG3D.onLoadingChange)
  const [isBuilding, setIsBuilding] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleLoadingChange = (isLoading) => {
    if (!mountedRef.current) return;
    setIsBuilding(!!isLoading);
    if (!isLoading) onReady?.();
  };

  const containerStyle = {
    width: size,
    height: size,
    position: 'relative',
    ...style,
  };

  // WebGL недоступен → сразу 2D fallback (не показываем спиннер)
  if (!webglReady || useFallback) {
    return (
      <div style={containerStyle} className={className}>
        <Fallback2DLogo size={size} src={fallbackSrc} />
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className}>
      <Logo3DErrorBoundary
        size={size}
        fallbackSrc={fallbackSrc}
        onError={(e) => {
          onError?.(e);
          setUseFallback(true);
        }}
      >
        {/* Пока lazy-загружается сам пакет 3dsvg — показываем спиннер (НЕ 2D) */}
        <Suspense fallback={<Logo3DLoader size={size} />}>
          <SVG3DLazy
            svg={svg}
            smoothness={smoothness}
            material={material}
            metalness={metalness}
            roughness={roughness}
            animate={animate === 'none' ? undefined : animate}
            animateSpeed={animateSpeed}
            lightPosition={lightPosition}
            color={color}
            onLoadingChange={handleLoadingChange}
          />
        </Suspense>
        {/* Пока SVG3D строит геометрию — поверх рисуем тот же спиннер.
            Canvas уже смонтирован, но ещё пуст, поэтому спиннер заметен. */}
        {isBuilding && <Logo3DLoader size={size} />}
      </Logo3DErrorBoundary>
    </div>
  );
};

export default Logo3D;
