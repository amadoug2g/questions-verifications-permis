/**
 * QuizEngine — gestion de l'état d'une session de quiz.
 * Découplé de l'UI : ne touche pas au DOM.
 * Émet des événements pour que les composants UI se mettent à jour.
 */

import { SCENARIOS } from '../data/scenarios.js'
import { storage } from '../utils/storage.js'

export class QuizEngine extends EventTarget {
  constructor() {
    super()
    this.scenario = null
    this.scenarioStatus = null // 'overdue' | 'new' | 'upcoming' | 'mastered' | null
    this.scores = [null, null, null] // null | 0 | 1 pour chaque question
  }

  /**
   * Tire un scénario selon l'ordre de priorité SRS :
   *   1. Overdue (nextDue <= now) — trié par nextDue croissant
   *   2. Jamais vus (attempts === 0 ou absent de permis_srs)
   *   3. Planifiés futurs non maîtrisés — le plus proche d'abord
   *   4. Maîtrisés — aléatoire
   */
  roll() {
    const now = Date.now()
    const srsData = storage.getSRSData()

    const overdue   = []  // nextDue <= now (et attempts > 0)
    const neverSeen = []  // absent ou attempts === 0
    const upcoming  = []  // nextDue > now, non maîtrisé
    const mastered  = []  // mastered === true

    for (const s of SCENARIOS) {
      const entry = srsData[s.id]
      if (!entry || entry.attempts === 0) {
        neverSeen.push(s)
      } else if (entry.mastered) {
        mastered.push(s)
      } else if (entry.nextDue <= now) {
        overdue.push(s)
      } else {
        upcoming.push(s)
      }
    }

    // Tri : overdue par nextDue croissant, upcoming par nextDue croissant
    overdue.sort((a, b) => srsData[a.id].nextDue - srsData[b.id].nextDue)
    upcoming.sort((a, b) => srsData[a.id].nextDue - srsData[b.id].nextDue)

    // Sélection selon priorité — aléatoire à l'intérieur d'un groupe ex-æquo
    let selected, status
    if (overdue.length > 0) {
      selected = overdue[0]
      status = 'overdue'
    } else if (neverSeen.length > 0) {
      selected = neverSeen[Math.floor(Math.random() * neverSeen.length)]
      status = 'new'
    } else if (upcoming.length > 0) {
      selected = upcoming[0]
      status = 'upcoming'
    } else {
      // Tous maîtrisés — révision aléatoire parmi les maîtrisés
      selected = mastered[Math.floor(Math.random() * mastered.length)]
      status = 'mastered'
    }

    this.scenario = selected
    this.scenarioStatus = status
    this.scores = [null, null, null]
    this.dispatch('scenario-changed', { scenario: this.scenario, status: this.scenarioStatus })
    return this.scenario
  }

  /** Tire le scénario correspondant à un numéro donné (pour test ou navigation). */
  selectById(id) {
    this.scenario = SCENARIOS.find(s => s.id === String(id).padStart(2, '0'))
    if (!this.scenario) throw new Error(`Scénario ${id} introuvable`)
    this.scenarioStatus = this._computeStatus(this.scenario)
    this.scores = [null, null, null]
    this.dispatch('scenario-changed', { scenario: this.scenario, status: this.scenarioStatus })
    return this.scenario
  }

  /** Enregistre le score d'une question (index 0, 1, 2). */
  setScore(index, value) {
    if (index < 0 || index > 2) throw new RangeError('index doit être 0, 1 ou 2')
    this.scores[index] = value
    this.dispatch('score-updated', { index, value, total: this.total })
    if (this.isComplete) this.dispatch('quiz-complete', { scores: this.scores, total: this.total })
  }

  get total() {
    return this.scores.reduce((sum, s) => sum + (s ?? 0), 0)
  }

  get isComplete() {
    return this.scores.every(s => s !== null)
  }

  /** Retourne le statut SRS d'un scénario donné. */
  _computeStatus(scenario) {
    const now = Date.now()
    const entry = storage.getSRSData()[scenario.id]
    if (!entry || entry.attempts === 0) return 'new'
    if (entry.mastered) return 'mastered'
    if (entry.nextDue <= now) return 'overdue'
    return 'upcoming'
  }

  dispatch(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}
