import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js'
import { bindCartButtons } from './syncBookDom.ts'

export type BookStatus = {
  index: number
  count: number
  orientation: 'portrait' | 'landscape'
}

export type BookHandle = {
  next: () => void
  prev: () => void
  goTo: (index: number) => void
}

type FlipBookProps = {
  children: ReactNode
  pageWidth: number
  pageHeight: number
  spread: boolean
  startPage: number
  reducedMotion: boolean
  onStatus: (status: BookStatus) => void
  onReady?: () => void
}

export const FlipBook = forwardRef<BookHandle, FlipBookProps>(function FlipBook(
  { children, pageWidth, pageHeight, spread, startPage, reducedMotion, onStatus, onReady },
  ref,
) {
  const sourceRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<PageFlip | null>(null)
  const indexRef = useRef(startPage)
  const countRef = useRef(1)
  const onStatusRef = useRef(onStatus)
  const onReadyRef = useRef(onReady)
  const [failed, setFailed] = useState(false)
  const [plainIndex, setPlainIndex] = useState(startPage)

  useEffect(() => {
    onStatusRef.current = onStatus
    onReadyRef.current = onReady
  }, [onReady, onStatus])

  useImperativeHandle(ref, () => ({
    next() {
      if (failed) {
        setPlainIndex((current) => Math.min(countRef.current - 1, current + 1))
        return
      }
      flipRef.current?.flipNext('bottom')
    },
    prev() {
      if (failed) {
        setPlainIndex((current) => Math.max(0, current - 1))
        return
      }
      flipRef.current?.flipPrev('bottom')
    },
    goTo(index: number) {
      if (failed) {
        setPlainIndex(Math.max(0, Math.min(countRef.current - 1, index)))
        return
      }
      const book = flipRef.current
      if (!book) return
      const current = book.getCurrentPageIndex()
      if (index === current) return
      if (Math.abs(index - current) <= 2) book.flip(index, 'top')
      else book.turnToPage(index)
    },
  }))

  useEffect(() => {
    if (pageWidth < 200 || pageHeight < 240) return
    const source = sourceRef.current
    const mount = mountRef.current
    if (!source || !mount) return

    const host = document.createElement('div')
    host.className = 'book-host'
    const sceneWidth = spread ? pageWidth * 2 : pageWidth
    host.style.width = `${sceneWidth}px`
    host.style.height = `${pageHeight}px`
    mount.appendChild(host)

    const pages = Array.from(source.children, (node) => node.cloneNode(true) as HTMLElement)
    pages.forEach((page) => bindCartButtons(page))
    countRef.current = pages.length
    let book: PageFlip | null = null

    const go = (next: number) => {
      if (!book) return
      const current = book.getCurrentPageIndex()
      if (next === current) return
      if (Math.abs(next - current) <= 2) book.flip(next, 'top')
      else book.turnToPage(next)
    }

    const report = () => {
      if (!book) return
      const index = book.getCurrentPageIndex()
      indexRef.current = index
      onStatusRef.current({
        index,
        count: book.getPageCount(),
        orientation: book.getOrientation(),
      })
    }

    try {
      book = new PageFlip(host, {
        width: pageWidth,
        height: pageHeight,
        size: 'fixed',
        drawShadow: !reducedMotion,
        flippingTime: reducedMotion ? 1 : 780,
        usePortrait: true,
        startPage: indexRef.current,
        autoSize: false,
        maxShadowOpacity: 0.42,
        showCover: true,
        mobileScrollSupport: false,
        swipeDistance: 28,
        clickEventForward: true,
        useMouseEvents: true,
        showPageCorners: !reducedMotion,
        disableFlipByClick: true,
        startZIndex: 2,
      })

      const onClick = (event: MouseEvent) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-turn-to]')
        if (!target) return
        event.preventDefault()
        const next = Number(target.dataset.turnTo)
        if (Number.isNaN(next)) return
        go(next)
      }

      host.addEventListener('click', onClick)
      book.on('flip', report)
      book.on('init', report)
      book.loadFromHTML(pages)
      flipRef.current = book
      report()
      host.classList.add('is-ready')
      onReadyRef.current?.()

      return () => {
        host.removeEventListener('click', onClick)
        flipRef.current = null
        try {
          book?.destroy()
        } catch {
          host.remove()
        }
      }
    } catch {
      host.remove()
      queueMicrotask(() => {
        setFailed(true)
        onReadyRef.current?.()
        onStatusRef.current({
          index: indexRef.current,
          count: pages.length,
          orientation: 'portrait',
        })
      })
    }
  }, [pageHeight, pageWidth, reducedMotion, spread])

  const sceneWidth = spread ? pageWidth * 2 : pageWidth

  return (
    <div className="book-scene" style={{ width: sceneWidth, height: pageHeight }}>
      <div className="book-shadow" aria-hidden="true" />
      <div ref={sourceRef} className="book-source" inert aria-hidden="true">
        {children}
      </div>
      {failed ? (
        <PlainBook index={plainIndex} width={pageWidth} height={pageHeight}>
          {children}
        </PlainBook>
      ) : (
        <div ref={mountRef} className="book-mount" />
      )}
    </div>
  )
})

function PlainBook({
  children,
  index,
  width,
  height,
}: {
  children: ReactNode
  index: number
  width: number
  height: number
}) {
  const pages = Array.isArray(children) ? children : [children]
  const safeIndex = Math.max(0, Math.min(index, pages.length - 1))
  return (
    <div className="plain-book" style={{ width, height }}>
      {pages[safeIndex] ?? null}
    </div>
  )
}
