import { useState } from 'react'
import { MAX_PARTS } from '../domain/grid'
import { useCircuit } from '../state/CircuitContext'

/** 전역 버튼: 캔버스를 비우고 다시 시작 (확인 단계 유지). */
export function ResetButton() {
  const { dispatch } = useCircuit()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="lead-side">
        <span className="reset-ask">정말 다시 할까요?</span>
        <button
          type="button"
          className="btn-pop"
          onClick={() => {
            dispatch({ type: 'LOAD', parts: [], wires: [] })
            setConfirming(false)
          }}
        >
          다시 하기
        </button>
        <button type="button" className="btn-pop" onClick={() => setConfirming(false)}>
          취소
        </button>
      </div>
    )
  }
  return (
    <button type="button" className="btn-pop" onClick={() => setConfirming(true)}>
      다시 하기
    </button>
  )
}

/** 상단 한 줄: 묶음 선택 버튼 두 그룹과 부품 조작 버튼. */
export function StepsBar() {
  const { state, dispatch } = useCircuit()
  const selected = state.parts.find((p) => p.id === state.selectedId)
  const selectedWire = state.wires.find((w) => w.id === state.selectedWireId)

  const seg = (active: boolean) => `seg-btn${active ? ' is-active' : ''}`

  return (
    <div className="steps">
      <div className="seg" role="group" aria-label="부품 그림 보기">
        <button
          type="button"
          aria-pressed={state.displayMode === 'realistic'}
          onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'realistic' })}
          className={seg(state.displayMode === 'realistic')}
        >
          실물 이미지
        </button>
        <button
          type="button"
          aria-pressed={state.displayMode === 'schematic'}
          onClick={() => dispatch({ type: 'SET_DISPLAY_MODE', mode: 'schematic' })}
          className={seg(state.displayMode === 'schematic')}
        >
          회로 기호
        </button>
      </div>
      <div className="seg" role="group" aria-label="화살표 방향 보기">
        <button
          type="button"
          aria-pressed={state.flowDisplay === 'current'}
          onClick={() => dispatch({ type: 'SET_FLOW_DISPLAY', mode: 'current' })}
          className={seg(state.flowDisplay === 'current')}
        >
          전류의 흐름 (+)
        </button>
        <button
          type="button"
          aria-pressed={state.flowDisplay === 'electron'}
          onClick={() => dispatch({ type: 'SET_FLOW_DISPLAY', mode: 'electron' })}
          className={seg(state.flowDisplay === 'electron')}
        >
          전자의 흐름 (−)
        </button>
      </div>
      <span className="steps-gap" />
      <button
        type="button"
        disabled={!selected}
        aria-label="선택한 부품을 90도 회전"
        onClick={() => selected && dispatch({ type: 'ROTATE_PART', id: selected.id })}
        className="step-tab"
      >
        회전
      </button>
      <button
        type="button"
        disabled={!selected && !selectedWire}
        onClick={() => {
          if (selected) dispatch({ type: 'REMOVE_PART', id: selected.id })
          else if (selectedWire) dispatch({ type: 'REMOVE_WIRE', id: selectedWire.id })
        }}
        className="step-tab"
      >
        삭제
      </button>
    </div>
  )
}

/** 상태 칩. 항상 렌더링한다(캔버스가 흔들리지 않게). */
export function StatusChip() {
  const { state, solution } = useCircuit()
  let cls = 'chip'
  let text = '○ 부품을 놓아 보세요'
  if (state.limitWarning) {
    cls = 'chip is-warn'
    text = `! 부품은 최대 ${MAX_PARTS}개`
  } else if (solution.status === 'short') {
    cls = 'chip is-warn'
    text = '! 단락 경고'
  } else if (solution.status === 'unsupported') {
    cls = 'chip is-warn'
    text = '! 지원하지 않는 회로'
  } else if (state.parts.length > 0 && solution.status === 'open') {
    text = '○ 개회로, 전류 0'
  } else if (state.parts.length > 0) {
    const flowing = Object.values(solution.components).some((c) => Math.abs(c.current) > 1e-6)
    if (flowing) {
      cls = 'chip is-ok'
      text = '✓ 전류가 흐르는 중'
    } else {
      text = '○ 아직 전류가 안 흘러요'
    }
  }
  return (
    <div className="status-slot">
      <span className={cls} role="status">
        {text}
      </span>
    </div>
  )
}

/** 하단 설명: 항상 그림 아래에 가로로 넓게. */
export function Caption() {
  const { state, solution } = useCircuit()
  let text: string
  if (state.limitWarning) {
    text = `부품은 최대 ${MAX_PARTS}개까지 놓을 수 있어요. 쓰지 않는 부품은 휴지통 칸으로 끌어다 지워 보세요.`
  } else if (solution.status === 'short') {
    text = '저항 없이 전지 양쪽이 바로 이어졌어요(단락). 전류가 너무 커져서 위험해요. 전구나 저항을 사이에 넣어 보세요.'
  } else if (solution.status === 'unsupported') {
    text = '이 회로 구성은 아직 지원하지 않아요. 직렬과 병렬로만 이어서 다시 만들어 보세요.'
  } else if (state.parts.length === 0) {
    text = '왼쪽 부품 칸에서 전지와 저항, 전구를 격자 위로 끌어다 놓고 전선으로 이어 보세요. 고리 모양으로 이어지면 전류가 흘러요.'
  } else if (solution.status === 'open') {
    text = '전선이 끊겨 있어서 전류가 흐르지 않아요. 전지의 두 단자가 저항이나 전구를 지나 한 바퀴 이어지도록 만들어 보세요.'
  } else {
    text = '전류는 전지의 + 극에서 나와 회로를 한 바퀴 돌아 − 극으로 돌아가요. 전압 = 전류 × 저항(V = I × R)이라서, 전압이 같을 때 저항이 클수록 전류는 작아져요.'
  }
  return (
    <div className="caption">
      <p>{text}</p>
    </div>
  )
}

/** 그림 아래 figcaption: 화살표 색의 뜻을 글자로도 알려 준다. */
export function FlowLegend() {
  const { state } = useCircuit()
  return (
    <figcaption>
      {state.flowDisplay === 'current'
        ? '그림 1 빨간 화살표는 전류(+)가 흐르는 방향이에요. 부품과 전선을 끌어서 옮길 수 있어요.'
        : '그림 1 초록 화살표는 전자(−)가 흐르는 방향이에요. 전류(+)와는 반대예요.'}
    </figcaption>
  )
}
