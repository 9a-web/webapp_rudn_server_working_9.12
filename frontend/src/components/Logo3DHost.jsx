/**
 * 🎯 Logo3DHost — singleton-инстанс 3D-логотипа в DOM (Portal в body).
 *
 * Рендерится ОДИН раз при маунте Logo3DProvider и НЕ размонтируется до
 * перезагрузки страницы. Позиционируется абсолютно (`position: fixed`) над
 * активным Logo3DAnchor'ом (через getBoundingClientRect + ResizeObserver).
 *
 * ## Что это решает:
 *
 * Пакет `3dsvg` (обёртка над three.js) при каждом маунте компонента:
 *  1. Делает `fetch(svgUrl)` — сетевой запрос (~50-200ms)
 *  2. Парсит SVG → THREE.ShapePath[]
 *  3. Строит `new THREE.ExtrudeGeometry()` для каждого shape (1448 сегментов × N shapes) — это САМЫЙ дорогой шаг (~300-800ms на мобильных)
 *  4. Создаёт WebGL Canvas + shaders
 *  5. Воспроизводит intro-анимацию "zoom" (2.5 секунды)
 *
 * Итого 500-3000ms "чёрного экрана" при каждом монтировании. При переходах
 * LoadingScreen → AuthLayout → AuthLayout это раздражает.
 *
 * Решение: Logo3DHost оставляет Canvas ВСЕГДА смонтированным и только плавно
 * перемещает его по экрану.
 *
 * ## Цепочка оптимизаций:
 *
 * 1. SVG preload (utils/logoPreload) — убирает fetch #1 при повторах
 * 2. Singleton Canvas (этот файл) — убирает пункты 3–5 при переходах
 * 3. `transition: top/left/width/height` — плавная анимация перелёта (400ms)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLogo3DContext } from '../contexts/Logo3DContext';
import Logo3D from './Logo3D';
import {
  DEFAULT_LOGO_SVG_URL,
  getCachedLogoSvg,
  preloadLogoSvg,
} from '../utils/logoPreload';

/**
 * Стили transition перелёта при смене anchor'а.
 * Отключаются при ПЕРВОМ размещении (чтобы логотип не "прилетал" из угла).
 */
const FLY_TRANSITION =
  'top 0.45s cubic-bezier(0.25, 0.1, 0.25, 1), ' +
  'left 0.45s cubic-bezier(0.25, 0.1, 0.25, 1), ' +
  'width 0.45s cubic-bezier(0.25, 0.1, 0.25, 1), ' +
  'height 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)';

export default function Logo3DHost() {
  const { activeAnchor } = useLogo3DContext();
  const [rect, setRect] = useState(null);
  const [svgString, setSvgString] = useState(() => getCachedLogoSvg());
  const [hasEverBeenPositioned, setHasEverBeenPositioned] = useState(false);

  // Preload SVG если ещё не в кэше
  useEffect(() => {
    if (svgString) return;
    let cancelled = false;
    preloadLogoSvg(DEFAULT_LOGO_SVG_URL).then((s) => {
      if (!cancelled && s) setSvgString(s);
    });
    return () => {
      cancelled = true;
    };
  }, [svgString]);

  // Отслеживание rect активного anchor'а.
  // Зависим от anchor.id (а не от объекта целиком), чтобы props-обновления
  // активного якоря не перезапускали rafLoop.
  const anchorId = activeAnchor?.id;
  const anchorRef = activeAnchor?.ref;
  useEffect(() => {
    const el = anchorRef?.current;
    if (!el) {
      setRect(null);
      return undefined;
    }

    // Инициализация — сразу установим позицию без transition.
    // Используем functional setState с epsilon-сравнением, чтобы при равных
    // значениях не создавать новый объект (иначе RAF 60fps × 700ms превращался
    // бы в 42 ререндера + бесконечный цикл при каскаде).
    const update = () => {
      const r = el.getBoundingClientRect();
      // getBoundingClientRect может вернуть 0×0, если элемент display:none
      if (r.width === 0 && r.height === 0) return;
      setRect((prev) => {
        if (
          prev &&
          Math.abs(prev.top - r.top) < 0.5 &&
          Math.abs(prev.left - r.left) < 0.5 &&
          Math.abs(prev.width - r.width) < 0.5 &&
          Math.abs(prev.height - r.height) < 0.5
        ) {
          return prev; // нет изменений — НЕ инициируем ре-рендер
        }
        return {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        };
      });
    };
    update();

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }

    // При scroll / resize / animation frame — обновляем
    // true в scroll = listen capture phase, чтобы ловить scroll любых
    // внутренних элементов (например motion.div animate scale).
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    // Для framer-motion animate / CSS transitions anchor'а — RAF-цикл
    // в течение 600ms (охватывает типичные entrance-анимации 300-500ms)
    let rafHandle = 0;
    const startedAt = performance.now();
    const rafLoop = () => {
      update();
      if (performance.now() - startedAt < 700) {
        rafHandle = requestAnimationFrame(rafLoop);
      }
    };
    rafHandle = requestAnimationFrame(rafLoop);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafHandle);
    };
  }, [anchorId, anchorRef]);

  // Отмечаем первое реальное позиционирование
  useEffect(() => {
    if (rect && !hasEverBeenPositioned) {
      // Small delay, чтобы первый paint прошёл без transition
      const h = requestAnimationFrame(() => setHasEverBeenPositioned(true));
      return () => cancelAnimationFrame(h);
    }
    return undefined;
  }, [rect, hasEverBeenPositioned]);

  const isVisible = !!(activeAnchor && rect);
  const props = activeAnchor?.props ?? {};
  const size = props.size ?? 200;

  // Fixed-позиционирование. Когда нет anchor'а — прячем за экран, чтобы Canvas
  // оставался в DOM (не размонтировать!), но не занимал место и не ловил клики.
  const style = useMemo(() => {
    if (!isVisible) {
      return {
        position: 'fixed',
        top: -10000,
        left: -10000,
        width: size,
        height: size,
        pointerEvents: 'none',
        visibility: 'hidden',
        zIndex: 100,
      };
    }
    return {
      position: 'fixed',
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      pointerEvents: 'none',
      zIndex: 100,
      // При первом позиционировании — без transition, чтобы логотип появился на
      // месте. При последующих — плавно перелетает.
      transition: hasEverBeenPositioned ? FLY_TRANSITION : 'none',
      willChange: 'top, left, width, height',
    };
  }, [isVisible, rect, size, hasEverBeenPositioned]);

  // SSR guard
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={style} aria-hidden={!isVisible} data-testid="logo3d-host">
      <Logo3D
        size={size}
        material={props.material ?? 'metal'}
        animate={props.animate ?? 'spin'}
        animateSpeed={props.animateSpeed ?? 2}
        smoothness={props.smoothness ?? 0.2}
        metalness={props.metalness ?? 0.9}
        roughness={props.roughness ?? 0.25}
        color={props.color}
        lightPosition={props.lightPosition ?? [-0.5, 2, 4]}
        svgString={svgString || undefined}
        svg={svgString ? undefined : DEFAULT_LOGO_SVG_URL}
        fallbackSrc={DEFAULT_LOGO_SVG_URL}
      />
    </div>,
    document.body
  );
}
