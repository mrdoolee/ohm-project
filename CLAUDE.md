# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # start Vite dev server
npm run build             # tsc -b && vite build -> dist/ (static, base:'./' for offline/USB use)
npm run preview           # serve the production build locally
npm run test               # vitest run (all tests, once)
npx vitest run <path>       # run a single test file
npx vitest run -t "<name>"   # run tests matching a name
npx tsc -b                  # type-check only, no emit
npm run lint                # oxlint
```

No test watch script is defined; use `npx vitest` directly for watch mode.

## Architecture

This is a client-only (no backend) React + TypeScript + Vite app: a grid-based circuit simulator for teaching Ohm's law (V = I × R). Three layers, strictly separated:

- **`src/domain/`** — pure, framework-free logic. No React imports here. This is where correctness lives and where tests live (`*.test.ts` beside the module they test).
- **`src/state/`** — a single `useReducer` + React Context (`CircuitContext.tsx`) holding all circuit data (parts, wires, UI mode). No external state library.
- **`src/components/`** — rendering only. Reads from `useCircuit()`, dispatches actions, never computes circuit values itself.

### Grid coordinate system (`domain/grid.ts`)

All positions are integer `{col, row}` grid coordinates, never pixels, until the moment of SVG rendering (`toPixel`, `CELL = 40`). `GRID_COLS`/`GRID_ROWS` define the fixed canvas size; `MAX_PARTS = 20` is enforced in the reducer, not the UI.

### Circuit solving pipeline

Three sequential domain modules turn placed parts + wires into meter readings on every state change (recomputed via `useMemo` in `CircuitContext`, not stored in the reducer):

1. **`domain/circuitGraph.ts`** (`buildCircuitEdges`) — resolves *electrical* connectivity from *geometric* placement via union-find over synthetic per-touch node ids (not raw coordinate strings). Any two entities sharing the exact same grid point — a part terminal, a wire endpoint, or a wire's interior pass-through point — are connected there, full stop; there is no separate "junction dot" step (an earlier version required one for wire-wire crossings specifically, but that read as arbitrary/inconsistent — an app-wide "if it touches, it's wired" rule is far closer to how students expect real leads and breadboards to behave, and this app's scope never needs to represent two wires deliberately crossing without connecting). A wire's own interior points are always connected to each other too. A long wire drag is expanded from its corner vertices to every unit cell it passes through (`wires.ts#expandWireToUnitPoints`) specifically so mid-segment crossings/taps are detectable at all — without that expansion, a part terminal landing midway along a long straight wire wouldn't register as touching it.
2. **`domain/circuitSolver.ts`** (`solveCircuit`) — pure function, the actual physics engine. Takes abstract `CircuitEdge[]` (nodeA/nodeB/resistance/emf/closed), independent of grid/parts concepts, which is why it's tested directly with hand-built edges rather than through the UI. Algorithm: repeatedly apply series elimination (any degree-2 node — this alone can produce a self-loop edge when both far endpoints coincide, which is the correctly-solved terminal state for a simple closed loop) and parallel merging (two edges sharing a node pair, restricted to zero-EMF pairs — merging a battery-bearing edge into a "parallel" pair only happens as the same series-elimination self-loop case, never as a real Thévenin-parallel combine; see the `flip()` helper, which must recursively re-orient composite children or current signs come out flipped). Unreduced leftovers after the loop determine status: fully resolved self-loop(s) → `ok`/`short` (R=0 with nonzero EMF); a single dangling non-self-loop edge containing a battery → `open`; anything else containing a battery → `unsupported` (genuine multi-loop/Kirchhoff topology, out of scope by design).
3. Component values are recovered by a top-down tree walk (`solveTree`) over the reduction tree built during step 2, not by re-deriving them from the flattened equivalent — that flattening is lossy for individual branch currents.

### Wires are placed and edited like parts, not drawn as a polyline tool

There is no "wire drawing mode." Dragging the "전선" palette entry sends the sentinel `'wire'` over the same `text/part-kind` DataTransfer key; `GridCanvas`'s `handleDrop` special-cases it into `ADD_WIRE` (instead of `ADD_PART`), which drops a 1-cell, 2-point horizontal `Wire` at the drop point. A selected wire shows two draggable circle handles at `points[0]`/`points[length-1]`; dragging one calls `RESIZE_WIRE_ENDPOINT`, which moves only that endpoint and axis-locks it against its immediate neighbor (`axisLock` in `circuitReducer.ts` — same snap-to-horizontal-or-vertical logic used everywhere else, so a segment can never go diagonal). Dragging the wire's body (the wide invisible hit-`path`) calls `MOVE_WIRE`, translating every point by the same delta. Bent multi-segment paths (like the sample circuit's) are still valid `Wire` data (more than 2 points) and still render/select/delete fine — they just can't be created via drag; only their first/last segment is resizable. To connect two straight wire pieces into an L-shape, drag their endpoints to the same grid point (ordinary endpoint-to-endpoint connectivity, see the circuitGraph section above).

**Do not reintroduce `nearestGridPoint()` on a value that already came from `clientToGrid()`/is already a `GridPoint`** — `nearestGridPoint(x, y)` expects *pixel* coordinates and divides by `CELL`. Applying it a second time to an already-grid-scale `{col, row}` silently collapses almost every point to `(0,0)`. This exact bug previously made every new wire start at the grid origin regardless of where the user clicked — `MOVE_PART`/`MOVE_WIRE`/`RESIZE_WIRE_ENDPOINT` correctly call only `clampToGrid()` on the incoming point; follow that pattern for anything new that consumes a `GridPoint` already computed by `clientToGrid()`.

`CircuitState` tracks part selection (`selectedId`) and wire selection (`selectedWireId`) separately; the `SELECT`/`SELECT_WIRE` reducer cases always null out the other one, so at most one thing is selected at a time. `Toolbar`'s delete button checks both; rotate only applies to parts.

### Drop preview is WYSIWYG, not a generic highlight square

While dragging a palette entry over the canvas, `GridCanvas` renders the *actual* part/wire glyph (semi-transparent) at the exact spot it will land — not a generic centered highlight box. This matters because a part's `origin` is its terminal `a`, not its center: it occupies `origin` through `origin + 1 cell` in its rotation direction, so a symmetric "highlight the hovered cell" preview visually lies about where the part's two ends will actually end up. `App.tsx` lifts `draggingKind` (set by `Palette`'s `onDragStart`/`onDragEnd`) down to `GridCanvas` so it knows *what* to preview — native HTML5 drag events can't carry the dragged value through `dataTransfer.getData()` during `dragover` (only during `drop`), so the kind has to arrive via this side channel instead.

### Status banner has a fixed-height slot

`Toolbar`'s bottom message row (short/unsupported/open/limit-warning) is *always* mounted, never conditionally — it renders a space character when idle. Conditionally mounting/unmounting it previously caused the canvas to reflow every time circuit status flipped mid-drag (e.g. dragging a part in and out of connection), which shifted `GridCanvas`'s `getBoundingClientRect()` under the pointer and made drags jitter. Keep this slot unconditionally rendered if you touch it.

If you change the solver's merge/reduction logic, re-run `circuitSolver.test.ts` — the test cases there are the executable spec for what's in/out of scope (series, parallel, mixed, multi-battery same/opposite polarity, open, short, switch).

### Display duality

Every part renders in one of two modes (`DisplayMode`, toggled in `Toolbar`, stored in `CircuitState.displayMode`): schematic symbols (`PartSymbol.tsx`'s inline sub-components) or realistic-looking icons (`parts/realisticGlyphs.tsx`). Both share the same outer transform/rotation/hit-rect/selection logic in `PartSymbol.tsx` — only the inner glyph swaps. The palette (`Palette.tsx`) always shows the realistic glyphs regardless of canvas mode, reusing the same components at a fixed neutral size; realistic glyphs' shared gradients (`RealisticDefs`) are mounted once in `GridCanvas.tsx` and referenced by id from anywhere in the document (do not duplicate `RealisticDefs` elsewhere — SVG gradient ids are document-global).

### Flow direction display (`FlowDisplay`, toggled in `Toolbar`, `CircuitState.flowDisplay`)

Display-only, does not touch the solver. `PartSymbol.tsx` draws two small arrow triangles on every current-carrying part's leads, using `ComponentResult.current`'s sign directly: positive means current flows terminal `a` → `b` (since `CircuitEdge.nodeA` maps to terminal `a`), so `'current'` mode points the arrows along that sign and `'electron'` mode just flips it. Arrows are suppressed below `FLOW_EPSILON` so an open branch or a voltmeter (always zero current) shows none.

Wires get the same arrow treatment, one per unit grid cell, via `domain/wireFlow.ts#computeWireSegmentFlows`. The solver never assigns current to wires (they're zero-resistance connectivity, collapsed entirely by circuitGraph's union-find, so there's no `CircuitEdge` for them) — this reconstructs it separately by re-deriving a raw point graph of wire unit-segments (undirected, current unknown) plus per-point injections from each part's already-solved signed current (a part draws current out of the wire network at terminal `a` and returns it at `b`), then solves the resulting tree via subtree-sum KCL propagation. A wire subnetwork containing a cycle (a redundant loop with no components in it) is genuinely underdetermined with ideal 0-resistance wires — segments in such a component are simply omitted rather than guessed at. This is a pure, independently-tested domain function (`wireFlow.test.ts`), not integrated into `circuitSolver.ts`, since it's a display-only reconstruction and not part of the V=IR physics.

### Palette drag-and-drop is pointer-based, not HTML5 native drag-and-drop

`Palette.tsx` items start a drag on `onPointerDown` (with `touch-action: none` via the `touch-none` class) instead of `draggable`/`dragstart`/`dragover`/`drop`. HTML5 native DnD simply doesn't fire on touch browsers (tablets), which is why it has to be pointer-based — the same mechanism the canvas already uses for moving placed parts/wires. `App.tsx` owns `draggingKind`, set by the palette's `onPointerDown` callback; once the pointer (mouse or touch) reaches the canvas, `GridCanvas`'s own `onPointerMove`/`onPointerUp` pick it up automatically — no explicit hand-off needed, because an uncaptured pointer's move/up events go to whatever's currently under it, same as a mouse. `App.tsx` also keeps one `window` `pointerup`/`pointercancel` listener while a drag is pending, purely as a safety net to un-stick `draggingKind` if the pointer is released (or a touch is cancelled) outside the canvas — dropping *inside* the canvas is handled entirely by `GridCanvas`, and that window listener firing afterward on the same event is harmless (React's own handler already ran first, since `window` is outside the DOM subtree React's root listens on).

### Part geometry (`domain/parts.ts`)

A part occupies two adjacent grid points (terminals `a`/`b`), one cell apart, direction determined by `rotation` (0/90/180/270 — rotating changes both orientation and battery polarity direction). `clampOriginForRotation` keeps both terminals on-grid; it must be re-applied whenever rotation changes, not just on move.
