/**
 * HistoryPanel — affiche l'historique des sessions et les analytics.
 */

const Q_LABELS = { q1: 'VI/VE', q2: 'QSER', q3: 'SEC' }

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function pct(rate) {
  return Math.round(rate * 100)
}

export class HistoryPanel {
  constructor({ container, storage, onBack }) {
    this.container = container
    this.storage   = storage
    this.onBack    = onBack
  }

  show() {
    this._render()
    this.container.classList.remove('hidden')
  }

  hide() {
    this.container.classList.add('hidden')
  }

  _render() {
    const history   = this.storage.getHistory()
    const analytics = this.storage.getAnalytics()

    this.container.innerHTML = `
      <div class="hp-topbar">
        <button class="back-btn" id="hp-back">← Retour</button>
        <span class="hp-title">Historique</span>
        ${history.length ? `<button class="hp-clear-btn" id="hp-clear">Effacer</button>` : ''}
      </div>

      ${analytics ? this._renderAnalytics(analytics) : ''}

      <div class="hp-list">
        ${history.length
          ? [...history].reverse().map(e => this._renderEntry(e)).join('')
          : '<p class="hp-empty">Aucune session enregistrée.</p>'
        }
      </div>
    `

    this.container.querySelector('#hp-back')?.addEventListener('click', () => this.onBack?.())
    this.container.querySelector('#hp-clear')?.addEventListener('click', () => {
      if (confirm('Effacer tout l\'historique ?')) {
        this.storage.resetHistory()
        this._render()
      }
    })
  }

  _renderAnalytics(a) {
    const scoreColor = (rate) => rate >= 0.8 ? 'var(--ok)' : rate >= 0.5 ? 'var(--warn)' : 'var(--ko)'

    const qBars = Object.entries(a.byQuestion).map(([key, q]) => `
      <div class="hp-qbar">
        <span class="hp-qbar-label">${Q_LABELS[key]}</span>
        <div class="hp-bar-track">
          <div class="hp-bar-fill" style="width:${pct(q.rate)}%;background:${scoreColor(q.rate)}"></div>
        </div>
        <span class="hp-qbar-pct" style="color:${scoreColor(q.rate)}">${pct(q.rate)}%</span>
      </div>
    `).join('')

    const trendDots = a.recentTrend.map(t => {
      const h = Math.round((t.total / 3) * 32)
      return `<div class="hp-trend-bar" style="height:${Math.max(h, 4)}px;background:${scoreColor(t.total / 3)}" title="${t.total}/3 — ${formatDate(t.ts)}"></div>`
    }).join('')

    return `
      <div class="hp-analytics">
        <div class="hp-stat-row">
          <div class="hp-stat">
            <span class="hp-stat-val">${a.totalSessions}</span>
            <span class="hp-stat-lbl">Sessions</span>
          </div>
          <div class="hp-stat">
            <span class="hp-stat-val" style="color:${scoreColor(a.globalRate)}">${pct(a.globalRate)}%</span>
            <span class="hp-stat-lbl">Taux global</span>
          </div>
          <div class="hp-stat">
            <span class="hp-stat-val">${Object.keys(a.byScenario).length}</span>
            <span class="hp-stat-lbl">Scénarios vus</span>
          </div>
        </div>

        <div class="hp-section-title">Par type de question</div>
        <div class="hp-qbars">${qBars}</div>

        ${a.recentTrend.length > 1 ? `
          <div class="hp-section-title">10 dernières sessions</div>
          <div class="hp-trend">${trendDots}</div>
        ` : ''}
      </div>
    `
  }

  _renderEntry(e) {
    const scoreColor = e.total === 3 ? 'var(--ok)' : e.total === 0 ? 'var(--ko)' : 'var(--warn)'
    const qIcons = [e.q1, e.q2, e.q3].map((v, i) =>
      `<span class="hp-qicon ${v ? 'hp-qicon-ok' : 'hp-qicon-ko'}" title="${Q_LABELS[`q${i+1}`]}">${v ? '✓' : '✗'}</span>`
    ).join('')

    return `
      <div class="hp-entry">
        <div class="hp-entry-left">
          <span class="hp-entry-id">Scén. ${e.scenarioId}</span>
          <span class="hp-entry-date">${formatDate(e.ts)}</span>
        </div>
        <div class="hp-entry-right">
          <div class="hp-entry-qs">${qIcons}</div>
          <span class="hp-entry-score" style="color:${scoreColor}">${e.total}/3</span>
        </div>
      </div>
    `
  }
}
