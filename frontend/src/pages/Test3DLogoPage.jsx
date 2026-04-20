import React, { useState, Suspense, lazy } from 'react';

// SVG3D импортируется лениво, чтобы не грузить three.js + @react-three до клика.
// Это важно: сама по себе модель тяжёлая (сам SVG - 82 KB path-data),
// и при дефолтных smoothness=0.6 браузер может «зависнуть» на несколько секунд
// во время триангуляции ExtrudeGeometry.
const SVG3DLazy = lazy(() =>
  import('3dsvg').then((m) => ({ default: m.SVG3D }))
);

const Test3DLogoPage = () => {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  // Регулируемые параметры (влияют на сложность рендера)
  const [smoothness, setSmoothness] = useState(0.2); // Начинаем с дешёвого варианта
  const [material, setMaterial] = useState('metal');
  const [animate, setAnimate] = useState('spin');
  // Переключатель простой демо-SVG vs реальный логотип РУДН
  const [useSimpleDemo, setUseSimpleDemo] = useState(false);

  // Простая демо-SVG для быстрой проверки работоспособности пакета
  // (пара простых форм - triangle + circle, рендерится за миллисекунды)
  const simpleDemoSvg = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <circle cx="128" cy="128" r="90" fill="#9b8cff"/>
    <path d="M128 60 L190 170 L66 170 Z" fill="#ffffff"/>
  </svg>`;

  const handleMount = () => {
    setErrorMsg('');
    setStatus('loading');
    setMounted(true);
  };

  const handleRemount = () => {
    setMounted(false);
    setStatus('idle');
    setErrorMsg('');
    setTimeout(() => {
      setStatus('loading');
      setMounted(true);
    }, 100);
  };

  const handleLoadingChange = (isLoading) => {
    setStatus(isLoading ? 'loading' : 'ready');
  };

  const handleLoadError = (err) => {
    console.error('[Test3DLogo] SVG3D error:', err);
    setErrorMsg(String(err?.message || err));
    setStatus('error');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background:
          'radial-gradient(1200px 800px at 50% 40%, #1a1a25 0%, #0b0b10 60%, #050507 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, opacity: 0.92 }}>
        Тест 3D-логотипа через пакет{' '}
        <code style={{ color: '#9b8cff' }}>3dsvg</code>
      </h1>
      <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 18, textAlign: 'center' }}>
        Источник: <code>/rudn-logo-3d.svg</code>&nbsp;&nbsp;•&nbsp;&nbsp;Статус:&nbsp;
        <StatusBadge status={status} />
      </p>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: 16,
          maxWidth: 600,
        }}
      >
        <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={useSimpleDemo}
            onChange={(e) => setUseSimpleDemo(e.target.checked)}
            disabled={mounted}
          />
          простой демо-SVG (быстро)
        </label>
        <label style={labelStyle}>
          smoothness: <b>{smoothness.toFixed(2)}</b>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={smoothness}
            onChange={(e) => setSmoothness(parseFloat(e.target.value))}
            style={{ width: 120 }}
            disabled={mounted}
          />
        </label>

        <label style={labelStyle}>
          material:
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            disabled={mounted}
            style={selectStyle}
          >
            {['default', 'metal', 'chrome', 'gold', 'plastic', 'glass', 'holographic'].map(
              (m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              )
            )}
          </select>
        </label>

        <label style={labelStyle}>
          animate:
          <select
            value={animate}
            onChange={(e) => setAnimate(e.target.value)}
            disabled={mounted}
            style={selectStyle}
          >
            {['spin', 'float', 'pulse', 'none'].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mount/remount buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {!mounted ? (
          <button onClick={handleMount} style={primaryBtn}>
            ▶ Отрендерить 3D-логотип
          </button>
        ) : (
          <button onClick={handleRemount} style={secondaryBtn}>
            ⟳ Перерендерить
          </button>
        )}
      </div>

      {/* 3D Canvas container */}
      <div
        style={{
          width: 'min(520px, 92vw)',
          height: 'min(520px, 65vh)',
          borderRadius: 24,
          background:
            'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
          position: 'relative',
          boxShadow:
            '0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {!mounted && (
          <div style={overlayStyle}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎲</div>
            <div style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', padding: '0 20px' }}>
              Нажмите «Отрендерить» выше, чтобы загрузить пакет <code>3dsvg</code>
              <br />и построить 3D-геометрию
            </div>
          </div>
        )}

        {mounted && (
          <ErrorCatcher onError={handleLoadError}>
            <Suspense
              fallback={
                <div style={overlayStyle}>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>Загружаю пакет 3dsvg…</div>
                </div>
              }
            >
              <SVG3DLazy
                {...(useSimpleDemo ? { svg: simpleDemoSvg } : { svg: '/rudn-logo-3d.svg' })}
                smoothness={smoothness}
                material={material}
                metalness={0.9}
                roughness={0.2}
                animate={animate === 'none' ? undefined : animate}
                animateSpeed={2.6}
                lightPosition={[-0.5, 2, 4]}
                onLoadingChange={handleLoadingChange}
              />
            </Suspense>
          </ErrorCatcher>
        )}

        {status === 'loading' && mounted && (
          <div style={{ ...overlayStyle, pointerEvents: 'none' }}>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              Триангуляция SVG… (может занять 2–10 сек для сложного SVG)
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ ...overlayStyle, color: '#f87171' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 12, textAlign: 'center', padding: '0 20px', maxWidth: 420 }}>
              {errorMsg || 'Ошибка рендера 3D-логотипа'}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          fontSize: 11,
          opacity: 0.45,
          textAlign: 'center',
          maxWidth: 520,
          lineHeight: 1.5,
        }}
      >
        Совет: начните со значения <code>smoothness</code> 0.1–0.2 для такого сложного SVG
        (82 KB path-data) — иначе ExtrudeGeometry может долго компилировать тысячи вершин.
        <br />
        Откройте консоль браузера (F12), чтобы увидеть возможные ошибки.
      </div>

      <a
        href="/"
        style={{
          marginTop: 24,
          fontSize: 13,
          color: '#9b8cff',
          textDecoration: 'none',
          border: '1px solid rgba(155,140,255,0.3)',
          padding: '8px 16px',
          borderRadius: 10,
        }}
      >
        ← На главную
      </a>
    </div>
  );
};

// ─── styles ──────────────────────────────────────────────────────────────
const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  fontSize: 11,
  opacity: 0.8,
};
const selectStyle = {
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '6px 8px',
  borderRadius: 6,
  fontSize: 12,
};
const primaryBtn = {
  background: 'linear-gradient(135deg, #7b61ff, #9b5cff)',
  color: '#fff',
  border: 'none',
  padding: '10px 20px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(123,97,255,0.4)',
};
const secondaryBtn = {
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.15)',
  padding: '10px 20px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};
const overlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.35)',
  backdropFilter: 'blur(2px)',
  zIndex: 5,
};

// ─── Sub-components ──────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    idle: { color: '#9ca3af', text: 'ожидание' },
    loading: { color: '#fbbf24', text: 'загрузка…' },
    ready: { color: '#4ade80', text: 'готово ✓' },
    error: { color: '#f87171', text: 'ошибка ✗' },
  };
  const { color, text } = map[status] || map.idle;
  return <span style={{ color, fontWeight: 600 }}>{text}</span>;
};

// Локальный ErrorBoundary (чтобы не тянуть глобальный Fallback
// и видеть конкретную ошибку на странице)
class ErrorCatcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    if (this.props.onError) this.props.onError(error);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ ...overlayStyle, color: '#f87171' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 12, textAlign: 'center', padding: '0 20px' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default Test3DLogoPage;
