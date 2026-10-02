import { describe, expect, it } from 'vitest';
import { createHistory, commitHistory } from '../src/studio/documentHistory';
import { planningFingerprint } from '../src/studio/planningFingerprint';
import { CARGO_SCENARIOS, SPACE_PRESETS } from '../src/studio/presets';
import { parseDocument, type StudioDocument } from '../src/studio/projects';

function sample(): StudioDocument {
  return { name: 'City delivery / load plan', space: { ...SPACE_PRESETS[0] }, items: CARGO_SCENARIOS[0].items.map(item => ({ ...item })), strategy: 'max-fill' };
}

describe('planning freshness across editor and storage origins', () => {
  it('keeps a restored draft current when an identical sample load is an editor no-op', () => {
    const preset = sample();
    const restored = parseDocument(JSON.parse(JSON.stringify(preset)));
    expect(JSON.stringify(restored.items)).not.toBe(JSON.stringify(preset.items));
    const history = createHistory(restored);
    expect(commitHistory(history, { document: preset, projectId: undefined })).toBe(history);
    expect(planningFingerprint(history.present)).toBe(planningFingerprint(preset));
  });

  it('allows renaming the project while keeping the same plan, but detects cargo and space label edits', () => {
    const original = sample();
    const renamed = sample(); renamed.name = 'New report title';
    expect(planningFingerprint(renamed)).toBe(planningFingerprint(original));
    renamed.items[0].name = 'Different carton label';
    expect(planningFingerprint(renamed)).not.toBe(planningFingerprint(original));
    const spaceLabel = sample(); spaceLabel.space.name = 'Different transport label';
    expect(planningFingerprint(spaceLabel)).not.toBe(planningFingerprint(original));
  });

  it('invalidates the plan for changed geometry, handling, color, item order or strategy', () => {
    const original = planningFingerprint(sample());
    const changes: Array<(document: StudioDocument) => void> = [
      document => { document.space.reservedDepthCm += 1; },
      document => { document.items[0].weightKg += 1; },
      document => { document.items[0].quantity += 1; },
      document => { document.items[0].keepUpright = !document.items[0].keepUpright; },
      document => { document.items[0].maxTopLoadKg += 1; },
      document => { document.items[0].color = '#ffffff'; },
      document => { document.items.reverse(); },
      document => { document.strategy = 'balanced'; },
    ];
    for (const change of changes) { const document = sample(); change(document); expect(planningFingerprint(document)).not.toBe(original); }
  });

  it('retains incomplete editor inputs without coercing distinct invalid numbers to null', () => {
    const fingerprints = [NaN, Infinity, -Infinity, 0].map(weight => { const document = sample(); document.name = ''; document.items[0].weightKg = weight; return planningFingerprint(document); });
    expect(new Set(fingerprints).size).toBe(4);
  });
});
