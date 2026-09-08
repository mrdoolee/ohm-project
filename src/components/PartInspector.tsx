import { BATTERY_PRESETS, RESISTANCE_PRESETS } from '../domain/parts'
import { useCircuit } from '../state/CircuitContext'

const KIND_LABEL: Record<string, string> = {
  battery: '전지',
  resistor: '저항',
  rheostat: '가변저항',
  bulb: '전구',
  switch: '스위치',
  voltmeter: '전압계',
  ammeter: '전류계',
}

const NO_VALUE_KINDS = new Set(['switch', 'voltmeter', 'ammeter'])

/** Right-side panel for the currently selected part: its value editor plus its own live current/voltage reading. */
export function PartInspector() {
  const { state, dispatch, solution } = useCircuit()
  const part = state.parts.find((p) => p.id === state.selectedId)

  if (!part) {
    return (
      <div className="p-3 bg-white border border-slate-300 rounded-lg w-52 text-sm text-slate-500">
        부품을 선택하면 여기서 값과 측정값을 확인할 수 있습니다.
      </div>
    )
  }

  const reading = solution.components[part.id]

  return (
    <div className="p-3 bg-white border border-slate-300 rounded-lg w-52 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-700">{KIND_LABEL[part.kind] ?? part.kind}</h3>

      <div className="flex justify-between text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1.5 tabular-nums">
        <span className="text-slate-600">전류 / 전압</span>
        <span className="font-semibold text-blue-700">
          {(reading?.current ?? 0).toFixed(2)}A / {(reading?.voltage ?? 0).toFixed(2)}V
        </span>
      </div>

      {NO_VALUE_KINDS.has(part.kind) ? (
        <p className="text-xs text-slate-500">{KIND_LABEL[part.kind]}는 값 설정이 없습니다.</p>
      ) : (
        <ValueEditor kind={part.kind} value={part.value} onChange={(value) => dispatch({ type: 'SET_VALUE', id: part.id, value })} />
      )}
    </div>
  )
}

function ValueEditor({ kind, value, onChange }: { kind: string; value: number; onChange: (value: number) => void }) {
  const presets = kind === 'battery' ? BATTERY_PRESETS : RESISTANCE_PRESETS
  const unit = kind === 'battery' ? 'V' : 'Ω'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`px-2 py-1 text-xs rounded border ${
              value === preset ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 hover:bg-slate-100'
            }`}
          >
            {preset}
            {unit}
          </button>
        ))}
      </div>
      <label className="text-xs text-slate-600 flex flex-col gap-1">
        직접 입력
        <input
          type="number"
          value={value}
          min={0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
      {kind === 'rheostat' && (
        <label className="text-xs text-slate-600 flex flex-col gap-1">
          슬라이더 (0~1000Ω)
          <input type="range" min={0} max={1000} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        </label>
      )}
    </div>
  )
}
