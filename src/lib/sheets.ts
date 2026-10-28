import type { Category } from '../types/menu.ts'

export type BookSheet =
  | { id: string; kind: 'cover'; label: string }
  | { id: string; kind: 'welcome'; label: string }
  | { id: string; kind: 'toc'; label: string }
  | { id: string; kind: 'category'; label: string; categoryId: string }
  | { id: string; kind: 'order'; label: string }
  | { id: string; kind: 'closing'; label: string }

export function buildSheets(categories: Category[]): BookSheet[] {
  return [
    { id: 'cover', kind: 'cover', label: 'Couverture' },
    { id: 'welcome', kind: 'welcome', label: 'Bienvenue' },
    { id: 'toc', kind: 'toc', label: 'Sommaire' },
    ...categories.map((category) => ({
      id: category.id,
      kind: 'category' as const,
      label: category.title,
      categoryId: category.id,
    })),
    { id: 'order', kind: 'order', label: 'Commande' },
    { id: 'closing', kind: 'closing', label: 'Merci' },
  ]
}

export function categoryPageIndex(sheets: BookSheet[], categoryId: string): number {
  return sheets.findIndex((sheet) => sheet.kind === 'category' && sheet.categoryId === categoryId)
}

export function sheetLabel(sheets: BookSheet[], index: number): string {
  return sheets[index]?.label ?? 'Carte'
}
