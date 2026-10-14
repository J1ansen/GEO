import { createHash } from 'node:crypto';

export const platforms = ['chatgpt', 'gemini'];
export const questions = [
  { id: 'discover-budget', type: 'discovery', location: 'Chinatown, Manhattan, New York', text: 'Which restaurants in Chinatown, Manhattan, New York are good for a casual dinner for two under $40 per person before tax and tip? Compare a few options.' },
  { id: 'discover-family', type: 'discovery', location: 'Chinatown, Manhattan, New York', text: 'Where can a family of four eat dim sum in Chinatown, Manhattan, New York this weekend? Suggest a few restaurants and explain why they fit.' },
  { id: 'discover-hotpot', type: 'discovery', location: 'Lower Manhattan, New York', text: 'What are some all-you-can-eat hot pot restaurants in Lower Manhattan, New York? Compare typical prices and reservation options.' },
  { id: 'verify-hours', type: 'brand_verification', location: 'Chinatown, Manhattan, New York', text: 'What are the current opening hours and street address of Easy Joy in Chinatown, Manhattan, New York?' },
  { id: 'verify-menu', type: 'brand_verification', location: 'Chinatown, Manhattan, New York', text: 'What menu prices and reservation options does Easy Joy in Chinatown, Manhattan, New York currently offer?' },
];

export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function safeId(value) {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value ?? '')) throw new Error('标识只能包含小写字母、数字、短横线和下划线，最长 80 字符。');
  return value;
}
export function dateInZone(value = new Date(), zone = 'America/New_York') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
}
export function makePlan({ id, kind = 'p0', mode = 'live', now = new Date(), bank }) {
  safeId(id);
  if (!['p0', 'probe', 'pilot'].includes(kind) || !['live', 'fixture'].includes(mode)) throw new Error('非法计划类型。');
  if (kind === 'pilot') {
    if (bank?.schema_version !== 'geo.question-bank.v1' || bank.questions?.length !== 11 ||
      bank.questions.filter(q => q.type === 'discovery').length !== 8 ||
      bank.questions.filter(q => q.type === 'brand_verification').length !== 3 ||
      new Set(bank.questions.map(q => q.id)).size !== 11 ||
      bank.questions.some(q => !q.text?.trim() || q.text.length > 5000 || !['en', 'zh'].includes(q.language))) throw new Error('试点需要已审核的 8 道发现题及 3 道事实核验题。');
    for (const q of bank.questions) safeId(q.id);
  }
  const selected = kind === 'pilot' ? bank.questions : kind === 'p0' ? questions : [questions[0], questions[4]];
  const samples = [];
  for (let day = 1; day <= (kind === 'probe' ? 1 : 2); day++) {
    for (let repeat = 1; repeat <= (kind === 'pilot' ? 5 : kind === 'p0' ? 2 : 1); repeat++) {
      for (const question of selected) {
        if (kind === 'pilot' && question.type === 'brand_verification' && (day !== 1 || repeat !== 1)) continue;
        for (const platform of platforms) samples.push({ id: `d${day}-${platform}-${question.id}-r${repeat}`, day, repeat, platform, question });
      }
    }
  }
  return {
    schema_version: 'geo.p0.v1', id, kind, mode, created_at: now.toISOString(),
    store: { id: 'easy-joy-nyc', name: 'Easy Joy / 意中人', identity_status: 'awaiting_merchant_confirmation' },
    ...(kind === 'pilot' ? { question_bank: { id: bank.id, sha256: digest(bank), source: bank.source }, analysis_groups: { discovery: 160, brand_verification: 6 }, historical_observations_included: false } : {}),
    conditions: { account_tier: 'free', interaction: 'default_chat', new_conversation: true, force_search: false, prohibit_platform_auto_search: false, language: kind === 'pilot' ? 'per_question' : 'en', location_method: 'explicit_prompt_place', actual_network_location: 'unverified', calendar_timezone: 'America/New_York', display_timezone: 'Asia/Shanghai', requested_model: 'product_default', custom_instructions: 'disabled_by_account_setup', memory: 'disabled_by_account_setup' },
    limits: { external_service_usd: 20, max_submitted_attempts_per_sample: 2, answer_timeout_ms: 180000, stable_answer_ms: 8000, poll_ms: 500, interval_ms: 15000 },
    acceptance: { minimum_success_rate_per_platform: 0.9, real_accounts_required: true, two_distinct_dates_required: kind !== 'probe' },
    samples,
  };
}

export function makeRetest(baseline, { id, now = new Date() }) {
  safeId(id);
  if (baseline.id === id || baseline.kind !== 'pilot' || baseline.mode !== 'live') throw new Error('复测需要真实试点基线及新的批次标识。');
  return { ...structuredClone(baseline), id, created_at: now.toISOString(), baseline: { id: baseline.id, plan_sha256: digest(baseline) } };
}
