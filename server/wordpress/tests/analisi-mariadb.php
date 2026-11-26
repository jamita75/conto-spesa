<?php
error_reporting(E_ALL); ini_set('display_errors','1');
set_error_handler(function($n,$s,$f,$l){ throw new ErrorException($s,0,$n,$f,$l); });
define('ABSPATH','/tmp/wptest2/'); define('HOUR_IN_SECONDS',3600); define('ARRAY_A','ARRAY_A'); define('OBJECT_K','OBJECT_K'); define('OBJECT','OBJECT');
if(!is_dir("/tmp/wptest2/wp-admin/includes")) mkdir('/tmp/wptest2/wp-admin/includes',0777,true); file_put_contents('/tmp/wptest2/wp-admin/includes/upgrade.php','<?php function dbDelta($q){ global $wpdb; $wpdb->query($q);} ');
$GLOBALS['_hooks']=[];
function add_action($h,$f,$p=10){ $GLOBALS['_hooks'][$h][]=$f; } function register_activation_hook($f,$c){$GLOBALS['_act']=$c;} function register_deactivation_hook($f,$c){} function register_uninstall_hook($f,$c){}
function add_shortcode($n,$f){} function get_transient($k){return false;} function set_transient($k,$v,$t){} function wp_strip_all_tags($s){return strip_tags($s);}
function current_time($t,$g){return gmdate('Y-m-d H:i:s');} function register_rest_route($ns,$r,$a){$GLOBALS['_routes'][$r]=$a;}
function get_option($k,$d=''){return $d;} function update_option($k,$v){} function wp_next_scheduled($h){return true;} function wp_schedule_event(){}
function esc_html($s){return htmlspecialchars((string)$s);} function esc_attr($s){return htmlspecialchars((string)$s,ENT_QUOTES);} function esc_url($s){return $s;}
function wp_unslash($v){return $v;} function sanitize_text_field($s){return trim(strip_tags((string)$s));} function sanitize_key($s){return preg_replace('/[^a-z0-9_\-]/','',strtolower($s));}
function number_format_i18n($n,$d=0){return number_format((float)$n,$d,',','.');} function date_i18n($f,$ts){return date($f,$ts);}
function add_query_arg($a,$u){return $u.'?'.http_build_query($a);} function admin_url($p=''){return '/wp-admin/'.$p;} function wp_nonce_url($u,$a){return $u.'&_wpnonce=x';}
function selected($a,$b,$e=true){return $a===$b?' selected':'';} function checked($a,$b,$e=true){return $a==$b?' checked':'';} function current_user_can($c){return true;}
function add_menu_page(){} function add_submenu_page(){} function submit_button(){} function wp_nonce_field(){} function check_admin_referer(){return true;}
class WP_REST_Request { public $h=[]; public $b=[]; function __construct($h,$b){$this->h=$h;$this->b=$b;} function get_json_params(){return $this->b;} function get_header($k){return $this->h[$k]??null;} function get_param($k){return $this->b[$k]??null;} }
class WP_REST_Response { public $data; public $status; function __construct($d,$s=200){$this->data=$d;$this->status=$s;} }
class DB { public $prefix='wp_'; public $insert_id=0; public $m;
  function __construct(){ $this->m=new mysqli('localhost','root','','wp'); $this->m->set_charset('utf8mb4'); }
  function get_charset_collate(){return 'DEFAULT CHARSET=utf8mb4';}
  function esc_like($s){ return addcslashes($s,'_%\\'); }
  function prepare($q,...$a){ if(count($a)===1 && is_array($a[0])) $a=$a[0]; $i=0; $m=$this->m;
    $q=str_replace('%%','__PCT__',$q);
    $q=preg_replace_callback('/%[sd]/',function($x) use(&$i,$a,$m){ $v=$a[$i++] ?? null; if($v===null) throw new Exception('arg mancante'); return $x[0]==='%d'?(string)(int)$v:"'".$m->real_escape_string((string)$v)."'"; },$q);
    if($i!==count($a)) throw new Exception("args: usati $i su ".count($a));
    return str_replace('__PCT__','%',$q); }
  function query($q){ $r=$this->m->query($q); if($r===false) throw new Exception($this->m->error."\n".$q); return $r; }
  function insert($t,$row){ $c=implode(',',array_keys($row)); $v=implode(',',array_map(fn($x)=>$x===null?'NULL':"'".$this->m->real_escape_string((string)$x)."'",$row));
    try{ $this->query("INSERT INTO $t ($c) VALUES ($v)"); }catch(Exception $e){ if(strpos($e->getMessage(),'Duplicate')!==false) return false; throw $e; } $this->insert_id=$this->m->insert_id; return 1; }
  function delete($t,$w){ $k=array_key_first($w); $this->query("DELETE FROM $t WHERE $k='".$this->m->real_escape_string($w[$k])."'"); return $this->m->affected_rows; }
  function get_results($q,$mode='OBJECT'){ $r=$this->query($q); $out=[]; while($row=$r->fetch_assoc()){ if($mode==='ARRAY_A') $out[]=$row; elseif($mode==='OBJECT_K'){ $out[reset($row)]=(object)$row; } else $out[]=(object)$row; } return $out; }
  function get_row($q){ $x=$this->get_results($q); return $x[0]??null; } function get_var($q){ $r=$this->query($q)->fetch_row(); return $r?$r[0]:null; }
  function get_col($q){ $r=$this->query($q); $o=[]; while($x=$r->fetch_row()) $o[]=$x[0]; return $o; }
}
$GLOBALS['wpdb']=$wpdb=new DB();
$wpdb->query('DROP TABLE IF EXISTS wp_cs_records'); $wpdb->query('DROP TABLE IF EXISTS wp_cs_items');
require '/home/claude/spesa-smart/server/wordpress/conto-spesa-stats/conto-spesa-stats.php';
cs_install();
foreach($GLOBALS['_hooks']['rest_api_init'] as $f) $f();
// dati finti: 30 utenti, 4 mesi
mt_srand(7); $chains=['Conad','Coop','Lidl',null]; $segs=array_keys(CS_SEGMENTS); $prods=['Latte intero 1L','Pasta 500g','Pane','Mele','Petto di pollo','Detersivo'];
for($u=0;$u<30;$u++){ $pid=sprintf('%08x-aaaa-4bbb-8ccc-%012x',$u,$u); $GLOBALS['_tr']=[]; $recs=[];
  $n=1+($u%7)*2; for($k=0;$k<$n;$k++){ $d=date('Y-m-d',strtotime('-'.mt_rand(0,120).' days')); $items=[]; $tot=0;
    for($j=0;$j<mt_rand(2,8);$j++){ $p=mt_rand(80,900); $q=mt_rand(1,3); $tot+=$p*$q; $items[]=['name'=>$prods[mt_rand(0,5)],'price'=>$p,'qty'=>$q,'segment'=>$segs[mt_rand(0,count($segs)-1)],'privateLabel'=>mt_rand(0,2)==0,'scanned'=>mt_rand(0,3)>0]; }
    $cu=mt_rand(0,3)==0?mt_rand(1,2):0;
    $recs[]=['rid'=>"r$u-$k",'day'=>$d,'weekday'=>(int)date('w',strtotime($d)),'storeType'=>mt_rand(0,5)?'food':'nonfood','chain'=>$chains[mt_rand(0,3)],'total'=>$tot,'discount'=>$cu?500:0,'couponsUsed'=>$cu,'shareWithPartners'=>$u%2==0,'items'=>$items]; }
  $r=cs_api_records(new WP_REST_Request(['x-cs-key'=>CS_APP_KEY],['pid'=>$pid,'appVersion'=>'1.6.2','records'=>$recs])); if($r->status!==200) { var_dump($r); exit(1);} }
echo "righe: ".$wpdb->get_var('SELECT COUNT(*) FROM wp_cs_records')." spese, ".$wpdb->get_var('SELECT COUNT(*) FROM wp_cs_items')." prodotti\n";
$variants=[ [], ['gruppo'=>'mese'], ['insegna'=>'Conad','reparto'=>$segs[0],'marca'=>'pl','partner'=>'1'], ['insegna'=>'(non indicata)','tipo'=>'nonfood'], ['q'=>'latte','giorni'=>'365'], ['dal'=>'2026-09-01','al'=>'2026-08-01'], ['q'=>"x'; DROP TABLE wp_cs_items; --"] ];
foreach($variants as $v){ $p=cs_an_params($v); foreach(cs_an_sections() as $k=>$fn){ $s=$fn($p); foreach($s['rows'] as $row) if(count($row)!==count($s['cols'])) { echo "colonne errate in $k\n"; exit(1);} }
  echo "ok filtri ".json_encode($v)."\n"; }
$p=cs_an_params([]); foreach(['kpi','andamento','fasce','buoni','frequenza','coorti','matrice'] as $k){ $s=cs_an_sections()[$k]($p); echo "\n== ".$s['title']." (".count($s['rows'])." righe)\n"; foreach(array_slice($s['rows'],0,4) as $r){ echo '  '.implode(' | ',array_map(fn($x,$c)=>cs_an_cell($x,$c[1]),$r,$s['cols']))."\n"; } }
$s=cs_an_products(cs_an_params(['q'=>'latte','giorni'=>'365'])); echo "\nprodotti latte: ".count($s['rows'])."\n";
$s=cs_an_prices(cs_an_params(['q'=>'latte','giorni'=>'365','gruppo'=>'mese'])); echo "prezzi latte: ".count($s['rows'])." righe\n";
$_GET=['giorni'=>'90']; ob_start(); cs_an_page(); $html=ob_get_clean(); echo "pagina: ".strlen($html)." byte, sezioni ".substr_count($html,'class="cs-sec"')."\n";
// CSV
$_GET=['sezione'=>'andamento','gruppo'=>'mese']; ob_start(); try{ foreach($GLOBALS['_hooks']['admin_post_cs_an_csv'] as $f) $f(); }catch(Throwable $e){} 
echo "tabella items ancora presente: ".$wpdb->get_var("SELECT COUNT(*) FROM wp_cs_items")."\n";
