/**
 * LLMService — abstraction pour les appels API LLM.
 * Supporte Anthropic (défaut) et OpenAI.
 * Pour ajouter un fournisseur : implémenter une nouvelle méthode _call<Provider>().
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

const PROVIDERS = {
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
  constructor({ provider = 'anthropic', apiKey, model, mock = false } = {}) {
    this.provider = provider
    this.apiKey = apiKey
    this.model = model || PROVIDERS[provider]?.defaultModel
    this.mock = mock || !apiKey
  }

  /** Évalue la réponse d'un candidat pour une question donnée. */
  async evaluate({ question, officialAnswer, userAnswer, context = '' }) {
    const prompt = buildEvalPrompt({ question, officialAnswer, userAnswer, context })
    const raw = await this._complete(prompt)
    return parseEvalResponse(raw)
  }

  /** Génère une explication pédagogique approfondie. */
  async explain({ question, officialAnswer, topic }) {
    const prompt = buildExplainPrompt({ question, officialAnswer, topic })
    const raw = await this._complete(prompt)
    return raw.trim()
  }

  /** Appel générique — délègue au bon fournisseur (ou au mock). */
  async _complete(userMessage) {
    if (this.mock) return this._callMock()
    if (this.provider === 'anthropic') return this._callAnthropic(userMessage)
    if (this.provider === 'openai') return this._callOpenAI(userMessage)
    throw new Error(`Fournisseur inconnu : ${this.provider}`)
  }

  /** Mode démo : simule un délai de réflexion et retourne un feedback réaliste. */
  async _callMock() {
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 900))
    const r = Math.random()
    let category, score
    if (r < 0.45)      { category = 'correct';   score = 1 }
    else if (r < 0.75) { category = 'partial';   score = 1 }
    else               { category = 'incorrect'; score = 0 }
    const pool = MOCK_POOL[category]
    const comment = pool[Math.floor(Math.random() * pool.length)]
    const label = category === 'correct' ? 'Correct' : category === 'partial' ? 'Partiel' : 'Incorrect'
    return JSON.stringify({ score, label, comment, demo: true })
  }

  async _callAnthropic(userMessage) {
    const res = await fetch(PROVIDERS.anthropic.url, {
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

  async _callOpenAI(userMessage) {
    const res = await fetch(PROVIDERS.openai.url, {
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

function buildEvalPrompt({ question, officialAnswer, userAnswer, context }) {
  return `Tu es un examinateur bienveillant du permis de conduire français.

Question posée au candidat :
"${question}"

Réponse officielle attendue :
"${officialAnswer}"

${context ? `Contexte pédagogique : ${context}\n` : ''}
Réponse du candidat :
"${userAnswer}"

Évalue si la réponse du candidat est correcte.
Réponds UNIQUEMENT en JSON valide, sans texte autour :
{
  "score": 1 ou 0,
  "label": "Correct" | "Partiel" | "Incorrect",
  "comment": "feedback court et pédagogique (1-2 phrases max)"
}

Sois indulgent sur la formulation si le fond est juste. Score 1 = réponse correcte ou partiellement correcte.`
}

function buildExplainPrompt({ question, officialAnswer, topic }) {
  return `Tu es un moniteur d'auto-école pédagogue. Explique de façon claire et mémorable pourquoi la réponse à cette question de permis de conduire est importante dans la vraie vie.

Question : "${question}"
Réponse officielle : "${officialAnswer}"
Thème : ${topic}

En 3-4 phrases maximum : explique le pourquoi concret, avec une analogie ou un chiffre si pertinent. Pas de jargon. Tutoies l'utilisateur.`
}

// ─── Parseur de réponse ────────────────────────────────────────────────────

function parseEvalResponse(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Pas de JSON trouvé')
    const parsed = JSON.parse(match[0])
    return {
      score: Number(parsed.score) === 1 ? 1 : 0,
      label: parsed.label || 'Incorrect',
      comment: parsed.comment || '',
      demo: !!parsed.demo,
    }
  } catch {
    // Fallback si le LLM ne renvoie pas du JSON propre
    const lower = raw.toLowerCase()
    const isOk = lower.includes('correct') && !lower.includes('incorrect')
    return {
      score: isOk ? 1 : 0,
      label: isOk ? 'Correct' : 'Incorrect',
      comment: raw.slice(0, 200),
    }
  }
}
