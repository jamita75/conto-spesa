<?php
define('ABSPATH', '/tmp/');
define('HOUR_IN_SECONDS', 3600); define('ARRAY_A','ARRAY_A'); define('OBJECT_K','OBJECT_K');
$GLOBALS['_hooks']=[]; $GLOBALS['_tr']=[];
function add_action($h,$f){ $GLOBALS['_hooks'][$h][]=$f; }
function register_activation_hook($f,$c){} function register_deactivation_hook($f,$c){} function register_uninstall_hook($f,$c){}
function add_shortcode($n,$f){ $GLOBALS['_sc'][$n]=$f; }
function get_transient($k){ return $GLOBALS['_tr'][$k] ?? false; }
function set_transient($k,$v,$t){ $GLOBALS['_tr'][$k]=$v; }
function wp_strip_all_tags($s){ return strip_tags($s); }
function current_time($t,$g){ return gmdate('Y-m-d H:i:s'); }
function register_rest_route($ns,$r,$a){ $GLOBALS['_routes'][$r]=$a; }
function get_option($k,$d=''){ return $d; } function esc_html($s){ return htmlspecialchars($s); }
class WP_REST_Request { public $h=[]; public $b=[]; function __construct($h,$b){$this->h=$h;$this->b=$b;}
  function get_json_params(){return $this->b;} function get_header($k){return $this->h[$k]??null;} function get_param($k){return $this->b[$k]??null;} }
class WP_REST_Response { public $data; public $status; function __construct($d,$s){$this->data=$d;$this->status=$s;} }
class FakeDB { public $prefix='wp_'; public $t=['wp_cs_records'=>[],'wp_cs_items'=>[]]; public $insert_id=0; private $id=0;
  function insert($table,$row){ if($table==='wp_cs_records'){ foreach($this->t[$table] as $r){ if($r['pid']===$row['pid'] && $r['rid']===$row['rid']) return false; } }
    $row['id']=++$this->id; $this->insert_id=$row['id']; $this->t[$table][]=$row; return 1; }
  function delete($table,$where){ $n=0; foreach($this->t[$table] as $i=>$r){ if($r['pid']===$where['pid']){ unset($this->t[$table][$i]); $n++; } } return $n; }
  function prepare($q,...$a){ $this->lastArgs=$a; return $q; }
  function get_results($q,$mode=null){ $pid=$this->lastArgs[0]; $tab=strpos($q,'cs_items')!==false?'wp_cs_items':'wp_cs_records';
    return array_values(array_filter($this->t[$tab], fn($r)=>$r['pid']===$pid)); }
}
$GLOBALS['wpdb']=new FakeDB();
require '/home/claude/spesa-smart/server/wordpress/conto-spesa-stats/conto-spesa-stats.php';
foreach($GLOBALS['_hooks']['rest_api_init'] as $f) $f();

$fail=0; function ok($c,$m){ global $fail; echo ($c?'✓ ':'✗ ').$m."\n"; if(!$c) $fail++; }
$key=['x-cs-key'=>CS_APP_KEY]; $pid='3b1f2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
$perm=$GLOBALS['_routes']['/records']['permission_callback'];
ok(!$perm(new WP_REST_Request(['x-cs-key'=>'sbagliata'],[])), 'chiave sbagliata rifiutata');
ok($perm(new WP_REST_Request($key,[])), 'chiave giusta accettata');
$rec=['rid'=>'s1','day'=>'2026-11-25','weekday'=>3,'storeType'=>'food','chain'=>'Conad','total'=>1200,'discount'=>200,'couponsUsed'=>1,'shareWithPartners'=>true,
  'items'=>[['name'=>'Pasta <b>x</b>','price'=>600,'qty'=>2,'segment'=>'dispensa','privateLabel'=>true,'scanned'=>true],['price'=>'abc','qty'=>1],['price'=>100,'qty'=>1,'segment'=>'inventato']]];
$r=cs_api_records(new WP_REST_Request($key,['pid'=>'non-valido','records'=>[$rec]]));
ok($r->status===400, 'pid non valido → 400');
$r=cs_api_records(new WP_REST_Request($key,['pid'=>$pid,'appVersion'=>'1.4.0','records'=>[$rec,['rid'=>'s2','day'=>'data-sbagliata']]]));
ok($r->status===200 && $r->data['saved']===1, 'salva 1 spesa valida, scarta quella con data errata');
ok(count($wpdb->t['wp_cs_items'])===2, 'scarta il prodotto con prezzo non numerico');
$items=array_values($wpdb->t['wp_cs_items']);
ok($items[0]['name']==='Pasta x' && $items[0]['private_label']===1, 'pulisce il nome (niente HTML) e salva marca del negozio');
ok($items[1]['segment']===null, 'reparto sconosciuto → vuoto');
$r=cs_api_records(new WP_REST_Request($key,['pid'=>$pid,'records'=>[$rec]]));
ok($r->data['saved']===0 && $r->data['received']===['s1'], 'reinvio della stessa spesa: nessun doppione ma confermata');
$e=cs_api_export(new WP_REST_Request($key,['pid'=>$pid]));
ok($e->data['ok'] && count($e->data['records'])===1, 'export dei dati dell\'utente');
$f=cs_api_forget(new WP_REST_Request($key,['pid'=>$pid]));
ok($f->data['deleted']===1 && count($wpdb->t['wp_cs_items'])===0, 'diritto all\'oblio: cancella spese e prodotti');
for($i=0;$i<40;$i++){ $last=cs_api_records(new WP_REST_Request($key,['pid'=>'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee','records'=>[]])); }
ok($last->status===429, 'limite di chiamate per codice');
$html=$GLOBALS['_sc']['contospesa_informativa']();
ok(strpos($html,'14 anni')!==false && strpos($html,'codice casuale')!==false, 'informativa pubblica generata');
echo $fail? "\nFALLITI: $fail\n" : "\nTutti i test del server superati\n";
