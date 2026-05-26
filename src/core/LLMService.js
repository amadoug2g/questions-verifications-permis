/**
 * LLMService — abstraction pour les appels LLM.
 *
 * Providers disponibles :
 *   'cloudflare' → appelle /api/evaluate sur le Worker (Workers AI, 100% gratuit)
 *   'anthropic'  → appelle l'API Anthropic directement (clé requise)
 *   'openai'     → appelle l'API OpenAI directement (clé requise)
 *
 * Si aucun provider n'est disponible → mode mock automatique (démo).
 */

// ─── Réponses simulées pour le mode démo ──────────────────────────────────

const MOCK_POOL = {
  correct: [
    "Bonne réponse ! Vous avez bien identifié les éléments essentiels. Continuez à pratiquer pour ancrer ces automatismes.",
    "Réponse complète et précise. Votre connaissance du véhicule est solide sur ce point.",
    "Excellent — vous maîtrisez ce point de vérification. N'oubliez pas de l'appliquer systématiquement.",
  ],
  partial: [
    "Vous êtes sur la bonne voie, mais la réponse officielle comporte quelques détails supplémentaires. Relisez l'explication.",
    "Bonne direction. Il manque quelques éléments précis pour une réponse complète à l'examen.",
    "Le principal y est, mais l'examinateur attend plus de précision sur la procédure exacte.",
  ],
  incorrect: [
    "La réponse s'écarte de ce qui est attendu. Le point essentiel est détaillé dans l'explication ci-dessous.",
    "À retravailler. Relisez l'explication pédagogique pour mémoriser la bonne procédure.",
    "Cette réponse ne correspond pas à la procédure officielle — consultez l'explication pour comprendre pourquoi.",
  ],
}

const DIRECT_PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-haiku-4-5-20251001',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
}

export class LLMService {
  /**
   * @param {Object} opts
   * @param {string}  [opts.provider='cloudflare']  'cloudflare' | 'anthropic' | 'openai'
   * @param {string}  [opts.apiKey]                 Clé API (uniquement pour anthropic/openai)
   * @param {string}  [opts.model]                  Modèle override
   * @param {boolean} [opts.mock=false]              Force le mode démo
   */
  constructor({ provider = 'cloudflare', apiKey, model, mock = false } = {}) {
    this.provider = provider
    this.apiKey = apiKey
    this.model = model || DIRECT_PROVIDERS[provider]?.defaultModel
    // mock si forcé, ou si provider direct sans clé
    this.mock = mock || (provider !== 'cloudflare' && !apiKey)
  }

  /** Évalue la réponse d'un candidat pour une question donnée. */
  async evaluate({ question, officialAnswer, userAnswer, context = '', requiredCount = null }) {
    const raw = await this._complete({ question, officialAnswer, userAnswer, context, requiredCount })
    return parseEvalResponse(raw)
  }

  /** Génère une explication pédagogique approfondie. */
  async explain({ question, officialAnswer, topic }) {
    const prompt = buildExplainPrompt({ question, officialAnswer, topic })
    const raw = await this._completeRaw(prompt)
    return raw.trim()
  }

  /** Délègue au bon provider. */
  async _complete(evalParams) {
    if (this.mock) return this._callMock()
    if (this.provider === 'cloudflare') return this._callCloudflare(evalParams)
    // Providers directs : construire le prompt texte
    const prompt = buildEvalPrompt(evalParams)
    return this._completeRaw(prompt)
  }

  /** Appel texte générique (pour anthropic/openai). */
  async _completeRaw(userMessage) {
    if (this.mock) return this._callMock()
    if (this.provider === 'anthropic') return this._callAnthropic(userMessage)
    if (this.provider === 'openai') return this._callOpenAI(userMessage)
    throw new Error(`Provider inconnu : ${this.provider}`)
  }

  // ── Provider Cloudflare Workers AI (via /api/evaluate) ──────────────────

  async _callCloudflare({ question, officialAnswer, userAnswer, context = '', requiredCount = null }) {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, officialAnswer, userAnswer, context, requiredCount }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || `Erreur Worker ${res.status}`)
    }
    const data = await res.json()
    return data.text || ''
  }

  // ── Mode démo ───────────────────────────────────────────────────────────

  async _callMock() {
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 900))
    const r = Math.random()
    let category, score
    if (r < 0.45)      { category = 'correct';   score = 1 }
    else if (r < 0.75) { category = 'partial';   score = 0 }
    else               { category = 'incorrect'; score = 0 }
    const pool = MOCK_POOL[category]
    const comment = pool[Math.floor(Math.random() * pool.length)]
    const label = category === 'correct' ? 'Correct' : category === 'partial' ? 'Partiel' : 'Incorrect'
    return JSON.stringify({ score, label, comment, demo: true })
  }

  // ── Provider Anthropic ──────────────────────────────────────────────────

  async _callAnthropic(userMessage) {
    const res = await fetch(DIRECT_PROVIDERS.anthropic.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 512,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Erreur API ${res.status}`)
    }
    const data = await res.json()
    return data.content?.[0]?.text || ''
  }

  // ── Provider OpenAI ─────────────────────────────────────────────────────

  async _callOpenAI(userMessage) {
    const res = await fetch(DIRECT_PROVIDERS.openai.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 512,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Erreur API ${res.status}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }
}

// ─── Constructeurs de prompts ──────────────────────────────────────────────

function buildEvalPrompt({ question, officialAnswer, userAnswer, context, requiredCount = null }) {
  const countRule = requiredCount
    ? `\nCONSIGNE DE QUANTITÉ : La question demande exactement ${requiredCount} élément(s). ` +
      `Si le candidat en fournit ${requiredCount} qui sont corrects (même parmi plusieurs possibles), ` +
      `c'est score 1 "Correct". Ne jamais pénaliser pour ne pas avoir listé les autres options.\n`
    : ''

  return `Évalue si la réponse du candidat couvre les points essentiels de la réponse officielle au permis de conduire français.

Question :
"${question}"

Réponse officielle :
"${officialAnswer}"
${context ? `\nContexte : ${context}\n` : ''}${countRule}
Réponse du candidat :
"${userAnswer}"

RÈGLES :
1. Ignore orthographe, style et ordre — seul le fond compte.
2. label "Correct" (score 1) : tous les éléments essentiels sont présents.
3. label "Partiel" (score 0) : certains éléments essentiels présents, d'autres manquent.
4. label "Incorrect" (score 0) : réponse fausse ou hors-sujet.

RÈGLE ABSOLUE : si label = "Correct", le comment doit être affirmatif SANS "mais", "cependant" ni suggestion de compléter. Si tu ressens le besoin d'ajouter un "mais", utilise "Partiel" à la place.

Réponds UNIQUEMENT en JSON valide, sans texte autour :
{"score": 1, "label": "Correct", "comment": "Bonne réponse — [confirmation courte du point clé]."}
ou
{"score": 0, "label": "Partiel", "comment": "Il manque [élément précis]. La réponse complète inclut aussi [complément]."}
ou
{"score": 0, "label": "Incorrect", "comment": "La réponse attendue est : [point clé]. [Explication courte pourquoi c'est important.]"}`
}

function buildExplainPrompt({ question, officialAnswer, topic }) {
  return `Tu es un moniteur d'auto-école pédagogue. Explique de façon claire et mémorable pourquoi la réponse à cette question de permis de conduire est importante dans la vraie vie.

Question : "${question}"
Réponse officielle : "${officialAnswer}"
Thème : ${topic}

En 3-4 phrases maximum : explique le pourquoi concret, avec une analogie ou un chiffre si pertinent. Pas de jargon. Tutoies l'utilisateur.`
}

// ─── Parseur de réponse ────────────────────────────────────────────────────

export function parseEvalResponse(raw) {
  // Guard: 70B model may return null/undefined/object instead of string
  const str = typeof raw === 'string' ? raw : (raw == null ? '' : JSON.stringify(raw))
  try {
    const match = str.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Pas de JSON trouvé')
    const parsed = JSON.parse(match[0])
    return {
      score:   Number(parsed.score) === 1 ? 1 : 0,
      label:   parsed.label   || 'Incorrect',
      comment: parsed.comment || '',
      demo:    !!parsed.demo,
    }
  } catch {
    const lower = str.toLowerCase()
    const isOk = lower.includes('correct') && !lower.includes('incorrect')
    return {
      score:   isOk ? 1 : 0,
      label:   isOk ? 'Correct' : 'Incorrect',
      comment: str.slice(0, 200),
    }
  }
}
