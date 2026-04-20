/**
 * Logo3D — единый компонент 3D-логотипа РУДН для прелоадера и auth-экранов.
 *
 * Обёртка над <SVG3D> из пакета `3dsvg` с:
 *  • ленивым импортом (не тащим three.js до монтирования)
 *  • детекцией WebGL и fallback на 2D <img>
 *  • ErrorBoundary (если 3D упадёт — покажется 2D)
 *  • использованием УПРОЩЁННОГО SVG (1448 точек вместо 13316 → мгновенный рендер)
 *
 * Использование:
 *   <Logo3D size={200} material="metal" animate="float" />
 *
 * Props:
 *   size       — ширина/высота контейнера (px)
 *   material   — 'metal' | 'chrome' | 'gold' | 'plastic' | 'glass' | 'holographic' | 'default'
 *   animate    — 'spin' | 'float' | 'pulse' | 'none' (по умолчанию 'float')
 *   animateSpeed — скорость анимации (1-3)
 *   smoothness — 0..1 (детализация геометрии, по умолчанию 0.2 — быстро и красиво)
 *   metalness  — 0..1 (для material=metal)
 *   roughness  — 0..1
 *   lightPosition — [x,y,z]
 *   color      — hex цвет (для не-material-preset)
 *   fallbackSrc — путь к 2D SVG для fallback (по умолчанию /rudn-logo-3d-simplified.svg)
 *   style      — доп. inline-стили контейнера
 *   className  — CSS class
 *   onReady    — колбэк при готовности рендера
 */
import React, { useState, useEffect, Suspense, lazy } from 'react';

// Lazy load 3dsvg — чтобы бандл страницы был лёгким.
const SVG3DLazy = lazy(() =>
  import('3dsvg').then((m) => ({ default: m.SVG3D }))
);

const DEFAULT_SVG_URL = '/rudn-logo-3d-simplified.svg';

// Кеш результата WebGL-детекции (не делаем по 3 раза)
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
 * Используется если WebGL недоступен или 3D упал.
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
 * Локальный ErrorBoundary: при падении 3D рендерит Fallback2DLogo.
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
          style={this.props.style}
          className={this.props.className}
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
  const [webglReady, setWebglReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setWebglReady(isWebGLSupported());
  }, []);

  const handleLoadingChange = (isLoading) => {
    if (!isLoading && onReady) onReady();
  };

  const containerStyle = {
    width: size,
    height: size,
    position: 'relative',
    ...style,
  };

  // WebGL недоступен → сразу fallback
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
        <Suspense fallback={<Fallback2DLogo size={size} src={fallbackSrc} />}>
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
      </Logo3DErrorBoundary>
    </div>
  );
};

export default Logo3D;
