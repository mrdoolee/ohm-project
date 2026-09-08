import { useEffect, useRef, useState } from 'react'
import { GridCanvas, type GridCanvasHandle } from './components/GridCanvas'
import { Palette, PaletteThumbnail } from './components/Palette'
import { PartInspector } from './components/PartInspector'
import { Toolbar } from './components/Toolbar'
import type { PartKind } from './domain/parts'
import { CircuitProvider } from './state/CircuitContext'

// How close to the top/bottom viewport edge (in px) a pointer must get while
// dragging before we auto-scroll the page for it. On a narrow/tablet layout
// the palette and canvas stack vertically and don't both fit on screen, so
// without this a touch drag can never physically reach the canvas at all.
const AUTO_SCROLL_EDGE = 72
const AUTO_SCROLL_SPEED = 16

function AppShell() {
  const [draggingKind, setDraggingKind] = useState<PartKind | 'wire' | null>(null)
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null)
  const gridCanvasRef = useRef<GridCanvasHandle>(null)

  // Palette items start a drag on pointerdown (works for mouse and touch alike,
  // unlike HTML5 native drag-and-drop which tablets/touch browsers don't fire).
  // Everything about the drag — the WYSIWYG hover preview on the canvas, the
  // actual drop, the floating thumbnail that follows the pointer, and
  // auto-scroll near the top/bottom edge — is driven from these window-level
  // listeners rather than GridCanvas's own onPointerMove/onPointerUp: on
  // touch, a pointer's events stay targeted at wherever it went *down* (the
  // palette item here) and only bubble from there, never actually firing on
  // the canvas SVG no matter where the finger physically moves — only a
  // window listener (which still receives them via bubbling) sees them
  // reliably, so GridCanvas exposes `updateDragHover`/`commitDrop` for this
  // to call imperatively instead of relying on its own pointer handlers.
  useEffect(() => {
    if (!draggingKind) return
    const move = (e: PointerEvent) => {
      setDragPointer({ x: e.clientX, y: e.clientY })
      gridCanvasRef.current?.updateDragHover(e.clientX, e.clientY)
      if (e.clientY < AUTO_SCROLL_EDGE) window.scrollBy(0, -AUTO_SCROLL_SPEED)
      else if (e.clientY > window.innerHeight - AUTO_SCROLL_EDGE) window.scrollBy(0, AUTO_SCROLL_SPEED)
    }
    const finish = (e: PointerEvent) => {
      gridCanvasRef.current?.commitDrop(e.clientX, e.clientY, draggingKind)
      setDraggingKind(null)
      setDragPointer(null)
    }
    const cancel = () => {
      gridCanvasRef.current?.updateDragHover(-1, -1) // off-canvas -> clears the hover preview
      setDraggingKind(null)
      setDragPointer(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [draggingKind])

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-slate-800">옴의 법칙 격자 회로 시뮬레이터</h1>
        <p className="text-sm text-slate-500">V = I × R — 부품을 배치하고 배선해서 전류와 전압을 확인해보세요.</p>
      </header>
      <Toolbar />
      <div className="flex gap-4 items-start flex-wrap">
        <Palette onDragStart={setDraggingKind} />
        <div className="flex-1 min-w-[400px]">
          <GridCanvas ref={gridCanvasRef} draggingKind={draggingKind} />
        </div>
        <div className="flex flex-col gap-4">
          <PartInspector />
        </div>
      </div>
      {draggingKind && dragPointer && (
        <div
          className="fixed z-50 pointer-events-none rounded-md border border-slate-300 bg-white/90 shadow-lg p-1"
          style={{ left: dragPointer.x - 20, top: dragPointer.y - 20 }}
        >
          <PaletteThumbnail kind={draggingKind} />
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <CircuitProvider>
      <AppShell />
    </CircuitProvider>
  )
}
