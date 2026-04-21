# 3dsvg Integration — Fix Notes (2026-04)

## User's Issue
> Installed `3dsvg` package from 3dsvg.design to render RUDN logo in 3D.
> It "wouldn't load".

## Root Causes
1. **Not imported**: `3dsvg` was in package.json but no source file imported `SVG3D`.
2. **Vite duplicate React**: pre-bundled `3dsvg` got its own React copy → "Invalid hook call / useState null".
3. **SVG too heavy**: RUDN logo = 82 KB / 2459 bezier commands → ExtrudeGeometry
   triangulation froze browser for 10+ sec.

## Fixes Applied

### 1. Vite config (fix React duplication)
`/app/frontend/vite.config.js`:
```js
resolve: { dedupe: ['react','react-dom','three','@react-three/fiber','@react-three/drei'] },
optimizeDeps: { include: ['3dsvg','@react-three/fiber','@react-three/drei','three'] }
```

### 2. Test page with SVG source selector
`/app/frontend/src/pages/Test3DLogoPage.jsx` at `/test-3d-logo`.
Three SVG options: simple demo / simplified RUDN / original RUDN.
Controls: smoothness slider, material select, animate select.

### 3. Geometric SVG simplification
`/app/scripts/simplify_svg_geometrically.cjs` — flattens beziers to polylines
and runs Ramer-Douglas-Peucker (simplify-js) to cut point count 5-10×.

Result on RUDN logo (tolerance=1.5):
- Size: 82 KB → 17 KB (20%)
- Commands: 2459 → 1448 (59%)
- Points: 13316 → 1448 (11% = **9× fewer**)
- Visual quality: indistinguishable from original

## Artifacts
- `/app/frontend/public/rudn-logo-3d.svg` — original from user (82 KB)
- `/app/frontend/public/rudn-logo-3d-simplified.svg` — optimized (17 KB)
- `/app/frontend/public/svg-compare.html` — side-by-side visual comparison
- `/app/scripts/simplify_svg_geometrically.cjs` — reusable CLI tool
- `/app/scripts/README_svg_simplify.md` — docs for the CLI

## Verified Working
- `/test-3d-logo` → "Логотип РУДН, упрощённый" + smoothness=0.2 + material=metal
  → renders in <1 sec, status "готово ✓", no console errors.
