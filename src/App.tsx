import { useEffect, useState } from 'react'
import { GridCanvas } from './components/GridCanvas'
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

  // Palette items start a drag on pointerdown (works for mouse and touch alike,
  // unlike HTML5 native drag-and-drop which tablets/touch browsers don't fire).
  // GridCanvas's own pointer handlers pick up the move/drop once the pointer
  // reaches the canvas; this window listener also tracks the pointer so a
  // floating preview can follow it (native drag-and-drop shows one automatically;
  // pointer-based dragging needs it drawn by hand, and without it a touch drag
  // that starts on the palette gives no visible feedback at all until the
  // finger happens to reach the canvas), auto-scrolls the page when the pointer
  // nears the top/bottom edge (palette and canvas don't both fit on a narrow
  // screen), and is the safety net that un-sticks `draggingKind` if the pointer
  // is released outside the canvas or a touch is cancelled.
  useEffect(() => {
    if (!draggingKind) return
    const move = (e: PointerEvent) => {
      setDragPointer({ x: e.clientX, y: e.clientY })
      if (e.clientY < AUTO_SCROLL_EDGE) window.scrollBy(0, -AUTO_SCROLL_SPEED)
      else if (e.clientY > window.innerHeight - AUTO_SCROLL_EDGE) window.scrollBy(0, AUTO_SCROLL_SPEED)
    }
    const clear = () => {
      setDraggingKind(null)
      setDragPointer(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', clear)
      window.removeEventListener('pointercancel', clear)
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
          <GridCanvas draggingKind={draggingKind} />
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
