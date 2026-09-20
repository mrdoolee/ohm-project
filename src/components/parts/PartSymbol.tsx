import { CELL, toPixel } from '../../domain/grid'
import { partTerminals, type Part } from '../../domain/parts'
import type { ComponentResult } from '../../domain/circuitTypes'
import {
  RealisticBattery,
  RealisticBulb,
  RealisticMeter,
  RealisticResistor,
  RealisticRheostat,
  RealisticSwitch,
} from './realisticGlyphs'

const BULB_REFERENCE_CURRENT = 1 // amps treated as "100% brightness" for the visual scale

export type DisplayMode = 'realistic' | 'schematic'
export type FlowDisplay = 'current' | 'electron'

export const FLOW_EPSILON = 1e-6
/** 전류(+)는 --plus, 전자(−)는 --minus. 색과 함께 상단 버튼/그림 설명에 글자로도 알려 준다. */
export function flowArrowColor(flowDisplay: FlowDisplay): string {
  return flowDisplay === 'current' ? 'var(--plus)' : 'var(--minus)'
}

interface PartSymbolProps {
  part: Part
  result: ComponentResult | undefined
  selected: boolean
  mode: DisplayMode
  flowDisplay: FlowDisplay
  onSelect: () => void
  onToggleSwitch: () => void
}

/** Small filled triangle on a lead, pointing toward +x (right) or -x (left) in local part space. */
function FlowArrow({ cx, pointsRight, color }: { cx: number; pointsRight: boolean; color: string }) {
  const points = pointsRight
    ? `${cx - 4},-3.5 ${cx - 4},3.5 ${cx + 4},0`
    : `${cx + 4},-3.5 ${cx + 4},3.5 ${cx - 4},0`
  return <polygon points={points} style={{ fill: color }} />
}

interface LabelProps {
  x: number
  y: number
  rotation: number
  fontSize?: number
  fontWeight?: number
  className?: string
  children: React.ReactNode
}

/** Text that stays upright regardless of the part's own rotation. */
function Label({ x, y, rotation, fontSize = 11, fontWeight, className, children }: LabelProps) {
  return (
    <text
      x={x}
      y={y}
      fontSize={fontSize}
      fontWeight={fontWeight}
      textAnchor="middle"
      className={className}
      transform={`rotate(${-rotation} ${x} ${y})`}
    >
      {children}
    </text>
  )
}

function BatterySymbol({ value, rotation }: { value: number; rotation: number }) {
  return (
    <g>
      <line x1={CELL * 0.35} y1={-10} x2={CELL * 0.35} y2={10} stroke="currentColor" strokeWidth={4} />
      <line x1={CELL * 0.65} y1={-16} x2={CELL * 0.65} y2={16} stroke="currentColor" strokeWidth={2} />
      <Label x={CELL * 0.35} y={-16} rotation={rotation} className="svg-plus">
        +
      </Label>
      <Label x={CELL * 0.65} y={-20} rotation={rotation} className="svg-minus">
        −
      </Label>
      <Label x={CELL / 2} y={26} rotation={rotation} className="svg-ink">
        {value}V
      </Label>
    </g>
  )
}

function ResistorSymbol({ value, label, rotation }: { value: number; label: string; rotation: number }) {
  return (
    <g>
      <rect x={CELL * 0.2} y={-10} width={CELL * 0.6} height={20} className="svg-white" stroke="currentColor" strokeWidth={2} />
      <Label x={CELL / 2} y={26} rotation={rotation} className="svg-ink">
        {label} {value}Ω
      </Label>
    </g>
  )
}

function BulbSymbol({ value, current, rotation }: { value: number; current: number; rotation: number }) {
  const brightness = Math.max(0, Math.min(1, current / BULB_REFERENCE_CURRENT))
  return (
    <g>
      <circle cx={CELL / 2} cy={0} r={14} className="svg-white" stroke="currentColor" strokeWidth={2} />
      <circle cx={CELL / 2} cy={0} r={13} className="svg-unit" fillOpacity={brightness * 0.6} />
      <line x1={CELL / 2 - 8} y1={-8} x2={CELL / 2 + 8} y2={8} stroke="currentColor" strokeWidth={1.5} />
      <line x1={CELL / 2 - 8} y1={8} x2={CELL / 2 + 8} y2={-8} stroke="currentColor" strokeWidth={1.5} />
      <Label x={CELL / 2} y={-20} rotation={rotation} className="svg-ink">
        {value}Ω
      </Label>
      <Label x={CELL / 2} y={30} rotation={rotation} fontWeight={600} className="svg-ink">
        {Math.round(brightness * 100)}%
      </Label>
    </g>
  )
}

function SwitchSymbol({ closed, rotation, onToggle }: { closed: boolean; rotation: number; onToggle: () => void }) {
  return (
    <g onClick={(e) => { e.stopPropagation(); onToggle() }} style={{ cursor: 'pointer' }}>
      <circle cx={CELL * 0.2} cy={0} r={3} fill="currentColor" />
      <circle cx={CELL * 0.8} cy={0} r={3} fill="currentColor" />
      {closed ? (
        <line x1={CELL * 0.2} y1={0} x2={CELL * 0.8} y2={0} stroke="currentColor" strokeWidth={2} />
      ) : (
        <line x1={CELL * 0.2} y1={0} x2={CELL * 0.65} y2={-14} stroke="currentColor" strokeWidth={2} />
      )}
      <Label x={CELL / 2} y={26} rotation={rotation} fontSize={10} className="svg-ink-soft">
        {closed ? '닫힘' : '열림'}
      </Label>
    </g>
  )
}

function MeterSymbol({ kind, reading, unit, rotation }: { kind: 'V' | 'A'; reading: number; unit: string; rotation: number }) {
  return (
    <g>
      <circle cx={CELL / 2} cy={0} r={14} className="svg-white" stroke="currentColor" strokeWidth={2} />
      <Label x={CELL / 2} y={4} rotation={rotation} fontSize={13} fontWeight={700} className="svg-ink">
        {kind}
      </Label>
      <Label x={CELL / 2} y={28} rotation={rotation} fontWeight={600} className="svg-unit">
        {reading.toFixed(2)}
        {unit}
      </Label>
    </g>
  )
}

export function PartSymbol({ part, result, selected, mode, flowDisplay, onSelect, onToggleSwitch }: PartSymbolProps) {
  const { a } = partTerminals(part)
  const pxA = toPixel(a)
  const rotation = part.rotation
  const current = result?.current ?? 0 // signed: positive = terminal a -> b (arrows only)
  const magnitude = Math.abs(current) // what meters/brightness display
  const voltage = result?.voltage ?? 0

  // `current` is signed in the part's own terminal-a -> terminal-b direction.
  // Conventional current follows that sign; electron flow runs the other way.
  const conventionalPointsRight = current > 0
  const showFlowArrow = Math.abs(current) > FLOW_EPSILON
  const flowPointsRight = flowDisplay === 'current' ? conventionalPointsRight : !conventionalPointsRight

  return (
    <g
      transform={`translate(${pxA.x},${pxA.y}) rotate(${rotation})`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={selected ? 'part is-selected' : 'part'}
    >
      <rect x={-4} y={-20} width={CELL + 8} height={40} fill="transparent" />
      <line x1={0} y1={0} x2={CELL} y2={0} stroke="currentColor" strokeWidth={2} />
      {showFlowArrow && (
        <>
          <FlowArrow cx={CELL * 0.1} pointsRight={flowPointsRight} color={flowArrowColor(flowDisplay)} />
          <FlowArrow cx={CELL * 0.9} pointsRight={flowPointsRight} color={flowArrowColor(flowDisplay)} />
        </>
      )}
      {mode === 'schematic' ? (
        <>
          {part.kind === 'battery' && <BatterySymbol value={part.value} rotation={rotation} />}
          {part.kind === 'resistor' && <ResistorSymbol value={part.value} label="R" rotation={rotation} />}
          {part.kind === 'rheostat' && <ResistorSymbol value={part.value} label="가변" rotation={rotation} />}
          {part.kind === 'bulb' && <BulbSymbol value={part.value} current={magnitude} rotation={rotation} />}
          {part.kind === 'switch' && <SwitchSymbol closed={part.closed} rotation={rotation} onToggle={onToggleSwitch} />}
          {part.kind === 'voltmeter' && <MeterSymbol kind="V" reading={voltage} unit="V" rotation={rotation} />}
          {part.kind === 'ammeter' && <MeterSymbol kind="A" reading={magnitude} unit="A" rotation={rotation} />}
        </>
      ) : (
        <>
          {part.kind === 'battery' && <RealisticBattery value={part.value} />}
          {part.kind === 'resistor' && <RealisticResistor value={part.value} />}
          {part.kind === 'rheostat' && <RealisticRheostat value={part.value} />}
          {part.kind === 'bulb' && <RealisticBulb current={magnitude} />}
          {part.kind === 'switch' && <RealisticSwitch closed={part.closed} />}
          {part.kind === 'voltmeter' && <RealisticMeter kind="V" reading={voltage} />}
          {part.kind === 'ammeter' && <RealisticMeter kind="A" reading={magnitude} />}
          {part.kind === 'switch' && (
            <rect
              x={0}
              y={-15}
              width={CELL}
              height={30}
              fill="transparent"
              onClick={(e) => {
                e.stopPropagation()
                onToggleSwitch()
              }}
              style={{ cursor: 'pointer' }}
            />
          )}
        </>
      )}
      {selected && (
        <rect x={-6} y={-22} width={CELL + 12} height={44} className="sel-box" rx={6} />
      )}
    </g>
  )
}
