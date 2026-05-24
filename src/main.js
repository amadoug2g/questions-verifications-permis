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

// ─── Stepper (mobile navigation) ─────────────────────────────────────────

function buildStepper(cards, container) {
  let current = 0

  const nav = document.createElement('div')
  nav.className = 'stepper-nav'
  nav.innerHTML = `
    <button class="step-btn step-prev" aria-label="Question précédente">← Préc.</button>
    <div class="step-dots">${cards.map((_, i) =>
      `<span class="step-dot${i === 0 ? ' active' : ''}"></span>`
    ).join('')}</div>
    <button class="step-btn step-next" aria-label="Question suivante">Suiv. →</button>
  `
  container.insertBefore(nav, container.firstChild)

  const dots  = nav.querySelectorAll('.step-dot')
  const prev  = nav.querySelector('.step-prev')
  const next  = nav.querySelector('.step-next')

  function goto(i) {
    cards[current].element.classList.remove('step-active')
    dots[current].classList.remove('active')
    current = i
    cards[current].element.classList.add('step-active')
    dots[current].classList.add('active')
    prev.disabled = current === 0
    next.disabled = current === cards.length - 1
    cards[current].element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  prev.addEventListener('click', () => { if (current > 0) goto(current - 1) })
  next.addEventListener('click', () => { if (current < cards.length - 1) goto(current + 1) })

  // Swipe tactile
  let touchX = 0
  container.addEventListener('touchstart', e => { touchX = e.touches[0].clientX }, { passive: true })
  container.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX
    if (Math.abs(dx) > 50) {
      if (dx < 0 && current < cards.length - 1) goto(current + 1)
      if (dx > 0 && current > 0) goto(current - 1)
    }
  }, { passive: true })

  // Init
  prev.disabled = true
  cards.forEach((c, i) => c.element.classList.toggle('step-active', i === 0))
}

// ─── Session ──────────────────────────────────────────────────────────────

function startSession(id) {
  const scenario = engine.selectById(id)
  const llm = getLLM()
  const container = document.getElementById('cards-container')
  container.innerHTML = ''

  document.getElementById('scenario-num').textContent = scenario.id
  show('quiz')
  scoreBoard.reset()

  const questions = [
    { type: scenario.type1, question: scenario.q1, answer: scenario.a1, explain: scenario.explain1, photo: scenario.photo1 },
    { type: 'QSER',          question: scenario.q2, answer: scenario.a2, explain: scenario.explain2 },
    { type: 'SEC',           question: scenario.q3, answer: scenario.a3, explain: scenario.explain3 },
  ]

  const cards = questions.map((q, i) => {
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
    return card
  })

  buildStepper(cards, container)
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
