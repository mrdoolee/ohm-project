import { CELL } from '../../domain/grid'

const BULB_REFERENCE_CURRENT = 1
const METER_CURRENT_SCALE = 2 // amps at full needle deflection
const METER_VOLTAGE_SCALE = 20 // volts at full needle deflection

/** Shared gradient/pattern defs, rendered once at the SVG root and referenced by id from every realistic glyph. */
export function RealisticDefs() {
  return (
    <defs>
      <linearGradient id="rg-battery-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="45%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
      <linearGradient id="rg-resistor-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f5deb3" />
        <stop offset="50%" stopColor="#e0b978" />
        <stop offset="100%" stopColor="#c99a54" />
      </linearGradient>
      <radialGradient id="rg-bulb-glass" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="70%" stopColor="#e6f4ff" />
        <stop offset="100%" stopColor="#bcd9ee" />
      </radialGradient>
      <radialGradient id="rg-meter-face" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#eef1f5" />
      </radialGradient>
    </defs>
  )
}

function BandedResistorBody({ bandColors }: { bandColors: string[] }) {
  return (
    <g>
      <rect x={CELL * 0.15} y={-9} width={CELL * 0.7} height={18} rx={9} fill="url(#rg-resistor-body)" stroke="#8a6d3b" strokeWidth={1} />
      {bandColors.map((color, i) => (
        <rect key={i} x={CELL * 0.32 + i * 6} y={-9} width={3.5} height={18} fill={color} />
      ))}
    </g>
  )
}

export function RealisticBattery({ value }: { value: number }) {
  return (
    <g>
      <rect x={CELL * 0.1} y={-13} width={CELL * 0.8} height={26} rx={6} fill="url(#rg-battery-body)" stroke="#475569" strokeWidth={1.5} />
      <rect x={CELL * 0.82} y={-6} width={CELL * 0.08} height={12} rx={2} fill="#d4a017" />
      <rect x={CELL * 0.2} y={-13} width={CELL * 0.5} height={26} fill={value >= 9 ? '#f59e0b' : '#38bdf8'} opacity={0.85} />
      <text x={CELL * 0.45} y={4} fontSize={9} fontWeight={700} textAnchor="middle" className="fill-white">
        {value}V
      </text>
      <text x={CELL * 0.86} y={-16} fontSize={10} textAnchor="middle" className="fill-red-600" fontWeight={700}>
        +
      </text>
      <text x={CELL * 0.08} y={-16} fontSize={10} textAnchor="middle" className="fill-slate-700" fontWeight={700}>
        -
      </text>
    </g>
  )
}

export function RealisticResistor({ value }: { value: number }) {
  const bandColors = colorBandsForValue(value)
  return <BandedResistorBody bandColors={bandColors} />
}

export function RealisticRheostat({ value }: { value: number }) {
  return (
    <g>
      <rect x={CELL * 0.12} y={-11} width={CELL * 0.76} height={22} rx={5} fill="url(#rg-resistor-body)" stroke="#8a6d3b" strokeWidth={1} />
      <text x={CELL / 2} y={26} fontSize={9} textAnchor="middle" className="fill-slate-600">
        {value}Ω
      </text>
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={CELL * 0.18 + i * 4} y1={-11} x2={CELL * 0.18 + i * 4 + 3} y2={11} stroke="#8a6d3b" strokeWidth={1} opacity={0.5} />
      ))}
      <polygon points={`${CELL / 2 - 6},-20 ${CELL / 2 + 6},-20 ${CELL / 2},-11`} fill="#334155" />
      <line x1={CELL / 2} y1={-24} x2={CELL / 2} y2={-20} stroke="#334155" strokeWidth={2} />
    </g>
  )
}

export function RealisticBulb({ current }: { current: number }) {
  const brightness = Math.max(0, Math.min(1, current / BULB_REFERENCE_CURRENT))
  const glow = brightness > 0.05 ? `drop-shadow(0 0 ${4 + brightness * 8}px rgba(250,204,21,${brightness}))` : undefined
  return (
    <g style={{ filter: glow }}>
      <rect x={CELL * 0.4} y={10} width={CELL * 0.2} height={8} fill="#94a3b8" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={CELL * 0.4} y1={12 + i * 2.5} x2={CELL * 0.6} y2={12 + i * 2.5} stroke="#475569" strokeWidth={0.8} />
      ))}
      <circle cx={CELL / 2} cy={0} r={15} fill="url(#rg-bulb-glass)" stroke="#93a8b8" strokeWidth={1} />
      <path
        d={`M ${CELL / 2 - 6} 6 Q ${CELL / 2 - 6} -6 ${CELL / 2} -6 Q ${CELL / 2 + 6} -6 ${CELL / 2 + 6} 6`}
        fill="none"
        stroke={brightness > 0.05 ? '#f59e0b' : '#94a3b8'}
        strokeWidth={1.3}
      />
      <text x={CELL / 2} y={32} fontSize={11} textAnchor="middle" fontWeight={600} className="fill-amber-700">
        {Math.round(brightness * 100)}%
      </text>
    </g>
  )
}

export function RealisticSwitch({ closed }: { closed: boolean }) {
  return (
    <g>
      <rect x={CELL * 0.28} y={-10} width={CELL * 0.44} height={20} rx={4} fill="#1e293b" />
      <circle cx={CELL * 0.5} cy={0} r={4} fill="#94a3b8" />
      <line
        x1={CELL * 0.5}
        y1={0}
        x2={closed ? CELL * 0.62 : CELL * 0.58}
        y2={closed ? 0 : -16}
        stroke="#e2e8f0"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <text x={CELL / 2} y={26} fontSize={10} textAnchor="middle" className="fill-slate-600">
        {closed ? 'ON' : 'OFF'}
      </text>
    </g>
  )
}

export function RealisticMeter({ kind, reading }: { kind: 'V' | 'A'; reading: number }) {
  const scale = kind === 'V' ? METER_VOLTAGE_SCALE : METER_CURRENT_SCALE
  const ratio = Math.max(0, Math.min(1, reading / scale))
  const angle = -60 + ratio * 120 // needle sweeps -60..+60 degrees
  return (
    <g>
      <circle cx={CELL / 2} cy={0} r={16} fill="url(#rg-meter-face)" stroke="#334155" strokeWidth={2} />
      {[-60, -30, 0, 30, 60].map((tick) => (
        <line
          key={tick}
          x1={CELL / 2}
          y1={-11}
          x2={CELL / 2}
          y2={-13}
          stroke="#64748b"
          strokeWidth={1}
          transform={`rotate(${tick} ${CELL / 2} 0)`}
        />
      ))}
      <line
        x1={CELL / 2}
        y1={0}
        x2={CELL / 2}
        y2={-11}
        stroke="#dc2626"
        strokeWidth={1.5}
        transform={`rotate(${angle} ${CELL / 2} 0)`}
      />
      <circle cx={CELL / 2} cy={0} r={2} fill="#1e293b" />
      <text x={CELL / 2} y={26} fontSize={10} textAnchor="middle" fontWeight={600} className="fill-blue-700">
        {reading.toFixed(2)}
        {kind}
      </text>
    </g>
  )
}

function colorBandsForValue(value: number): string[] {
  // Loose visual mapping, not a strict resistor color-code decoder.
  if (value <= 10) return ['#8b5e3c', '#000000', '#8b5e3c']
  if (value <= 20) return ['#dc2626', '#dc2626', '#8b5e3c']
  if (value <= 50) return ['#16a34a', '#000000', '#8b5e3c']
  if (value <= 100) return ['#2563eb', '#000000', '#f59e0b']
  return ['#7c3aed', '#7c3aed', '#f59e0b']
}
