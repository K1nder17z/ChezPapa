import { describe, expect, it } from 'vitest'
import { isPublishableMenuUrl } from '../config/restaurant.ts'
import { allDishes, categories } from './menu.ts'
import { formatEuro } from '../lib/format.ts'
import { buildSheets, categoryPageIndex } from '../lib/sheets.ts'

const expected = [
  ['entrees', 'Zaalouk', 750],
  ['entrees', 'Salade du chef', 750],
  ['entrees', 'Salade marocaine', 750],
  ['entrees', 'Salade de thon', 750],
  ['soupes', 'Harira', 400],
  ['soupes', 'Bissara', 400],
  ['soupes', 'Potage du chef', 400],
  ['plats', 'Tajine de viande aux pruneaux avec frites', 1400],
  ['plats', 'Tajine poulet, frites et olives', 1300],
  ['plats', 'Riz aux légumes', 750],
  ['specialites', 'Tripes (douara)', 1100],
  ['specialites', 'Pied de veau (kar3ine)', 1300],
  ['specialites', 'Lentilles', 600],
  ['specialites', 'Haricots blancs', 600],
  ['couscous', 'Couscous poulet', 1300],
  ['couscous', 'Couscous viande', 1500],
  ['grillades', 'Poulet rôti entier', 2200],
  ['grillades', 'Demi-poulet rôti', 1100],
  ['grillades', 'Brochettes de poulet', 1200],
  ['grillades', 'Brochettes de dinde', 1200],
  ['grillades', 'Merguez', 900],
  ['grillades', 'Brochettes de kefta', 1200],
  ['grillades', "Côte d'agneau", 2000],
  ['snacks', 'Shawarma + frites', 800],
  ['snacks', 'Hamburger kefta + frites', 700],
  ['sauces', 'Ketchup', 100],
  ['sauces', 'Andalouse', 100],
  ['sauces', 'Mayonnaise', 100],
  ['sauces', 'Samouraï', 100],
  ['sauces', 'Ail', 100],
  ['frites', 'Grande portion de frites', 300],
  ['frites', 'Petite portion de frites', 200],
  ['boissons-froides', 'Coca-Cola', 150],
  ['boissons-froides', 'Coca-Cola Zero', 150],
  ['boissons-froides', 'Fanta', 150],
  ['boissons-froides', 'Schweppes', 150],
  ['boissons-froides', 'Sprite', 150],
  ['boissons-froides', 'Oasis', 150],
  ['boissons-froides', 'Eau pétillante', 150],
  ['boissons-froides', 'Eau plate', 150],
  ['boissons-chaudes', 'Thé marocain', 200],
  ['boissons-chaudes', 'Café', 200],
  ['desserts', 'Tiramisu', 250],
] as const

describe('carte Chez Papa', () => {
  it('reproduit exactement les plats et les prix', () => {
    const actual = allDishes().map((dish) => [dish.categoryId, dish.name, dish.priceCents])
    expect(actual).toEqual(expected.map((row) => [...row]))
  })

  it('ne place le supplément que sur le tajine de viande aux pruneaux', () => {
    const withSupplement = allDishes().filter((dish) => dish.supplement)
    expect(withSupplement).toHaveLength(1)
    expect(withSupplement[0]?.name).toBe('Tajine de viande aux pruneaux avec frites')
    expect(withSupplement[0]?.supplement).toEqual({
      label: 'Amandes et œuf en supplément',
      priceCents: 300,
    })
  })

  it('indique les ingrédients et les allergènes de chaque plat', () => {
    for (const item of allDishes()) {
      expect(item.ingredients.trim().length).toBeGreaterThan(2)
      expect(item.allergens.trim().length).toBeGreaterThan(2)
    }
  })

  it('garde des identifiants uniques', () => {
    const ids = allDishes().map((dish) => dish.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('calcule les pages du sommaire à partir du catalogue', () => {
    const sheets = buildSheets(categories)
    expect(sheets).toHaveLength(categories.length + 4)
    expect(categoryPageIndex(sheets, 'couscous')).toBeGreaterThan(categoryPageIndex(sheets, 'entrees'))
    expect(categoryPageIndex(sheets, 'desserts')).toBe(sheets.length - 2)
  })

  it('formate les euros avec une virgule', () => {
    expect(formatEuro(1400)).toBe('14,00 €')
    expect(formatEuro(150)).toBe('1,50 €')
    expect(formatEuro(100)).toBe('1,00 €')
    expect(formatEuro(0)).toBe('0,00 €')
  })

  it('refuse une URL de QR locale ou provisoire', () => {
    expect(isPublishableMenuUrl('http://localhost:5173/menu')).toBe(false)
    expect(isPublishableMenuUrl('https://votre-domaine.be/menu')).toBe(false)
    expect(isPublishableMenuUrl('https://chezpapa.be/menu')).toBe(true)
  })
})
