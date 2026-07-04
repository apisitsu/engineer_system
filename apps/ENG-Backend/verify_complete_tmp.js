const { engPool } = require('./instance/eng_db');
const { maqPool } = require('./instance/maq_db');
const { pool: rodpcPool } = require('./instance/instance');
const { TABLES } = require('./api/engineer/mtc/mtcConstants');
const cnFormat = require('./api/engineer/mtc/utils/cnFormat');
const PART_TYPE_ITEM_PREFIX={ball:'3',race:'2',body:'[15]',sleeve:'6',mecha:'9',spherical:'4'};
const normalizeCn=r=>cnFormat.toControlNo(r)||String(r||'').trim().toUpperCase().replace(/-[A-Z]$/,'');
function cnPartType(cn){const m=String(cn||'').toUpperCase().match(/^([A-Z])(\d{2})/);if(!m)return 'other';const[,l,d]=m;const n=+d;if(l==='C'){if(n>=31&&n<=39)return 'ball';if(n>=21&&n<=29)return 'race';if((n>=11&&n<=19)||(n>=51&&n<=59))return 'body';if((n>=61&&n<=64)||n===69)return 'sleeve';}if(l==='A'&&n>=41&&n<=49)return 'spherical';if(l==='C'&&(n===95||n===99))return 'mecha';return 'other';}
(async()=>{
  const cfg=await engPool.query('SELECT key,value FROM sds_report_config');
  const scope={part_types:['ball','race','mecha'],process_codes:['1011','1012','1021','1022','1031','1041','1042','1061','1062','1101','1102','1161','1162','1241','1321'],work_centers:['05','09','29','30','31','32','37'],excluded_cns:['C39-00209','C29-04044','C29-04045'],since_date:'2023-01-01',tooling_optional_machines:['PSG-64','GS-64PFII']};
  for(const r of cfg.rows) if(r.key in scope) scope[r.key]=r.value; if(Array.isArray(scope.since_date))scope.since_date=scope.since_date[0];
  const TARGET=new Set(scope.tooling_optional_machines);
  const exclItemNos=scope.excluded_cns.map(c=>cnFormat.toItemNo(c)).filter(Boolean);
  const prefixRegex='^('+scope.part_types.map(pt=>PART_TYPE_ITEM_PREFIX[pt]).filter(Boolean).join('|')+')';
  const [prod,rpiTool,mcode,rodpcMachine,tpl,stamps]=await Promise.all([
    maqPool.query(`SELECT control_no,machine,process,MIN(comp_date) AS first_seen FROM ${TABLES.LPB_PC_PRODUCTION} WHERE control_no IS NOT NULL AND control_no NOT LIKE 'PM%' AND control_no <> ALL($1) AND comp_date>=$2 AND machine IS NOT NULL AND wc=ANY($3) AND process=ANY($4) AND control_no ~ $5 GROUP BY control_no,machine,process`,[exclItemNos,scope.since_date,scope.work_centers,scope.process_codes,prefixRegex]),
    maqPool.query(`SELECT process_plan_no AS control_no,process_code FROM ${TABLES.LPB_ENG_R_PI_TOOL} WHERE process_plan_no IS NOT NULL AND process_plan_no ~ '^[A-Z][0-9]{2}-' AND tool_dwg_no IS NOT NULL`),
    engPool.query(`SELECT machine_code,machine_name FROM ${TABLES.SDS_MACHINE_CODE}`),
    rodpcPool.query(`SELECT machine_code,TRIM(m_model) AS m_model FROM m_machine WHERE wc=ANY($1) AND m_model IS NOT NULL AND TRIM(m_model)!=''`,[scope.work_centers]),
    engPool.query(`SELECT machine_type_name FROM ${TABLES.SDS_PARAMETER} WHERE cn IS NULL GROUP BY machine_type_name HAVING COUNT(param_key)>0`),
    engPool.query("SELECT cn,machine_type_name,process_code FROM sds_approval WHERE prepared_em_id IS NOT NULL AND checked_em_id IS NOT NULL AND approved_em_id IS NOT NULL AND approved_em_id<>prepared_em_id"),
  ]);
  const mcMap={};for(const r of rodpcMachine.rows)if(r.m_model)mcMap[r.machine_code]=r.m_model;for(const r of mcode.rows)mcMap[r.machine_code]=r.machine_name;
  const planHasTool=new Set();for(const r of rpiTool.rows)planHasTool.add(r.control_no+'||'+r.process_code);
  const tplSet=new Set(tpl.rows.map(r=>r.machine_type_name));
  const fullStamp=new Set();for(const s of stamps.rows)fullStamp.add(s.cn+'||'+s.machine_type_name+'||'+s.process_code);
  const excl=new Set(scope.excluded_cns.map(normalizeCn));
  const dedup=new Map();
  for(const row of prod.rows){const mName=mcMap[row.machine]||null;if(!TARGET.has(mName))continue;const cn=normalizeCn(row.control_no);if(excl.has(cn))continue;const pt=cnPartType(cn);if(!scope.part_types.includes(pt))continue;if(planHasTool.has(cn+'||'+row.process))continue;const key=cn+'||'+mName+'||'+row.process;if(!dedup.has(key)||row.first_seen<dedup.get(key).first_seen)dedup.set(key,{cn,machine_type_name:mName,process_code:row.process,first_seen:row.first_seen});}
  const sheets=[...dedup.values()];
  let complete=0,noTpl=0,noStamp=0;
  for(const s of sheets){const hasTpl=tplSet.has(s.machine_type_name);const stamped=fullStamp.has(s.cn+'||'+s.machine_type_name+'||'+s.process_code);if(hasTpl&&stamped)complete++;else{if(!hasTpl)noTpl++;if(!stamped)noStamp++;}}
  console.log('tooling_not_required sheets:',sheets.length);
  console.log('=> would be COMPLETE (template+full stamp):',complete);
  console.log('   missing template:',noTpl,'| missing full stamp:',noStamp);
  await engPool.end();await maqPool.end();await rodpcPool.end();
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
