import { BATTERY_PRESETS, RESISTANCE_PRESETS } from '../domain/parts'
import { useCircuit } from '../state/CircuitContext'

const KIND_LABEL: Record<string, string> = {
  battery: '전지',
  resistor: '저항',
  rheostat: '가변저항',
  bulb: '전구',
}

export function ValueEditorPopover() {
  const { state, dispatch } = useCircuit()
  const part = state.parts.find((p) => p.id === state.selectedId)

  if (!part) {
    return (
      <div className="p-3 bg-white border border-slate-300 rounded-lg w-48 text-sm text-slate-500">
        부품을 선택하면 값을 편집할 수 있습니다.
      </div>
    )
  }

  if (part.kind === 'switch' || part.kind === 'voltmeter' || part.kind === 'ammeter') {
    return (
      <div className="p-3 bg-white border border-slate-300 rounded-lg w-48 text-sm text-slate-500">
        {KIND_LABEL[part.kind] ?? part.kind}는 값 설정이 없습니다.
      </div>
    )
  }

  const presets = part.kind === 'battery' ? BATTERY_PRESETS : RESISTANCE_PRESETS
  const unit = part.kind === 'battery' ? 'V' : 'Ω'

  return (
    <div className="p-3 bg-white border border-slate-300 rounded-lg w-48 flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-700">{KIND_LABEL[part.kind]} 값</h3>
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => dispatch({ type: 'SET_VALUE', id: part.id, value: preset })}
            className={`px-2 py-1 text-xs rounded border ${
              part.value === preset ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 hover:bg-slate-100'
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
          value={part.value}
          min={0}
          onChange={(e) => dispatch({ type: 'SET_VALUE', id: part.id, value: Number(e.target.value) })}
          className="border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </label>
      {part.kind === 'rheostat' && (
        <label className="text-xs text-slate-600 flex flex-col gap-1">
          슬라이더 (0~1000Ω)
          <input
            type="range"
            min={0}
            max={1000}
            value={part.value}
            onChange={(e) => dispatch({ type: 'SET_VALUE', id: part.id, value: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  )
}
