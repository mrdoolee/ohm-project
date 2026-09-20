import { useEffect, useRef, useState } from 'react'
import { GridCanvas, type GridCanvasHandle } from './components/GridCanvas'
import { Palette, PaletteThumbnail } from './components/Palette'
import { PartInspector } from './components/PartInspector'
import { Caption, FlowLegend, ResetButton, StatusChip, StepsBar } from './components/Toolbar'
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
    <div className="frame">
      <aside className="band" aria-hidden="true">
        <span>옴의 법칙</span>
      </aside>
      <div className="content">
        {/* 상단 */}
        <header className="lead">
          <div>
            <h1>전압과 저항이 바뀌면 전류는 어떻게 될까?</h1>
            <p>부품을 끌어다 놓고 전선으로 이어서 V = I × R을 직접 확인해 보세요.</p>
          </div>
          <div className="lead-side">
            <ResetButton />
          </div>
        </header>
        <StepsBar />

        {/* 중앙: 좌우 없이 하나. 프리셋 아래에 부품 칸(왼쪽 세로)과 캔버스 */}
        <main className="bench">
          <figure className="figure">
            <section className="preset" aria-label="프리셋과 측정값">
              <PartInspector />
              <StatusChip />
            </section>
            <div className="work">
              <Palette onDragStart={setDraggingKind} />
              <div className="stage">
                <GridCanvas ref={gridCanvasRef} draggingKind={draggingKind} />
              </div>
            </div>
            <FlowLegend />
          </figure>
        </main>

        {/* 하단 */}
        <Caption />
        <footer className="foot">옴의 법칙 시뮬레이션: 전압, 전류, 저항의 관계를 눈으로 확인해요.</footer>
      </div>
      {draggingKind && dragPointer && (
        <div className="drag-ghost" style={{ left: dragPointer.x - 20, top: dragPointer.y - 20 }}>
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
