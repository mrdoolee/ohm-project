import { useEffect, useState } from 'react'
import { GridCanvas } from './components/GridCanvas'
import { Palette } from './components/Palette'
import { PartInspector } from './components/PartInspector'
import { Toolbar } from './components/Toolbar'
import type { PartKind } from './domain/parts'
import { CircuitProvider } from './state/CircuitContext'

function AppShell() {
  const [draggingKind, setDraggingKind] = useState<PartKind | 'wire' | null>(null)

  // Palette items start a drag on pointerdown (works for mouse and touch alike,
  // unlike HTML5 native drag-and-drop which tablets/touch browsers don't fire).
  // GridCanvas's own pointer handlers pick up the move/drop once the pointer
  // reaches the canvas; this window listener is only the safety net for a
  // pointer released outside the canvas (or a touch cancel), so the pending
  // drag never gets stuck.
  useEffect(() => {
    if (!draggingKind) return
    const clear = () => setDraggingKind(null)
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
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
