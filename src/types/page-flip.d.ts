declare module 'page-flip/dist/js/page-flip.module.js' {
  export interface FlipEvent {
    data: number | string | { page: number; mode: 'portrait' | 'landscape' }
  }

  export interface PageFlipSettings {
    width: number
    height: number
    size?: 'fixed' | 'stretch'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    drawShadow?: boolean
    flippingTime?: number
    usePortrait?: boolean
    startZIndex?: number
    autoSize?: boolean
    maxShadowOpacity?: number
    showCover?: boolean
    mobileScrollSupport?: boolean
    swipeDistance?: number
    clickEventForward?: boolean
    useMouseEvents?: boolean
    showPageCorners?: boolean
    disableFlipByClick?: boolean
    startPage?: number
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings)
    loadFromHTML(items: HTMLElement[]): void
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    flip(page: number, corner?: 'top' | 'bottom'): void
    turnToPage(page: number): void
    getBoundsRect(): { left: number; top: number; width: number; height: number; pageWidth: number }
    getState(): string
    getFlipController(): { flip(point: { x: number; y: number }): void }
    getCurrentPageIndex(): number
    getPageCount(): number
    getOrientation(): 'portrait' | 'landscape'
    destroy(): void
    on(event: string, callback: (event: FlipEvent) => void): this
  }
}
