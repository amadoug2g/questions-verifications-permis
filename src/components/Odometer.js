/**
 * Odometer — simule l'affichage du compteur kilométrique.
 * Anime les 2 derniers chiffres, les autres restent fixes.
 */

export class Odometer {
  constructor({ container, onRoll }) {
    this.container = container
    this.onRoll = onRoll
    this.spinning = false
    this._render()
  }

  _render() {
    this.container.innerHTML = `
      <div class="odo-card">
        <p class="odo-label">Compteur kilométrique du véhicule d'examen</p>
        <div class="odo-display">
          <span class="odo-digit" id="od0">5</span>
          <span class="odo-digit" id="od1">4</span>
          <span class="odo-sep">·</span>
          <span class="odo-digit" id="od2">2</span>
          <span class="odo-digit" id="od3">7</span>
          <span class="odo-sep">·</span>
          <span class="odo-digit active" id="od4">2</span>
          <span class="odo-digit active" id="od5">6</span>
        </div>
        <p class="odo-caption">Scénario sélectionné : <strong id="odo-result">26</strong></p>
        <button id="btn-roll" class="qbtn qbtn-ai" style="font-size:.95rem;padding:12px 28px;gap:10px;">
          <span class="btn-icon">⟳</span>
          <span class="btn-label">Simuler le compteur</span>
        </button>
        <p class="odo-hint">L'examinateur utilise les 2 derniers chiffres du compteur pour choisir le scénario.</p>
      </div>
    `
    this.container.querySelector('#btn-roll').addEventListener('click', () => this.roll())
  }

  roll() {
    if (this.spinning) return
    this.spinning = true
    const btn = this.container.querySelector('#btn-roll')
    btn.disabled = true

    const target = Math.floor(Math.random() * 100)
    const tens = Math.floor(target / 10)
    const units = target % 10

    this._animate(['od4', 'od5'], [tens, units], 800, () => {
      this.container.querySelector('#odo-result').textContent = String(target).padStart(2, '0')
      btn.disabled = false
      this.spinning = false
      this.onRoll?.(String(target).padStart(2, '0'))
    })
  }

  /** Animation de défilement des chiffres. */
  _animate(ids, targets, duration, done) {
    const fps = 80
    const steps = Math.round((duration / 1000) * fps)
    let step = 0

    const interval = setInterval(() => {
      step++
      const progress = step / steps
      ids.forEach((id, i) => {
        const el = this.container.querySelector(`#${id}`)
        if (!el) return
        if (progress < 0.85) {
          el.textContent = Math.floor(Math.random() * 10)
        } else {
          el.textContent = targets[i]
        }
      })
      if (step >= steps) {
        clearInterval(interval)
        ids.forEach((id, i) => {
          const el = this.container.querySelector(`#${id}`)
          if (el) el.textContent = targets[i]
        })
        done?.()
      }
    }, 1000 / fps)
  }
}
