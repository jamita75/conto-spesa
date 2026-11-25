import assert from 'node:assert/strict';
import { computeCouponProgress } from '../src/features/coupons/couponLogic';
import type { Coupon } from '../src/features/coupons/types';
import { extractPriceCandidates, pickConfidentPrice } from '../src/features/ocr/priceParser';
import { parseEuroInput } from '../src/lib/money';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log('✓', name);
};

// --- parser prezzi etichette ---
t('etichetta semplice', () => {
  const c = extractPriceCandidates(['LATTE INTERO 1L', '€ 1,29', '1,29 €/l']);
  assert.equal(c[0].cents, 129);
});
t('prezzo al kg non preselezionato', () => {
  const c = extractPriceCandidates(['Prosciutto cotto 120g', '2,49 €', '20,75 €/kg']);
  assert.equal(c[0].cents, 249);
  assert.ok(c.find((x) => x.cents === 2075)?.isUnitPrice);
});
t('prezzo barrato vs offerta', () => {
  const c = extractPriceCandidates(['prima 3,49', 'OFFERTA', '2,49€']);
  assert.equal(c[0].cents, 249);
});
t('ignora date e percentuali', () => {
  const c = extractPriceCandidates(['valido fino al 12.05.26', '-30%', '4,99']);
  assert.deepEqual(c.map((x) => x.cents), [499]);
});
t('euro grandi e centesimi piccoli separati', () => {
  const c = extractPriceCandidates(['PASTA', '1 99']);
  assert.equal(c[0].cents, 199);
});
t('punto decimale', () => {
  assert.equal(extractPriceCandidates(['EUR 12.50'])[0].cents, 1250);
});

// --- modalità automatica ---
t('auto: etichetta chiara → prezzo sicuro', () => {
  const c = extractPriceCandidates(['Prosciutto cotto 120g', '2,49 €', '20,75 €/kg']);
  assert.equal(pickConfidentPrice(c)?.cents, 249);
});
t('auto: due prezzi simili → chiede conferma', () => {
  const c = extractPriceCandidates(['3,49 €', '2,49 €']);
  assert.equal(pickConfidentPrice(c), null);
});
t('auto: numero senza € → chiede conferma', () => {
  assert.equal(pickConfidentPrice(extractPriceCandidates(['cod 12,30 lotto'])), null);
});

// --- input utente ---
t('input euro', () => {
  assert.equal(parseEuroInput('12,5'), 1250);
  assert.equal(parseEuroInput('€ 3'), 300);
  assert.equal(parseEuroInput('abc'), null);
});

// --- coupon ---
const cp = (minSpend: number, value: number, kind: 'amount' | 'percent' = 'amount', extra: Partial<Coupon> = {}): Coupon => ({
  id: `${minSpend}-${value}`, name: `c${minSpend}`, minSpend, value, kind, active: true, ...extra,
});
t('prossimo traguardo e quanto manca', () => {
  const p = computeCouponProgress([cp(5000, 500), cp(8000, 1000)], 4380, false);
  assert.equal(p.discount, 0);
  assert.equal(p.next?.missing, 620);
  assert.equal(p.next?.extraSaving, 500);
});
t('applica il migliore se non cumulabili', () => {
  const p = computeCouponProgress([cp(5000, 500), cp(3000, 10, 'percent')], 6000, false);
  assert.equal(p.discount, 600); // 10% di 60 € = 6 € > 5 €
  assert.equal(p.toPay, 5400);
});
t('somma se cumulabili', () => {
  const p = computeCouponProgress([cp(5000, 500), cp(3000, 200)], 6000, true);
  assert.equal(p.discount, 700);
});
t('ignora scaduti e disattivi', () => {
  const p = computeCouponProgress(
    [cp(1000, 500, 'amount', { expiresOn: '2020-01-01' }), cp(1000, 300, 'amount', { active: false })],
    2000,
    false,
  );
  assert.equal(p.discount, 0);
  assert.equal(p.milestones.length, 0);
});
t('obiettivo senza sconto', () => {
  const p = computeCouponProgress([cp(5000, 0)], 3000, false);
  assert.equal(p.next?.missing, 2000);
  assert.equal(p.discount, 0);
});

console.log(`\n${passed} test superati`);
