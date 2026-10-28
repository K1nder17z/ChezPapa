import { describe, expect, it } from 'vitest'
import { applyCartAction, cartCount, changeQty } from './cart.ts'
import { applySalleAction, assignTable, rememberOrder, type SalleOrder } from './salle.ts'
import { decodeTicket, encodeTicket, priceLines } from './ticket.ts'

describe('panier', () => {
  it('ajoute, retire et plafonne une quantité', () => {
    let lines = changeQty([], 'tiramisu', 1)
    lines = changeQty(lines, 'tiramisu', 1)
    expect(lines).toEqual([{ dishId: 'tiramisu', qty: 2, supplementQty: 0 }])
    expect(cartCount(lines)).toBe(2)
    lines = changeQty(lines, 'tiramisu', -2)
    expect(lines).toEqual([])
    lines = changeQty([], 'cafe', 20)
    expect(lines[0]?.qty).toBe(12)
  })

  it('limite le supplément à la quantité du plat', () => {
    let lines = changeQty([], 'tajine-viande-pruneaux', 2)
    lines = applyCartAction(lines, 'sup-inc', 'tajine-viande-pruneaux')
    lines = applyCartAction(lines, 'sup-inc', 'tajine-viande-pruneaux')
    lines = applyCartAction(lines, 'sup-inc', 'tajine-viande-pruneaux')
    expect(lines[0]?.supplementQty).toBe(2)
    lines = changeQty(lines, 'tajine-viande-pruneaux', -1)
    expect(lines[0]).toMatchObject({ qty: 1, supplementQty: 1 })
  })

  it('calcule le total avec le supplément et ignore un plat inconnu', () => {
    const priced = priceLines([
      { dishId: 'tiramisu', qty: 2, supplementQty: 4 },
      { dishId: 'tajine-viande-pruneaux', qty: 1, supplementQty: 1 },
      { dishId: 'inexistant', qty: 3, supplementQty: 0 },
    ])
    expect(priced.totalCents).toBe(250 * 2 + 1400 + 300)
    expect(priced.lines.map((line) => line.dishId)).toEqual(['tiramisu', 'tajine-viande-pruneaux'])
  })

  it('retrouve la même commande dans le code du QR', () => {
    const lines = changeQty(changeQty([], 'tiramisu', 1), 'shawarma', 2)
    const code = encodeTicket(lines)
    expect(decodeTicket(code)).toEqual([
      { dishId: 'shawarma', qty: 2, supplementQty: 0 },
      { dishId: 'tiramisu', qty: 1, supplementQty: 0 },
    ])
    expect(decodeTicket('pas-un-code')).toBeNull()
  })
})

describe('commande en salle', () => {
  const now = '2026-10-28T00:00:00.000Z'
  const base: SalleOrder = {
    code: 'abc',
    lines: [{ dishId: 'tiramisu', qty: 1, supplementQty: 0 }],
    tableLabel: '4',
    status: 'attente',
    paid: false,
    createdAt: now,
    updatedAt: now,
  }

  it('ne crée pas deux fois la même commande', () => {
    const once = rememberOrder([], 'abc', base.lines, now)
    expect(rememberOrder(once, 'abc', base.lines, now)).toBe(once)
  })

  it('suit démarrer, pause, terminer et le paiement confirmé', () => {
    const started = applySalleAction(base, 'start', now)
    expect(started.status).toBe('en_cours')
    const paused = applySalleAction(started, 'pause', now)
    expect(paused.status).toBe('pause')
    const resumed = applySalleAction(paused, 'start', now)
    expect(resumed.status).toBe('en_cours')
    const done = applySalleAction(resumed, 'finish', now)
    expect(done.status).toBe('terminee')
    expect(applySalleAction(done, 'pay', now).paid).toBe(true)
    expect(applySalleAction({ ...base, status: 'annulee' }, 'pay', now).paid).toBe(false)
  })

  it('enregistre le nom de table', () => {
    expect(assignTable({ ...base, tableLabel: null }, '  Terrasse 2  ', now).tableLabel).toBe('Terrasse 2')
    expect(assignTable(base, '   ', now)).toBe(base)
  })
})
