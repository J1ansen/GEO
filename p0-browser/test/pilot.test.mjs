import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makePlan, makeRetest, digest } from '../src/plan.mjs';

const bank = JSON.parse(await readFile(new URL('../../repos/Elmo/packages/lib/src/restaurants/geo/easyjoy-bank.json', import.meta.url), 'utf8'));
test('approved pilot preserves bilingual prompts and separates discovery from one-round facts', () => {
  const plan = makePlan({ id: 'pilot-test', kind: 'pilot', bank });
  assert.equal(plan.samples.length, 166);
  assert.equal(new Set(plan.samples.map(s => s.id)).size, 166);
  for (const platform of ['chatgpt', 'gemini']) {
    for (const question of bank.questions) {
      const samples = plan.samples.filter(s => s.platform === platform && s.question.id === question.id);
      assert.equal(samples.length, question.type === 'discovery' ? 10 : 1);
      assert.ok(samples.every(s => s.question.text === question.text));
    }
  }
  assert.equal(plan.samples.filter(s => s.question.language === 'zh').length, 40);
  assert.equal(plan.historical_observations_included, false);
  assert.equal(plan.question_bank.sha256, digest(bank));
});
test('retest freezes prompts and conditions and records baseline hash without reusing results', () => {
  const baseline = makePlan({ id: 'original', kind: 'pilot', bank });
  const next = makeRetest(baseline, { id: 'retest' });
  assert.deepEqual(next.samples, baseline.samples);
  assert.deepEqual(next.conditions, baseline.conditions);
  assert.equal(next.baseline.plan_sha256, digest(baseline));
  next.samples[0].question.text = 'changed';
  assert.notEqual(next.samples[0].question.text, baseline.samples[0].question.text);
  assert.throws(() => makeRetest({ ...baseline, mode: 'fixture' }, { id: 'bad' }));
});
