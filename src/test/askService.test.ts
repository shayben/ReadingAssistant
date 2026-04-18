import { describe, it, expect } from 'vitest';
import { heuristicIntent } from '../services/askService';

describe('heuristicIntent', () => {
  it('returns unknown for empty input', () => {
    const r = heuristicIntent('', 'he');
    expect(r.intent).toBe('unknown');
    expect(r.word).toBe('');
  });

  it('treats a single English word as a spell request', () => {
    const r = heuristicIntent('elephant', 'he');
    expect(r.intent).toBe('spell');
    expect(r.word).toBe('elephant');
    expect(r.sourceLang).toBe('en');
    expect(r.targetLang).toBe('en');
  });

  it('treats a single Hebrew word as a spell request in the account language', () => {
    const r = heuristicIntent('פיל', 'he');
    expect(r.intent).toBe('spell');
    expect(r.word).toBe('פיל');
    expect(r.sourceLang).toBe('he');
    expect(r.targetLang).toBe('he');
  });

  it('multi-token English request → translate to account language', () => {
    const r = heuristicIntent('how do you spell elephant', 'he');
    expect(r.intent).toBe('translate');
    expect(r.sourceLang).toBe('en');
    expect(r.targetLang).toBe('he');
    // longest token "elephant" wins
    expect(r.word).toBe('elephant');
  });

  it('multi-token account-language request → translate to English', () => {
    const r = heuristicIntent('איך אומרים פילון באנגלית', 'he');
    expect(r.intent).toBe('translate');
    expect(r.sourceLang).toBe('he');
    expect(r.targetLang).toBe('en');
  });

  it('strips punctuation from the extracted word', () => {
    const r = heuristicIntent('elephant.', 'es');
    expect(r.word).toBe('elephant');
  });
});
