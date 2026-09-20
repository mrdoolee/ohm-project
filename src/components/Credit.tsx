import { useEffect, useRef, useState } from 'react'

/**
 * 푸터와 제작자 안내 모달. friction-electricity/index.html의 마크업, 클래스, 동작을
 * 그대로 옮겼다(표시 전용: 회로 상태와 무관).
 */
export function Credit() {
  const [open, setOpen] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const openBtnRef = useRef<HTMLButtonElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    document.body.classList.toggle('modal-open', open)
    return () => document.body.classList.remove('modal-open')
  }, [open])

  useEffect(() => {
    if (!open) return
    closeBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        openBtnRef.current?.focus()
        return
      }
      // 모달이 열려 있는 동안 Tab 포커스를 모달 안에 가둔다
      if (e.key === 'Tab' && modalRef.current) {
        const items = [...modalRef.current.querySelectorAll<HTMLElement>('button, a[href]')]
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    setOpen(false)
    openBtnRef.current?.focus()
  }

  return (
    <>
      <footer className="footer">
        © 2026 Designed &amp; Developed by{' '}
        <button
          type="button"
          id="creditBtn"
          ref={openBtnRef}
          className="credit-link"
          aria-haspopup="dialog"
          aria-controls="creditModal"
          onClick={() => setOpen(true)}
        >
          두리쌤
        </button>
        . All rights reserved.
      </footer>

      {/* 제작자 안내 모달 (표시 전용) */}
      <div
        id="creditModal"
        ref={modalRef}
        className="modal"
        hidden={!open}
        // 배경(오버레이) 클릭으로 닫기: 카드 안쪽 클릭은 무시
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="creditTitle">
          <button type="button" id="creditClose" ref={closeBtnRef} className="modal-close" aria-label="닫기" onClick={close}>
            ✕
          </button>

          <div className="modal-body">
            <section className="modal-card">
              <h2 id="creditTitle">✨ 제작: 두리쌤</h2>
              <h3>📌 이용 조건</h3>
              <ul>
                <li>교육 목적으로 자유롭게 사용하실 수 있습니다.</li>
                <li>재배포 시 출처(제작자 표기)를 유지해주세요.</li>
                <li>코드를 임의로 수정한 버전을 다시 배포하지 말아주세요.</li>
                <li>수정이 필요하시면 아래 연락처로 요청해주세요.</li>
              </ul>
            </section>

            <section className="modal-card">
              <h3>📷 문의</h3>
              <ul>
                <li>
                  Instagram:{' '}
                  <a href="https://www.instagram.com/trdoolee" target="_blank" rel="noopener noreferrer">
                    trdoolee
                  </a>
                </li>
                <li>
                  Blog:{' '}
                  <a href="https://blog.naver.com/trdoolee" target="_blank" rel="noopener noreferrer">
                    blog.naver.com/trdoolee
                  </a>
                </li>
              </ul>
              <p className="modal-note">간단한 질문 위주로 답변드리며, 답변이 늦어질 수 있습니다.</p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
