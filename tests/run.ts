import assert from 'node:assert/strict';
import { buildAnonymousRecord } from '../src/features/analytics/collector';
import { makeBarcode } from '../src/features/barcode/encode';
import { computeCouponProgress, couponsForStore } from '../src/features/coupons/couponLogic';
import { monthSummary } from '../src/features/history/types';
import { extractProductName } from '../src/features/ocr/nameParser';
import type { Coupon } from '../src/features/coupons/types';
import { extractPriceCandidates, pickConfidentPrice } from '../src/features/ocr/priceParser';
import { parseEuroInput } from '../src/lib/money';
import { initialState, migrate, reducer } from '../src/store/reducer';

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

// --- nome prodotto ---
t('nome: riga in maiuscolo in alto', () => {
  assert.equal(extractProductName(['LATTE INTERO PARMALAT 1L', '€ 1,29', '1,29 €/l']), 'Latte intero parmalat 1L');
});
t('nome: scarta parole da cartellino', () => {
  assert.equal(extractProductName(['OFFERTA', 'Prosciutto cotto', '2,49 €', 'prezzo al kg 20,75']), 'Prosciutto cotto');
});
t('nome: nessun nome leggibile', () => {
  assert.equal(extractProductName(['2,49', '8001234567890']), undefined);
});

// --- codici a barre ---
t('barcode: 13 cifre valide → EAN-13', () => {
  const b = makeBarcode('4006381333931');
  assert.equal(b?.format, 'EAN13');
  assert.equal(b?.modules.length, 95);
});
t('barcode: 12 cifre → EAN-13 con cifra di controllo', () => {
  assert.equal(makeBarcode('400638133393')?.text, '4006381333931');
});
t('barcode: alfanumerico → Code 128', () => {
  const b = makeBarcode('SCONTO5');
  assert.equal(b?.format, 'CODE128');
  assert.ok(b!.modules.startsWith('11010010000')); // start B
});
t('barcode: vuoto → nessun codice', () => assert.equal(makeBarcode('  '), null));

// --- storico ---
t('storico: riepilogo del mese', () => {
  const nov = new Date(2026, 10, 10).getTime();
  const oct = new Date(2026, 9, 10).getTime();
  const base = { items: [], subtotal: 0, couponsUsed: [] };
  const s = monthSummary(
    [
      { ...base, id: 'a', date: nov, store: { type: 'food' }, toPay: 4500, discount: 500 },
      { ...base, id: 'b', date: nov, store: { type: 'nonfood' }, toPay: 2000, discount: 0 },
      { ...base, id: 'c', date: oct, store: { type: 'food' }, toPay: 9999, discount: 0 },
    ],
    2026,
    10,
  );
  assert.deepEqual([s.count, s.spent, s.saved, s.byType.food, s.byType.nonfood], [2, 6500, 500, 4500, 2000]);
});

// --- consenso e statistiche anonime ---
t('statistiche: senza consenso nessun record', () => {
  const s = { id: 'x', date: Date.now(), items: [], subtotal: 0, discount: 0, toPay: 0, couponsUsed: [] };
  assert.equal(buildAnonymousRecord(s, { stats: false, partners: false }, []), null);
});
t('statistiche: insegna scritta a mano non viene inviata', () => {
  const s = {
    id: 'x', date: Date.now(), store: { type: 'food' as const, chain: 'Bottega di Mario' },
    items: [{ id: '1', price: 100, qty: 1, source: 'scan' as const, createdAt: 0, label: 'Pane' }],
    subtotal: 100, discount: 0, toPay: 100, couponsUsed: [],
  };
  const r = buildAnonymousRecord(s, { stats: true, partners: false }, ['Conad']);
  assert.equal(r?.chain, undefined);
  assert.equal(r?.items[0].name, 'Pane');
  assert.equal(r?.shareWithPartners, false);
});

// --- coupon per insegna ---
t('coupon: filtrati per insegna del negozio', () => {
  const list = [cp(1000, 100, 'amount', { chain: 'Conad' }), cp(1000, 200, 'amount', { chain: 'Coop' }), cp(1000, 50)];
  assert.deepEqual(couponsForStore(list, { type: 'food', chain: 'Conad' }).map((c) => c.value), [100, 50]);
  assert.equal(couponsForStore(list, undefined).length, 3);
});

// --- stato dell'app ---
t('migrazione v1 → v2 conserva carrello e buoni', () => {
  const v1 = { schema: 1, items: [{ id: 'i', price: 100, qty: 2, source: 'manual', createdAt: 0 }], coupons: [cp(500, 50)], settings: { stackCoupons: true } };
  const s = migrate(v1);
  assert.equal(s.schema, 2);
  assert.equal(s.items.length, 1);
  assert.equal(s.coupons.length, 1);
  assert.equal(s.settings.stackCoupons, true);
  assert.equal(s.settings.autoScan, true);
  assert.equal(s.onboarded, true);
  assert.deepEqual([s.consent.stats, s.consent.partners], [false, false]);
});
t('concludi spesa: va nello storico con lo sconto e svuota il carrello', () => {
  let s = reducer({ ...initialState, store: { type: 'food', chain: 'Conad' } }, { type: 'coupon/add', coupon: { name: 'B', minSpend: 1000, kind: 'amount', value: 200, active: true, chain: 'Conad' } });
  s = reducer(s, { type: 'item/add', item: { price: 600, qty: 2, source: 'scan', label: 'Pasta' } });
  s = reducer(s, { type: 'session/finish', id: 'sess' });
  assert.equal(s.items.length, 0);
  assert.deepEqual([s.history[0].subtotal, s.history[0].discount, s.history[0].toPay], [1200, 200, 1000]);
  assert.equal(s.analyticsQueue.length, 0); // nessun consenso → nessun record
});
t('consenso: dato e poi revocato svuota la coda', () => {
  let s = reducer(initialState, { type: 'consent/set', patch: { stats: true } });
  s = reducer(s, { type: 'item/add', item: { price: 100, qty: 1, source: 'manual' } });
  s = reducer(s, { type: 'session/finish', id: 'a' });
  assert.equal(s.analyticsQueue.length, 1);
  assert.ok(s.consent.updatedAt && s.consent.policyVersion);
  s = reducer(s, { type: 'consent/set', patch: { stats: false } });
  assert.equal(s.analyticsQueue.length, 0);
});

console.log(`\n${passed} test superati`);
