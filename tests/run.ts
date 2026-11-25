import assert from 'node:assert/strict';
import { buildAnonymousRecord } from '../src/features/analytics/collector';
import { makeBarcode } from '../src/features/barcode/encode';
import { budgetStatus, budgetWorsened } from '../src/features/budget/budget';
import { guessPrivateLabel } from '../src/features/catalog/privateLabel';
import { guessSegment } from '../src/features/catalog/segments';
import {
  computeCouponProgress,
  couponState,
  couponsForCart,
  couponsForStore,
  describeScope,
  newlyUnlocked,
  sortCoupons,
} from '../src/features/coupons/couponLogic';
import { monthSummary } from '../src/features/history/types';
import { extractProductName } from '../src/features/ocr/nameParser';
import { parseOffersFile, visibleOffers } from '../src/features/offers/feed';
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

// --- etichette del fresco (vaschette pesate) ---
t('vaschetta: prende il da pagare, non peso né €/kg', () => {
  const lines = ['PETTO DI POLLO A FETTE', 'Peso netto kg 0,532', 'Prezzo €/kg 12,90', 'Da pagare € 6,86', 'Confezionato il 24/11/26'];
  const c = extractPriceCandidates(lines);
  assert.equal(c[0].cents, 686);
  assert.equal(pickConfidentPrice(c)?.cents, 686);
  assert.ok(!c.some((x) => x.cents === 53));
});
t('vaschetta: numeri su righe separate', () => {
  const lines = ['MACINATO SCELTO', 'PESO NETTO', '0,450 kg', '€/kg', '9,90', 'PREZZO €', '4,46'];
  const c = extractPriceCandidates(lines);
  assert.equal(c[0].cents, 446);
  assert.ok(c.find((x) => x.cents === 990)?.isUnitPrice);
});
t('vaschetta: peso con 2 decimali non è un prezzo', () => {
  const c = extractPriceCandidates(['Zucchine', 'kg 1,25', 'Importo € 2,49']);
  assert.deepEqual(c.map((x) => x.cents), [249]);
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
const cartOf = (cents: number) => [{ id: 'x', price: cents, qty: 1, source: 'manual' as const, createdAt: 0 }];
t('prossimo traguardo e quanto manca', () => {
  const p = computeCouponProgress([cp(5000, 500), cp(8000, 1000)], cartOf(4380), false);
  assert.equal(p.discount, 0);
  assert.equal(p.next?.missing, 620);
  assert.equal(p.next?.extraSaving, 500);
});
t('applica il migliore se non cumulabili', () => {
  const p = computeCouponProgress([cp(5000, 500), cp(3000, 10, 'percent')], cartOf(6000), false);
  assert.equal(p.discount, 600); // 10% di 60 € = 6 € > 5 €
  assert.equal(p.toPay, 5400);
});
t('somma se cumulabili', () => {
  const p = computeCouponProgress([cp(5000, 500), cp(3000, 200)], cartOf(6000), true);
  assert.equal(p.discount, 700);
});
t('ignora scaduti e disattivi', () => {
  const p = computeCouponProgress(
    [cp(1000, 500, 'amount', { expiresOn: '2020-01-01' }), cp(1000, 300, 'amount', { active: false })],
    cartOf(2000),
    false,
  );
  assert.equal(p.discount, 0);
  assert.equal(p.milestones.length, 0);
});
t('obiettivo senza sconto', () => {
  const p = computeCouponProgress([cp(5000, 0)], cartOf(3000), false);
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

// --- reparti e marca del negozio ---
t('reparto dal nome', () => {
  assert.equal(guessSegment('Petto di pollo a fette'), 'carne');
  assert.equal(guessSegment('Zucchine chiare'), 'fruttaVerdura');
  assert.equal(guessSegment('Mozzarella di bufala'), 'salumiFormaggi');
  assert.equal(guessSegment('Spaghetti n.5'), 'dispensa');
  assert.equal(guessSegment('Detersivo lavatrice'), 'casaIgiene');
  assert.equal(guessSegment('Xyz'), undefined);
});
t('marca del negozio dal nome', () => {
  assert.equal(guessPrivateLabel('Passata Conad 700g', 'Conad'), true);
  assert.equal(guessPrivateLabel('Latte Milbona', undefined), true);
  assert.equal(guessPrivateLabel('Passata Mutti', 'Conad'), undefined);
});

// --- buoni per reparto / marca / data di inizio ---
const item = (price: number, qty: number, extra: object = {}) => ({ id: Math.random().toString(), price, qty, source: 'scan' as const, createdAt: 0, ...extra });
t('buono reparto: conta solo la carne', () => {
  const items = [item(800, 1, { segment: 'carne' }), item(1500, 1, { segment: 'dispensa' })];
  const c = cp(1000, 300, 'amount', { scope: { kind: 'segments', segments: ['carne'] } });
  const p = computeCouponProgress([c], items, false);
  assert.equal(p.scoped[0].base, 800);
  assert.equal(p.scoped[0].missing, 200);
  assert.equal(p.discount, 0);
  const p2 = computeCouponProgress([c], [...items, item(300, 1, { segment: 'carne' })], false);
  assert.equal(p2.discount, 300);
});
t('buono marca del negozio: 20% solo sui prodotti a marchio', () => {
  const items = [item(1000, 1, { privateLabel: true }), item(1000, 1)];
  const p = computeCouponProgress([cp(500, 20, 'percent', { scope: { kind: 'privateLabel' } })], items, false);
  assert.equal(p.discount, 200);
});
t('buono non ancora valido: non conta ma viene ricordato', () => {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const p = computeCouponProgress([cp(100, 50, 'amount', { startsOn: iso })], [item(500, 1)], false);
  assert.equal(p.discount, 0);
  assert.equal(p.upcoming.length, 1);
});
t('descrizione ambito', () => {
  assert.equal(describeScope({ kind: 'segments', segments: ['carne', 'pesce', 'fruttaVerdura'] }), 'Carne, Pesce e Frutta e verdura');
});

// --- stato dell'app ---
t('migrazione v1 → v2 conserva carrello e buoni', () => {
  const v1 = { schema: 1, items: [{ id: 'i', price: 100, qty: 2, source: 'manual', createdAt: 0 }], coupons: [cp(500, 50)], settings: { stackCoupons: true } };
  const s = migrate(v1);
  assert.equal(s.schema, 4);
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

// --- offerte riservate (file online) e Socio fondatore ---
t('offerte: file letto in modo tollerante', () => {
  const file = JSON.parse(require('fs').readFileSync('offers/offerte.json', 'utf8'));
  assert.deepEqual(parseOffersFile(file), []);
  const list = parseOffersFile({
    offers: [
      file._esempio,
      { id: 'rotta', title: 'senza valore' , value: 'abc' },
      { id: 'perc', title: '200%', kind: 'percent', value: 200 },
      { title: 'senza id', value: 100 },
    ],
  });
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].scope, { kind: 'segments', segments: ['carne'] });
  assert.equal(list[0].foundersOnly, true);
});
t('offerte: solo fondatori e non scadute', () => {
  const offers = parseOffersFile({ offers: [
    { id: 'a', title: 'A', value: 100, foundersOnly: true },
    { id: 'b', title: 'B', value: 100, expiresOn: '2020-01-01' },
    { id: 'c', title: 'C', value: 100 },
  ] });
  assert.deepEqual(visibleOffers(offers, false).map((o) => o.id), ['c']);
  assert.deepEqual(visibleOffers(offers, true).map((o) => o.id), ['a', 'c']);
});
t('consenso partner → Socio fondatore, prendi offerta una sola volta', () => {
  let s = reducer(initialState, { type: 'consent/set', patch: { partners: true } });
  assert.ok(s.founderSince);
  const since = s.founderSince;
  s = reducer(s, { type: 'consent/set', patch: { partners: false } });
  s = reducer(s, { type: 'consent/set', patch: { partners: true } });
  assert.equal(s.founderSince, since);
  const [offer] = parseOffersFile({ offers: [{ id: 'x', title: 'X', value: 300, minSpend: 1500, code: 'X3' }] });
  s = reducer(s, { type: 'offer/claim', offer });
  s = reducer(s, { type: 'offer/claim', offer });
  assert.equal(s.coupons.length, 1);
  assert.deepEqual([s.coupons[0].source, s.coupons[0].offerId, s.coupons[0].code], ['partner', 'x', 'X3']);
});
t('migrazione v2 → v3 aggiunge le offerte', () => {
  const s = migrate({ schema: 2, onboarded: true, items: [], coupons: [], history: [], settings: {}, consent: { stats: true, partners: false }, analyticsQueue: [] });
  assert.deepEqual([s.schema, s.offers.length, s.consent.stats, s.onboarded], [4, 0, false, false]);
});

// --- codice pseudonimo, invio e diritti ---
const PID = '3b1f2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
t('codice: nasce col primo consenso e resta lo stesso', () => {
  let s = reducer(initialState, { type: 'consent/set', patch: { stats: true }, newPid: PID });
  assert.equal(s.pid, PID);
  s = reducer(s, { type: 'consent/set', patch: { partners: true }, newPid: 'altro' });
  assert.equal(s.pid, PID);
});
t('codice: nessun consenso → nessun codice', () => {
  const s = reducer(initialState, { type: 'consent/set', patch: { stats: false, partners: false }, newPid: PID });
  assert.equal(s.pid, undefined);
});
t('revoca totale: codice eliminato, cancellazione chiesta al server, coda svuotata', () => {
  let s = reducer(initialState, { type: 'consent/set', patch: { stats: true, partners: true }, newPid: PID });
  s = reducer(s, { type: 'item/add', item: { price: 100, qty: 1, source: 'manual' } });
  s = reducer(s, { type: 'session/finish', id: 'sess-1' });
  assert.equal(s.analyticsQueue[0].rid, 'sess-1');
  s = reducer(s, { type: 'consent/set', patch: { stats: false, partners: false } });
  assert.equal(s.pid, undefined);
  assert.deepEqual(s.pendingOps, [{ type: 'forget', pid: PID }]);
  assert.equal(s.analyticsQueue.length, 0);
  s = reducer(s, { type: 'ops/done', op: { type: 'forget', pid: PID } });
  assert.equal(s.pendingOps.length, 0);
});
t('revoca solo partner: il server toglie le spese dai report partner', () => {
  let s = reducer(initialState, { type: 'consent/set', patch: { stats: true, partners: true }, newPid: PID });
  s = reducer(s, { type: 'consent/set', patch: { partners: false } });
  assert.equal(s.pid, PID);
  assert.deepEqual(s.pendingOps, [{ type: 'partnersOff', pid: PID }]);
});
t('cancella tutti i dati: anche sul server', () => {
  let s = reducer(initialState, { type: 'consent/set', patch: { stats: true }, newPid: PID });
  s = reducer(s, { type: 'data/wipe' });
  assert.equal(s.pid, undefined);
  assert.deepEqual(s.pendingOps, [{ type: 'forget', pid: PID }]);
});
t('invio confermato toglie dalla coda solo le spese ricevute', () => {
  let s = reducer(initialState, { type: 'consent/set', patch: { stats: true }, newPid: PID });
  for (const id of ['a', 'b']) {
    s = reducer(s, { type: 'item/add', item: { price: 100, qty: 1, source: 'manual' } });
    s = reducer(s, { type: 'session/finish', id });
  }
  s = reducer(s, { type: 'analytics/sent', rids: ['a'] });
  assert.deepEqual(s.analyticsQueue.map((r) => r.rid), ['b']);
});
t('migrazione v3 → v4', () => {
  const s = migrate({ schema: 3, onboarded: true, items: [], coupons: [], history: [], settings: {}, consent: { stats: true, partners: true }, analyticsQueue: [{ v: 1 }], offers: [] });
  assert.deepEqual([s.schema, s.pendingOps.length, s.analyticsQueue.length, s.pid], [4, 0, 0, undefined]);
  assert.deepEqual([s.consent.stats, s.consent.partners, s.onboarded], [false, false, false]); // riconferma con nuova informativa
});

// --- limite di spesa ---
t('limite: dentro, vicino, superato', () => {
  assert.equal(budgetStatus(2000, 5000).level, 'ok');
  assert.equal(budgetStatus(2000, 5000).left, 3000);
  assert.equal(budgetStatus(4300, 5000).level, 'near'); // 86%
  assert.equal(budgetStatus(1700, 2000).level, 'near'); // restano 3 € (< 5 €)
  const o = budgetStatus(5250, 5000);
  assert.equal(o.level, 'over');
  assert.equal(o.over, 250);
  assert.equal(o.left, 0);
  assert.equal(o.ratio, 1);
  assert.equal(budgetStatus(5000, 5000).level, 'near'); // esattamente il limite: ancora pagabile
  assert.equal(budgetStatus(0, 300).level, 'ok'); // carrello vuoto: nessun avviso
});
t('limite: avviso solo quando peggiora', () => {
  assert.ok(budgetWorsened('ok', 'near'));
  assert.ok(budgetWorsened('near', 'over'));
  assert.ok(!budgetWorsened('over', 'over'));
  assert.ok(!budgetWorsened('over', 'near'));
});
t('limite salvato nelle impostazioni e tolto', () => {
  let st = reducer(initialState, { type: 'settings/update', patch: { budget: 5000 } });
  assert.equal(st.settings.budget, 5000);
  st = reducer(st, { type: 'settings/update', patch: { budget: undefined } });
  assert.equal(st.settings.budget, undefined);
  assert.equal(migrate(JSON.parse(JSON.stringify(st))).settings.budget, undefined);
});

// --- buoni della spesa in corso ---
const mk = (id: string, extra: Partial<Coupon> = {}): Coupon => ({
  id,
  name: `Buono ${id}`,
  minSpend: 3000,
  kind: 'amount',
  value: 500,
  active: true,
  ...extra,
});
t('buoni scelti per la spesa: «Non oggi» li esclude', () => {
  const list = [mk('a'), mk('b')];
  assert.deepEqual(couponsForCart(list, undefined, ['b']).map((c) => c.id), ['a']);
  let st = { ...initialState, coupons: list, items: [{ id: 'i', price: 3500, qty: 1, createdAt: 0 } as any] };
  st = reducer(st, { type: 'cart/toggleCoupon', id: 'a' });
  assert.deepEqual(st.skipCoupons, ['a']);
  st = reducer(st, { type: 'cart/toggleCoupon', id: 'a' });
  assert.deepEqual(st.skipCoupons, []);
  st = reducer(st, { type: 'cart/toggleCoupon', id: 'b' });
  // escluso b: si applica a
  st = reducer(st, { type: 'session/finish', id: 's1', markUsed: true });
  assert.equal(st.history[0].discount, 500);
  assert.deepEqual(st.history[0].couponsUsed, ['Buono a']);
  const a = st.coupons.find((c) => c.id === 'a')!;
  const b = st.coupons.find((c) => c.id === 'b')!;
  assert.equal(a.active, false);
  assert.ok(a.usedOn);
  assert.equal(b.active, true);
  assert.equal(b.usedOn, undefined);
  assert.deepEqual(st.skipCoupons, []);
});
t('fine spesa senza segnare usato: il buono resta attivo', () => {
  let st = { ...initialState, coupons: [mk('a')], items: [{ id: 'i', price: 3500, qty: 1, createdAt: 0 } as any] };
  st = reducer(st, { type: 'session/finish', id: 's1' });
  assert.equal(st.coupons[0].active, true);
});
t('avviso buono sbloccato una sola volta', () => {
  const a = mk('a');
  const b = mk('b');
  assert.deepEqual(newlyUnlocked([], [a]).map((c) => c.id), ['a']);
  assert.deepEqual(newlyUnlocked(['a'], [a, b]).map((c) => c.id), ['b']);
  assert.equal(newlyUnlocked(['a', 'b'], [a, b]).length, 0);
});
t('lista buoni ordinata per stato e scadenza', () => {
  const today = new Date(2026, 10, 25);
  const list = [
    mk('usato', { active: false, usedOn: '2026-11-20' }),
    mk('scaduto', { expiresOn: '2026-11-01' }),
    mk('spento', { active: false }),
    mk('futuro', { startsOn: '2026-12-01' }),
    mk('lontano', { expiresOn: '2026-12-31' }),
    mk('vicino', { expiresOn: '2026-11-27' }),
  ];
  assert.deepEqual(sortCoupons(list, today).map((c) => c.id), ['vicino', 'lontano', 'futuro', 'spento', 'scaduto', 'usato']);
  assert.equal(couponState(list[0], today), 'used');
  assert.equal(couponState(list[3], today), 'upcoming');
});

console.log(`\n${passed} test superati`);
