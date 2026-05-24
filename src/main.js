/**
 * main.js — câble tous les modules ensemble.
 * C'est ici qu'on orchestre, pas qu'on logique.
 */

import { QuizEngine }   from './core/QuizEngine.js'
import { LLMService }   from './core/LLMService.js'
import { Odometer }     from './components/Odometer.js'
import { QuestionCard } from './components/QuestionCard.js'
import { ScoreBoard }   from './components/ScoreBoard.js'
import { storage }      from './utils/storage.js'

// ─── Éléments DOM ─────────────────────────────────────────────────────────

const screens = {
  home:      document.getElementById('screen-home'),
  quiz:      document.getElementById('screen-quiz'),
  settings:  document.getElementById('screen-settings'),
}

const show = (name) => {
  Object.values(screens).forEach(s => s?.classList.add('hidden'))
  screens[name]?.classList.remove('hidden')
}

// ─── Instanciation ────────────────────────────────────────────────────────

const engine = new QuizEngine()

const getLLM = () => {
  // En production (Cloudflare), on passe par /api/evaluate — gratuit, sans clé.
  const isDeployed = !['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (isDeployed) {
    return new LLMService({ provider: 'cloudflare' })
  }
  // En local : clé API si configurée, sinon mode démo automatique.
  const key = storage.getApiKey()
  return new LLMService({
    provider: storage.getProvider(),
    apiKey: key || '',
    model: storage.getModel() || undefined,
  })
}

const odometer = new Odometer({
  container: document.getElementById('odo-container'),
  onRoll: (id) => startSession(id),
})

const scoreBoard = new ScoreBoard({
  container: document.getElementById('score-container'),
  onNewSession: () => { show('home'); scoreBoard.reset() },
})

// ─── Session ──────────────────────────────────────────────────────────────

function startSession(id) {
  const scenario = engine.selectById(id)
  const llm = getLLM()
  const container = document.getElementById('cards-container')
  container.innerHTML = ''

  // Titre du scénario
  document.getElementById('scenario-num').textContent = scenario.id
  show('quiz')
  scoreBoard.reset()

  const questions = [
    { type: scenario.type1, question: scenario.q1, answer: scenario.a1, explain: scenario.explain1, photo: scenario.photo1 },
    { type: 'QSER',          question: scenario.q2, answer: scenario.a2, explain: scenario.explain2 },
    { type: 'SEC',           question: scenario.q3, answer: scenario.a3, explain: scenario.explain3 },
  ]

  questions.forEach((q, i) => {
    const card = new QuestionCard({
      ...q,
      index: i,
      llm,
      onScore: (index, value) => {
        engine.setScore(index, value)
        scoreBoard.update(index, value)
        if (engine.isComplete) {
          const stats = storage.addSession(engine.total)
          scoreBoard.showFinal(engine.total, stats)
        }
      },
    })
    container.appendChild(card.element)
  })
}

// ─── Paramètres ───────────────────────────────────────────────────────────

document.getElementById('btn-settings')?.addEventListener('click', () => {
  document.getElementById('input-api-key').value = storage.getApiKey()
  document.getElementById('select-provider').value = storage.getProvider()
  document.getElementById('input-model').value = storage.getModel()
  show('settings')
})

document.getElementById('btn-save-settings')?.addEventListener('click', () => {
  storage.setApiKey(document.getElementById('input-api-key').value.trim())
  storage.setProvider(document.getElementById('select-provider').value)
  storage.setModel(document.getElementById('input-model').value.trim())
  show('home')
})

document.getElementById('btn-cancel-settings')?.addEventListener('click', () => show('home'))

document.getElementById('btn-back')?.addEventListener('click', () => show('home'))

document.getElementById('btn-reset-stats')?.addEventListener('click', () => {
  if (confirm('Effacer tout l\'historique de scores ?')) {
    storage.resetStats()
    alert('Historique effacé.')
  }
})

// ─── Init ─────────────────────────────────────────────────────────────────

show('home')

// Affiche un badge si aucune clé API n'est configurée
if (!storage.getApiKey()) {
  const badge = document.getElementById('api-key-badge')
  if (badge) badge.classList.remove('hidden')
}
