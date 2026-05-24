/**
 * storage.js — helpers pour localStorage.
 * Centralise tous les accès pour faciliter la migration (ex: IndexedDB, cookie...).
 */

const KEYS = {
  apiKey: 'permis_api_key',
  provider: 'permis_provider',
  model: 'permis_model',
  stats: 'permis_stats',
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
}
