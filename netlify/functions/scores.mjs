import { getStore } from '@netlify/blobs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
const response=(status,obj)=>new Response(JSON.stringify(obj),{status,headers});
function dayJapan(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function weekStart(day){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
export default async (request)=>{
 try{
  const store=getStore('bank-code-scores');
  if(request.method==='POST'){
   const data=await request.json().catch(()=>null);
   if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>18||!Number.isSafeInteger(data.score)||data.score<0||data.score>10000000)return response(400,{error:'invalid score'});
   const now=new Date();const day=dayJapan();
   const record={name:data.name.trim().slice(0,18),score:data.score,day,when:now.toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'}),createdAt:now.toISOString()};
   const key=now.toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID();
   await store.setJSON(key,record);return response(201,{ok:true});
  }
  if(request.method!=='GET')return response(405,{error:'method not allowed'});
  const mode=new URL(request.url).searchParams.get('mode')||'all';if(!['all','monthly','weekly','daily'].includes(mode))return response(400,{error:'invalid mode'});
  const today=dayJapan();const all=[];let cursor;
  do{const page=await store.list({paginate:true,cursor});for(const item of page.blobs){const rec=await store.get(item.key,{type:'json'}).catch(()=>null);if(rec&&typeof rec.score==='number')all.push(rec)}cursor=page.cursor}while(cursor);
  const filtered=all.filter(r=>mode==='all'||(mode==='daily'&&r.day===today)||(mode==='weekly'&&r.day&&weekStart(r.day)===weekStart(today))||(mode==='monthly'&&r.day?.slice(0,7)===today.slice(0,7)));
  filtered.sort((a,b)=>b.score-a.score);return response(200,{scores:filtered.slice(0,10)});
 }catch(e){console.error(e);return response(500,{error:'server error'})}
};
