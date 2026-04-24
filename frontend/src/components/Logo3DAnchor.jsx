/**
 * 🎯 Logo3DAnchor — placeholder для глобального 3D-логотипа.
 *
 * Используется в местах, где раньше стоял <Logo3D />. Занимает место
 * указанного размера и регистрирует себя в Logo3DContext. Logo3DHost
 * увидит anchor и позиционирует свой Canvas над ним (position: fixed).
 *
 * При размонтировании anchor'а — Logo3DHost скрывает Canvas (но НЕ
 * размонтирует). Следующий маунт Logo3DAnchor → Host плавно летит обратно.
 *
 * Props — совпадают с <Logo3D />. При их изменении Logo3DHost перерендерит
 * внутренний Logo3D с новыми параметрами (без пересборки геометрии, если
 * не поменялся `smoothness` или `svg`).
 */

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { useLogo3DContext } from '../contexts/Logo3DContext';

// Дефолты вынесены наружу — иначе каждый рендер создавал бы новый массив,
// что инвалидировало бы useMemo(propsObject) и приводило к бесконечному
// циклу updateAnchorProps → setAnchors → re-render → новый default → ...
const DEFAULT_LIGHT_POSITION = [-0.5, 2, 4];

export default function Logo3DAnchor({
  size = 200,
  material = 'metal',
  animate = 'spin',
  animateSpeed = 2,
  smoothness = 0.2,
  metalness = 0.9,
  roughness = 0.25,
  color,
  lightPosition = DEFAULT_LIGHT_POSITION,
  priority = 0,
  className,
  style,
}) {
  const ref = useRef(null);
  const id = useId();
  const ctx = useLogo3DContext();

  // Стабильные методы из контекста (через ref, чтобы effect deps были стабильны).
  // Сам объект ctx пересоздаётся при каждом изменении anchors → нельзя ставить
  // его в deps, иначе зацикливание.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  // Стабильные props объект — для диффа
  const propsObject = useMemo(
    () => ({
      size,
      material,
      animate,
      animateSpeed,
      smoothness,
      metalness,
      roughness,
      color,
      lightPosition,
    }),
    [size, material, animate, animateSpeed, smoothness, metalness, roughness, color, lightPosition]
  );

  // Регистрация / снятие регистрации
  useEffect(() => {
    const c = ctxRef.current;
    if (!c) return undefined;
    c.registerAnchor(id, ref, propsObject, priority);
    return () => {
      const c2 = ctxRef.current;
      if (c2) c2.unregisterAnchor(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, priority]);

  // Обновление props — separate effect, чтобы не дёргать register/unregister.
  // Не зависим от ctx (он пересоздаётся), берём через ref.
  useEffect(() => {
    const c = ctxRef.current;
    if (!c) return;
    c.updateAnchorProps(id, propsObject);
  }, [id, propsObject]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        pointerEvents: 'none',
        ...style,
      }}
      aria-label="3D-логотип РУДН"
    />
  );
}
