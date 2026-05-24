/**
 * QuestionCard — carte de question avec évaluation IA ou auto-correction.
 * Design revu : meilleure hiérarchie visuelle, états clairs, mock LLM.
 */

const TYPE_CONFIG = {
  VI:  { label: 'Vérification Intérieure', short: 'VI',   color: '#ef4444', glow: 'rgba(239,68,68,.18)' },
  VE:  { label: 'Vérification Extérieure', short: 'VE',   color: '#b91c1c', glow: 'rgba(185,28,28,.18)' },
  QSER:{ label: 'Sécurité routière',       short: 'QSER', color: '#f97316', glow: 'rgba(249,115,22,.18)' },
  SEC: { label: 'Premiers secours',        short: 'SEC',  color: '#22c55e', glow: 'rgba(34,197,94,.18)' },
}

export class QuestionCard {
  constructor(opts) {
    Object.assign(this, opts)
    this._scored = false
    this.element = this._build()
  }

  _build() {
    const cfg = TYPE_CONFIG[this.type] || TYPE_CONFIG.SEC
    const el = document.createElement('article')
    el.className = 'qcard'
    el.style.setProperty('--type-color', cfg.color)
    el.style.setProperty('--type-glow',  cfg.glow)

    el.innerHTML = `
      <header class="qcard-header">
        <div class="qcard-type">
          <span class="type-badge">${cfg.short}</span>
          <span class="type-label">${cfg.label}</span>
        </div>
        <span class="qcard-pts">1 pt</span>
      </header>

      <div class="qcard-body">
        ${this.photo ? `
          <a class="photo-hint" href="./photos/${this.photo}" target="_blank">
            <span class="photo-icon">📷</span>
            <span>Voir la photo : ${this.photo}</span>
          </a>` : ''}

        <p class="q-text">${this.question}</p>

        <div class="q-input-wrap">
          <textarea
            class="q-textarea"
            placeholder="Écris ta réponse ici…"
            rows="3"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="q-actions">
          <button class="qbtn qbtn-ai">
            <span class="btn-icon">✦</span>
            <span class="btn-label">Évaluer par l'IA</span>
          </button>
          <button class="qbtn qbtn-reveal">
            <span class="btn-icon">◎</span>
            <span class="btn-label">Voir la réponse</span>
          </button>
        </div>

        <div class="q-feedback hidden"></div>

        <div class="q-self-eval hidden">
          <p class="self-eval-prompt">Tu t'évalues toi-même :</p>
          <div class="self-eval-btns">
            <button class="qbtn qbtn-yes">✓ Correct — 1 pt</button>
            <button class="qbtn qbtn-no">✗ Pas correct — 0 pt</button>
          </div>
        </div>

        ${this.explain ? `
          <details class="q-explain">
            <summary>
              <span class="explain-icon">💡</span>
              <span>Comprendre pourquoi</span>
            </summary>
            <div class="explain-body">${this.explain}</div>
          </details>` : ''}
      </div>
    `

    this._textarea  = el.querySelector('.q-textarea')
    this._feedback  = el.querySelector('.q-feedback')
    this._selfEval  = el.querySelector('.q-self-eval')
    this._btnAI     = el.querySelector('.qbtn-ai')
    this._btnReveal = el.querySelector('.qbtn-reveal')

    this._btnReveal?.addEventListener('click', () => this._reveal())
    this._btnAI?.addEventListener('click',     () => this._aiEval())
    el.querySelector('.qbtn-yes')?.addEventListener('click', () => this._score(1))
    el.querySelector('.qbtn-no')?.addEventListener('click',  () => this._score(0))

    // Auto-resize textarea
    this._textarea?.addEventListener('input', () => {
      this._textarea.style.height = 'auto'
      this._textarea.style.height = this._textarea.scrollHeight + 'px'
    })

    return el
  }

  _reveal() {
    this._showOfficialAnswer()
    this._selfEval.classList.remove('hidden')
    this._btnReveal.disabled = true
    this._btnReveal.querySelector('.btn-label').textContent = 'Réponse affichée'
  }

  async _aiEval() {
    if (!this.llm) return
    const userAnswer = this._textarea.value.trim()
    if (!userAnswer) {
      this._textarea.focus()
      this._textarea.classList.add('shake')
      setTimeout(() => this._textarea.classList.remove('shake'), 500)
      return
    }

    this._setLoading(true)
    try {
      const result = await this.llm.evaluate({
        question:       this.question,
        officialAnswer: this.answer,
        userAnswer,
        context:        this.explain || '',
      })
      this._showAIResult(result)
      this._score(result.score)
    } catch (err) {
      this._showFeedback('error', '⚠ Erreur', err.message)
      this._selfEval.classList.remove('hidden')
    } finally {
      this._setLoading(false)
    }
  }

  _setLoading(on) {
    this._btnAI.disabled    = on
    this._btnReveal.disabled = on
    if (on) {
      this._btnAI.innerHTML = `
        <span class="spinner"></span>
        <span class="btn-label">L'IA analyse…</span>
      `
      this._feedback.innerHTML = `
        <div class="feedback-loading">
          <span class="spinner spinner-lg"></span>
          <span>Analyse en cours…</span>
        </div>
      `
      this._feedback.className = 'q-feedback feedback-loading-wrap'
    } else {
      this._btnAI.innerHTML = `<span class="btn-icon">✦</span><span class="btn-label">Évaluer par l'IA</span>`
    }
  }

  _showAIResult(result) {
    const stateMap = { 'Correct': 'ok', 'Partiel': 'partial', 'Incorrect': 'ko' }
    const state = stateMap[result.label] || 'ko'
    const iconMap = { ok: '✓', partial: '◑', ko: '✗' }
    const demoTag = result.demo ? `<span class="demo-badge">Mode démo</span>` : ''

    this._feedback.className = `q-feedback feedback-${state}`
    this._feedback.innerHTML = `
      <div class="fb-row">
        <span class="fb-icon">${iconMap[state]}</span>
        <div class="fb-content">
          <div class="fb-label">${result.label} ${demoTag}</div>
          <div class="fb-comment">${result.comment}</div>
        </div>
      </div>
      <div class="fb-official">
        <span class="fb-official-label">Réponse officielle</span>
        <p>${this.answer}</p>
      </div>
    `
    this._feedback.classList.remove('hidden')
  }

  _showOfficialAnswer() {
    this._feedback.className = 'q-feedback feedback-reveal'
    this._feedback.innerHTML = `
      <div class="fb-official">
        <span class="fb-official-label">Réponse officielle</span>
        <p>${this.answer}</p>
      </div>
    `
    this._feedback.classList.remove('hidden')
  }

  _showFeedback(type, title, text) {
    this._feedback.className = `q-feedback feedback-${type}`
    this._feedback.innerHTML = `<div class="fb-label">${title}</div><div class="fb-comment">${text}</div>`
    this._feedback.classList.remove('hidden')
  }

  _score(value) {
    if (this._scored) return
    this._scored = true
    this._selfEval.classList.add('hidden')
    this._btnAI.disabled     = true
    this._btnReveal.disabled = true

    // Ajouter un badge de score dans le feedback
    const badge = document.createElement('div')
    badge.className = `score-badge ${value === 1 ? 'score-ok' : 'score-ko'}`
    badge.textContent = value === 1 ? '+1 point' : '0 point'
    this._feedback.appendChild(badge)

    // Bordure de la carte selon le résultat
    this.element.classList.add(value === 1 ? 'card-ok' : 'card-ko')

    this.onScore?.(this.index, value)
  }
}
