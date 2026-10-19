import { describe, expect, it } from 'vitest';
import { apis } from './catalog';
import { analyzeRecipe, recipes, starterCode } from './recipes';

describe('recipes', () => {
  it('only reference APIs that exist in the catalog', () => {
    const ids = new Set(apis.map((a) => a.id));
    for (const r of recipes) for (const m of r.apis) expect(ids.has(m.id)).toBe(true);
  });
  it('have unique ids and at least two APIs', () => {
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
    expect(recipes.every((r) => r.apis.length >= 2)).toBe(true);
  });
  it('never calls a total complete when a member cannot be estimated', () => {
    const a = analyzeRecipe(recipes.find((r) => r.id === 'weather-dashboard')!, apis, 10_000);
    expect(a.complete).toBe(false);
    expect(a.unknown.length).toBeGreaterThan(0);
  });
  it('reports the hardest auth and commercial risk', () => {
    const a = analyzeRecipe(recipes.find((r) => r.id === 'no-key-quiz')!, apis, 1000);
    expect(a.hardestAuth).toBe('none');
    expect(a.commercialRisk).toBe('unchecked');
    const w = analyzeRecipe(recipes.find((r) => r.id === 'weather-dashboard')!, apis, 1000);
    expect(w.commercialRisk).toBe('restricted-or-forbidden');
  });
  it('reports missing ids instead of hiding them', () => {
    const a = analyzeRecipe({ id: 'x', name: 'x', summary: '', notes: '', apis: [{ id: 'nope', role: '' }] }, apis, 1);
    expect(a.missingIds).toEqual(['nope']);
    expect(a.complete).toBe(false);
  });
  it('generates starter code with every API', () => {
    const a = analyzeRecipe(recipes[0]!, apis, 1);
    expect(starterCode(a.members, 'javascript')).toMatch(/open-meteo/);
    expect(starterCode(a.members, 'python')).toMatch(/import requests/);
  });
});
