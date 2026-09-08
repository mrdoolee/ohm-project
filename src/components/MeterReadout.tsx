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

export function MeterReadout() {
  const { state, solution } = useCircuit()

  return (
    <div className="p-3 bg-white border border-slate-300 rounded-lg w-56 flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-700">계기 값</h2>
      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
        {state.parts.map((part) => {
          const r = solution.components[part.id]
          return (
            <div key={part.id} className="flex justify-between text-xs text-slate-700 border-b border-slate-100 py-1">
              <span>{KIND_LABEL[part.kind]}</span>
              <span className="tabular-nums">
                {(r?.current ?? 0).toFixed(2)}A / {(r?.voltage ?? 0).toFixed(2)}V
              </span>
            </div>
          )
        })}
        {state.parts.length === 0 && <p className="text-xs text-slate-400">배치된 부품이 없습니다.</p>}
      </div>
    </div>
  )
}
