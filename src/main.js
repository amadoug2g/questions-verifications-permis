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
  home: document.getElementById('screen-home'),
  quiz: document.getElementById('screen-quiz'),
}

const show = (name) => {
  Object.values(screens).forEach(s => s?.classList.add('hidden'))
  screens[name]?.classList.remove('hidden')
}

// ─── Instanciation ────────────────────────────────────────────────────────

const engine = new QuizEngine()

const getLLM = () => new LLMService({ provider: 'cloudflare' })

const odometer = new Odometer({
  container: document.getElementById('odo-container'),
  onRoll: (id) => startSession(id),
})

const scoreBoard = new ScoreBoard({
  container: document.getElementById('score-container'),
  onNewSession:   () => { show('home'); scoreBoard.reset(); hideStickyScoreBar() },
  onNextScenario: () => { const s = engine.roll(); startSession(s.id) },
})

// ─── Stepper (mobile navigation) ─────────────────────────────────────────

function buildStepper(cards, container) {
  let current = 0

  const nav = document.createElement('div')
  nav.className = 'stepper-nav'
  nav.innerHTML = `
    <button class="step-btn step-prev" aria-label="Question précédente">← Préc.</button>
    <span class="step-counter">Question <strong>1</strong>/${cards.length}</span>
    <button class="step-btn step-next" aria-label="Question suivante">Suiv. →</button>
  `
  container.insertBefore(nav, container.firstChild)

  const stepCounter = nav.querySelector('.step-counter strong')
  const prev  = nav.querySelector('.step-prev')
  const next  = nav.querySelector('.step-next')

  function goto(i) {
    cards[current].element.classList.remove('step-active')
    current = i
    cards[current].element.classList.add('step-active')
    stepCounter.textContent = current + 1
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

// ─── Sticky score bar ─────────────────────────────────────────────────────

function initStickyScoreBar(scenarioId) {
  const bar = document.getElementById('sticky-score-bar')
  const numEl = document.getElementById('sticky-scenario-num')
  if (!bar || !numEl) return
  numEl.textContent = scenarioId
  bar.classList.add('visible')
  // Reset dots
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById(`sticky-dot-${i}`)
    if (dot) { dot.classList.remove('dot-ok', 'dot-ko') }
  }
}

function updateStickyDot(index, value) {
  const dot = document.getElementById(`sticky-dot-${index}`)
  if (!dot) return
  dot.classList.remove('dot-ok', 'dot-ko')
  dot.classList.add(value >= 1 ? 'dot-ok' : 'dot-ko')
}

function hideStickyScoreBar() {
  const bar = document.getElementById('sticky-score-bar')
  if (bar) bar.classList.remove('visible')
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
  initStickyScoreBar(scenario.id)

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
        updateStickyDot(index, value)
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

document.getElementById('btn-back')?.addEventListener('click', () => { show('home'); hideStickyScoreBar() })

// ─── Init ─────────────────────────────────────────────────────────────────

show('home')
