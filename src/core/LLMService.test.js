import { describe, it, expect } from 'vitest'
import { parseEvalResponse } from './LLMService.js'

describe('parseEvalResponse', () => {
  it('JSON valide Correct → score 1', () => {
    const r = parseEvalResponse('{"score":1,"label":"Correct","comment":"Bonne réponse"}')
    expect(r.score).toBe(1)
    expect(r.label).toBe('Correct')
    expect(r.comment).toBe('Bonne réponse')
    expect(r.demo).toBe(false)
  })

  it('JSON valide Partiel → score 0', () => {
    const r = parseEvalResponse('{"score":0,"label":"Partiel","comment":"Il manque X"}')
    expect(r.score).toBe(0)
    expect(r.label).toBe('Partiel')
  })

  it('JSON valide Incorrect → score 0', () => {
    const r = parseEvalResponse('{"score":0,"label":"Incorrect","comment":"Faux"}')
    expect(r.score).toBe(0)
    expect(r.label).toBe('Incorrect')
  })

  it('JSON enveloppé dans du texte → extrait le JSON', () => {
    const r = parseEvalResponse('Voici ma réponse : {"score":1,"label":"Correct","comment":"OK"}')
    expect(r.score).toBe(1)
    expect(r.label).toBe('Correct')
  })

  it('null (bug 70B) → ne throw pas, retourne Incorrect', () => {
    expect(() => parseEvalResponse(null)).not.toThrow()
    const r = parseEvalResponse(null)
    expect(r.score).toBe(0)
    expect(r.label).toBe('Incorrect')
  })

  it('undefined → ne throw pas, retourne Incorrect', () => {
    expect(() => parseEvalResponse(undefined)).not.toThrow()
    const r = parseEvalResponse(undefined)
    expect(r.score).toBe(0)
  })

  it('objet (bug 70B) → ne throw pas', () => {
    expect(() => parseEvalResponse({ response: 'test' })).not.toThrow()
  })

  it('string vide → ne throw pas, retourne Incorrect', () => {
    expect(() => parseEvalResponse('')).not.toThrow()
    const r = parseEvalResponse('')
    expect(r.score).toBe(0)
  })

  it('demo:true propagé', () => {
    const r = parseEvalResponse('{"score":1,"label":"Correct","comment":"OK","demo":true}')
    expect(r.demo).toBe(true)
  })

  it('fallback texte "correct" → score 1', () => {
    const r = parseEvalResponse('La réponse est correct')
    expect(r.score).toBe(1)
  })

  it('fallback texte "incorrect" → score 0', () => {
    const r = parseEvalResponse('La réponse est incorrect')
    expect(r.score).toBe(0)
  })
})
