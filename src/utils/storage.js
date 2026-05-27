/**
 * storage.js — helpers pour localStorage.
 * Centralise tous les accès pour faciliter la migration (ex: IndexedDB, cookie...).
 */

const KEYS = {
  apiKey: 'permis_api_key',
  provider: 'permis_provider',
  model: 'permis_model',
  stats: 'permis_stats',
  srs: 'permis_srs',
  attempts: 'permis_attempts',
  sessionsMeta: 'permis_sessions_meta',
}

export const storage = {
  getApiKey: () => localStorage.getItem(KEYS.apiKey) || import.meta.env?.VITE_ANTHROPIC_API_KEY || '',
  setApiKey: (v) => localStorage.setItem(KEYS.apiKey, v),

  getProvider: () => localStorage.getItem(KEYS.provider) || 'anthropic',
  setProvider: (v) => localStorage.setItem(KEYS.provider, v),

  getModel: () => localStorage.getItem(KEYS.model) || '',
  setModel: (v) => localStorage.setItem(KEYS.model, v),

  /** Stats cumulées : { played, totalScore, maxScore } */
  getStats: () => JSON.parse(localStorage.getItem(KEYS.stats) || '{"played":0,"totalScore":0,"maxScore":0}'),
  addSession: (score) => {
    const s = storage.getStats()
    s.played += 1
    s.totalScore += score
    s.maxScore += 3
    localStorage.setItem(KEYS.stats, JSON.stringify(s))
    return s
  },
  resetStats: () => localStorage.removeItem(KEYS.stats),

  // ─── SRS (Spaced Repetition System) ───────────────────────────────────

  /**
   * Lit et parse permis_srs. Retourne {} si absent (première utilisation).
   * Structure : { [scenarioId]: SRSEntry }
   */
  getSRSData: () => JSON.parse(localStorage.getItem(KEYS.srs) || '{}'),

  /**
   * Retourne l'entrée SRS pour un scénario, ou les valeurs par défaut si absent.
   */
  getSRSEntry: (scenarioId) => {
    const data = storage.getSRSData()
    return data[scenarioId] ?? { ...DEFAULT_SRS_ENTRY }
  },

  /**
   * Applique les règles SRS pour un score donné, persiste le résultat.
   *
   * Décision (issue #28 Q2) : score 1 et 2 sont traités identiquement
   * (interval ÷ 2, streak=0) — une distinction 1/3 vs 2/3 est réservée
   * à une issue future.
   *
   * @param {string} scenarioId
   * @param {number} score — 0, 1, 2 ou 3
   */
  updateSRSEntry: (scenarioId, score) => {
    const data = storage.getSRSData()
    const entry = data[scenarioId] ?? { ...DEFAULT_SRS_ENTRY }
    const updated = computeNextSRS(entry, score, Date.now())
    data[scenarioId] = updated
    localStorage.setItem(KEYS.srs, JSON.stringify(data))
    return updated
  },

  /** Supprime permis_srs sans toucher à permis_stats. */
  resetSRS: () => localStorage.removeItem(KEYS.srs),

  // ─── Session detection ────────────────────────────────────────────────

  /**
   * Retourne l'ID de la session courante.
   * Crée une nouvelle session si la dernière activité date de plus de 30 min.
   */
  getCurrentSessionId: () => {
    const SESSION_TIMEOUT = 30 * 60 * 1000
    const raw = localStorage.getItem(KEYS.sessionsMeta)
    const meta = raw ? JSON.parse(raw) : { currentId: null, lastActivity: 0 }
    const now = Date.now()
    if (!meta.currentId || now - meta.lastActivity > SESSION_TIMEOUT) {
      meta.currentId = `ses_${now}`
    }
    meta.lastActivity = now
    localStorage.setItem(KEYS.sessionsMeta, JSON.stringify(meta))
    return meta.currentId
  },

  // ─── Attempt log ──────────────────────────────────────────────────────

  /**
   * Enregistre une tentative complète (3 questions) dans le journal.
   *
   * @param {object} attempt — voir structure dans Opus strategy doc
   */
  logAttempt: (attempt) => {
    const data = JSON.parse(localStorage.getItem(KEYS.attempts) || '{"log":[],"version":1}')
    data.log.push(attempt)
    localStorage.setItem(KEYS.attempts, JSON.stringify(data))
  },

  /** Lit tout le journal de tentatives. */
  getAttempts: () => JSON.parse(localStorage.getItem(KEYS.attempts) || '{"log":[],"version":1}'),

  /** Supprime le journal de tentatives. */
  resetAttempts: () => localStorage.removeItem(KEYS.attempts),
}

// ─── Valeurs par défaut d'une entrée SRS ─────────────────────────────────

/** Exporté pour les tests et comme référence de type. */
export const DEFAULT_SRS_ENTRY = {
  attempts: 0,
  correctStreak: 0,
  interval: 1,    // en heures
  nextDue: 0,     // ms epoch — 0 = jamais vu = toujours considéré overdue
  mastered: false,
}

// ─── Logique de calcul SRS (pure, testable sans localStorage) ────────────

/**
 * Calcule la nouvelle entrée SRS après un score donné.
 *
 * @param {object} entry — entrée SRS courante
 * @param {number} score — 0, 1, 2 ou 3
 * @param {number} now   — timestamp ms (injecté pour testabilité)
 * @returns {object} nouvelle entrée SRS (immutable — ne modifie pas entry)
 */
export function computeNextSRS(entry, score, now) {
  const MS_PER_HOUR = 3600 * 1000
  let { correctStreak, interval, attempts } = entry

  attempts += 1

  let newStreak, newInterval, newNextDue

  if (score === 3) {
    newStreak = correctStreak + 1
    // easeFactor : 1.5 + 0.1×(newStreak-1), plafonné à 2.5
    const easeFactor = Math.min(1.5 + 0.1 * (newStreak - 1), 2.5)
    newInterval = Math.max(interval * easeFactor, 24)
    newNextDue = now + newInterval * MS_PER_HOUR
  } else if (score === 1 || score === 2) {
    // Réussite partielle : streak à zéro, interval divisé par 2 (min 1h)
    newStreak = 0
    newInterval = Math.max(interval / 2, 1)
    newNextDue = now + newInterval * MS_PER_HOUR
  } else {
    // Échec (score 0) : reset complet
    newStreak = 0
    newInterval = 1
    newNextDue = now + 1 * MS_PER_HOUR
  }

  const mastered = newStreak >= 3 && newInterval >= 168

  return {
    attempts,
    correctStreak: newStreak,
    interval: newInterval,
    nextDue: newNextDue,
    mastered,
  }
}
