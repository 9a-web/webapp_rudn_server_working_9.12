# 3dsvg Integration — Fix Notes (2026-04)

## Problem
User installed `3dsvg` package via npm and pasted code from 3dsvg.design
(see /tmp/import3Dlogo.txt). The 3D logo "wouldn't load".

## Root Causes Found
1. **Package never actually imported anywhere in src/** — user added `3dsvg` to
   package.json but no file imported `SVG3D`.
2. **Vite duplicated React**: 3dsvg was pre-bundled in `.vite/deps` with its
   own React copy, producing "Invalid hook call / Cannot read properties of
   null (useState)". Fixed via `resolve.dedupe` + `optimizeDeps.include` in
   `vite.config.js`.

## Fix Applied
- `/app/frontend/vite.config.js` — added dedupe for react/react-dom/three/
  @react-three/* and optimizeDeps.include for 3dsvg.
- `/app/frontend/src/pages/Test3DLogoPage.jsx` — isolated test page with
  controls (smoothness, material, animate) + simple demo SVG toggle.
- `/app/frontend/public/rudn-logo-3d.svg` — extracted RUDN SVG asset.
- `/app/frontend/src/App.jsx` — added `/test-3d-logo` route.

## Result
- ✅ Package works perfectly (simple demo SVG renders in ~1 sec).
- ⚠️ Real RUDN logo SVG is 82 KB / 1 path / ~2700 curves — too heavy for
  real-time ExtrudeGeometry triangulation. Browser freezes during geometry
  build even with smoothness=0. This is an SVG complexity problem, NOT a
  package bug.

## Recommendation for User
- Simplify RUDN SVG via SVGO / Inkscape Simplify Paths before using with 3dsvg.
- Or pre-bake GLB in Blender for real production usage.
