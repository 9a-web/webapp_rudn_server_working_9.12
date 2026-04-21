// Геометрическая симплификация SVG:
// 1. Парсим path d-атрибут
// 2. Сэмплим каждую кривую в точки (с шагом = stepPx)
// 3. Запускаем RDP (simplify-js) с нужной tolerance
// 4. Пишем новый path только с командами M/L (прямые), замкнутые Z
//
// Это даёт 5-15x сокращение числа команд ценой потери плавности кривых,
// что НЕ ЗАМЕТНО для extrude-геометрии в three.js (с smoothness 0).
//
// Args: inputSvg outputSvg [tolerance] [samplesPerCurve]

const fs = require('node:fs');
const simplify = require('simplify-js');

const INPUT = process.argv[2] || '/app/frontend/public/rudn-logo-3d.svg';
const OUTPUT = process.argv[3] || '/tmp/rudn-simplified-geo.svg';
const TOL = parseFloat(process.argv[4] || '1.0');
const SAMPLES = parseInt(process.argv[5] || '8', 10);

const src = fs.readFileSync(INPUT, 'utf8');
console.log(`Input ${INPUT}: ${src.length} bytes, tol=${TOL}, samples/curve=${SAMPLES}`);

// ─── Мини-парсер d-атрибута ──────────────────────────────────────────────
function parseD(d) {
  // Разбиваем на команды: буква + аргументы
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const cmds = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      const type = t;
      const argCount = { M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1, C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2, A: 7, a: 7, Z: 0, z: 0 }[type];
      i++;
      if (argCount === 0) { cmds.push({ type, args: [] }); continue; }
      // В SVG можно опускать букву для последующих групп аргументов
      do {
        const args = [];
        for (let k = 0; k < argCount; k++) {
          args.push(parseFloat(tokens[i++]));
        }
        cmds.push({ type, args });
      } while (i < tokens.length && !/[A-Za-z]/.test(tokens[i]));
    } else {
      i++;
    }
  }
  return cmds;
}

// ─── Сэмплирование Безье ─────────────────────────────────────────────────
function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const u2 = u * u, u3 = u2 * u;
  const t2 = t * t, t3 = t2 * t;
  return {
    x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
    y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y,
  };
}
function quadBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

// ─── Преобразуем команды в ломаные (subPath: array of {x,y}) ─────────────
function commandsToPolylines(cmds) {
  const subPaths = [];
  let current = [];
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;
  let lastCP2 = null; // для S/s
  let lastQCP = null; // для T/t

  function add(p) {
    current.push(p);
    cx = p.x; cy = p.y;
  }
  function finishSub() {
    if (current.length > 0) subPaths.push(current);
    current = [];
  }

  for (const cmd of cmds) {
    const { type, args } = cmd;
    const rel = type === type.toLowerCase();
    switch (type.toUpperCase()) {
      case 'M': {
        finishSub();
        const x = rel ? cx + args[0] : args[0];
        const y = rel ? cy + args[1] : args[1];
        current = [{ x, y }];
        cx = x; cy = y; startX = x; startY = y;
        // Согласно SVG, доп. пары после M трактуются как L
        break;
      }
      case 'L': {
        const x = rel ? cx + args[0] : args[0];
        const y = rel ? cy + args[1] : args[1];
        add({ x, y });
        break;
      }
      case 'H': {
        const x = rel ? cx + args[0] : args[0];
        add({ x, y: cy });
        break;
      }
      case 'V': {
        const y = rel ? cy + args[0] : args[0];
        add({ x: cx, y });
        break;
      }
      case 'C': {
        const p0 = { x: cx, y: cy };
        const p1 = { x: rel ? cx + args[0] : args[0], y: rel ? cy + args[1] : args[1] };
        const p2 = { x: rel ? cx + args[2] : args[2], y: rel ? cy + args[3] : args[3] };
        const p3 = { x: rel ? cx + args[4] : args[4], y: rel ? cy + args[5] : args[5] };
        for (let k = 1; k <= SAMPLES; k++) current.push(cubicBezier(p0, p1, p2, p3, k / SAMPLES));
        cx = p3.x; cy = p3.y; lastCP2 = p2;
        break;
      }
      case 'S': {
        const p0 = { x: cx, y: cy };
        const p1 = lastCP2 ? { x: 2 * cx - lastCP2.x, y: 2 * cy - lastCP2.y } : p0;
        const p2 = { x: rel ? cx + args[0] : args[0], y: rel ? cy + args[1] : args[1] };
        const p3 = { x: rel ? cx + args[2] : args[2], y: rel ? cy + args[3] : args[3] };
        for (let k = 1; k <= SAMPLES; k++) current.push(cubicBezier(p0, p1, p2, p3, k / SAMPLES));
        cx = p3.x; cy = p3.y; lastCP2 = p2;
        break;
      }
      case 'Q': {
        const p0 = { x: cx, y: cy };
        const p1 = { x: rel ? cx + args[0] : args[0], y: rel ? cy + args[1] : args[1] };
        const p2 = { x: rel ? cx + args[2] : args[2], y: rel ? cy + args[3] : args[3] };
        for (let k = 1; k <= SAMPLES; k++) current.push(quadBezier(p0, p1, p2, k / SAMPLES));
        cx = p2.x; cy = p2.y; lastQCP = p1;
        break;
      }
      case 'T': {
        const p0 = { x: cx, y: cy };
        const p1 = lastQCP ? { x: 2 * cx - lastQCP.x, y: 2 * cy - lastQCP.y } : p0;
        const p2 = { x: rel ? cx + args[0] : args[0], y: rel ? cy + args[1] : args[1] };
        for (let k = 1; k <= SAMPLES; k++) current.push(quadBezier(p0, p1, p2, k / SAMPLES));
        cx = p2.x; cy = p2.y; lastQCP = p1;
        break;
      }
      case 'A':
        // Упрощаем: аппроксимируем дугу несколькими сэмплами линии к конечной точке
        // (для логотипа А встречается редко)
        {
          const x = rel ? cx + args[5] : args[5];
          const y = rel ? cy + args[6] : args[6];
          add({ x, y });
        }
        break;
      case 'Z':
        current.push({ x: startX, y: startY });
        finishSub();
        cx = startX; cy = startY;
        break;
    }
    if (!'CSQTA'.includes(type.toUpperCase())) lastCP2 = null;
    if (!'QT'.includes(type.toUpperCase())) lastQCP = null;
  }
  finishSub();
  return subPaths;
}

// ─── Собираем обратно в d-атрибут ────────────────────────────────────────
function polylinesToD(subs) {
  const parts = [];
  for (const sub of subs) {
    if (sub.length < 2) continue;
    parts.push(`M${round(sub[0].x)} ${round(sub[0].y)}`);
    let prev = sub[0];
    // Горизонтальные H и вертикальные V дают чуть более короткий вывод
    for (let i = 1; i < sub.length; i++) {
      const p = sub[i];
      if (Math.abs(p.y - prev.y) < 0.05) parts.push(`H${round(p.x)}`);
      else if (Math.abs(p.x - prev.x) < 0.05) parts.push(`V${round(p.y)}`);
      else parts.push(`L${round(p.x)} ${round(p.y)}`);
      prev = p;
    }
    parts.push('Z');
  }
  return parts.join('');
}
const round = (n) => Math.round(n * 10) / 10; // 1 знак после запятой

// ─── Обработка SVG ───────────────────────────────────────────────────────
let out = src;
let totalCmdsBefore = 0, totalCmdsAfter = 0, totalPoints = 0, totalPointsSimp = 0;

out = out.replace(/<path\b([^>]*?)\sd="([^"]+)"([^>]*?)\/?>/g, (_, pre, d, post) => {
  const cmds = parseD(d);
  totalCmdsBefore += cmds.length;

  const polylines = commandsToPolylines(cmds);
  const polySimplified = polylines.map((poly) => {
    totalPoints += poly.length;
    const s = simplify(poly, TOL, true);
    totalPointsSimp += s.length;
    return s;
  });
  const newD = polylinesToD(polySimplified);
  // считаем команды в новом d
  const newCmds = (newD.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length;
  totalCmdsAfter += newCmds;
  return `<path${pre} d="${newD}"${post}/>`;
});

console.log(`Before: ${totalCmdsBefore} cmds → After: ${totalCmdsAfter} cmds (${(totalCmdsAfter / totalCmdsBefore * 100).toFixed(1)}%)`);
console.log(`Polyline points: ${totalPoints} → ${totalPointsSimp} (${(totalPointsSimp / totalPoints * 100).toFixed(1)}%)`);
console.log(`Output size: ${out.length} bytes (${(out.length / src.length * 100).toFixed(1)}% of original ${src.length})`);

fs.writeFileSync(OUTPUT, out);
console.log(`Written → ${OUTPUT}`);
