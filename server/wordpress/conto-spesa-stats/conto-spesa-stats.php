<?php
/**
 * Plugin Name: Conto Spesa – Statistiche
 * Description: Riceve le statistiche d'acquisto pseudonime dell'app Conto Spesa (solo da chi ha dato il consenso), mostra la dashboard e produce report aggregati per i negozi partner.
 * Version: 1.0.2
 * Author: Creaitivity
 * Requires PHP: 7.4
 * Requires at least: 6.0
 * License: GPLv2 or later
 * Text Domain: conto-spesa-stats
 *
 * PRIVACY BY DESIGN
 * - Riceve solo dati dall'app con consenso; nessun nome, telefono, email, posizione o identificativo del dispositivo.
 * - Ogni telefono è indicato da un codice casuale (pseudonimo) generato dall'app al consenso e cancellato alla revoca.
 * - Il plugin NON salva indirizzi IP.
 * - Cancellazione automatica dopo CS_RETENTION_MONTHS mesi; cancellazione ed export su richiesta dell'utente dall'app.
 * - Ai partner solo report AGGREGATI con almeno CS_K_MIN utenti per riga e solo da chi ha accettato la condivisione con i partner.
 */

if (!defined('ABSPATH')) {
	exit;
}

define('CS_VERSION', '1.0.2');
define('CS_DB_VERSION', '1');
/** chiave condivisa con l'app (filtro anti-spam; deve coincidere con APP_KEY in src/features/analytics/uploader.ts) */
define('CS_APP_KEY', '2f596d4986ea489f344e7ee39541fae7');
define('CS_RETENTION_MONTHS', 24);
/** soglia minima di utenti diversi perché un dato compaia nei report ai partner */
define('CS_K_MIN', 10);
define('CS_MAX_RECORDS_PER_CALL', 50);
define('CS_MAX_ITEMS_PER_RECORD', 300);
define('CS_MAX_CALLS_PER_HOUR', 30);

const CS_SEGMENTS = array(
	'fruttaVerdura'   => 'Frutta e verdura',
	'carne'           => 'Carne',
	'pesce'           => 'Pesce',
	'salumiFormaggi'  => 'Salumi e formaggi',
	'latteYogurt'     => 'Latte, yogurt, uova',
	'panePasticceria' => 'Pane e forno',
	'dispensa'        => 'Pasta, riso, dispensa',
	'surgelati'       => 'Surgelati',
	'bevande'         => 'Bevande',
	'dolciSnack'      => 'Dolci e snack',
	'casaIgiene'      => 'Casa e igiene',
	'animali'         => 'Animali',
	'altro'           => 'Altro',
);

/* ------------------------------------------------------------------ */
/* Tabelle, attivazione, pulizia automatica                            */
/* ------------------------------------------------------------------ */

function cs_tables() {
	global $wpdb;
	return array(
		'records' => $wpdb->prefix . 'cs_records',
		'items'   => $wpdb->prefix . 'cs_items',
	);
}

function cs_install() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$t       = cs_tables();
	$charset = $wpdb->get_charset_collate();

	dbDelta(
		"CREATE TABLE {$t['records']} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			pid CHAR(36) NOT NULL,
			rid VARCHAR(40) NOT NULL,
			received DATETIME NOT NULL,
			day DATE NOT NULL,
			weekday TINYINT UNSIGNED NOT NULL,
			store_type VARCHAR(10) NULL,
			chain VARCHAR(60) NULL,
			total INT UNSIGNED NOT NULL,
			discount INT UNSIGNED NOT NULL,
			coupons_used SMALLINT UNSIGNED NOT NULL,
			share_partners TINYINT(1) NOT NULL,
			app_version VARCHAR(20) NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY pid_rid (pid, rid),
			KEY day (day),
			KEY chain (chain)
		) $charset;"
	);
	dbDelta(
		"CREATE TABLE {$t['items']} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			record_id BIGINT UNSIGNED NOT NULL,
			pid CHAR(36) NOT NULL,
			day DATE NOT NULL,
			name VARCHAR(60) NULL,
			segment VARCHAR(20) NULL,
			private_label TINYINT(1) NOT NULL,
			price INT UNSIGNED NOT NULL,
			qty SMALLINT UNSIGNED NOT NULL,
			scanned TINYINT(1) NOT NULL,
			PRIMARY KEY  (id),
			KEY record_id (record_id),
			KEY pid (pid),
			KEY segment (segment)
		) $charset;"
	);
	update_option('cs_db_version', CS_DB_VERSION);

	if (!wp_next_scheduled('cs_daily_cleanup')) {
		wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'cs_daily_cleanup');
	}
}
register_activation_hook(__FILE__, 'cs_install');

register_deactivation_hook(
	__FILE__,
	function () {
		wp_clear_scheduled_hook('cs_daily_cleanup');
	}
);

/** conservazione limitata: cancella i dati più vecchi di CS_RETENTION_MONTHS mesi */
function cs_cleanup() {
	global $wpdb;
	$t     = cs_tables();
	$limit = gmdate('Y-m-d', strtotime('-' . CS_RETENTION_MONTHS . ' months'));
	$wpdb->query($wpdb->prepare("DELETE FROM {$t['items']} WHERE day < %s", $limit));
	$wpdb->query($wpdb->prepare("DELETE FROM {$t['records']} WHERE day < %s", $limit));
}
add_action('cs_daily_cleanup', 'cs_cleanup');

/* ------------------------------------------------------------------ */
/* API per l'app                                                       */
/* ------------------------------------------------------------------ */

function cs_valid_pid($pid) {
	return is_string($pid) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $pid);
}

function cs_check_key(WP_REST_Request $req) {
	$key = (string) $req->get_header('x-cs-key');
	return hash_equals(CS_APP_KEY, $key);
}

/** limite di chiamate per codice (non per IP: il plugin non tratta indirizzi IP) */
function cs_rate_limited($pid) {
	$k = 'cs_rl_' . md5($pid);
	$n = (int) get_transient($k);
	if ($n >= CS_MAX_CALLS_PER_HOUR) {
		return true;
	}
	set_transient($k, $n + 1, HOUR_IN_SECONDS);
	return false;
}

function cs_str($v, $max) {
	if (!is_string($v)) {
		return null;
	}
	$v = trim(wp_strip_all_tags($v));
	return '' === $v ? null : mb_substr($v, 0, $max);
}

function cs_int($v, $min, $max) {
	if (!is_numeric($v)) {
		return null;
	}
	$v = (int) round((float) $v);
	return ($v < $min || $v > $max) ? null : $v;
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'contospesa/v1',
			'/records',
			array(
				'methods'             => 'POST',
				'callback'            => 'cs_api_records',
				'permission_callback' => 'cs_check_key',
			)
		);
		register_rest_route(
			'contospesa/v1',
			'/forget',
			array(
				'methods'             => 'POST',
				'callback'            => 'cs_api_forget',
				'permission_callback' => 'cs_check_key',
			)
		);
		register_rest_route(
			'contospesa/v1',
			'/partners-off',
			array(
				'methods'             => 'POST',
				'callback'            => 'cs_api_partners_off',
				'permission_callback' => 'cs_check_key',
			)
		);
		register_rest_route(
			'contospesa/v1',
			'/export',
			array(
				'methods'             => 'POST',
				'callback'            => 'cs_api_export',
				'permission_callback' => 'cs_check_key',
			)
		);
	}
);

function cs_api_records(WP_REST_Request $req) {
	global $wpdb;
	$t    = cs_tables();
	$body = $req->get_json_params();
	$pid  = isset($body['pid']) ? $body['pid'] : '';
	if (!cs_valid_pid($pid)) {
		return new WP_REST_Response(array('ok' => false, 'error' => 'pid'), 400);
	}
	if (cs_rate_limited($pid)) {
		return new WP_REST_Response(array('ok' => false, 'error' => 'rate'), 429);
	}
	$records = isset($body['records']) && is_array($body['records']) ? array_slice($body['records'], 0, CS_MAX_RECORDS_PER_CALL) : array();
	$app     = cs_str(isset($body['appVersion']) ? $body['appVersion'] : null, 20);
	$saved   = 0;
	$ids     = array();

	foreach ($records as $r) {
		$rid = cs_str(isset($r['rid']) ? $r['rid'] : null, 40);
		$day = isset($r['day']) && is_string($r['day']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['day']) ? $r['day'] : null;
		if (!$rid || !$day) {
			continue;
		}
		$ids[] = $rid;
		$store = isset($r['storeType']) && in_array($r['storeType'], array('food', 'nonfood'), true) ? $r['storeType'] : null;
		$ok    = $wpdb->insert(
			$t['records'],
			array(
				'pid'            => $pid,
				'rid'            => $rid,
				'received'       => current_time('mysql', true),
				'day'            => $day,
				'weekday'        => (int) cs_int(isset($r['weekday']) ? $r['weekday'] : 0, 0, 6),
				'store_type'     => $store,
				'chain'          => cs_str(isset($r['chain']) ? $r['chain'] : null, 60),
				'total'          => (int) cs_int(isset($r['total']) ? $r['total'] : 0, 0, 10000000),
				'discount'       => (int) cs_int(isset($r['discount']) ? $r['discount'] : 0, 0, 10000000),
				'coupons_used'   => (int) cs_int(isset($r['couponsUsed']) ? $r['couponsUsed'] : 0, 0, 100),
				'share_partners' => !empty($r['shareWithPartners']) ? 1 : 0,
				'app_version'    => $app,
			)
		);
		if (!$ok) {
			continue; // già ricevuto (stesso pid + rid): nessun doppione
		}
		$record_id = (int) $wpdb->insert_id;
		$saved++;
		$items = isset($r['items']) && is_array($r['items']) ? array_slice($r['items'], 0, CS_MAX_ITEMS_PER_RECORD) : array();
		foreach ($items as $i) {
			$price = cs_int(isset($i['price']) ? $i['price'] : null, 0, 10000000);
			$qty   = cs_int(isset($i['qty']) ? $i['qty'] : null, 1, 999);
			if (null === $price || null === $qty) {
				continue;
			}
			$seg = isset($i['segment']) && is_string($i['segment']) && array_key_exists($i['segment'], CS_SEGMENTS) ? $i['segment'] : null;
			$wpdb->insert(
				$t['items'],
				array(
					'record_id'     => $record_id,
					'pid'           => $pid,
					'day'           => $day,
					'name'          => cs_str(isset($i['name']) ? $i['name'] : null, 60),
					'segment'       => $seg,
					'private_label' => !empty($i['privateLabel']) ? 1 : 0,
					'price'         => $price,
					'qty'           => $qty,
					'scanned'       => !empty($i['scanned']) ? 1 : 0,
				)
			);
		}
	}
	// "received" restituisce tutti i rid validi (anche i doppioni) così l'app li toglie dalla coda
	return new WP_REST_Response(array('ok' => true, 'saved' => $saved, 'received' => $ids), 200);
}

/** diritto alla cancellazione: elimina tutto ciò che è legato al codice */
function cs_api_forget(WP_REST_Request $req) {
	global $wpdb;
	$t   = cs_tables();
	$pid = (string) $req->get_param('pid');
	if (!cs_valid_pid($pid)) {
		return new WP_REST_Response(array('ok' => false, 'error' => 'pid'), 400);
	}
	$wpdb->delete($t['items'], array('pid' => $pid));
	$n = $wpdb->delete($t['records'], array('pid' => $pid));
	return new WP_REST_Response(array('ok' => true, 'deleted' => (int) $n), 200);
}

/** revoca del solo consenso ai partner: le spese di quel codice escono dai report per i partner */
function cs_api_partners_off(WP_REST_Request $req) {
	global $wpdb;
	$t   = cs_tables();
	$pid = (string) $req->get_param('pid');
	if (!cs_valid_pid($pid)) {
		return new WP_REST_Response(array('ok' => false, 'error' => 'pid'), 400);
	}
	$n = $wpdb->update($t['records'], array('share_partners' => 0), array('pid' => $pid));
	return new WP_REST_Response(array('ok' => true, 'updated' => (int) $n), 200);
}

/** diritto di accesso / portabilità: restituisce i dati legati al codice */
function cs_api_export(WP_REST_Request $req) {
	global $wpdb;
	$t   = cs_tables();
	$pid = (string) $req->get_param('pid');
	if (!cs_valid_pid($pid)) {
		return new WP_REST_Response(array('ok' => false, 'error' => 'pid'), 400);
	}
	if (cs_rate_limited($pid)) {
		return new WP_REST_Response(array('ok' => false, 'error' => 'rate'), 429);
	}
	$records = $wpdb->get_results($wpdb->prepare("SELECT id, day, weekday, store_type, chain, total, discount, coupons_used, share_partners FROM {$t['records']} WHERE pid = %s ORDER BY day", $pid), ARRAY_A);
	$items   = $wpdb->get_results($wpdb->prepare("SELECT record_id, name, segment, private_label, price, qty FROM {$t['items']} WHERE pid = %s", $pid), ARRAY_A);
	$by      = array();
	foreach ($items as $i) {
		$by[ $i['record_id'] ][] = $i;
	}
	foreach ($records as &$r) {
		$r['items'] = isset($by[ $r['id'] ]) ? $by[ $r['id'] ] : array();
		unset($r['id']);
	}
	return new WP_REST_Response(array('ok' => true, 'pid' => $pid, 'records' => $records), 200);
}

/* ------------------------------------------------------------------ */
/* Dashboard (Bacheca → Conto Spesa)                                   */
/* ------------------------------------------------------------------ */

add_action(
	'admin_menu',
	function () {
		add_menu_page('Conto Spesa', 'Conto Spesa', 'manage_options', 'conto-spesa', 'cs_dashboard', 'dashicons-cart', 58);
	}
);

function cs_eur($cents) {
	return number_format_i18n(((int) $cents) / 100, 2) . ' €';
}

function cs_pct($part, $total) {
	return $total > 0 ? number_format_i18n(100 * $part / $total, 1) . '%' : '—';
}

function cs_bar($value, $max) {
	$w = $max > 0 ? max(1, round(100 * $value / $max)) : 0;
	return '<span style="display:inline-block;height:10px;width:' . (int) $w . '%;max-width:220px;background:#1E8E5A;border-radius:4px;vertical-align:middle"></span>';
}

function cs_dashboard() {
	if (!current_user_can('manage_options')) {
		return;
	}
	global $wpdb;
	$t    = cs_tables();
	$days = isset($_GET['giorni']) ? (int) $_GET['giorni'] : 90;
	$days = in_array($days, array(30, 90, 365, 730), true) ? $days : 90;
	$from = gmdate('Y-m-d', strtotime("-$days days"));

	if (isset($_POST['cs_settings']) && check_admin_referer('cs_settings')) {
		update_option('cs_titolare', sanitize_text_field(wp_unslash($_POST['cs_titolare'] ?? '')));
		update_option('cs_email', sanitize_email(wp_unslash($_POST['cs_email'] ?? '')));
		echo '<div class="notice notice-success"><p>Dati del titolare salvati.</p></div>';
	}

	$k = $wpdb->get_row($wpdb->prepare(
		"SELECT COUNT(*) spese, COUNT(DISTINCT pid) utenti, COALESCE(SUM(total),0) totale, COALESCE(SUM(discount),0) sconto,
		        SUM(coupons_used > 0) con_buono
		 FROM {$t['records']} WHERE day >= %s",
		$from
	));
	$pl = $wpdb->get_row($wpdb->prepare(
		"SELECT COALESCE(SUM(price*qty),0) tot, COALESCE(SUM(CASE WHEN private_label=1 THEN price*qty ELSE 0 END),0) pl
		 FROM {$t['items']} WHERE day >= %s",
		$from
	));
	$months = max(1, $days / 30);
	$freq   = $k->utenti > 0 ? $k->spese / $k->utenti / $months : 0;

	echo '<div class="wrap"><h1>🛒 Conto Spesa – Statistiche</h1>';
	echo '<p>Periodo: ';
	foreach (array(30 => '30 giorni', 90 => '90 giorni', 365 => '12 mesi', 730 => '24 mesi') as $d => $label) {
		$url = esc_url(add_query_arg(array('page' => 'conto-spesa', 'giorni' => $d), admin_url('admin.php')));
		echo $d === $days ? '<strong>' . esc_html($label) . '</strong> · ' : '<a href="' . $url . '">' . esc_html($label) . '</a> · ';
	}
	echo '</p>';

	echo '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:12px 0">';
	$tiles = array(
		'Utenti attivi'          => number_format_i18n((int) $k->utenti),
		'Spese registrate'       => number_format_i18n((int) $k->spese),
		'Spesa totale'           => cs_eur($k->totale),
		'Scontrino medio'        => $k->spese ? cs_eur($k->totale / $k->spese) : '—',
		'Spese per utente/mese'  => number_format_i18n($freq, 1),
		'Spese con buono'        => cs_pct((int) $k->con_buono, (int) $k->spese),
		'Risparmio con buoni'    => cs_eur($k->sconto),
		'Quota marca del negozio' => cs_pct((int) $pl->pl, (int) $pl->tot),
	);
	foreach ($tiles as $label => $value) {
		echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:12px 16px;min-width:170px"><div style="color:#646970">' . esc_html($label) . '</div><div style="font-size:22px;font-weight:700">' . esc_html($value) . '</div></div>';
	}
	echo '</div>';

	// reparti
	$seg = $wpdb->get_results($wpdb->prepare(
		"SELECT COALESCE(segment,'altro') s, SUM(price*qty) v, COUNT(DISTINCT pid) u FROM {$t['items']} WHERE day >= %s GROUP BY s ORDER BY v DESC",
		$from
	));
	$max = $seg ? max(array_map(function ($r) { return (int) $r->v; }, $seg)) : 0;
	echo '<h2>Spesa per reparto</h2><table class="widefat striped" style="max-width:820px"><thead><tr><th>Reparto</th><th>Spesa</th><th></th><th>Utenti</th></tr></thead><tbody>';
	foreach ($seg as $r) {
		$name = array_key_exists($r->s, CS_SEGMENTS) ? CS_SEGMENTS[ $r->s ] : $r->s;
		echo '<tr><td>' . esc_html($name) . '</td><td>' . esc_html(cs_eur($r->v)) . '</td><td style="width:240px">' . cs_bar($r->v, $max) . '</td><td>' . (int) $r->u . '</td></tr>';
	}
	echo '</tbody></table>';

	// insegne
	$ch = $wpdb->get_results($wpdb->prepare(
		"SELECT COALESCE(chain,'(non indicata)') c, COUNT(*) n, COUNT(DISTINCT pid) u, SUM(total) v FROM {$t['records']} WHERE day >= %s GROUP BY c ORDER BY v DESC LIMIT 30",
		$from
	));
	echo '<h2>Per insegna</h2><table class="widefat striped" style="max-width:820px"><thead><tr><th>Insegna</th><th>Spese</th><th>Utenti</th><th>Spesa</th><th>Scontrino medio</th></tr></thead><tbody>';
	foreach ($ch as $r) {
		echo '<tr><td>' . esc_html($r->c) . '</td><td>' . (int) $r->n . '</td><td>' . (int) $r->u . '</td><td>' . esc_html(cs_eur($r->v)) . '</td><td>' . esc_html(cs_eur($r->n ? $r->v / $r->n : 0)) . '</td></tr>';
	}
	echo '</tbody></table>';

	// giorni della settimana
	$wd    = $wpdb->get_results($wpdb->prepare("SELECT weekday w, COUNT(*) n FROM {$t['records']} WHERE day >= %s GROUP BY w", $from), OBJECT_K);
	$names = array('Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato');
	$maxw  = $wd ? max(array_map(function ($r) { return (int) $r->n; }, $wd)) : 0;
	echo '<h2>Quando fanno la spesa</h2><table class="widefat striped" style="max-width:820px"><tbody>';
	foreach (array(1, 2, 3, 4, 5, 6, 0) as $d) {
		$n = isset($wd[ $d ]) ? (int) $wd[ $d ]->n : 0;
		echo '<tr><td style="width:120px">' . esc_html($names[ $d ]) . '</td><td style="width:60px">' . $n . '</td><td>' . cs_bar($n, $maxw) . '</td></tr>';
	}
	echo '</tbody></table>';

	// abitudini nel tempo (grazie al codice pseudonimo)
	$loyal = $wpdb->get_var($wpdb->prepare(
		"SELECT AVG(top_share) FROM (
			SELECT x.pid, MAX(x.n) / SUM(x.n) top_share FROM (
				SELECT pid, COALESCE(chain,'-') c, COUNT(*) n FROM {$t['records']} WHERE day >= %s GROUP BY pid, c
			) x GROUP BY x.pid HAVING SUM(x.n) >= 3
		) y",
		$from
	));
	$ret = $wpdb->get_row($wpdb->prepare(
		"SELECT COUNT(*) tot, SUM(w >= 2) ritorno FROM (SELECT pid, COUNT(DISTINCT YEARWEEK(day, 1)) w FROM {$t['records']} WHERE day >= %s GROUP BY pid) z",
		$from
	));
	echo '<h2>Abitudini</h2><ul style="font-size:14px">';
	echo '<li><strong>Fedeltà all\'insegna</strong> (utenti con almeno 3 spese): in media ' . esc_html(null === $loyal ? '—' : cs_pct((float) $loyal, 1)) . ' delle spese nella loro insegna preferita.</li>';
	echo '<li><strong>Utenti che tornano</strong> (spese in almeno 2 settimane diverse): ' . esc_html(cs_pct((int) $ret->ritorno, (int) $ret->tot)) . '.</li>';
	echo '</ul>';

	// prodotti più acquistati (solo nomi comprati da almeno K utenti)
	$top = $wpdb->get_results($wpdb->prepare(
		"SELECT name, COUNT(DISTINCT pid) u, SUM(qty) q, ROUND(AVG(price)) p FROM {$t['items']} WHERE day >= %s AND name IS NOT NULL GROUP BY name HAVING u >= %d ORDER BY u DESC, q DESC LIMIT 25",
		$from,
		CS_K_MIN
	));
	echo '<h2>Prodotti più presenti</h2><p style="color:#646970">Solo prodotti acquistati da almeno ' . (int) CS_K_MIN . ' utenti diversi.</p>';
	echo '<table class="widefat striped" style="max-width:820px"><thead><tr><th>Prodotto</th><th>Utenti</th><th>Pezzi</th><th>Prezzo medio</th></tr></thead><tbody>';
	foreach ($top as $r) {
		echo '<tr><td>' . esc_html($r->name) . '</td><td>' . (int) $r->u . '</td><td>' . (int) $r->q . '</td><td>' . esc_html(cs_eur($r->p)) . '</td></tr>';
	}
	if (!$top) {
		echo '<tr><td colspan="4">Ancora pochi dati.</td></tr>';
	}
	echo '</tbody></table>';

	// report partner
	$csv = wp_nonce_url(admin_url('admin-post.php?action=cs_partner_csv&giorni=' . $days), 'cs_partner_csv');
	echo '<h2>Report per i negozi partner</h2><p>File CSV con dati <strong>solo aggregati</strong> (insegna × reparto), solo da utenti che hanno accettato la condivisione con i partner, e solo righe con almeno ' . (int) CS_K_MIN . ' utenti diversi. Non contiene codici né singole spese.</p>';
	echo '<p><a class="button button-primary" href="' . esc_url($csv) . '">Scarica report aggregato (CSV)</a></p>';

	// titolare per l'informativa
	echo '<h2>Informativa privacy</h2><p>Crea una pagina pubblica con lo shortcode <code>[contospesa_informativa]</code>: il suo indirizzo serve al Play Store.</p>';
	echo '<form method="post">';
	wp_nonce_field('cs_settings');
	echo '<input type="hidden" name="cs_settings" value="1"><table class="form-table"><tr><th>Titolare del trattamento</th><td><input class="regular-text" name="cs_titolare" value="' . esc_attr(get_option('cs_titolare', '')) . '" placeholder="Ragione sociale, indirizzo, P.IVA"></td></tr>';
	echo '<tr><th>Email per la privacy</th><td><input class="regular-text" name="cs_email" value="' . esc_attr(get_option('cs_email', '')) . '" placeholder="privacy@…"></td></tr></table>';
	submit_button('Salva');
	echo '</form>';
	echo '<p style="color:#646970">Dati pseudonimi conservati ' . (int) CS_RETENTION_MONTHS . ' mesi e poi cancellati automaticamente. Nessun indirizzo IP viene salvato dal plugin.</p></div>';
}

add_action(
	'admin_post_cs_partner_csv',
	function () {
		if (!current_user_can('manage_options') || !check_admin_referer('cs_partner_csv')) {
			wp_die('Non autorizzato');
		}
		global $wpdb;
		$t    = cs_tables();
		$days = isset($_GET['giorni']) ? (int) $_GET['giorni'] : 90;
		$days = in_array($days, array(30, 90, 365, 730), true) ? $days : 90;
		$from = gmdate('Y-m-d', strtotime("-$days days"));
		$rows = $wpdb->get_results($wpdb->prepare(
			"SELECT COALESCE(r.chain,'(non indicata)') insegna, COALESCE(i.segment,'altro') reparto,
			        COUNT(DISTINCT i.pid) utenti, COUNT(DISTINCT i.record_id) spese, SUM(i.price*i.qty) spesa_cent,
			        SUM(CASE WHEN i.private_label=1 THEN i.price*i.qty ELSE 0 END) pl_cent
			 FROM {$t['items']} i JOIN {$t['records']} r ON r.id = i.record_id
			 WHERE r.share_partners = 1 AND r.day >= %s
			 GROUP BY insegna, reparto HAVING utenti >= %d ORDER BY insegna, spesa_cent DESC",
			$from,
			CS_K_MIN
		));
		nocache_headers();
		header('Content-Type: text/csv; charset=utf-8');
		header('Content-Disposition: attachment; filename="conto-spesa-report-' . gmdate('Y-m-d') . '.csv"');
		$out = fopen('php://output', 'w');
		fwrite($out, "\xEF\xBB\xBF");
		fputcsv($out, array('Periodo (giorni)', 'Insegna', 'Reparto', 'Utenti', 'Spese', 'Spesa totale €', 'Quota marca del negozio %'), ';');
		foreach ($rows as $r) {
			fputcsv(
				$out,
				array(
					$days,
					$r->insegna,
					array_key_exists($r->reparto, CS_SEGMENTS) ? CS_SEGMENTS[ $r->reparto ] : $r->reparto,
					$r->utenti,
					$r->spese,
					number_format($r->spesa_cent / 100, 2, ',', ''),
					$r->spesa_cent > 0 ? number_format(100 * $r->pl_cent / $r->spesa_cent, 1, ',', '') : '0',
				),
				';'
			);
		}
		fclose($out);
		exit;
	}
);

/* ------------------------------------------------------------------ */
/* Informativa pubblica: [contospesa_informativa]                      */
/* ------------------------------------------------------------------ */

add_shortcode(
	'contospesa_informativa',
	function () {
		$tit   = esc_html(get_option('cs_titolare', '[titolare da completare]'));
		$email = esc_html(get_option('cs_email', '[email da completare]'));
		$m     = (int) CS_RETENTION_MONTHS;
		$k     = (int) CS_K_MIN;
		return <<<HTML
<div class="contospesa-informativa">
<h2>Informativa privacy – app Conto Spesa</h2>
<p><strong>Titolare del trattamento:</strong> {$tit}. Contatto: {$email}.</p>
<h3>Dati sul telefono</h3>
<p>Carrello, buoni, codici dei buoni e storico delle spese restano sul telefono. Le foto dei cartellini vengono lette sul telefono e non vengono né inviate né conservate.</p>
<h3>Statistiche d'acquisto (solo con il tuo consenso)</h3>
<p>Se accetti, a fine spesa l'app invia: giorno e giorno della settimana, tipo di negozio, insegna (se scelta dall'elenco), nome letto, reparto, prezzo e quantità dei prodotti, indicazione «marca del negozio», totale, sconto e numero di buoni usati. I dati sono collegati a un <strong>codice casuale</strong> creato sul telefono al momento del consenso, che permette di studiare le abitudini nel tempo senza sapere chi sei. Non raccogliamo nome, numero di telefono, email, posizione, foto o identificativi del dispositivo. Il codice è un dato pseudonimo e quindi un dato personale.</p>
<p><strong>Finalità:</strong> (1) statistiche per migliorare l'app; (2) solo con il secondo consenso, report statistici per i negozi partner, anche a pagamento. <strong>Base giuridica:</strong> consenso (art. 6.1.a GDPR), facoltativo: l'app funziona completamente anche senza.</p>
<h3>Cosa ricevono i negozi partner</h3>
<p>Solo statistiche <strong>aggregate</strong> (per insegna e reparto) che riguardano almeno {$k} persone diverse. Mai il codice, mai le singole spese.</p>
<h3>Dove e per quanto</h3>
<p>I dati sono conservati sul server del titolare in Italia, per {$m} mesi, poi cancellati automaticamente. Il fornitore di hosting agisce come responsabile del trattamento. Come ogni sito, il server può registrare l'indirizzo di rete nei registri tecnici del fornitore; il sistema di raccolta non lo salva.</p>
<h3>Buoni dei negozi partner</h3>
<p>Con l'autorizzazione ai partner l'app scarica l'elenco dei buoni sconto da un file pubblico ospitato su GitHub; il telefono si collega a quel servizio come a un normale sito. La data dell'autorizzazione resta solo sul telefono.</p>
<h3>I tuoi diritti</h3>
<p>Dall'app (Profilo) puoi in ogni momento revocare i consensi, scaricare i tuoi dati e cancellarli dal server: alla revoca il codice viene eliminato e i dati collegati vengono cancellati. Puoi esercitare i diritti di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione scrivendo a {$email}, e proporre reclamo al Garante per la protezione dei dati personali. Il servizio è riservato a chi ha almeno 14 anni.</p>
</div>
HTML;
	}
);

register_uninstall_hook(__FILE__, 'cs_uninstall');
function cs_uninstall() {
	global $wpdb;
	$t = cs_tables();
	$wpdb->query("DROP TABLE IF EXISTS {$t['items']}");
	$wpdb->query("DROP TABLE IF EXISTS {$t['records']}");
	delete_option('cs_db_version');
	delete_option('cs_titolare');
	delete_option('cs_email');
	wp_clear_scheduled_hook('cs_daily_cleanup');
}
