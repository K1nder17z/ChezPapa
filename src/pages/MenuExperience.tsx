import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Arch } from '../components/brand/Ornaments.tsx'
import { BookSheets } from '../components/book/BookSheets.tsx'
import { FlipBook, type BookHandle, type BookStatus } from '../components/book/FlipBook.tsx'
import { IntroScreen } from '../components/intro/IntroScreen.tsx'
import { ListView } from '../components/list/ListView.tsx'
import { BottomBar, Sommaire, TopBar } from '../components/nav/Chrome.tsx'
import { categories } from '../data/menu.ts'
import { cartCount } from '../lib/cart.ts'
import { installCartClicks, useCartLines } from '../lib/cartStore.ts'
import { buildSheets, categoryPageIndex } from '../lib/sheets.ts'
import { syncBookDom } from '../components/book/syncBookDom.ts'

const SKIP_KEY = 'chezpapa-skip-intro'

function readSkip(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

function writeSkip() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1')
  } catch {
    /* session privée : on n'insiste pas */
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function useStageSize(active: boolean, stageRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ pageWidth: 360, pageHeight: 640, spread: false })

  useEffect(() => {
    if (!active) return
    const element = stageRef.current
    if (!element) return

    const measure = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width < 200 || rect.height < 280) return
      const spread = rect.width >= 960 && rect.height >= 620
      const inset = spread ? 18 : 6
      const availW = Math.floor(rect.width - inset * 2)
      const availH = Math.floor(rect.height - 6)
      const pageWidth = spread
        ? Math.max(300, Math.min(520, Math.floor(availW / 2), Math.floor(availH * 0.7)))
        : availW
      setSize((previous) => {
        if (
          previous.spread === spread &&
          Math.abs(previous.pageWidth - pageWidth) < 6 &&
          Math.abs(previous.pageHeight - availH) < 6
        ) {
          return previous
        }
        return { pageWidth, pageHeight: availH, spread }
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [active, stageRef])

  return size
}

export function MenuExperience() {
  const reduced = useReducedMotion()
  const sheets = useMemo(() => buildSheets(categories), [])
  const wantsList = new URLSearchParams(window.location.search).get('vue') === 'liste'
  const skipped = readSkip()
  const [phase, setPhase] = useState<'intro' | 'opening' | 'reading'>(
    wantsList || skipped ? 'reading' : 'intro',
  )
  const [view, setView] = useState<'book' | 'list'>(wantsList ? 'list' : 'book')
  const [entryPage, setEntryPage] = useState(skipped || wantsList ? 2 : 1)
  const [sommaireOpen, setSommaireOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [status, setStatus] = useState<BookStatus>({
    index: skipped || wantsList ? 2 : 1,
    count: sheets.length,
    orientation: 'portrait',
  })
  const bookRef = useRef<BookHandle>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const [bookEpoch, setBookEpoch] = useState(0)
  const orderCount = cartCount(useCartLines())
  const readingBook = phase === 'reading' && view === 'book'
  const size = useStageSize(readingBook, stageRef)
  const fullscreenEnabled = typeof document !== 'undefined' && document.fullscreenEnabled

  const onStatus = useCallback((next: BookStatus) => {
    setStatus(next)
  }, [])

  useEffect(() => {
    const image = new Image()
    image.src = '/photos/couscous.webp'
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'reading') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sommaireOpen) {
        setSommaireOpen(false)
        return
      }
      if (view !== 'book' || sommaireOpen) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        bookRef.current?.next()
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        bookRef.current?.prev()
      } else if (event.key === 'Home') {
        event.preventDefault()
        bookRef.current?.goTo(2)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, sommaireOpen, view])

  useEffect(() => {
    if (phase !== 'reading') return
    return installCartClicks()
  }, [phase])

  function openBook() {
    setEntryPage(1)
    setView('book')
    if (reduced) {
      setPhase('reading')
      return
    }
    setPhase('opening')
    timerRef.current = window.setTimeout(() => setPhase('reading'), 1080)
  }

  function skipToBook() {
    writeSkip()
    setEntryPage(2)
    setView('book')
    setPhase('reading')
  }

  function openList() {
    setSommaireOpen(false)
    setView('list')
    setPhase('reading')
  }

  function closeBook() {
    setSommaireOpen(false)
    setView('book')
    setPhase('intro')
  }

  function selectCategory(index: number) {
    setSommaireOpen(false)
    if (view === 'book' && phase === 'reading') {
      bookRef.current?.goTo(index)
      return
    }
    setEntryPage(index)
    setView('book')
    setPhase('reading')
  }

  function goOrder() {
    const index = Math.max(0, sheets.findIndex((sheet) => sheet.kind === 'order'))
    setSommaireOpen(false)
    if (view === 'book' && phase === 'reading') {
      bookRef.current?.goTo(index)
      return
    }
    setEntryPage(index)
    setView('book')
    setPhase('reading')
  }

  async function toggleFullscreen() {
    const node = shellRef.current
    if (!node || !document.fullscreenEnabled) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await node.requestFullscreen()
    } catch {
      /* le navigateur peut refuser le plein écran */
    }
  }

  if (phase !== 'reading') {
    return <IntroScreen opening={phase === 'opening'} onOpen={openBook} onSkip={skipToBook} onList={openList} />
  }

  return (
    <div className="shell" ref={shellRef}>
      <h1 className="sr-only">Chez Papa — Cuisine traditionnelle marocaine</h1>
      <TopBar
        view={view}
        fullscreenEnabled={fullscreenEnabled}
        fullscreen={fullscreen}
        orderCount={orderCount}
        onSommaire={() => setSommaireOpen(true)}
        onToggleView={() => {
          setSommaireOpen(false)
          setView((current) => (current === 'list' ? 'book' : 'list'))
        }}
        onFullscreen={() => void toggleFullscreen()}
        onClose={closeBook}
        onOrder={goOrder}
      />
      <CartSync epoch={bookEpoch} />
      {view === 'book' ? (
        <>
          <div className="stage" ref={stageRef}>
            <Arch className="stage-arch" />
            <FlipBook
              ref={bookRef}
              pageWidth={size.pageWidth}
              pageHeight={size.pageHeight}
              spread={size.spread}
              startPage={entryPage}
              reducedMotion={reduced}
              onStatus={onStatus}
              onReady={() => setBookEpoch((value) => value + 1)}
            >
              <BookSheets sheets={sheets} />
            </FlipBook>
          </div>
          <BottomBar
            sheets={sheets}
            status={status}
            onPrev={() => bookRef.current?.prev()}
            onNext={() => bookRef.current?.next()}
          />
        </>
      ) : (
        <ListView
          reducedMotion={reduced}
          onOpenCategory={(categoryId) => selectCategory(categoryPageIndex(sheets, categoryId))}
        />
      )}
      {sommaireOpen ? (
        <Sommaire sheets={sheets} onClose={() => setSommaireOpen(false)} onSelect={selectCategory} />
      ) : null}
    </div>
  )
}

function CartSync({ epoch }: { epoch: number }) {
  const lines = useCartLines()
  useLayoutEffect(() => {
    syncBookDom()
  }, [epoch, lines])
  return null
}
