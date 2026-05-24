/**
 * ScoreBoard — score visuel en cours de session + récapitulatif final.
 */

const LABELS = ['Q1', 'Q2', 'Q3']

export class ScoreBoard {
  constructor({ container, onNewSession }) {
    this.container   = container
    this.onNewSession = onNewSession
    this.scores      = [null, null, null]
    this._render()
  }

  _render() {
    this.container.innerHTML = `
      <div class="scoreboard">
        <div class="sb-dots">
          ${LABELS.map((lbl, i) => `
            <div class="sb-dot" data-i="${i}">
              <span class="dot-ring"></span>
              <span class="dot-value">?</span>
              <span class="dot-label">${lbl}</span>
            </div>
          `).join('')}
        </div>
        <div class="sb-total" id="sb-total">0 / 3</div>
      </div>
    `
  }

  update(index, value) {
    this.scores[index] = value
    const dot = this.container.querySelector(`[data-i="${index}"]`)
    if (dot) {
      dot.classList.remove('dot-ok', 'dot-ko')
      dot.classList.add(value === 1 ? 'dot-ok' : 'dot-ko')
      dot.querySelector('.dot-value').textContent = value === 1 ? '✓' : '✗'
    }

    const earned = this.scores.filter(s => s === 1).length
    const done   = this.scores.filter(s => s !== null).length
    this.container.querySelector('#sb-total').textContent = `${earned} / ${done}`
  }

  showFinal(total, stats) {
    const pct = stats.maxScore > 0
      ? Math.round((stats.totalScore / stats.maxScore) * 100)
      : 0

    const emoji   = total === 3 ? '🎉' : total >= 2 ? '👍' : '💪'
    const message = total === 3
      ? 'Parfait, scénario maîtrisé !'
      : total === 2
        ? 'Presque — revois les erreurs.'
        : 'À retravailler. Continue !'

    const existing = this.container.querySelector('.sb-final')
    if (existing) existing.remove()

    const div = document.createElement('div')
    div.className = 'sb-final'
    div.innerHTML = `
      <div class="final-top">
        <span class="final-score">${total}<span class="final-denom">/3</span></span>
        <span class="final-emoji">${emoji}</span>
      </div>
      <p class="final-msg">${message}</p>
      <div class="final-stats">
        <span>${stats.played} session${stats.played > 1 ? 's' : ''}</span>
        <span>·</span>
        <span>${stats.totalScore}/${stats.maxScore} pts au total</span>
        <span>·</span>
        <span>${pct}% de réussite</span>
      </div>
      <button class="qbtn qbtn-new" id="btn-new-session">
        ↩ Nouveau scénario
      </button>
    `
    div.querySelector('#btn-new-session')
      .addEventListener('click', () => this.onNewSession?.())

    this.container.appendChild(div)

    // Petite animation d'apparition
    requestAnimationFrame(() => div.classList.add('visible'))
  }

  reset() {
    this.scores = [null, null, null]
    this._render()
  }
}
