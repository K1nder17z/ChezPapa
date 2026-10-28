import type { PhotoId } from '../types/menu.ts'

export type PhotoCredit = {
  src: string
  alt: string
  caption: string
  position: string
  author: string
  license: string
  licenseUrl?: string
  sourceUrl: string
  fileName: string
}

export const photos: Record<PhotoId, PhotoCredit> = {
  harira: {
    src: '/photos/harira.webp',
    alt: 'Illustration : bol de harira',
    caption: 'Illustration : harira',
    position: 'center',
    author: 'Kattusa24',
    license: 'Domaine public',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Harira.png',
    fileName: 'Harira.png',
  },
  couscous: {
    src: '/photos/couscous.webp',
    alt: 'Illustration : couscous aux légumes et à la viande',
    caption: 'Illustration : couscous aux légumes et à la viande',
    position: '46% 42%',
    author: 'ZRAFIQA',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Couscous_%227_vegetables%22.jpg',
    fileName: 'Couscous "7 vegetables".jpg',
  },
  poulet: {
    src: '/photos/poulet.webp',
    alt: 'Illustration : poulet aux olives',
    caption: 'Illustration : poulet aux olives',
    position: 'center 58%',
    author: 'Indiana Younes',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tajine_de_poulet_aux_olives_(Maroc).jpg',
    fileName: 'Tajine de poulet aux olives (Maroc).jpg',
  },
  grill: {
    src: '/photos/grill.webp',
    alt: 'Illustration : brochettes grillées',
    caption: 'Illustration : brochettes grillées',
    position: 'center',
    author: 'Benoît Prieur',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Brochettes_de_b%C5%93uf_hach%C3%A9,_ail,_sel,_apr%C3%A8s_cuisson_au_barbecue.jpg',
    fileName: 'Brochettes de bœuf haché, ail, sel, après cuisson au barbecue.jpg',
  },
  tea: {
    src: '/photos/tea.webp',
    alt: 'Illustration : thé marocain servi dans des verres traditionnels',
    caption: 'Illustration : thé marocain',
    position: 'center 62%',
    author: 'EL HALLABI Mehdi',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Th%C3%A9_marocain.jpg',
    fileName: 'Thé marocain.jpg',
  },
  frites: {
    src: '/photos/frites.webp',
    alt: 'Illustration : portion de frites',
    caption: 'Illustration : frites',
    position: 'center 55%',
    author: 'Sidg13',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:French_fries.jpg',
    fileName: 'French fries.jpg',
  },
}

export const photoList = Object.values(photos)
