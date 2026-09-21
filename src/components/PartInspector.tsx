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

/** 프리셋 칸: 선택한 부품의 전류/전압 측정값과 값 편집. */
export function PartInspector() {
  const { state, dispatch, solution } = useCircuit()
  const part = state.parts.find((p) => p.id === state.selectedId)

  if (!part) {
    return (
      <div className="inspector">
        <h2>프리셋</h2>
        <p className="inspector-empty">부품을 누르면 여기에서 전류와 전압, 값을 볼 수 있어요.</p>
      </div>
    )
  }

  const reading = solution.components[part.id]

  return (
    <div className="inspector">
      <div className="inspector-side">
      <h2>{KIND_LABEL[part.kind] ?? part.kind}</h2>

      <dl className="readout">
        <div>
          <dt>전류</dt>
          <dd className="num">
            {Math.abs(reading?.current ?? 0).toFixed(2)}
            <span className="unit-label">A</span>
          </dd>
        </div>
        <div>
          <dt>전압</dt>
          <dd className="num">
            {(reading?.voltage ?? 0).toFixed(2)}
            <span className="unit-label">V</span>
          </dd>
        </div>
      </dl>
      </div>

      {NO_VALUE_KINDS.has(part.kind) ? (
        <p className="inspector-empty">{KIND_LABEL[part.kind]}은(는) 값을 정하지 않아요.</p>
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
    <div className="editor">
      <div className="presets">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={value === preset}
            onClick={() => onChange(preset)}
            className={`chip-btn${value === preset ? ' is-active' : ''}`}
          >
            {preset}
            {unit}
          </button>
        ))}
      </div>
      <div className="editor-fields">
      <label className="field">
        직접 입력
        <input type="number" value={value} min={0} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
      {kind === 'rheostat' && (
        <label className="field">
          슬라이더
          <input type="range" min={0} max={1000} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        </label>
      )}
      </div>
    </div>
  )
}
