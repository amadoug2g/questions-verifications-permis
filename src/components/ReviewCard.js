import { openVideoSheet } from './videoSheet.js'

const TYPE_CONFIG = {
  VI:  { label: 'Vérification Intérieure', short: 'VI',   color: '#ef4444', glow: 'rgba(239,68,68,.18)' },
  VE:  { label: 'Vérification Extérieure', short: 'VE',   color: '#b91c1c', glow: 'rgba(185,28,28,.18)' },
  QSER:{ label: 'Sécurité routière',       short: 'QSER', color: '#f97316', glow: 'rgba(249,115,22,.18)' },
  SEC: { label: 'Premiers secours',        short: 'SEC',  color: '#22c55e', glow: 'rgba(34,197,94,.18)' },
}

export class ReviewCard {
  constructor({ type, question, answer, explain, photo, video, scenarioId }) {
    this.element = this._build({ type, question, answer, explain, photo, video, scenarioId })
  }

  _build({ type, question, answer, explain, photo, video, scenarioId }) {
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.SEC
    const el = document.createElement('article')
    el.className = 'qcard'
    el.style.setProperty('--type-color', cfg.color)
    el.style.setProperty('--type-glow', cfg.glow)

    el.innerHTML = `
      <header class="qcard-header">
        <div class="qcard-type">
          <span class="type-badge">${cfg.short}</span>
          <span class="type-label">${cfg.label}</span>
        </div>
        <span class="review-scenario-tag">Scénario ${scenarioId}</span>
      </header>
      <div class="qcard-body">
        ${photo ? `
          <a class="photo-hint" href="./photos/${photo}" target="_blank">
            <span class="photo-icon">📷</span>
            <span>Voir la photo : ${photo}</span>
          </a>` : ''}
        <p class="q-text">${question}</p>
        <div class="q-actions">
          <button class="qbtn qbtn-reveal js-reveal">
            <span class="btn-icon">◎</span>
            <span class="btn-label">Voir la réponse</span>
          </button>
          ${video ? `
          <button class="qbtn qbtn-video js-video">
            <span class="btn-icon">▶</span>
            <span class="btn-label">Vidéo</span>
          </button>` : ''}
        </div>
        <div class="q-feedback feedback-reveal hidden">
          <div class="fb-official">
            <span class="fb-official-label">Réponse officielle</span>
            <p>${answer}</p>
          </div>
        </div>
        ${explain ? `
          <details class="q-explain">
            <summary>
              <span class="explain-icon">💡</span>
              <span>Comprendre pourquoi</span>
            </summary>
            <div class="explain-body">${explain}</div>
          </details>` : ''}
      </div>
    `

    el.querySelector('.js-reveal').addEventListener('click', () => {
      el.querySelector('.q-feedback').classList.remove('hidden')
      el.querySelector('.q-explain')?.setAttribute('open', '')
      const btn = el.querySelector('.js-reveal')
      btn.disabled = true
      btn.querySelector('.btn-label').textContent = 'Réponse affichée'
    })

    if (video) {
      el.querySelector('.js-video')?.addEventListener('click', () => openVideoSheet(video))
    }

    return el
  }
}
