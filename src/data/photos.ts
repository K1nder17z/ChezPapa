import type { PhotoId } from '../types/menu.ts'

export type PhotoCredit = {
  src: string
  alt: string
  caption: string
  position: string
}

export const photos: Record<PhotoId, PhotoCredit> = {
  harira: {
    src: '/photos/harira.webp',
    alt: 'Illustration : bol de harira',
    caption: 'Illustration : harira',
    position: 'center',
  },
  couscous: {
    src: '/photos/couscous.webp',
    alt: 'Illustration : couscous aux légumes et à la viande',
    caption: 'Illustration : couscous aux légumes et à la viande',
    position: 'center',
  },
  poulet: {
    src: '/photos/poulet.webp',
    alt: 'Illustration : tajine de poulet aux olives',
    caption: 'Illustration : tajine de poulet aux olives',
    position: 'center',
  },
  grill: {
    src: '/photos/grill.webp',
    alt: 'Illustration : brochettes grillées',
    caption: 'Illustration : brochettes grillées',
    position: 'center',
  },
  tea: {
    src: '/photos/tea.webp',
    alt: 'Illustration : thé marocain servi dans des verres traditionnels',
    caption: 'Illustration : thé marocain',
    position: 'center',
  },
  frites: {
    src: '/photos/frites.webp',
    alt: 'Illustration : portion de frites',
    caption: 'Illustration : frites',
    position: 'center',
  },
  entrees: {
    src: '/photos/entrees.webp',
    alt: 'Illustration : salades marocaines, olives et citron',
    caption: 'Illustration : entrées',
    position: 'center',
  },
  snacks: {
    src: '/photos/snacks.webp',
    alt: 'Illustration : shawarma et frites',
    caption: 'Illustration : snacks',
    position: 'center',
  },
  specialites: {
    src: '/photos/specialites.webp',
    alt: 'Illustration : plat de lentilles et haricots blancs',
    caption: 'Illustration : spécialités',
    position: 'center',
  },
  tiramisu: {
    src: '/photos/tiramisu.webp',
    alt: 'Illustration : tiramisu en verrine, sans marque',
    caption: 'Illustration : tiramisu',
    position: 'center',
  },
}

export const photoList = Object.values(photos)
