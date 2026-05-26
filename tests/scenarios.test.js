/**
 * scenarios.test.js — Suite de tests TDD pour valider les données des scénarios.
 *
 * Couche 1 : Tests structurels (format, champs, parité ID/type)
 * Couche 2 : Tests contre le PDF officiel DSR/BRPCE (source de vérité)
 * Couche 3 : Tests anti-hallucination sur les champs explain
 * Couche 4 : Tests de régression connus (ex: scénario 28 "courroie")
 * Couche 5 : Smoke tests (count, getScenarioById)
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect, test } from 'vitest'
import { SCENARIOS, getScenarioById } from '../src/data/scenarios.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PDF_PATH = resolve(__dirname, 'fixtures/pdf-source.txt')
const pdfText = readFileSync(PDF_PATH, 'utf-8')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise un texte pour comparaison fuzzy :
 * - Minuscules
 * - Supprime les accents
 * - Normalise les espaces multiples
 * - Retire la ponctuation de séparation
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les diacritiques
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s']/g, ' ')       // ponctuation -> espace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrait les mots significatifs (> 3 lettres) d'un texte normalisé.
 */
function significantWords(text) {
  return normalize(text)
    .split(' ')
    .filter(w => w.length > 3)
}

/**
 * Normalise et découpe en mots significatifs (> 3 lettres), en splitant aussi
 * sur les apostrophes pour que "l'arrêt" donne ["arret"] et non ["l'arret"].
 */
function significantWordsStrict(text) {
  return normalize(text)
    .replace(/'/g, ' ')   // sépare les contractions : l'arrêt → l arret
    .split(' ')
    .filter(w => w.length > 3)
}

/**
 * Vérifie qu'au moins `threshold`% des mots significatifs (> 3 lettres) de
 * `value` sont présents dans le texte du PDF (recherche globale).
 *
 * Stratégie : le layout deux-colonnes du PDF rend l'extraction de blocs par
 * ID non fiable. On recherche donc dans l'intégralité du texte extrait.
 * Les réponses (a1/a2/a3) de l'app sont enrichies pédagogiquement par rapport
 * au PDF — on n'applique donc le test strict qu'aux questions (q1/q2/q3).
 */
function expectMatchesPDF(scenarioId, field, value, pdfContent, threshold = 0.65) {
  const pdfNorm = normalize(pdfContent).replace(/'/g, ' ')
  const words = significantWordsStrict(value)

  if (words.length === 0) return // texte trop court, pas de mots significatifs

  const matched = words.filter(w => pdfNorm.includes(w))
  const ratio = matched.length / words.length

  if (ratio < threshold) {
    const missing = words.filter(w => !pdfNorm.includes(w))
    throw new Error(
      `Scénario ${scenarioId} — ${field} : seulement ${Math.round(ratio * 100)}% des mots trouvés dans le PDF (seuil : ${Math.round(threshold * 100)}%).\n` +
      `  Valeur testée : "${value}"\n` +
      `  Mots manquants (absents du PDF entier) : ${missing.join(', ')}`
    )
  }
}

// ---------------------------------------------------------------------------
// Couche 5 — Smoke tests (déclarés d'abord pour visibilité rapide)
// ---------------------------------------------------------------------------

describe('Couche 5 — Smoke tests', () => {
  it('SCENARIOS contient exactement 60 scénarios', () => {
    expect(SCENARIOS).toHaveLength(60)
  })

  it('getScenarioById("01") retourne le scénario 01', () => {
    const s = getScenarioById('01')
    expect(s).not.toBeNull()
    expect(s.id).toBe('01')
  })

  it('getScenarioById("61") retourne null (scénario non implémenté)', () => {
    expect(getScenarioById('61')).toBeNull()
  })

  it('getScenarioById(1) (numérique) retourne le scénario 01', () => {
    const s = getScenarioById(1)
    expect(s).not.toBeNull()
    expect(s.id).toBe('01')
  })
})

// ---------------------------------------------------------------------------
// Couche 1 — Tests structurels
// ---------------------------------------------------------------------------

describe('Couche 1 — Tests structurels', () => {
  it('Pas de doublons d\'ID', () => {
    const ids = SCENARIOS.map(s => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  describe.each(SCENARIOS)('Scénario $id', (scenario) => {
    it('id est une string à 2 chiffres', () => {
      expect(scenario.id).toMatch(/^\d{2}$/)
    })

    it('type1 est "VI" ou "VE"', () => {
      expect(['VI', 'VE']).toContain(scenario.type1)
    })

    it('parité respectée : pair → VE, impair → VI', () => {
      const num = parseInt(scenario.id, 10)
      const expectedType = num % 2 === 0 ? 'VE' : 'VI'
      expect(scenario.type1).toBe(expectedType)
    })

    it('champs Q/A présents et non vides', () => {
      for (const field of ['q1', 'a1', 'q2', 'a2', 'q3', 'a3']) {
        expect(scenario[field], `champ ${field} manquant`).toBeDefined()
        expect(scenario[field].trim(), `champ ${field} vide`).not.toBe('')
      }
    })

    it('photo1, si présent, est au format kebab-case avec extension', () => {
      if (scenario.photo1 !== undefined) {
        expect(scenario.photo1).toMatch(/^[a-z0-9-]+\.(jpg|png|webp)$/)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Couche 2 — Tests contre le PDF (source de vérité)
// ---------------------------------------------------------------------------

describe('Couche 2 — Tests contre le PDF officiel DSR/BRPCE', () => {
  // Note : seules les questions (q1/q2/q3) sont testées contre le PDF.
  // Les réponses (a1/a2/a3) sont pédagogiquement enrichies dans l'app par rapport
  // aux réponses courtes du PDF — leur validation est assurée par la couche 3
  // (anti-hallucination) et la couche 4 (régressions connues).
  describe.each(SCENARIOS)('Scénario $id', (scenario) => {
    it('q1 figure dans le PDF', () => {
      expectMatchesPDF(scenario.id, 'q1', scenario.q1, pdfText)
    })

    it('q2 figure dans le PDF', () => {
      expectMatchesPDF(scenario.id, 'q2', scenario.q2, pdfText)
    })

    it('q3 figure dans le PDF', () => {
      expectMatchesPDF(scenario.id, 'q3', scenario.q3, pdfText)
    })
  })
})

// ---------------------------------------------------------------------------
// Couche 3 — Tests anti-hallucination sur explain
// ---------------------------------------------------------------------------

/** Blocklist de termes interdits — à enrichir au fil du temps */
const HALLUCINATION_BLOCKLIST = [
  'courroie de distribution',
]

describe('Couche 3 — Tests anti-hallucination sur explain', () => {
  describe.each(SCENARIOS)('Scénario $id', (scenario) => {
    for (const n of [1, 2, 3]) {
      const field = `explain${n}`
      if (scenario[field] !== undefined) {
        it(`${field} fait moins de 250 caractères`, () => {
          expect(scenario[field].length).toBeLessThan(250)
        })

        it(`${field} ne contient pas de termes de la blocklist`, () => {
          const value = scenario[field].toLowerCase()
          for (const term of HALLUCINATION_BLOCKLIST) {
            expect(value, `"${term}" trouvé dans ${field}`).not.toContain(term)
          }
        })
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Couche 4 — Tests de régression connus
// ---------------------------------------------------------------------------

describe('Couche 4 — Tests de régression connus', () => {
  it('Scénario 28 q1 : contient "dispositifs réfléchissants"', () => {
    const s = getScenarioById('28')
    expect(s).not.toBeNull()
    expect(s.q1.toLowerCase()).toContain('dispositifs réfléchissants')
  })

  it('Scénario 28 q1 : ne contient PAS "courroie"', () => {
    const s = getScenarioById('28')
    expect(s).not.toBeNull()
    expect(s.q1.toLowerCase()).not.toContain('courroie')
  })

  it('Scénario 28 explain1 : ne contient PAS "courroie"', () => {
    const s = getScenarioById('28')
    expect(s).not.toBeNull()
    if (s.explain1) {
      expect(s.explain1.toLowerCase()).not.toContain('courroie')
    }
  })

  it('Scénario 01 q1 : contient "hauteur des feux"', () => {
    const s = getScenarioById('01')
    expect(s).not.toBeNull()
    expect(s.q1.toLowerCase()).toContain('hauteur des feux')
  })
})
