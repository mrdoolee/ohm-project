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

function PaletteThumbnail({ kind }: { kind: PartKind | 'wire' }) {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9 shrink-0">
      <g transform="translate(0,20)" className="text-slate-800">
        {kind === 'wire' && (
          <>
            <line x1={4} y1={0} x2={36} y2={0} stroke="#334155" strokeWidth={3} strokeLinecap="round" />
            <circle cx={4} cy={0} r={2.5} fill="#16a34a" />
            <circle cx={36} cy={0} r={2.5} fill="#16a34a" />
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
    <div className="flex flex-col gap-2 p-3 bg-white border border-slate-300 rounded-lg w-44">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">부품 팔레트</h2>
      {PALETTE_ITEMS.map((item) => (
        <div
          key={item.kind}
          onPointerDown={(e) => {
            e.preventDefault()
            onDragStart(item.kind)
          }}
          className="touch-none select-none cursor-grab active:cursor-grabbing flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
        >
          <PaletteThumbnail kind={item.kind} />
          {item.label}
        </div>
      ))}
      <p className="text-xs text-slate-500 mt-1">캔버스로 드래그해서 배치하세요.</p>
    </div>
  )
}
