/**
 * Odometer — simule l'affichage du compteur kilométrique.
 * Anime les 2 derniers chiffres, les autres restent fixes.
 */

import { SCENARIOS } from '../data/scenarios.js'
import { storage }   from '../utils/storage.js'

const SRS_STATUS = {
  new:      { label: 'Nouveau',  cls: 'srs-new' },
  overdue:  { label: 'À revoir', cls: 'srs-overdue' },
  upcoming: { label: 'Planifié', cls: 'srs-upcoming' },
  mastered: { label: 'Maîtrisé', cls: 'srs-mastered' },
}

export class Odometer {
  constructor({ container, onRoll }) {
    this.container = container
    this.onRoll = onRoll
    this.spinning = false
    this._render()
  }

  _computeStatus(id) {
    const now = Date.now()
    const entry = storage.getSRSData()[id]
    if (!entry || entry.attempts === 0) return 'new'
    if (entry.mastered) return 'mastered'
    if (entry.nextDue <= now) return 'overdue'
    return 'upcoming'
  }

  _updateStatusBadge(id) {
    const badge = this.container.querySelector('#odo-status-badge')
    if (!badge) return
    const status = this._computeStatus(String(id).padStart(2, '0'))
    const cfg = SRS_STATUS[status]
    badge.textContent = cfg.label
    badge.className = `odo-status-badge ${cfg.cls}`
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
        <div class="odo-caption-row">
          <p class="odo-caption">Scénario sélectionné : <strong id="odo-result">26</strong></p>
          <span id="odo-status-badge" class="odo-status-badge srs-new">Nouveau</span>
        </div>
        <button id="btn-roll" class="qbtn qbtn-ai" style="font-size:.95rem;padding:12px 28px;gap:10px;">
          <span class="btn-icon">⟳</span>
          <span class="btn-label">Simuler le compteur</span>
        </button>
        <p class="odo-hint">L'examinateur utilise les 2 derniers chiffres du compteur pour choisir le scénario.</p>
      </div>
    `
    this.container.querySelector('#btn-roll').addEventListener('click', () => this.roll())
    // Afficher le statut réel du scénario par défaut (26)
    this._updateStatusBadge(26)
  }

  roll() {
    if (this.spinning) return
    this.spinning = true
    const btn = this.container.querySelector('#btn-roll')
    btn.disabled = true

    const available = SCENARIOS.map(s => s.id)
    const pickedId = available[Math.floor(Math.random() * available.length)]
    const target = parseInt(pickedId, 10)
    const tens = Math.floor(target / 10)
    const units = target % 10

    this._animate(['od4', 'od5'], [tens, units], 800, () => {
      const paddedId = String(target).padStart(2, '0')
      this.container.querySelector('#odo-result').textContent = paddedId
      this._updateStatusBadge(target)
      btn.disabled = false
      this.spinning = false
      this.onRoll?.(paddedId)
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
