import { useState } from 'react'
import { MAX_PARTS } from '../domain/grid'
import { useCircuit } from '../state/CircuitContext'

const STATUS_TEXT: Record<string, { text: string; className: string } | undefined> = {
  short: { text: '⚠ 단락 경고: 저항 없이 전지 양단이 직결되었습니다. 배선을 확인하세요.', className: 'bg-red-100 text-red-800 border-red-300' },
  unsupported: { text: '이 회로 구성은 지원하지 않습니다 (다중 루프). 직렬/병렬 조합만 가능합니다.', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  open: { text: '개회로 상태입니다. 모든 계기가 0을 표시합니다.', className: 'bg-slate-100 text-slate-700 border-slate-300' },
}

export function Toolbar() {
  const { state, dispatch, solution } = useCircuit()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const selected = state.parts.find((p) => p.id === state.selectedId)
  const selectedWire = state.wires.find((w) => w.id === state.selectedWireId)
  const banner = STATUS_TEXT[solution.status]
  const messageText = state.limitWarning ? `부품은 최대 ${MAX_PARTS}개까지 배치할 수 있습니다.` : banner?.text
  const messageClass = state.limitWarning
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : (banner?.className ?? 'border-transparent')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 p-2 bg-white border border-slate-300 rounded-lg">
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && dispatch({ type: 'ROTATE_PART', id: selected.id })}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
        >
          회전 (90°)
        </button>
        <button
          type="button"
          disabled={!selected && !selectedWire}
          onClick={() => {
            if (selected) dispatch({ type: 'REMOVE_PART', id: selected.id })
            else if (selectedWire) dispatch({ type: 'REMOVE_WIRE', id: selectedWire.id })
          }}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
        >
          삭제
        </button>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <div className="flex rounded-md border border-slate-300 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'realistic' })}
            className={`px-3 py-1.5 ${state.displayMode === 'realistic' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
          >
            실물 이미지
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'schematic' })}
            className={`px-3 py-1.5 ${state.displayMode === 'schematic' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
          >
            회로 기호
          </button>
        </div>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <div className="flex rounded-md border border-slate-300 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_FLOW_DISPLAY', mode: 'current' })}
            className={`px-3 py-1.5 ${state.flowDisplay === 'current' ? 'bg-orange-600 text-white' : 'hover:bg-slate-100'}`}
          >
            전류 방향
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_FLOW_DISPLAY', mode: 'electron' })}
            className={`px-3 py-1.5 ${state.flowDisplay === 'electron' ? 'bg-orange-600 text-white' : 'hover:bg-slate-100'}`}
          >
            전자 방향
          </button>
        </div>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        {confirmingReset ? (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-slate-600">정말 초기화할까요?</span>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'LOAD', parts: [], wires: [] })
                setConfirmingReset(false)
              }}
              className="px-3 py-1.5 rounded-md border border-red-300 bg-red-600 text-white hover:bg-red-700"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50"
          >
            캔버스 초기화
          </button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-slate-500">
          부품 {state.parts.length} / {MAX_PARTS}
        </span>
      </div>

      {/* Fixed-height slot: always mounted so status changes during a drag never reflow the canvas below. */}
      <div className={`min-h-[2.5rem] p-2 text-sm rounded-md border box-border ${messageClass}`}>{messageText ?? ' '}</div>
    </div>
  )
}
