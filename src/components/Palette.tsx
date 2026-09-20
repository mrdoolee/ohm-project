import type { PartKind } from '../domain/parts'
import {
  RealisticBattery,
  RealisticBulb,
  RealisticMeter,
  RealisticResistor,
  RealisticRheostat,
  RealisticSwitch,
} from './parts/realisticGlyphs'

const PALETTE_ITEMS: { kind: PartKind | 'wire'; label: string }[] = [
  { kind: 'wire', label: '전선' },
  { kind: 'battery', label: '전지' },
  { kind: 'resistor', label: '저항' },
  { kind: 'rheostat', label: '가변저항' },
  { kind: 'bulb', label: '전구' },
  { kind: 'switch', label: '스위치' },
  { kind: 'voltmeter', label: '전압계' },
  { kind: 'ammeter', label: '전류계' },
]

export function PaletteThumbnail({ kind }: { kind: PartKind | 'wire' }) {
  return (
    <svg viewBox="0 0 40 40" className="thumb" aria-hidden="true">
      <g transform="translate(0,20)" className="part">
        {kind === 'wire' && (
          <>
            <line x1={4} y1={0} x2={36} y2={0} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            <circle cx={4} cy={0} r={2.5} className="svg-ink" />
            <circle cx={36} cy={0} r={2.5} className="svg-ink" />
          </>
        )}
        {kind === 'battery' && <RealisticBattery value={9} />}
        {kind === 'resistor' && <RealisticResistor value={20} />}
        {kind === 'rheostat' && <RealisticRheostat value={50} />}
        {kind === 'bulb' && <RealisticBulb current={0} />}
        {kind === 'switch' && <RealisticSwitch closed />}
        {kind === 'voltmeter' && <RealisticMeter kind="V" reading={0} />}
        {kind === 'ammeter' && <RealisticMeter kind="A" reading={0} />}
      </g>
    </svg>
  )
}

interface PaletteProps {
  onDragStart: (kind: PartKind | 'wire') => void
}

export function Palette({ onDragStart }: PaletteProps) {
  return (
    <section className="palette" aria-label="부품 칸">
      <h2>부품 칸</h2>
      <div className="palette-list">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.kind}
            onPointerDown={(e) => {
              e.preventDefault()
              onDragStart(item.kind)
            }}
            className="palette-item"
          >
            <PaletteThumbnail kind={item.kind} />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  )
}
