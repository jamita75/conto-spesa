<?php
/**
 * Conto Spesa – Analisi dettagliata (pagina di amministrazione).
 *
 * Filtri: periodo (preset o date), insegna, tipo di negozio, reparto, marca del negozio,
 * solo utenti che condividono con i partner, raggruppamento per settimana o mese.
 * Ogni sezione è una funzione che restituisce colonne + righe: la stessa funzione
 * disegna la tabella e produce il CSV.
 *
 * Solo per il titolare (manage_options). I report per i partner restano quelli aggregati
 * della pagina principale (minimo CS_K_MIN utenti per riga).
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action(
	'admin_menu',
	function () {
		add_submenu_page('conto-spesa', 'Analisi dettagliata', 'Analisi dettagliata', 'manage_options', 'conto-spesa-analisi', 'cs_an_page');
	},
	20
);

/* ----------------------------- filtri ----------------------------- */

function cs_an_date($v) {
	$v = is_string($v) ? trim($v) : '';
	return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && strtotime($v) ? $v : '';
}

function cs_an_params($src = null) {
	$g     = null === $src ? wp_unslash($_GET) : $src;
	$days  = isset($g['giorni']) ? (int) $g['giorni'] : 90;
	$days  = in_array($days, array(7, 30, 90, 365, 730), true) ? $days : 90;
	$dal   = cs_an_date($g['dal'] ?? '');
	$al    = cs_an_date($g['al'] ?? '');
	$from  = $dal ? $dal : gmdate('Y-m-d', strtotime("-$days days"));
	$to    = $al ? $al : gmdate('Y-m-d');
	if ($from > $to) {
		list($from, $to) = array($to, $from);
	}
	$tipo    = in_array($g['tipo'] ?? '', array('food', 'nonfood'), true) ? $g['tipo'] : '';
	$reparto = (isset($g['reparto']) && array_key_exists($g['reparto'], CS_SEGMENTS)) ? $g['reparto'] : '';
	$marca   = in_array($g['marca'] ?? '', array('pl', 'brand'), true) ? $g['marca'] : '';
	$gruppo  = ($g['gruppo'] ?? '') === 'mese' ? 'mese' : 'settimana';
	return array(
		'giorni'  => $days,
		'dal'     => $dal,
		'al'      => $al,
		'from'    => $from,
		'to'      => $to,
		'insegna' => isset($g['insegna']) ? substr(sanitize_text_field($g['insegna']), 0, 60) : '',
		'tipo'    => $tipo,
		'reparto' => $reparto,
		'marca'   => $marca,
		'partner' => !empty($g['partner']) ? 1 : 0,
		'gruppo'  => $gruppo,
		'q'       => isset($g['q']) ? substr(sanitize_text_field($g['q']), 0, 40) : '',
	);
}

/** condizioni sulle spese (alias r) */
function cs_an_rw($p) {
	$t    = cs_tables();
	$sql  = 'r.day BETWEEN %s AND %s';
	$args = array($p['from'], $p['to']);
	if ('(non indicata)' === $p['insegna']) {
		$sql .= ' AND r.chain IS NULL';
	} elseif ('' !== $p['insegna']) {
		$sql   .= ' AND r.chain = %s';
		$args[] = $p['insegna'];
	}
	if ($p['tipo']) {
		$sql   .= ' AND r.store_type = %s';
		$args[] = $p['tipo'];
	}
	if ($p['partner']) {
		$sql .= ' AND r.share_partners = 1';
	}
	if ($p['reparto']) {
		$sql   .= " AND EXISTS (SELECT 1 FROM {$t['items']} i2 WHERE i2.record_id = r.id AND i2.segment = %s)";
		$args[] = $p['reparto'];
	}
	return array($sql, $args);
}

/** condizioni sui prodotti (alias i, unito a r) */
function cs_an_iw($p) {
	list($sql, $args) = cs_an_rw($p);
	if ($p['reparto']) {
		$sql   .= ' AND i.segment = %s';
		$args[] = $p['reparto'];
	}
	if ('pl' === $p['marca']) {
		$sql .= ' AND i.private_label = 1';
	} elseif ('brand' === $p['marca']) {
		$sql .= ' AND i.private_label = 0';
	}
	return array($sql, $args);
}

function cs_an_q($sql, $args) {
	global $wpdb;
	return $wpdb->prepare($sql, $args);
}

function cs_an_seg_name($s) {
	return array_key_exists($s, CS_SEGMENTS) ? CS_SEGMENTS[ $s ] : ('altro' === $s ? 'Altro / non indicato' : $s);
}

function cs_an_div($a, $b) {
	return $b > 0 ? $a / $b : null;
}

/* ----------------------------- sezioni ----------------------------- */
/* Ogni sezione: array(title, note, cols => [[nome, tipo]], rows => [[...]], bar => indice colonna) */
/* tipi: txt, int, eur (centesimi), pct (0..1), num */

function cs_an_sections() {
	return array(
		'kpi'       => 'cs_an_kpi',
		'andamento' => 'cs_an_trend',
		'fasce'     => 'cs_an_bands',
		'buoni'     => 'cs_an_coupons',
		'giorni'    => 'cs_an_weekdays',
		'insegne'   => 'cs_an_chains',
		'reparti'   => 'cs_an_segments',
		'matrice'   => 'cs_an_matrix',
		'frequenza' => 'cs_an_frequency',
		'coorti'    => 'cs_an_cohorts',
		'prodotti'  => 'cs_an_products',
		'prezzi'    => 'cs_an_prices',
	);
}

function cs_an_kpi($p) {
	global $wpdb;
	$t = cs_tables();
	list($rw, $ra) = cs_an_rw($p);
	list($iw, $ia) = cs_an_iw($p);
	$k  = $wpdb->get_row(cs_an_q(
		"SELECT COUNT(*) spese, COUNT(DISTINCT r.pid) utenti, COALESCE(SUM(r.total),0) totale, COALESCE(SUM(r.discount),0) sconto,
		        COALESCE(SUM(r.coupons_used > 0),0) con_buono, COUNT(DISTINCT r.day) giorni
		 FROM {$t['records']} r WHERE $rw",
		$ra
	));
	$it = $wpdb->get_row(cs_an_q(
		"SELECT COUNT(*) righe, COALESCE(SUM(i.qty),0) pezzi, COALESCE(SUM(i.price*i.qty),0) valore,
		        COALESCE(SUM(CASE WHEN i.private_label=1 THEN i.price*i.qty ELSE 0 END),0) pl, COALESCE(SUM(i.scanned),0) letti
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id WHERE $iw",
		$ia
	));
	$nuovi = (int) $wpdb->get_var(cs_an_q(
		"SELECT COUNT(*) FROM (SELECT r.pid FROM {$t['records']} r WHERE $rw GROUP BY r.pid) a
		 JOIN (SELECT pid, MIN(day) d0 FROM {$t['records']} GROUP BY pid) f ON f.pid = a.pid WHERE f.d0 >= %s",
		array_merge($ra, array($p['from']))
	));
	$spese = (int) $k->spese;
	$mesi  = max(1, (strtotime($p['to']) - strtotime($p['from'])) / 86400 / 30);
	return array(
		'title' => 'Numeri chiave',
		'cols'  => array(array('Indicatore', 'txt'), array('Valore', 'txt')),
		'rows'  => array(
			array('Utenti attivi', number_format_i18n((int) $k->utenti)),
			array('Nuovi utenti (prima spesa nel periodo)', number_format_i18n($nuovi)),
			array('Spese registrate', number_format_i18n($spese)),
			array('Spesa totale', cs_eur($k->totale)),
			array('Scontrino medio', $spese ? cs_eur($k->totale / $spese) : '—'),
			array('Spese per utente al mese', $k->utenti ? number_format_i18n($spese / $k->utenti / $mesi, 1) : '—'),
			array('Prodotti per spesa (pezzi)', $spese ? number_format_i18n($it->pezzi / $spese, 1) : '—'),
			array('Prezzo medio di un pezzo', $it->pezzi ? cs_eur($it->valore / $it->pezzi) : '—'),
			array('Spese con almeno un buono', cs_pct((int) $k->con_buono, $spese)),
			array('Risparmio totale con i buoni', cs_eur($k->sconto)),
			array('Quota marca del negozio (sul valore)', cs_pct((int) $it->pl, (int) $it->valore)),
			array('Prodotti letti con la fotocamera', cs_pct((int) $it->letti, (int) $it->righe)),
		),
	);
}

function cs_an_trend($p) {
	global $wpdb;
	$t   = cs_tables();
	$grp = 'mese' === $p['gruppo'] ? "DATE_FORMAT(r.day, '%%Y-%%m')" : 'DATE_SUB(r.day, INTERVAL WEEKDAY(r.day) DAY)';
	list($rw, $ra) = cs_an_rw($p);
	list($iw, $ia) = cs_an_iw($p);
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT $grp per, COUNT(*) n, COUNT(DISTINCT r.pid) u, SUM(r.total) v, SUM(r.discount) d, SUM(r.coupons_used > 0) b
		 FROM {$t['records']} r WHERE $rw GROUP BY per ORDER BY per",
		$ra
	));
	$pl = $wpdb->get_results(cs_an_q(
		"SELECT $grp per, SUM(i.price*i.qty) v, SUM(CASE WHEN i.private_label=1 THEN i.price*i.qty ELSE 0 END) pl
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id WHERE $iw GROUP BY per",
		$ia
	), OBJECT_K);
	$out = array();
	foreach ($rows as $r) {
		$label = 'mese' === $p['gruppo'] ? $r->per : 'sett. ' . date_i18n('j M Y', strtotime($r->per));
		$x     = isset($pl[ $r->per ]) ? $pl[ $r->per ] : null;
		$out[] = array($label, (int) $r->n, (int) $r->u, (int) $r->v, cs_an_div($r->v, $r->n), (int) $r->d, cs_an_div($r->b, $r->n), $x ? cs_an_div($x->pl, $x->v) : null);
	}
	return array(
		'title' => 'Andamento per ' . $p['gruppo'],
		'cols'  => array(array('Periodo', 'txt'), array('Spese', 'int'), array('Utenti', 'int'), array('Spesa', 'eur'), array('Scontrino medio', 'eur'), array('Sconto buoni', 'eur'), array('Spese con buono', 'pct'), array('Quota marca negozio', 'pct')),
		'rows'  => $out,
		'bar'   => 3,
	);
}

function cs_an_bands($p) {
	global $wpdb;
	$t = cs_tables();
	list($rw, $ra) = cs_an_rw($p);
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT CASE WHEN r.total < 2000 THEN 'meno di 20 €' WHEN r.total < 5000 THEN '20–50 €' WHEN r.total < 10000 THEN '50–100 €'
		             WHEN r.total < 15000 THEN '100–150 €' ELSE 'oltre 150 €' END f,
		        MIN(r.total) o, COUNT(*) n, COUNT(DISTINCT r.pid) u, SUM(r.total) v, SUM(r.coupons_used > 0) b
		 FROM {$t['records']} r WHERE $rw GROUP BY f ORDER BY o",
		$ra
	));
	$tot = array_sum(array_map(function ($r) { return (int) $r->n; }, $rows));
	$out = array();
	foreach ($rows as $r) {
		$out[] = array($r->f, (int) $r->n, cs_an_div($r->n, $tot), (int) $r->u, (int) $r->v, cs_an_div($r->b, $r->n));
	}
	return array(
		'title' => 'Fasce di scontrino',
		'cols'  => array(array('Fascia', 'txt'), array('Spese', 'int'), array('% spese', 'pct'), array('Utenti', 'int'), array('Spesa', 'eur'), array('Con buono', 'pct')),
		'rows'  => $out,
		'bar'   => 1,
	);
}

function cs_an_coupons($p) {
	global $wpdb;
	$t = cs_tables();
	list($rw, $ra) = cs_an_rw($p);
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT LEAST(r.coupons_used, 3) c, COUNT(*) n, COUNT(DISTINCT r.pid) u, AVG(r.total) m, SUM(r.discount) d
		 FROM {$t['records']} r WHERE $rw GROUP BY c ORDER BY c",
		$ra
	));
	$names = array(0 => 'Senza buoni', 1 => '1 buono', 2 => '2 buoni', 3 => '3 o più buoni');
	$out   = array();
	foreach ($rows as $r) {
		$out[] = array($names[ (int) $r->c ], (int) $r->n, (int) $r->u, (float) $r->m, (int) $r->d, cs_an_div($r->d, $r->n));
	}
	return array(
		'title' => 'Buoni sconto',
		'note'  => 'Confronta lo scontrino medio di chi usa i buoni con chi non li usa.',
		'cols'  => array(array('Spese', 'txt'), array('Numero', 'int'), array('Utenti', 'int'), array('Scontrino medio', 'eur'), array('Sconto totale', 'eur'), array('Sconto medio', 'eur')),
		'rows'  => $out,
		'bar'   => 1,
	);
}

function cs_an_weekdays($p) {
	global $wpdb;
	$t = cs_tables();
	list($rw, $ra) = cs_an_rw($p);
	$rows  = $wpdb->get_results(cs_an_q(
		"SELECT r.weekday w, COUNT(*) n, COUNT(DISTINCT r.pid) u, AVG(r.total) m, SUM(r.coupons_used > 0) b
		 FROM {$t['records']} r WHERE $rw GROUP BY w",
		$ra
	), OBJECT_K);
	$names = array('Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato');
	$out   = array();
	foreach (array(1, 2, 3, 4, 5, 6, 0) as $d) {
		$r     = isset($rows[ $d ]) ? $rows[ $d ] : null;
		$out[] = array($names[ $d ], $r ? (int) $r->n : 0, $r ? (int) $r->u : 0, $r ? (float) $r->m : null, $r ? cs_an_div($r->b, $r->n) : null);
	}
	return array(
		'title' => 'Giorni della settimana',
		'cols'  => array(array('Giorno', 'txt'), array('Spese', 'int'), array('Utenti', 'int'), array('Scontrino medio', 'eur'), array('Con buono', 'pct')),
		'rows'  => $out,
		'bar'   => 1,
	);
}

function cs_an_chains($p) {
	global $wpdb;
	$t = cs_tables();
	list($rw, $ra) = cs_an_rw($p);
	list($iw, $ia) = cs_an_iw($p);
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT COALESCE(r.chain,'(non indicata)') c, MAX(r.store_type) ty, COUNT(*) n, COUNT(DISTINCT r.pid) u, SUM(r.total) v, SUM(r.discount) d, SUM(r.coupons_used > 0) b
		 FROM {$t['records']} r WHERE $rw GROUP BY c ORDER BY v DESC LIMIT 50",
		$ra
	));
	$pl = $wpdb->get_results(cs_an_q(
		"SELECT COALESCE(r.chain,'(non indicata)') c, SUM(i.price*i.qty) v, SUM(CASE WHEN i.private_label=1 THEN i.price*i.qty ELSE 0 END) pl
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id WHERE $iw GROUP BY c",
		$ia
	), OBJECT_K);
	$tot = array_sum(array_map(function ($r) { return (int) $r->v; }, $rows));
	$out = array();
	foreach ($rows as $r) {
		$x     = isset($pl[ $r->c ]) ? $pl[ $r->c ] : null;
		$out[] = array($r->c, 'nonfood' === $r->ty ? 'non alimentare' : ('food' === $r->ty ? 'alimentare' : ''), (int) $r->n, (int) $r->u, (int) $r->v, cs_an_div($r->v, $tot), cs_an_div($r->v, $r->n), cs_an_div($r->b, $r->n), $x ? cs_an_div($x->pl, $x->v) : null);
	}
	return array(
		'title' => 'Insegne',
		'cols'  => array(array('Insegna', 'txt'), array('Tipo', 'txt'), array('Spese', 'int'), array('Utenti', 'int'), array('Spesa', 'eur'), array('Quota spesa', 'pct'), array('Scontrino medio', 'eur'), array('Con buono', 'pct'), array('Marca negozio', 'pct')),
		'rows'  => $out,
		'bar'   => 4,
	);
}

function cs_an_segments($p) {
	global $wpdb;
	$t = cs_tables();
	list($iw, $ia) = cs_an_iw($p);
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT COALESCE(i.segment,'altro') s, COUNT(DISTINCT r.pid) u, COUNT(DISTINCT r.id) n, SUM(i.qty) q, SUM(i.price*i.qty) v,
		        SUM(CASE WHEN i.private_label=1 THEN i.price*i.qty ELSE 0 END) pl
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id WHERE $iw GROUP BY s ORDER BY v DESC",
		$ia
	));
	$tot = array_sum(array_map(function ($r) { return (int) $r->v; }, $rows));
	$out = array();
	foreach ($rows as $r) {
		$out[] = array(cs_an_seg_name($r->s), (int) $r->v, cs_an_div($r->v, $tot), (int) $r->n, (int) $r->u, (int) $r->q, cs_an_div($r->v, $r->q), cs_an_div($r->pl, $r->v));
	}
	return array(
		'title' => 'Reparti',
		'cols'  => array(array('Reparto', 'txt'), array('Spesa', 'eur'), array('Quota', 'pct'), array('Spese', 'int'), array('Utenti', 'int'), array('Pezzi', 'int'), array('Prezzo medio pezzo', 'eur'), array('Marca negozio', 'pct')),
		'rows'  => $out,
		'bar'   => 1,
	);
}

function cs_an_matrix($p) {
	global $wpdb;
	$t = cs_tables();
	list($iw, $ia) = cs_an_iw($p);
	$rows   = $wpdb->get_results(cs_an_q(
		"SELECT COALESCE(i.segment,'altro') s, COALESCE(r.chain,'(non indicata)') c, SUM(i.price*i.qty) v
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id WHERE $iw GROUP BY s, c",
		$ia
	));
	$chainT = array();
	$segT   = array();
	$cell   = array();
	foreach ($rows as $r) {
		$chainT[ $r->c ]          = ($chainT[ $r->c ] ?? 0) + (int) $r->v;
		$segT[ $r->s ]            = ($segT[ $r->s ] ?? 0) + (int) $r->v;
		$cell[ $r->s ][ $r->c ] = (int) $r->v;
	}
	arsort($chainT);
	arsort($segT);
	$chains = array_slice(array_keys($chainT), 0, 8);
	$cols   = array(array('Reparto', 'txt'));
	foreach ($chains as $c) {
		$cols[] = array($c, 'pct');
	}
	$cols[] = array('Tutte', 'pct');
	$all    = array_sum($chainT);
	$out    = array();
	foreach (array_keys($segT) as $s) {
		$row = array(cs_an_seg_name($s));
		foreach ($chains as $c) {
			$row[] = cs_an_div($cell[ $s ][ $c ] ?? 0, $chainT[ $c ]);
		}
		$row[] = cs_an_div($segT[ $s ], $all);
		$out[] = $row;
	}
	return array(
		'title' => 'Reparti × insegne',
		'note'  => 'Quanto pesa ogni reparto nel carrello di ciascuna insegna (percentuale della spesa di quella insegna). Prime 8 insegne per spesa.',
		'cols'  => $cols,
		'rows'  => $out,
		'heat'  => true,
	);
}

function cs_an_frequency($p) {
	global $wpdb;
	$t = cs_tables();
	list($rw, $ra) = cs_an_rw($p);
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT CASE WHEN n = 1 THEN '1 spesa' WHEN n <= 3 THEN '2–3 spese' WHEN n <= 9 THEN '4–9 spese' ELSE '10 o più' END f,
		        MIN(n) o, COUNT(*) u, SUM(n) sp, SUM(v) v, AVG(ch) ch
		 FROM (SELECT r.pid, COUNT(*) n, SUM(r.total) v, COUNT(DISTINCT COALESCE(r.chain,'-')) ch FROM {$t['records']} r WHERE $rw GROUP BY r.pid) x
		 GROUP BY f ORDER BY o",
		$ra
	));
	$tu  = array_sum(array_map(function ($r) { return (int) $r->u; }, $rows));
	$tv  = array_sum(array_map(function ($r) { return (int) $r->v; }, $rows));
	$out = array();
	foreach ($rows as $r) {
		$out[] = array($r->f, (int) $r->u, cs_an_div($r->u, $tu), (int) $r->sp, (int) $r->v, cs_an_div($r->v, $tv), (float) $r->ch);
	}
	return array(
		'title' => 'Frequenza e fedeltà',
		'note'  => 'Utenti divisi per numero di spese nel periodo. «Insegne usate» = media delle insegne diverse frequentate.',
		'cols'  => array(array('Utenti con', 'txt'), array('Utenti', 'int'), array('% utenti', 'pct'), array('Spese', 'int'), array('Spesa', 'eur'), array('% spesa', 'pct'), array('Insegne usate', 'num')),
		'rows'  => $out,
		'bar'   => 1,
	);
}

function cs_an_cohorts($p) {
	global $wpdb;
	$t    = cs_tables();
	$part = $p['partner'] ? ' AND r.share_partners = 1' : '';
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT f.m0 coorte, PERIOD_DIFF(DATE_FORMAT(r.day, '%%Y%%m'), DATE_FORMAT(f.d0, '%%Y%%m')) k, COUNT(DISTINCT r.pid) u
		 FROM {$t['records']} r
		 JOIN (SELECT pid, MIN(day) d0, DATE_FORMAT(MIN(day), '%%Y-%%m') m0 FROM {$t['records']} GROUP BY pid) f ON f.pid = r.pid
		 WHERE f.d0 BETWEEN %s AND %s $part
		 GROUP BY coorte, k ORDER BY coorte, k",
		array($p['from'], $p['to'])
	));
	$c = array();
	foreach ($rows as $r) {
		$c[ $r->coorte ][ (int) $r->k ] = (int) $r->u;
	}
	$cols = array(array('Primo mese', 'txt'), array('Nuovi utenti', 'int'));
	for ($m = 1; $m <= 6; $m++) {
		$cols[] = array("Mese +$m", 'pct');
	}
	$out = array();
	foreach ($c as $coorte => $ks) {
		$base = $ks[0] ?? 0;
		$row  = array($coorte, $base);
		for ($m = 1; $m <= 6; $m++) {
			$row[] = isset($ks[ $m ]) ? cs_an_div($ks[ $m ], $base) : null;
		}
		$out[] = $row;
	}
	return array(
		'title' => 'Utenti che tornano (coorti)',
		'note'  => 'Per chi ha fatto la prima spesa in un mese: percentuale che fa almeno una spesa nei mesi successivi. Usa solo il periodo e il filtro partner.',
		'cols'  => $cols,
		'rows'  => $out,
		'heat'  => true,
	);
}

function cs_an_products($p) {
	global $wpdb;
	$t = cs_tables();
	list($iw, $ia) = cs_an_iw($p);
	if ('' !== $p['q']) {
		$iw   .= ' AND i.name LIKE %s';
		$ia[] = '%' . $wpdb->esc_like($p['q']) . '%';
	}
	$ia[] = CS_K_MIN;
	$rows = $wpdb->get_results(cs_an_q(
		"SELECT i.name n, MAX(i.segment) s, COUNT(DISTINCT r.pid) u, COUNT(DISTINCT r.id) sp, SUM(i.qty) q, ROUND(AVG(i.price)) m,
		        MIN(i.price) mn, MAX(i.price) mx, COUNT(DISTINCT r.chain) ch, AVG(i.private_label) pl
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id
		 WHERE $iw AND i.name IS NOT NULL GROUP BY i.name HAVING u >= %d ORDER BY u DESC, q DESC LIMIT 100",
		$ia
	));
	$out = array();
	foreach ($rows as $r) {
		$out[] = array($r->n, cs_an_seg_name($r->s ? $r->s : 'altro'), (int) $r->u, (int) $r->sp, (int) $r->q, (int) $r->m, (int) $r->mn, (int) $r->mx, (int) $r->ch, (float) $r->pl);
	}
	return array(
		'title' => 'Prodotti',
		'note'  => 'Nomi letti dai cartellini, raggruppati così come sono scritti. Solo prodotti comprati da almeno ' . (int) CS_K_MIN . ' utenti diversi.',
		'cols'  => array(array('Prodotto', 'txt'), array('Reparto', 'txt'), array('Utenti', 'int'), array('Spese', 'int'), array('Pezzi', 'int'), array('Prezzo medio', 'eur'), array('Min', 'eur'), array('Max', 'eur'), array('Insegne', 'int'), array('Marca negozio', 'pct')),
		'rows'  => $out,
		'bar'   => 2,
	);
}

function cs_an_prices($p) {
	global $wpdb;
	$t = cs_tables();
	if ('' === $p['q']) {
		return array(
			'title' => 'Prezzo nel tempo e per insegna',
			'note'  => 'Scrivi un prodotto nel campo «Prodotto» dei filtri (es. «latte») per vedere come cambia il suo prezzo per mese e per insegna.',
			'cols'  => array(),
			'rows'  => array(),
		);
	}
	list($iw, $ia) = cs_an_iw($p);
	$iw   .= ' AND i.name LIKE %s';
	$ia[]  = '%' . $wpdb->esc_like($p['q']) . '%';
	$ia[]  = CS_K_MIN;
	$rows  = $wpdb->get_results(cs_an_q(
		"SELECT DATE_FORMAT(r.day, '%%Y-%%m') m, COALESCE(r.chain,'(non indicata)') c, ROUND(AVG(i.price)) pr, MIN(i.price) mn, MAX(i.price) mx, COUNT(DISTINCT r.pid) u, SUM(i.qty) q
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id
		 WHERE $iw GROUP BY m, c HAVING u >= %d ORDER BY m, pr",
		$ia
	));
	$all = $wpdb->get_results(cs_an_q(
		"SELECT DATE_FORMAT(r.day, '%%Y-%%m') m, 'Tutte le insegne' c, ROUND(AVG(i.price)) pr, MIN(i.price) mn, MAX(i.price) mx, COUNT(DISTINCT r.pid) u, SUM(i.qty) q
		 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id
		 WHERE $iw GROUP BY m HAVING u >= %d ORDER BY m",
		$ia
	));
	$out = array();
	foreach (array_merge($all, $rows) as $r) {
		$out[] = array($r->m, $r->c, (int) $r->pr, (int) $r->mn, (int) $r->mx, (int) $r->u, (int) $r->q);
	}
	usort($out, function ($a, $b) { return strcmp($a[0], $b[0]) ?: ('Tutte le insegne' === $a[1] ? -1 : ('Tutte le insegne' === $b[1] ? 1 : $a[2] - $b[2])); });
	return array(
		'title' => 'Prezzo di «' . $p['q'] . '» nel tempo e per insegna',
		'note'  => 'Righe con almeno ' . (int) CS_K_MIN . ' utenti diversi.',
		'cols'  => array(array('Mese', 'txt'), array('Insegna', 'txt'), array('Prezzo medio', 'eur'), array('Min', 'eur'), array('Max', 'eur'), array('Utenti', 'int'), array('Pezzi', 'int')),
		'rows'  => $out,
		'bar'   => 2,
	);
}

/* ----------------------------- disegno ----------------------------- */

function cs_an_cell($v, $type) {
	if (null === $v || '' === $v) {
		return '—';
	}
	switch ($type) {
		case 'int':
			return number_format_i18n((int) $v);
		case 'eur':
			return cs_eur($v);
		case 'pct':
			return number_format_i18n(100 * $v, 1) . '%';
		case 'num':
			return number_format_i18n((float) $v, 1);
		default:
			return (string) $v;
	}
}

function cs_an_table($key, $s, $p) {
	echo '<div class="cs-sec" id="' . esc_attr($key) . '"><h2>' . esc_html($s['title']) . '</h2>';
	if (!empty($s['note'])) {
		echo '<p class="cs-note">' . esc_html($s['note']) . '</p>';
	}
	if (!$s['cols']) {
		echo '</div>';
		return;
	}
	if (!$s['rows']) {
		echo '<p class="cs-note">Nessun dato con questi filtri.</p></div>';
		return;
	}
	$bar = $s['bar'] ?? null;
	$max = 0;
	if (null !== $bar) {
		foreach ($s['rows'] as $r) {
			$max = max($max, (float) $r[ $bar ]);
		}
	}
	echo '<div class="cs-scroll"><table class="widefat striped cs-t"><thead><tr>';
	foreach ($s['cols'] as $c) {
		echo '<th>' . esc_html($c[0]) . '</th>';
	}
	if (null !== $bar) {
		echo '<th></th>';
	}
	echo '</tr></thead><tbody>';
	foreach ($s['rows'] as $r) {
		echo '<tr>';
		foreach ($s['cols'] as $i => $c) {
			$style = '';
			if (!empty($s['heat']) && 'pct' === $c[1] && null !== $r[ $i ]) {
				$a     = min(1, max(0, (float) $r[ $i ])) * 0.85 + 0.05;
				$style = ' style="background:rgba(30,142,90,' . number_format($a, 2, '.', '') . ');' . ($a > 0.5 ? 'color:#fff' : '') . '"';
			}
			$cls = 'txt' === $c[1] ? '' : ' class="num"';
			echo '<td' . $cls . $style . '>' . esc_html(cs_an_cell($r[ $i ], $c[1])) . '</td>';
		}
		if (null !== $bar) {
			echo '<td style="width:180px">' . cs_bar((float) $r[ $bar ], $max) . '</td>';
		}
		echo '</tr>';
	}
	echo '</tbody></table></div>';
	$csv = wp_nonce_url(add_query_arg(array_merge(cs_an_query_args($p), array('action' => 'cs_an_csv', 'sezione' => $key)), admin_url('admin-post.php')), 'cs_an_csv');
	echo '<p><a class="button" href="' . esc_url($csv) . '">Scarica CSV</a></p></div>';
}

function cs_an_query_args($p) {
	$a = array();
	foreach (array('giorni', 'dal', 'al', 'insegna', 'tipo', 'reparto', 'marca', 'partner', 'gruppo', 'q') as $k) {
		if ('' !== $p[ $k ] && 0 !== $p[ $k ]) {
			$a[ $k ] = $p[ $k ];
		}
	}
	return $a;
}

function cs_an_select($name, $value, $options) {
	echo '<select name="' . esc_attr($name) . '">';
	foreach ($options as $k => $label) {
		echo '<option value="' . esc_attr($k) . '"' . selected((string) $value, (string) $k, false) . '>' . esc_html($label) . '</option>';
	}
	echo '</select>';
}

function cs_an_page() {
	if (!current_user_can('manage_options')) {
		return;
	}
	global $wpdb;
	$t = cs_tables();
	$p = cs_an_params();

	$chains = $wpdb->get_col("SELECT DISTINCT COALESCE(chain,'(non indicata)') FROM {$t['records']} ORDER BY 1");
	$chopts = array('' => 'Tutte le insegne');
	foreach ($chains as $c) {
		$chopts[ $c ] = $c;
	}
	$segopts = array('' => 'Tutti i reparti') + CS_SEGMENTS;

	echo '<div class="wrap"><h1>📊 Conto Spesa – Analisi dettagliata</h1>';
	echo '<style>
		.cs-filtri{background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:end;margin:12px 0}
		.cs-filtri label{display:flex;flex-direction:column;font-size:12px;color:#646970;gap:3px}
		.cs-nav{position:sticky;top:32px;z-index:5;background:#f0f0f1;padding:6px 0;margin-bottom:6px}
		.cs-nav a{display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;border-radius:12px;background:#fff;border:1px solid #dcdcde;text-decoration:none}
		.cs-sec{margin:22px 0}
		.cs-note{color:#646970;margin:4px 0 8px}
		.cs-scroll{overflow-x:auto;max-width:100%}
		.cs-t{width:auto;min-width:560px}
		.cs-t td.num,.cs-t th{white-space:nowrap}
		.cs-t td.num{text-align:right;font-variant-numeric:tabular-nums}
	</style>';

	// filtri
	echo '<form method="get" class="cs-filtri"><input type="hidden" name="page" value="conto-spesa-analisi">';
	echo '<label>Periodo';
	cs_an_select('giorni', $p['giorni'], array(7 => 'Ultimi 7 giorni', 30 => 'Ultimi 30 giorni', 90 => 'Ultimi 90 giorni', 365 => 'Ultimi 12 mesi', 730 => 'Ultimi 24 mesi'));
	echo '</label>';
	echo '<label>Oppure dal <input type="date" name="dal" value="' . esc_attr($p['dal']) . '"></label>';
	echo '<label>al <input type="date" name="al" value="' . esc_attr($p['al']) . '"></label>';
	echo '<label>Insegna';
	cs_an_select('insegna', $p['insegna'], $chopts);
	echo '</label><label>Tipo di negozio';
	cs_an_select('tipo', $p['tipo'], array('' => 'Tutti', 'food' => 'Alimentare', 'nonfood' => 'Non alimentare'));
	echo '</label><label>Reparto';
	cs_an_select('reparto', $p['reparto'], $segopts);
	echo '</label><label>Marca';
	cs_an_select('marca', $p['marca'], array('' => 'Tutte', 'pl' => 'Solo marca del negozio', 'brand' => 'Solo altre marche'));
	echo '</label><label>Andamento per';
	cs_an_select('gruppo', $p['gruppo'], array('settimana' => 'Settimana', 'mese' => 'Mese'));
	echo '</label><label>Prodotto <input type="search" name="q" value="' . esc_attr($p['q']) . '" placeholder="es. latte"></label>';
	echo '<label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" name="partner" value="1"' . checked($p['partner'], 1, false) . '> Solo chi condivide con i partner</label>';
	echo '<button class="button button-primary">Applica</button> <a class="button" href="' . esc_url(admin_url('admin.php?page=conto-spesa-analisi')) . '">Azzera</a>';
	echo '</form>';
	echo '<p class="cs-note">Dal <strong>' . esc_html(date_i18n('j M Y', strtotime($p['from']))) . '</strong> al <strong>' . esc_html(date_i18n('j M Y', strtotime($p['to']))) . '</strong>. Il filtro reparto conta le spese che contengono quel reparto; nei dati sui prodotti conta solo quel reparto.</p>';

	$sections = cs_an_sections();
	$titles   = array('kpi' => 'Numeri', 'andamento' => 'Andamento', 'fasce' => 'Scontrini', 'buoni' => 'Buoni', 'giorni' => 'Giorni', 'insegne' => 'Insegne', 'reparti' => 'Reparti', 'matrice' => 'Reparti × insegne', 'frequenza' => 'Frequenza', 'coorti' => 'Ritorno', 'prodotti' => 'Prodotti', 'prezzi' => 'Prezzi');
	echo '<div class="cs-nav">';
	foreach ($titles as $k => $label) {
		echo '<a href="#' . esc_attr($k) . '">' . esc_html($label) . '</a>';
	}
	echo '</div>';

	foreach ($sections as $key => $fn) {
		cs_an_table($key, call_user_func($fn, $p), $p);
	}

	$raw = wp_nonce_url(add_query_arg(array_merge(cs_an_query_args($p), array('action' => 'cs_an_raw')), admin_url('admin-post.php')), 'cs_an_raw');
	echo '<div class="cs-sec"><h2>Dati per analisi in Excel</h2><p class="cs-note">Una riga per prodotto con i dati della sua spesa (giorno, insegna, totale, buoni), con i filtri attuali. <strong>Senza il codice dell\'utente</strong>: solo per uso interno, non va dato ai partner.</p>';
	echo '<p><a class="button button-primary" href="' . esc_url($raw) . '">Scarica righe prodotto (CSV)</a></p></div>';
	echo '</div>';
}

/* ----------------------------- CSV ----------------------------- */

function cs_an_csv_start($name) {
	nocache_headers();
	header('Content-Type: text/csv; charset=utf-8');
	header('Content-Disposition: attachment; filename="' . $name . '-' . gmdate('Y-m-d') . '.csv"');
	$out = fopen('php://output', 'w');
	fwrite($out, "\xEF\xBB\xBF");
	return $out;
}

function cs_an_csv_value($v, $type) {
	if (null === $v) {
		return '';
	}
	switch ($type) {
		case 'eur':
			return number_format(((float) $v) / 100, 2, ',', '');
		case 'pct':
			return number_format(100 * (float) $v, 1, ',', '');
		case 'num':
			return number_format((float) $v, 2, ',', '');
		default:
			return $v;
	}
}

add_action(
	'admin_post_cs_an_csv',
	function () {
		if (!current_user_can('manage_options') || !check_admin_referer('cs_an_csv')) {
			wp_die('Non autorizzato');
		}
		$p        = cs_an_params();
		$sections = cs_an_sections();
		$key      = isset($_GET['sezione']) ? sanitize_key(wp_unslash($_GET['sezione'])) : '';
		if (!isset($sections[ $key ])) {
			wp_die('Sezione sconosciuta');
		}
		$s   = call_user_func($sections[ $key ], $p);
		$out = cs_an_csv_start('conto-spesa-' . $key);
		fputcsv($out, array_map(function ($c) { return $c[0] . ('eur' === $c[1] ? ' €' : ('pct' === $c[1] ? ' %' : '')); }, $s['cols']), ';');
		foreach ($s['rows'] as $r) {
			$line = array();
			foreach ($s['cols'] as $i => $c) {
				$line[] = cs_an_csv_value($r[ $i ], $c[1]);
			}
			fputcsv($out, $line, ';');
		}
		fclose($out);
		exit;
	}
);

add_action(
	'admin_post_cs_an_raw',
	function () {
		if (!current_user_can('manage_options') || !check_admin_referer('cs_an_raw')) {
			wp_die('Non autorizzato');
		}
		global $wpdb;
		$t = cs_tables();
		$p = cs_an_params();
		list($iw, $ia) = cs_an_iw($p);
		$rows = $wpdb->get_results(cs_an_q(
			"SELECT r.id spesa, r.day, r.weekday, r.store_type, r.chain, r.total, r.discount, r.coupons_used, r.share_partners,
			        i.name, i.segment, i.private_label, i.price, i.qty, i.scanned
			 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id WHERE $iw ORDER BY r.day, r.id LIMIT 100000",
			$ia
		), ARRAY_A);
		$days = array('dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab');
		$out  = cs_an_csv_start('conto-spesa-righe');
		fputcsv($out, array('Spesa n.', 'Giorno', 'Giorno sett.', 'Tipo negozio', 'Insegna', 'Totale spesa €', 'Sconto €', 'Buoni usati', 'Condivide con partner', 'Prodotto', 'Reparto', 'Marca negozio', 'Prezzo €', 'Quantità', 'Letto con fotocamera'), ';');
		foreach ($rows as $r) {
			fputcsv(
				$out,
				array(
					$r['spesa'],
					$r['day'],
					$days[ (int) $r['weekday'] ] ?? '',
					'nonfood' === $r['store_type'] ? 'non alimentare' : ('food' === $r['store_type'] ? 'alimentare' : ''),
					$r['chain'],
					number_format($r['total'] / 100, 2, ',', ''),
					number_format($r['discount'] / 100, 2, ',', ''),
					$r['coupons_used'],
					$r['share_partners'] ? 'sì' : 'no',
					$r['name'],
					$r['segment'] ? cs_an_seg_name($r['segment']) : '',
					$r['private_label'] ? 'sì' : 'no',
					number_format($r['price'] / 100, 2, ',', ''),
					$r['qty'],
					$r['scanned'] ? 'sì' : 'no',
				),
				';'
			);
		}
		fclose($out);
		exit;
	}
);
