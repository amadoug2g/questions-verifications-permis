/**
 * srs.test.js — Tests TDD pour le système de répétition espacée (SRS).
 *
 * Stratégie : on teste deux niveaux séparément :
 *   1. `computeNextSRS` — logique pure, aucun accès localStorage.
 *   2. `roll()` SRS-aware — via un mock de localStorage pour isoler l'env.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computeNextSRS, DEFAULT_SRS_ENTRY } from '../src/utils/storage.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_HOUR = 3600 * 1000

function makeEntry(overrides = {}) {
  return { ...DEFAULT_SRS_ENTRY, ...overrides }
}

// ---------------------------------------------------------------------------
// 1. computeNextSRS — logique pure
// ---------------------------------------------------------------------------

describe('computeNextSRS — logique pure', () => {
  const NOW = Date.now()

  it('score 3 depuis état initial → streak=1, interval=24, nextDue cohérent, mastered=false', () => {
    const entry = makeEntry()
    const result = computeNextSRS(entry, 3, NOW)

    expect(result.correctStreak).toBe(1)
    expect(result.interval).toBe(24)                              // max(1×1.5, 24) = 24
    expect(result.nextDue).toBeCloseTo(NOW + 24 * MS_PER_HOUR, -3)
    expect(result.mastered).toBe(false)
    expect(result.attempts).toBe(1)
  })

  it('score 3 → easeFactor = min(1.5 + 0.1×(streak-1), 2.5)', () => {
    // streak devient 2 → easeFactor = 1.6
    const entry = makeEntry({ correctStreak: 1, interval: 24 })
    const result = computeNextSRS(entry, 3, NOW)

    expect(result.correctStreak).toBe(2)
    expect(result.interval).toBeCloseTo(24 * 1.6, 5)             // 38.4
  })

  it('3 réussites parfaites consécutives depuis interval=100 → mastered=true', () => {
    // On part avec streak=2, interval=100 (seuil proche)
    // Après score 3 : streak=3, easeFactor=1.7, interval=max(100×1.7, 24)=170 ≥ 168
    const entry = makeEntry({ correctStreak: 2, interval: 100 })
    const result = computeNextSRS(entry, 3, NOW)

    expect(result.correctStreak).toBe(3)
    expect(result.interval).toBeGreaterThanOrEqual(168)
    expect(result.mastered).toBe(true)
  })

  it('mastered reste false si streak≥3 mais interval<168', () => {
    const entry = makeEntry({ correctStreak: 2, interval: 24 })
    const result = computeNextSRS(entry, 3, NOW)
    // streak=3, interval=max(24×1.7,24)=40.8 < 168
    expect(result.mastered).toBe(false)
  })

  it('score 0 après streak=2 → streak=0, interval=1, nextDue=now+1h', () => {
    const entry = makeEntry({ correctStreak: 2, interval: 36 })
    const result = computeNextSRS(entry, 0, NOW)

    expect(result.correctStreak).toBe(0)
    expect(result.interval).toBe(1)
    expect(result.nextDue).toBeCloseTo(NOW + 1 * MS_PER_HOUR, -3)
    expect(result.mastered).toBe(false)
  })

  it('score 1 (partiel) → streak=0, interval=max(interval/2, 1)', () => {
    const entry = makeEntry({ correctStreak: 1, interval: 24 })
    const result = computeNextSRS(entry, 1, NOW)

    expect(result.correctStreak).toBe(0)
    expect(result.interval).toBe(12)  // 24/2
  })

  it('score 2 (partiel) → même résultat que score 1', () => {
    const entry = makeEntry({ correctStreak: 1, interval: 24 })
    const r1 = computeNextSRS(entry, 1, NOW)
    const r2 = computeNextSRS(entry, 2, NOW)

    expect(r2.correctStreak).toBe(r1.correctStreak)
    expect(r2.interval).toBe(r1.interval)
  })

  it('score partiel avec interval=1 → interval reste 1 (minimum)', () => {
    const entry = makeEntry({ interval: 1 })
    const result = computeNextSRS(entry, 1, NOW)
    expect(result.interval).toBe(1)
  })

  it('attempts est incrémenté à chaque appel', () => {
    const entry = makeEntry({ attempts: 3 })
    const result = computeNextSRS(entry, 3, NOW)
    expect(result.attempts).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// 2. getSRSEntry — valeurs par défaut
// ---------------------------------------------------------------------------

describe('getSRSEntry — valeurs par défaut', () => {
  beforeEach(() => {
    // Mock localStorage vide
    const store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v },
      removeItem: (k) => { delete store[k] },
    })
  })

  it('scénario absent → retourne les valeurs par défaut sans erreur', async () => {
    const { storage } = await import('../src/utils/storage.js')
    const entry = storage.getSRSEntry('99')

    expect(entry).toEqual({ attempts: 0, correctStreak: 0, interval: 1, nextDue: 0, mastered: false })
  })

  it('clé permis_srs absente → getSRSData() retourne {}', async () => {
    const { storage } = await import('../src/utils/storage.js')
    expect(storage.getSRSData()).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 3. roll() SRS-aware — priorité de sélection
// ---------------------------------------------------------------------------

describe('roll() SRS-aware — priorité', () => {
  let store

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v },
      removeItem: (k) => { delete store[k] },
    })
    vi.resetModules()
  })

  it('scénario overdue retourné avant un jamais-vu', async () => {
    const { storage } = await import('../src/utils/storage.js')
    const { QuizEngine } = await import('../src/core/QuizEngine.js')

    const pastDue = Date.now() - 1000 * 3600  // 1h passé

    // On marque le scénario "42" comme overdue
    store['permis_srs'] = JSON.stringify({
      '42': { attempts: 1, correctStreak: 1, interval: 1, nextDue: pastDue, mastered: false },
    })

    const engine = new QuizEngine()
    // On tourne plusieurs fois pour s'assurer que "42" revient (overdue doit primer)
    const ids = new Set()
    for (let i = 0; i < 20; i++) {
      const s = engine.roll()
      ids.add(s.id)
    }

    // "42" overdue doit apparaître systématiquement quand c'est le seul overdue
    expect(ids.has('42')).toBe(true)
  })

  it('quand TOUS les scénarios sont maîtrisés → roll() retourne quand même un scénario valide', async () => {
    const { SCENARIOS } = await import('../src/data/scenarios.js')
    const { QuizEngine } = await import('../src/core/QuizEngine.js')

    const futureDue = Date.now() + 1000 * 3600 * 200  // loin dans le futur
    const allMastered = {}
    for (const s of SCENARIOS) {
      allMastered[s.id] = { attempts: 5, correctStreak: 5, interval: 200, nextDue: futureDue, mastered: true }
    }
    store['permis_srs'] = JSON.stringify(allMastered)

    const engine = new QuizEngine()
    const result = engine.roll()

    expect(result).not.toBeNull()
    expect(result.id).toBeDefined()
    expect(SCENARIOS.find(s => s.id === result.id)).toBeDefined()
  })

  it('première utilisation (permis_srs absent) → roll() sans erreur, traite tout comme jamais-vu', async () => {
    const { QuizEngine } = await import('../src/core/QuizEngine.js')

    const engine = new QuizEngine()
    expect(() => engine.roll()).not.toThrow()
    const result = engine.roll()
    expect(result).not.toBeNull()
  })
})
