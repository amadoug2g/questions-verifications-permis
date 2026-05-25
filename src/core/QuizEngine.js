/**
 * QuizEngine — gestion de l'état d'une session de quiz.
 * Découplé de l'UI : ne touche pas au DOM.
 * Émet des événements pour que les composants UI se mettent à jour.
 */

import { SCENARIOS } from '../data/scenarios.js'

export class QuizEngine extends EventTarget {
  constructor() {
    super()
    this.scenario = null
    this.scores = [null, null, null] // null | 0 | 1 pour chaque question
  }

  /** Tire un scénario aléatoire parmi les scénarios disponibles. */
  roll() {
    const available = SCENARIOS.map(s => s.id)
    const id = available[Math.floor(Math.random() * available.length)]
    this.scenario = SCENARIOS.find(s => s.id === id)
    this.scores = [null, null, null]
    this.dispatch('scenario-changed', { scenario: this.scenario })
    return this.scenario
  }

  /** Tire le scénario correspondant à un numéro donné (pour test ou navigation). */
  selectById(id) {
    this.scenario = SCENARIOS.find(s => s.id === String(id).padStart(2, '0'))
    if (!this.scenario) throw new Error(`Scénario ${id} introuvable`)
    this.scores = [null, null, null]
    this.dispatch('scenario-changed', { scenario: this.scenario })
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

  dispatch(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}
