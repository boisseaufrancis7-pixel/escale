// Escale — appli de voyage de groupe. Données partagées via Firebase; mode essai local sans configuration.
{

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CURS=[['CAD','Dollar canadien'],['USD','Dollar américain'],['EUR','Euro'],['GBP','Livre sterling'],['MXN','Peso mexicain'],['CHF','Franc suisse'],['JPY','Yen japonais'],['AUD','Dollar australien'],['DOP','Peso dominicain'],['CRC','Colón costaricien'],['CUP','Peso cubain'],['MAD','Dirham marocain'],['THB','Baht thaïlandais'],['VND','Dông vietnamien'],['ISK','Couronne islandaise'],['BRL','Réal brésilien'],['COP','Peso colombien'],['PEN','Sol péruvien']];
const money=(c,cur)=>{try{return (c/100).toLocaleString('fr-CA',{style:'currency',currency:cur||'CAD'})}catch(e){return (c/100).toFixed(2)+' '+cur}};
const parseAmt=v=>{const n=parseFloat(String(v).replace(/[\s$€£]/g,'').replace(',','.'));return isFinite(n)?Math.round(n*100):NaN};
const parseRate=v=>{const n=parseFloat(String(v).replace(/\s/g,'').replace(',','.'));return isFinite(n)&&n>0?n:NaN};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>iso(new Date());
const D=s=>new Date(s+'T12:00:00');
const addDays=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return iso(d)};
const diffDays=(a,b)=>Math.round((D(b)-D(a))/864e5);
const fmtDay=s=>{const d=D(s);return isNaN(d)?s:d.toLocaleDateString('fr-CA',{weekday:'short',day:'numeric',month:'short'})};
const fmtLong=s=>{const d=D(s);return isNaN(d)?s:d.toLocaleDateString('fr-CA',{day:'numeric',month:'long'})};
const days=t=>{const n=Math.max(0,diffDays(t.start,t.end));const out=[];for(let i=0;i<=n&&i<90;i++)out.push(addDays(t.start,i));return out};
const CATS=[['food','Nourriture'],['lodge','Hébergement'],['transport','Transport'],['act','Activités'],['shop','Achats'],['other','Autre']];
const catName=c=>(CATS.find(x=>x[0]===c)||CATS[5])[1];
const LKEY='escale-v1';
const ME=(()=>{try{return JSON.parse(localStorage.getItem('escale-moi'))||{}}catch(e){return {}}})();
const saveMe=()=>{try{localStorage.setItem('escale-moi',JSON.stringify(ME))}catch(e){}};

/* ---------- Stockage : Firebase (partagé) ou cet appareil (mode essai) ---------- */
const FB_VER='10.12.2';
const CFG=window.ESCALE_FIREBASE||{};
const configured=!!CFG.apiKey&&!String(CFG.apiKey).startsWith('COLLE');
const lsGet=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const secretId=()=>{const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,x=>'abcdefghijkmnpqrstuvwxyz23456789'[x%32]).join('')+'xx'};
let mine=lsGet('escale-voyages',[]);
const addMine=id=>{if(!mine.includes(id)){mine.unshift(id);lsSet('escale-voyages',mine)}};
const St={mode:'wait',trips:[],items:{},missing:{},loaded:false,ro:false,slow:false,err:'',offline:!navigator.onLine};
const tripMap={};
const refreshTrips=()=>{St.trips=mine.map(id=>tripMap[id]).filter(Boolean)};
let F=null,loc={trips:{},items:{}};const subs={};
function errMsg(e){const c=(e&&e.code)||'';
 if(c.includes('admin-restricted-operation')||c.includes('operation-not-allowed'))return 'La connexion anonyme n’est pas activée dans Firebase.';
 if(c.includes('api-key'))return 'La configuration Firebase est invalide.';
 if(c.includes('permission-denied'))return 'Accès refusé par la base de données : les règles de sécurité ne sont pas en place.';
 if(c.includes('network')||c.includes('unavailable'))return 'Pas de connexion Internet pour le moment.';
 return 'Problème de connexion aux données'+(c?' ('+c+')':'')+'.'}
async function startFirebase(){
 try{const base='https://www.gstatic.com/firebasejs/'+FB_VER+'/';
  const [appM,authM,fsM]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
  const app=appM.initializeApp(CFG);let fdb;
  try{fdb=fsM.initializeFirestore(app,{localCache:fsM.persistentLocalCache({tabManager:fsM.persistentMultipleTabManager()})})}catch(e){fdb=fsM.getFirestore(app)}
  const auth=authM.getAuth(app);await auth.authStateReady();if(!auth.currentUser)await authM.signInAnonymously(auth);
  F={db:fdb,...fsM};St.mode='fb';St.loaded=true;mine.forEach(watch);render()
 }catch(e){St.mode='fb';St.loaded=true;St.err=errMsg(e);render()}}
function watch(tid){if(St.mode!=='fb'||!F||subs[tid])return;
 subs[tid]=[F.onSnapshot(F.doc(F.db,'trips',tid),s=>{if(s.exists()){tripMap[tid]={...s.data(),id:tid};delete St.missing[tid]}else if(!s.metadata.fromCache){delete tripMap[tid];St.missing[tid]=1}refreshTrips();render()},e=>{St.err=errMsg(e);render()}),
  F.onSnapshot(F.collection(F.db,'trips',tid,'items'),s=>{St.items[tid]=s.docs.map(d=>({...d.data(),id:d.id}));render()},()=>{})]}
function unwatch(tid){(subs[tid]||[]).forEach(u=>u());delete subs[tid]}
function forget(tid){mine=mine.filter(x=>x!==tid);lsSet('escale-voyages',mine);unwatch(tid);delete tripMap[tid];delete St.items[tid];delete St.missing[tid];delete ME[tid];saveMe();refreshTrips()}
function startLocal(){St.mode='local';loc=lsGet('escale-local',loc);syncLoc();St.loaded=true;render()}
function syncLoc(){for(const k in tripMap)delete tripMap[k];for(const id in loc.trips){tripMap[id]=loc.trips[id];St.items[id]=Object.values(loc.items[id]||{})}refreshTrips()}
const saveLoc=()=>{lsSet('escale-local',loc);syncLoc();render()};
const W=p=>p.catch(e=>toast(errMsg(e)));
const clean=o=>{const r={};for(const k in o)if(o[k]!==undefined)r[k]=o[k];return r};
const Save={
 trip:t=>{const {id,...b}=clean(t);addMine(id);if(St.mode==='local'){loc.trips[id]={...b,id};return saveLoc()}
  tripMap[id]={...b,id};refreshTrips();watch(id);render();W(F.setDoc(F.doc(F.db,'trips',id),b))},
 item:(tid,it)=>{const {id,...b}=clean(it);if(St.mode==='local'){(loc.items[tid]=loc.items[tid]||{})[id]={...b,id};return saveLoc()}W(F.setDoc(F.doc(F.db,'trips',tid,'items',id),b))},
 del:(tid,id)=>{if(St.mode==='local'){if(loc.items[tid])delete loc.items[tid][id];return saveLoc()}W(F.deleteDoc(F.doc(F.db,'trips',tid,'items',id)))},
 delTrip:async tid=>{const list=St.items[tid]||[];forget(tid);
  if(St.mode==='local'){delete loc.trips[tid];delete loc.items[tid];return saveLoc()}
  try{for(const i of list)await F.deleteDoc(F.doc(F.db,'trips',tid,'items',i.id));await F.deleteDoc(F.doc(F.db,'trips',tid))}catch(e){toast(errMsg(e))}render()}
};
const inviteLink=t=>location.origin+location.pathname+'#join-'+t.id;

/* ---------- Localisation des lieux (OpenStreetMap) ---------- */
const gq=[];let gbusy=false;
function geocode(q){return new Promise(res=>{gq.push({q,res});pump()})}
async function pump(){if(gbusy)return;gbusy=true;
 while(gq.length){const {q,res}=gq.shift();
  try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=fr&q='+encodeURIComponent(q));const j=await r.json();res(j&&j[0]?{lat:+j[0].lat,lng:+j[0].lon}:null)}catch(e){res(null)}
  await sleep(1100)}
 gbusy=false}
const geoQuery=(t,it)=>it.type==='doc'?(it.addr||''):(it.place?it.place+', '+t.dest:'');
async function locate(t,it){const q=geoQuery(t,it);if(!q)return;const g=await geocode(q);
 const cur=(St.items[t.id]||[]).find(i=>i.id===it.id);if(!cur)return;
 Save.item(t.id,{...cur,geo:q,lat:g?g.lat:null,lng:g?g.lng:null})}
async function locateTrip(t){if(t.geo===t.dest)return;const g=await geocode(t.dest);const cur=tripMap[t.id];if(!cur)return;Save.trip({...cur,geo:t.dest,lat:g?g.lat:null,lng:g?g.lng:null})}

/* ---------- Calculs d'argent (comme Moitié, avec devises) ---------- */
const toHome=(t,cents,cur,rt)=>cur===t.home?cents:Math.round(cents*(rt||t.rate||1));
const fmtRate=r=>String(Math.round(r*10000)/10000).replace('.',',');
async function fetchRate(from,to){if(from===to)return 1;
 try{const r=await fetch('https://api.frankfurter.app/latest?from='+from+'&to='+to);if(r.ok){const j=await r.json();if(j&&j.rates&&j.rates[to])return j.rates[to]}}catch(e){}
 try{const r=await fetch('https://open.er-api.com/v6/latest/'+from);if(r.ok){const j=await r.json();if(j&&j.rates&&j.rates[to])return j.rates[to]}}catch(e){}
 return null}
const rateTried={};
async function autoRate(t){if(!t||t.cur===t.home||t.rateAuto===false||t.rateDate===today()||rateTried[t.id])return;rateTried[t.id]=1;
 const r=await fetchRate(t.cur,t.home);const cur=tripMap[t.id];if(!r||!cur)return;
 Save.trip({...cur,rate:Math.round(r*10000)/10000,rateDate:today(),rateAuto:true})}
async function sheetRate(){const s=V.sheet;if(!s||s.type!=='trip')return;const x=s.x;if(x.cur===x.home)return;
 s.rateMsg='Recherche du taux du jour…';paintSheet();const r=await fetchRate(x.cur,x.home);if(V.sheet!==s)return;
 if(r){x.rateTxt=fmtRate(r);x.rateDate=today();s.rateMsg='Taux du jour trouvé : 1 '+x.cur+' = '+fmtRate(r)+' '+x.home+'.'}else s.rateMsg='Taux introuvable pour le moment : entre-le à la main.';paintSheet()}
function shares(t,e){ // parts en devise du voyage (home), par personne
 const out={};
 if(e.mode==='exact'){for(const id in e.parts||{})out[id]=toHome(t,e.parts[id],e.cur,e.rate);return out}
 const ids=e.split||[],n=ids.length;if(!n)return out;
 const tot=toHome(t,e.amount,e.cur,e.rate),base=Math.floor(tot/n);let rest=tot-base*n;
 ids.forEach(id=>{out[id]=base+(rest>0?1:0);if(rest>0)rest--});return out}
const expHome=(t,e)=>Object.values(shares(t,e)).reduce((s,v)=>s+v,0);
function balances(t){const b={};t.people.forEach(p=>b[p.id]=0);
 for(const e of items(t,'exp')){const s=shares(t,e);let sum=0;for(const id in s){b[id]=(b[id]||0)-s[id];sum+=s[id]}b[e.by]=(b[e.by]||0)+sum}
 for(const p of items(t,'pay')){b[p.by]=(b[p.by]||0)+p.amount;b[p.to]=(b[p.to]||0)-p.amount}
 return b}
function settle(b){const cr=[],de=[];for(const id in b){if(b[id]>0)cr.push([id,b[id]]);else if(b[id]<0)de.push([id,-b[id]])}
 cr.sort((x,y)=>y[1]-x[1]);de.sort((x,y)=>y[1]-x[1]);const out=[];let i=0,j=0;
 while(i<de.length&&j<cr.length){const v=Math.min(de[i][1],cr[j][1]);if(v>0)out.push({from:de[i][0],to:cr[j][0],cents:v});de[i][1]-=v;cr[j][1]-=v;if(!de[i][1])i++;if(!cr[j][1])j++}
 return out}
const items=(t,type)=>(St.items[t.id]||[]).filter(i=>i.type===type);
const spent=t=>items(t,'exp').reduce((s,e)=>s+expHome(t,e),0);
const nm=(t,id)=>{const p=t.people.find(x=>x.id===id);return p?p.name:'(personne retirée)'};
const nmMe=(t,id)=>esc(nm(t,id))+(ME[t.id]===id?'<span class="me">toi</span>':'');
function status(t){const d=today();if(d<t.start){const n=diffDays(d,t.start);return n===1?'Départ demain':'Départ dans '+n+' jours'}
 if(d>t.end)return 'Voyage terminé';return 'Jour '+(diffDays(t.start,d)+1)+' sur '+days(t).length}
const gmaps=q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
const groute=(t,places)=>{const enc=p=>encodeURIComponent(p+', '+t.dest);let u='https://www.google.com/maps/dir/?api=1&origin='+enc(places[0])+'&destination='+enc(places[places.length-1]);
 const mid=places.slice(1,-1).slice(0,8);if(mid.length)u+='&waypoints='+mid.map(enc).join('%7C');return u};

/* ---------- Icônes ---------- */
const I={
 back:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
 gear:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
 check:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
 pin:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
 rec:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
 pay:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
 plane:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14l-7-3 1-2 8 1 5-5a2 2 0 0 1 3 3l-5 5 1 8-2 1-3-7-4 4v3l-2 1-1-4-4-1 1-2h3z"/></svg>',
 bed:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18V6M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10" r="2"/></svg>',
 car:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
 tick:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>'};
const DOCK={vol:['Vol',I.plane],hotel:['Hébergement',I.bed],auto:['Location d’auto',I.car],autre:['Autre',I.tick]};

/* ---------- Vues ---------- */
const V={tab:null,sub:'list',sheet:null,toast:null};
const route=()=>{const h=location.hash.slice(1);return h.startsWith('t-')?h.slice(2):''};
const curT=()=>St.trips.find(t=>t.id===route());
const modeLine=()=>St.mode==='fb'?'Synchronisé en direct avec les autres voyageurs.':'';
function notes(){let h='';if(St.offline)h+=`<div class="note">Hors ligne : tes ajouts seront envoyés au retour du réseau.</div>`;if(St.mode==='local')h+=`<div class="note">Mode essai : les voyages restent sur cet appareil. Configure Firebase pour les partager.</div>`;if(St.err)h+=`<div class="note warn" role="alert">${esc(St.err)}</div>`;if(St.slow)h+=`<div class="note warn">Les données ne répondent pas encore. Vérifie ta connexion.</div>`;if(St.ro)h+=`<div class="note warn">Lecture seule : demande au propriétaire de t’inviter comme éditeur.</div>`;return h}

function home(){
 const ts=St.trips.slice().sort((a,b)=>(a.start||'').localeCompare(b.start||''));
 return `<div class="band"><div class="bin"><div class="brand">Escale</div>
<h1 style="margin-top:14px">Ton voyage, du premier plan au dernier dollar.</h1>
<p class="tag">Le programme jour par jour, les endroits sur la carte, les réservations et les dépenses partagées entre vous.</p></div></div>
<div class="wrap stack">${notes()}
<div class="row" style="justify-content:space-between"><h2>Tes voyages</h2>${ts.length?`<button class="btn sm dark" data-act="newtrip">Nouveau voyage</button>`:''}</div>
${Object.keys(St.missing).filter(id=>mine.includes(id)).map(id=>`<div class="card row"><div class="grow sub">Un voyage a été supprimé par un des voyageurs.</div><button class="btn sm" data-act="forget" data-id="${esc(id)}">Retirer</button></div>`).join('')}
${!St.loaded?`<div class="card empty">Connexion…</div>`:ts.length?ts.map(t=>`<a class="card" href="#t-${esc(t.id)}"><div class="row"><div class="grow">
<div style="font:700 18px Sora,sans-serif">${esc(t.name)}</div><div class="sub">${esc(t.dest)} · ${esc(fmtLong(t.start))} au ${esc(fmtLong(t.end))}</div>
<div class="sub" style="margin-top:4px;color:var(--sea);font-weight:600">${esc(status(t))}${St.items[t.id]?' · '+money(spent(t),t.home)+' dépensés':''}</div></div>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></div></a>`).join('')
 :`<div class="card empty stack" style="align-items:center"><div>Aucun voyage pour l’instant. Crée le tien, ou ouvre le lien d’invitation qu’un ami t’a envoyé.</div><button class="btn pri" data-act="newtrip">Planifier mon premier voyage</button></div>`}
<p class="foot">${esc(modeLine())}</p></div>`}

function tPlan(t){
 const acts=items(t,'act'),d0=today(),ds=days(t);
 const row=a=>`<div class="it${a.done?' done':''}"><button class="chk" data-act="tdone" data-id="${esc(a.id)}" aria-pressed="${!!a.done}" aria-label="Marquer « ${esc(a.title)} » comme fait">${a.done?I.check:''}</button>
<button class="main" data-act="editact" data-id="${esc(a.id)}"><span class="time">${esc(a.time||'—')}</span><span class="grow"><span class="t1">${esc(a.title)}</span>${a.place?`<span class="sub">${esc(a.place)}</span>`:''}</span>${a.cost?`<span class="amt sub">${money(a.cost,a.cur||t.home)}</span>`:''}</button></div>`;
 const sorted=l=>l.slice().sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
 let h=ds.map((d,i)=>{const l=sorted(acts.filter(a=>a.day===d));return `<div class="dayh" id="d-${d}"><span><b>Jour ${i+1}</b> · ${esc(fmtDay(d))}${d===d0?'<span class="today">Aujourd’hui</span>':''}</span><button class="btn sm" data-act="newact" data-day="${d}" style="min-height:36px;padding:0 10px" aria-label="Ajouter une activité au jour ${i+1}">+ Ajouter</button></div>
<div class="card" style="padding:4px 14px">${l.length?l.map(row).join(''):`<div class="sub" style="padding:12px 0">Rien de prévu pour l’instant.</div>`}</div>`}).join('');
 const ideas=sorted(acts.filter(a=>!a.day||!ds.includes(a.day)));
 h+=`<div class="dayh"><span><b>Idées</b> · pas encore placées</span></div><div class="card" style="padding:4px 14px">${ideas.length?ideas.map(row).join(''):`<div class="sub" style="padding:12px 0">Note ici les envies sans date : tu les placeras plus tard.</div>`}</div>`;
 return h}

const DAYC=['#C2521D','#0E6E86','#7A4FB5','#2D6A3E','#A86B00','#C23B6B','#3B5BA9'];
function mapPoints(t){const ds=days(t),pts=[];
 items(t,'act').filter(a=>typeof a.lat==='number').sort((a,b)=>(a.day||'z').localeCompare(b.day||'z')||(a.time||'99').localeCompare(b.time||'99')).forEach(a=>{const i=ds.indexOf(a.day);pts.push({lat:a.lat,lng:a.lng,label:i>=0?String(i+1):'?',color:i>=0?DAYC[i%DAYC.length]:'#6b7c84',title:a.title,sub:(i>=0?'Jour '+(i+1):'Idée')+(a.time?' · '+a.time:''),day:i})});
 items(t,'doc').filter(x=>typeof x.lat==='number').forEach(x=>pts.push({lat:x.lat,lng:x.lng,label:'R',color:'#10222A',title:x.title,sub:'Réservation',day:-2}));
 return pts}
function tMap(t){
 const acts=items(t,'act').filter(a=>a.place),ds=days(t);
 const missing=[...acts,...items(t,'doc').filter(x=>x.addr)].filter(x=>x.geo!==geoQuery(t,x)).length;
 const used=[...new Set(acts.filter(a=>typeof a.lat==='number').map(a=>ds.indexOf(a.day)).filter(i=>i>=0))].sort((a,b)=>a-b);
 let h=`<div id="mapslot" class="mapslot"></div>
${used.length?`<div class="legend">${used.map(i=>`<span><i style="background:${DAYC[i%DAYC.length]}"></i>Jour ${i+1}</span>`).join('')}<span><i style="background:#10222A"></i>Réservation</span></div>`:''}
${missing?`<button class="btn full" data-act="geoall">Placer ${missing} lieu${missing>1?'x':''} sur la carte</button>`:''}`;
 ds.forEach((d,i)=>{const l=acts.filter(a=>a.day===d).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));if(!l.length)return;
  h+=`<div class="dayh"><span><b>Jour ${i+1}</b> · ${esc(fmtDay(d))}</span></div><div class="card" style="padding:4px 14px">${l.map(a=>`<div class="place"><span><span class="t1">${esc(a.title)}</span><span class="sub">${esc(a.place)}${a.geo===geoQuery(t,a)&&a.lat==null?' · introuvable sur la carte':''}</span></span><a class="btn sm" href="${esc(gmaps(a.place+', '+t.dest))}" target="_blank" rel="noopener">${I.pin}Y aller</a></div>`).join('')}
${l.length>1?`<div style="padding:10px 0"><a class="btn dark full" href="${esc(groute(t,l.map(a=>a.place)))}" target="_blank" rel="noopener">Trajet de la journée dans Google Maps</a></div>`:''}</div>`});
 if(!acts.length)h+=`<div class="card empty">Ajoute un lieu à tes activités (onglet Programme) : il apparaîtra sur la carte.</div>`;
 return h}

/* ---------- Carte interactive (Leaflet + OpenStreetMap) ---------- */
let Lp=null,lmap=null,layer=null,lastKey='';
const mapbox=document.createElement('div');mapbox.className='mapbox';
function loadLeaflet(){if(Lp)return Lp;Lp=new Promise((res,rej)=>{const c=document.createElement('link');c.rel='stylesheet';c.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(c);
 const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=()=>res(window.L);s.onerror=()=>{Lp=null;rej(new Error('leaflet'))};document.head.appendChild(s)});return Lp}
async function mountMap(t){const slot=document.getElementById('mapslot');if(!slot)return;slot.appendChild(mapbox);
 try{const L=await loadLeaflet();if(!document.getElementById('mapslot'))return;
  if(!lmap){lmap=L.map(mapbox,{scrollWheelZoom:false});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© les contributeurs d’OpenStreetMap'}).addTo(lmap);layer=L.layerGroup().addTo(lmap)}
  lmap.invalidateSize();
  const pts=mapPoints(t),key=t.id+'|'+JSON.stringify(pts)+'|'+(t.lat||'');if(key===lastKey)return;lastKey=key;layer.clearLayers();
  const byDay={};pts.forEach(p=>{if(p.day>=0)(byDay[p.day]=byDay[p.day]||[]).push([p.lat,p.lng])});
  Object.entries(byDay).forEach(([d,l])=>{if(l.length>1)L.polyline(l,{color:DAYC[d%DAYC.length],weight:3,opacity:.7,dashArray:'6 6'}).addTo(layer)});
  pts.forEach(p=>L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<span class="pinm" style="background:'+p.color+'">'+esc(p.label)+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).bindPopup('<b>'+esc(p.title)+'</b><br>'+esc(p.sub)).addTo(layer));
  if(pts.length)lmap.fitBounds(pts.map(p=>[p.lat,p.lng]),{padding:[36,36],maxZoom:15});else if(typeof t.lat==='number')lmap.setView([t.lat,t.lng],12);else lmap.setView([30,0],2)
 }catch(e){slot.innerHTML='<div class="card empty">La carte ne peut pas se charger pour le moment (pas de connexion?).</div>'}}

function tMoney(t){
 const b=balances(t),st=settle(b),sub=V.sub;
 let h=`<div class="seg" role="group" aria-label="Argent"><button data-act="sub" data-v="list" aria-pressed="${sub==='list'}">Dépenses</button><button data-act="sub" data-v="bal" aria-pressed="${sub==='bal'}">Soldes${st.length?' ('+st.length+')':''}</button><button data-act="sub" data-v="bud" aria-pressed="${sub==='bud'}">Budget</button></div>`;
 if(sub==='list'){
  const l=[...items(t,'exp'),...items(t,'pay')].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.t||0)-(a.t||0));
  if(!l.length)return h+`<div class="card empty">Aucune dépense. Ajoute la première avec le bouton en bas.</div>`;
  let last='';l.forEach(e=>{if(e.date!==last){if(last)h+='</div>';h+=`<div class="day">${esc(fmtDay(e.date))}</div><div class="card" style="padding:4px 14px">`;last=e.date}
   h+=e.type==='pay'?`<button class="exp" data-act="editexp" data-id="${esc(e.id)}"><span class="ico s">${I.pay}</span><span class="grow"><b>${esc(nm(t,e.by))}</b> a remboursé <b>${esc(nm(t,e.to))}</b></span><span class="amt">${money(e.amount,t.home)}</span></button>`
   :`<button class="exp" data-act="editexp" data-id="${esc(e.id)}"><span class="ico">${I.rec}</span><span class="grow"><span class="t1">${esc(e.desc)}</span><span class="sub">${esc(catName(e.cat))} · payé par ${esc(nm(t,e.by))}</span></span><span class="right"><span class="amt">${money(e.amount,e.cur)}</span>${e.cur!==t.home?`<span class="sub">${money(expHome(t,e),t.home)}</span>`:''}</span></button>`});
  return h+'</div>'}
 if(sub==='bal'){
  const mx=Math.max(1,...Object.values(b).map(Math.abs));
  h+=`<div class="card"><h2 style="margin-bottom:4px">Soldes</h2>${t.people.map(p=>{const v=b[p.id]||0,pc=Math.abs(v)/mx*50;return `<div class="bal"><span style="font-weight:600;overflow-wrap:anywhere">${nmMe(t,p.id)}</span><span class="amt ${v>0?'pos':v<0?'neg':''}">${v>0?'récupère '+money(v,t.home):v<0?'doit '+money(-v,t.home):'quitte'}</span>
<span class="track" aria-hidden="true"><span class="mid"></span><i style="${v>=0?'left:50%':'right:50%'};width:${pc}%;background:${v>=0?'var(--sea)':'var(--sun)'}"></i></span></div>`}).join('')}</div>
<div class="card"><h2 style="margin-bottom:4px">Pour tout régler</h2>${st.length?st.map(s=>`<div class="settle"><span><b>${nmMe(t,s.from)}</b> doit <span class="amt neg">${money(s.cents,t.home)}</span> à <b>${nmMe(t,s.to)}</b></span><button class="btn sm" data-act="paid" data-f="${esc(s.from)}" data-t="${esc(s.to)}" data-c="${s.cents}">C’est payé</button></div>`).join(''):`<div class="sub" style="padding-top:6px">Tout le monde est quitte.</div>`}</div>
<button class="btn full" data-act="copy">Copier le bilan pour l’envoyer au groupe</button>
${t.cur!==t.home?`<div class="sub">Montants en ${esc(t.home)}. Taux utilisé : 1 ${esc(t.cur)} = ${String(t.rate).replace('.',',')} ${esc(t.home)} (modifiable dans les réglages du voyage).</div>`:''}`;
  return h}
 const tot=spent(t),bud=t.budget||0,nd=days(t).length,ppl=t.people.length||1;
 const byCat={};items(t,'exp').forEach(e=>{byCat[e.cat||'other']=(byCat[e.cat||'other']||0)+expHome(t,e)});
 const mxc=Math.max(1,...Object.values(byCat));
 const paid={};items(t,'exp').forEach(e=>{paid[e.by]=(paid[e.by]||0)+expHome(t,e)});
 h+=`<div class="card stack"><div class="row" style="justify-content:space-between;align-items:baseline"><h2>Dépensé</h2><span class="amt" style="font-size:22px">${money(tot,t.home)}</span></div>
${bud?`<div class="meter${tot>bud?' over':''}" aria-hidden="true"><i style="width:${Math.min(100,tot/bud*100)}%"></i></div><div class="sub">${tot>bud?'Dépassement de '+money(tot-bud,t.home)+' sur le budget de '+money(bud,t.home):'Il reste '+money(bud-tot,t.home)+' sur le budget de '+money(bud,t.home)}</div>`:`<div class="sub">Aucun budget fixé. Ajoute-le dans les réglages du voyage.</div>`}</div>
<div class="stats"><div class="card stat"><div class="big-n">${money(Math.round(tot/ppl),t.home)}</div><div class="sub">par personne</div></div><div class="card stat"><div class="big-n">${money(Math.round(tot/nd),t.home)}</div><div class="sub">par jour en moyenne</div></div></div>
<div class="card"><h2 style="margin-bottom:8px">Par catégorie</h2>${Object.keys(byCat).length?CATS.filter(c=>byCat[c[0]]).map(c=>`<div style="padding:6px 0"><div class="row" style="justify-content:space-between"><span>${c[1]}</span><span class="amt">${money(byCat[c[0]],t.home)}</span></div><div class="meter" style="height:8px;margin-top:4px" aria-hidden="true"><i style="width:${byCat[c[0]]/mxc*100}%"></i></div></div>`).join(''):`<div class="sub">Aucune dépense encore.</div>`}</div>
<div class="card"><h2 style="margin-bottom:8px">Qui a payé quoi</h2>${t.people.map(p=>`<div class="row" style="justify-content:space-between;padding:6px 0"><span>${nmMe(t,p.id)}</span><span class="amt">${money(paid[p.id]||0,t.home)}</span></div>`).join('')}</div>`;
 return h}

function tPrep(t){
 const todos=items(t,'todo').sort((a,b)=>(a.done?1:0)-(b.done?1:0)||(a.t||0)-(b.t||0)),docs=items(t,'doc').sort((a,b)=>(a.date||'9').localeCompare(b.date||'9'));
 const left=todos.filter(x=>!x.done).length;
 return `<div class="card"><div class="row" style="justify-content:space-between"><h2>À faire avant de partir</h2><span class="sub">${todos.length?(todos.length-left)+' / '+todos.length:''}</span></div>
${todos.map(x=>`<div class="it${x.done?' done':''}"><button class="chk" data-act="tdone" data-id="${esc(x.id)}" aria-pressed="${!!x.done}" aria-label="Cocher « ${esc(x.text)} »">${x.done?I.check:''}</button><span class="grow t1" style="font-weight:500">${esc(x.text)}</span><button class="btn sm" data-act="deltodo" data-id="${esc(x.id)}" aria-label="Retirer « ${esc(x.text)} »" style="min-height:44px;width:44px;padding:0;border-color:transparent;color:var(--mut)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join('')}
<form class="addrow" data-form="todo" style="margin-top:10px"><input type="text" id="todo" placeholder="Ex. : Renouveler le passeport" aria-label="Nouvelle tâche" maxlength="80"><button class="btn dark" type="submit">Ajouter</button></form>
${todos.length?'':`<button class="btn full" data-act="basics" style="margin-top:10px">Ajouter la liste de base (passeport, assurance…)</button>`}</div>
<div class="card"><div class="row" style="justify-content:space-between"><h2>Réservations</h2><button class="btn sm dark" data-act="newdoc">Ajouter</button></div>
${docs.length?docs.map(x=>`<button class="exp" data-act="editdoc" data-id="${esc(x.id)}"><span class="ico">${(DOCK[x.kind]||DOCK.autre)[1]}</span><span class="grow"><span class="t1">${esc(x.title)}</span><span class="sub">${esc((DOCK[x.kind]||DOCK.autre)[0])}${x.date?' · '+esc(fmtDay(x.date)):''}${x.time?' à '+esc(x.time):''}</span>${x.ref?`<span style="display:block;margin-top:4px"><span class="code">${esc(x.ref)}</span></span>`:''}</span></button>`).join('')
 :`<div class="sub" style="padding-top:8px">Garde ici tes vols, ton hébergement et tes numéros de confirmation : tout sera au même endroit à l’aéroport.</div>`}</div>`}


/* ---------- Écran « Aujourd'hui » ---------- */
const nowHM=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const WX={0:['Ensoleillé','sun'],1:['Plutôt ensoleillé','sun'],2:['Partiellement nuageux','part'],3:['Nuageux','cloud'],45:['Brouillard','fog'],48:['Brouillard','fog'],51:['Bruine','rain'],53:['Bruine','rain'],55:['Bruine','rain'],56:['Bruine verglaçante','rain'],57:['Bruine verglaçante','rain'],61:['Faible pluie','rain'],63:['Pluie','rain'],65:['Forte pluie','rain'],66:['Pluie verglaçante','rain'],67:['Pluie verglaçante','rain'],71:['Faible neige','snow'],73:['Neige','snow'],75:['Forte neige','snow'],77:['Neige','snow'],80:['Averses','rain'],81:['Averses','rain'],82:['Fortes averses','rain'],85:['Averses de neige','snow'],86:['Averses de neige','snow'],95:['Orages','storm'],96:['Orages et grêle','storm'],99:['Orages et grêle','storm']};
const SV=(b,sz)=>'<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+b+'</svg>';
const WI={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 part:'<circle cx="8" cy="8" r="3"/><path d="M8 2v1M2 8h1M3.8 3.8l.7.7M12.2 3.8l-.7.7"/><path d="M9 19h8a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A3.3 3.3 0 0 0 9 19z"/>',
 cloud:'<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/>',
 rain:'<path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 14z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
 snow:'<path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01"/>',
 storm:'<path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 14z"/><path d="M12 14l-2 4h4l-2 4"/>',
 fog:'<path d="M4 10h16M6 14h12M4 18h16M7 6h10"/>'};
const wxCache={};
async function loadWx(t){
 if(typeof t.lat!=='number')return;const d0=today();const key=t.id+'|'+d0+'|'+t.lat;if(wxCache[key])return;
 const s0=d0>t.start?d0:t.start;let e0=addDays(s0,6);if(e0>t.end)e0=t.end;const lim=addDays(d0,15);if(e0>lim)e0=lim;
 if(d0>t.end||s0>lim){wxCache[key]={none:true};return}
 wxCache[key]={loading:true};
 try{const u='https://api.open-meteo.com/v1/forecast?latitude='+t.lat+'&longitude='+t.lng+'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date='+s0+'&end_date='+e0;
  const j=await (await fetch(u)).json();const dl=j.daily;
  wxCache[key]={days:dl.time.map((d,i)=>({d,code:dl.weather_code[i],max:dl.temperature_2m_max[i],min:dl.temperature_2m_min[i],rain:dl.precipitation_probability_max[i]}))}
 }catch(e){wxCache[key]={err:true}}
 render()}
function wxCard(t){
 if(typeof t.lat!=='number')return '';const w=wxCache[t.id+'|'+today()+'|'+t.lat];
 if(!w||w.loading)return `<div class="card sub">Chargement de la météo…</div>`;
 if(w.none)return '';if(w.err||!w.days||!w.days.length)return `<div class="card sub">Météo indisponible pour le moment.</div>`;
 const f=w.days[0],lab=WX[f.code]||['—','cloud'],r=x=>Math.round(x);
 return `<div class="card wx"><div class="row"><span class="wxi">${SV(WI[lab[1]],44)}</span><div class="grow"><div class="sub">Météo à ${esc(t.dest.split(',')[0])} · ${f.d===today()?'aujourd’hui':esc(fmtDay(f.d))}</div>
<div class="big-n">${r(f.max)}° <span class="sub" style="font-size:16px">/ ${r(f.min)}°</span></div><div>${lab[0]}${f.rain!=null?' · '+f.rain+' % de risque de pluie':''}</div></div></div>
${w.days.length>1?`<div class="wxs">${w.days.slice(1).map(x=>{const l=WX[x.code]||['—','cloud'];return `<div><span class="sub">${esc(fmtDay(x.d).split(' ')[0])}</span>${SV(WI[l[1]],22)}<b>${r(x.max)}°</b><span class="sub">${r(x.min)}°</span></div>`}).join('')}</div>`:''}</div>`}
function nextUp(t){
 const d0=today(),n=nowHM(),c=[];
 items(t,'act').forEach(a=>{if(a.day&&a.time&&!a.done&&(a.day>d0||(a.day===d0&&a.time>=n)))c.push({when:a.day+'T'+a.time,day:a.day,time:a.time,title:a.title,where:a.place?a.place+', '+t.dest:'',place:a.place,kind:'act'})});
 items(t,'doc').forEach(x=>{if(x.date&&(x.date>d0||(x.date===d0&&(x.time||'23:59')>=n)))c.push({when:x.date+'T'+(x.time||'00:00'),day:x.date,time:x.time,title:x.title,where:x.addr||'',place:x.addr,ref:x.ref,kind:'doc'})});
 c.sort((a,b)=>a.when.localeCompare(b.when));return c[0]}
function untilTxt(nx){const ms=new Date(nx.when)-new Date();if(isNaN(ms))return '';const m=Math.round(ms/60000);
 if(nx.day===today())return m<1?'maintenant':m<60?'dans '+m+' min':'dans '+Math.floor(m/60)+' h'+(m%60?' '+String(m%60).padStart(2,'0'):'');
 const dd=diffDays(today(),nx.day);return dd===1?'demain':'dans '+dd+' jours'}
function tToday(t){
 const d0=today(),ds=days(t),inTrip=d0>=t.start&&d0<=t.end,before=d0<t.start;loadWx(t);autoRate(t);
 const nx=nextUp(t);let h='';
 if(before){const n=diffDays(d0,t.start),todo=items(t,'todo'),left=todo.filter(x=>!x.done).length;
  h+=`<div class="card hero"><div class="sub">Départ pour ${esc(t.dest)}</div><div class="cd">${n===1?'Demain!':n+' jours'}</div><div class="sub">${n===1?'C’est le grand départ.':'avant le départ, le '+esc(fmtLong(t.start))}</div></div>`;
  h+=wxCard(t);
  h+=`<button class="card row" data-act="tab" data-v="prep" style="width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer"><span class="ico">${I.tick}</span><span class="grow"><span class="t1">${todo.length?(left?'Il reste '+left+' chose'+(left>1?'s':'')+' à préparer':'Tout est prêt!'):'Prépare ta liste avant le départ'}</span><span class="sub">Ouvrir l’onglet Préparer</span></span></button>`}
 else if(inTrip){const i=ds.indexOf(d0);h+=`<div class="card hero"><div class="sub">${esc(new Date().toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long'}))}</div><div class="cd">Jour ${i+1} <span style="font-size:20px;opacity:.7">sur ${ds.length}</span></div></div>`;h+=wxCard(t)}
 else{const tot=spent(t),st=settle(balances(t));
  h+=`<div class="card hero"><div class="sub">Voyage terminé</div><div class="cd">${money(tot,t.home)}</div><div class="sub">dépensés à ${t.people.length} · ${st.length?st.length+' remboursement'+(st.length>1?'s':'')+' à faire':'tout le monde est quitte'}</div></div>
<button class="btn full dark" data-act="gobal">Voir qui doit quoi</button>`}
 if(nx&&!(d0>t.end))h+=`<div class="card nx"><div class="sub">Prochain rendez-vous · <b style="color:var(--sun)">${esc(untilTxt(nx))}</b></div>
<div class="row" style="align-items:flex-start;margin-top:6px"><span class="ico${nx.kind==='doc'?'':' s'}">${nx.kind==='doc'?I.plane:I.pin}</span><div class="grow"><div class="t1" style="font-size:17px">${esc(nx.title)}</div>
<div class="sub">${nx.day===d0?'Aujourd’hui':esc(fmtDay(nx.day))}${nx.time?' à '+esc(nx.time):''}${nx.place?' · '+esc(nx.place):''}</div>${nx.ref?`<div style="margin-top:4px"><span class="code">${esc(nx.ref)}</span></div>`:''}</div></div>
${nx.where?`<a class="btn sm full" style="margin-top:10px" href="${esc(gmaps(nx.where))}" target="_blank" rel="noopener">${I.pin}Y aller</a>`:''}</div>`;
 if(inTrip){const acts=items(t,'act').filter(a=>a.day===d0).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
  const exp=items(t,'exp').filter(e=>e.date===d0),sp=exp.reduce((s,e)=>s+expHome(t,e),0),b=balances(t),mine=ME[t.id]?b[ME[t.id]]||0:null;
  h+=`<div class="card"><div class="row" style="justify-content:space-between"><h2>Programme du jour</h2><button class="btn sm" data-act="newact" data-day="${d0}" style="min-height:36px;padding:0 10px">+ Ajouter</button></div>
${acts.length?acts.map(a=>`<div class="it${a.done?' done':''}"><button class="chk" data-act="tdone" data-id="${esc(a.id)}" aria-pressed="${!!a.done}" aria-label="Marquer « ${esc(a.title)} » comme fait">${a.done?I.check:''}</button><button class="main" data-act="editact" data-id="${esc(a.id)}"><span class="time">${esc(a.time||'—')}</span><span class="grow"><span class="t1">${esc(a.title)}</span>${a.place?`<span class="sub">${esc(a.place)}</span>`:''}</span></button></div>`).join(''):`<div class="sub" style="padding-top:8px">Journée libre! Ajoute une activité si l’envie te prend.</div>`}</div>
<div class="stats"><div class="card stat"><div class="big-n">${money(sp,t.home)}</div><div class="sub">dépensés aujourd’hui</div></div><button class="card stat" data-act="gobal" style="text-align:left;font:inherit;color:inherit;cursor:pointer"><div class="big-n ${mine>0?'pos':mine<0?'neg':''}">${mine===null?'—':money(Math.abs(mine),t.home)}</div><div class="sub">${mine===null?'choisis ton prénom':mine>0?'on te doit':mine<0?'tu dois':'tu es quitte'}</div></button></div>`}
 return h}

function trip(t){
 watch(t.id);
 if(!V.tab)V.tab='today';
 const tabs=[['today','Aujourd’hui'],['plan','Jours'],['map','Carte'],['money','Argent'],['prep','Préparer']];
 const body={today:tToday,plan:tPlan,map:tMap,money:tMoney,prep:tPrep}[V.tab](t);
 const fab={today:today()<=t.end?['newexp','J’ai payé quelque chose']:null,plan:['newact','Ajouter une activité'],money:['newexp','Ajouter une dépense']}[V.tab];
 const b=balances(t),mine=ME[t.id]?b[ME[t.id]]||0:null;
 return `<div class="band"><div class="bin"><div class="bandrow"><a class="btn sm onband" href="#" aria-label="Retour aux voyages">${I.back}Voyages</a><span class="row" style="gap:8px"><button class="btn sm onband" data-act="invite">Inviter</button><button class="btn sm onband" data-act="settings" aria-label="Réglages du voyage" style="width:44px;padding:0">${I.gear}</button></span></div>
<h1>${esc(t.name)}</h1><p class="tag">${esc(t.dest)} · ${esc(fmtLong(t.start))} au ${esc(fmtLong(t.end))} · ${t.people.length} voyageur${t.people.length>1?'s':''}</p>
<div class="status">${esc(status(t))}${mine!==null&&St.items[t.id]?' · '+(mine>0?'tu récupères '+money(mine,t.home):mine<0?'tu dois '+money(-mine,t.home):'tu es quitte'):''}</div></div></div>
<div class="wrap stack">${notes()}
${!ME[t.id]?`<div class="card stack"><h3>Qui es-tu dans ce voyage?</h3><div class="row" style="flex-wrap:wrap;gap:8px">${t.people.map(p=>`<button class="btn sm" data-act="iam" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')}<button class="btn sm" data-act="newme">Je ne suis pas dans la liste</button></div></div>`:''}
<div class="tabs"><div class="seg" role="group" aria-label="Sections du voyage">${tabs.map(([k,l])=>`<button data-act="tab" data-v="${k}" aria-pressed="${V.tab===k}">${l}</button>`).join('')}</div></div>
${!St.items[t.id]?`<div class="card empty">Chargement…</div>`:body}
<p class="foot">${esc(modeLine())}</p></div>
${fab&&!St.ro?`<div class="fab"><button class="btn pri" data-act="${fab[0]}">${fab[1]}</button></div>`:''}`}

/* ---------- Formulaires ---------- */
function sheetHtml(){
 const s=V.sheet;if(!s)return '';const t=curT();
 const wrap=(title,inner)=>`<div class="ov" data-act="close"><form class="sheet" role="dialog" aria-modal="true" aria-labelledby="st" novalidate data-form="sheet"><h2 id="st">${title}</h2>${inner}</form></div>`;
 const err=s.err?`<div class="err" role="alert">${esc(s.err)}</div>`:'';
 const cancel=`<button type="button" class="btn" data-act="close">Annuler</button>`;
 if(s.type==='trip'){const x=s.x;return wrap(s.isNew?'Nouveau voyage':'Réglages du voyage',`
<label class="f">Nom du voyage<input type="text" data-k="name" value="${esc(x.name)}" placeholder="Ex. : Portugal entre amis" maxlength="60"></label>
<label class="f">Destination<input type="text" data-k="dest" value="${esc(x.dest)}" placeholder="Ex. : Lisbonne, Portugal" maxlength="80"></label>
<div class="two"><label class="f">Départ<input type="date" data-k="start" value="${esc(x.start)}"></label><label class="f">Retour<input type="date" data-k="end" value="${esc(x.end)}"></label></div>
<div class="f" style="font-size:14px;font-weight:600">Qui part?</div>
${x.people.map((p,i)=>`<input type="text" class="inp" data-pp="${i}" value="${esc(p.name)}" placeholder="${i===0?'Ton prénom':'Prénom '+(i+1)}" aria-label="${i===0?'Ton prénom':'Prénom '+(i+1)}" maxlength="40">`).join('')}
<button type="button" class="btn sm" data-act="morep">Ajouter une personne</button>
<div class="two"><label class="f">Ta monnaie<select data-k="home">${CURS.map(c=>`<option value="${c[0]}" ${c[0]===x.home?'selected':''}>${c[0]} – ${c[1]}</option>`).join('')}</select></label>
<label class="f">Monnaie sur place<select data-k="cur">${CURS.map(c=>`<option value="${c[0]}" ${c[0]===x.cur?'selected':''}>${c[0]} – ${c[1]}</option>`).join('')}</select></label></div>
${x.cur!==x.home?`<div class="card stack" style="padding:14px;gap:10px;background:var(--bg)"><label class="f">Taux : 1 ${esc(x.cur)} = combien de ${esc(x.home)}?<input type="text" inputmode="decimal" data-k="rateTxt" value="${esc(x.rateTxt)}" placeholder="Ex. : 1,50"></label>
${s.rateMsg?`<div class="sub">${esc(s.rateMsg)}</div>`:''}<button type="button" class="btn sm" data-act="getrate">Obtenir le taux du jour</button>
<label class="ck"><input type="checkbox" data-chk="rateAuto" ${x.rateAuto!==false?'checked':''}>Mettre à jour le taux automatiquement chaque jour</label>
<div class="sub">Chaque dépense garde le taux du jour où elle a été ajoutée : les comptes déjà faits ne bougent pas.</div></div>`:''}
<label class="f">Budget total du groupe (${esc(x.home)}, optionnel)<input type="text" inputmode="decimal" data-k="budTxt" value="${esc(x.budTxt)}" placeholder="Ex. : 4000"></label>
${err}<button class="btn pri" type="submit">${s.isNew?'Créer le voyage':'Enregistrer'}</button>
${s.isNew?'':`<button type="button" class="btn" data-act="leave">Retirer de mon téléphone</button><button type="button" class="btn danger" data-act="deltrip">Supprimer pour tout le monde</button>`}${cancel}`)}
 if(s.type==='act'){const x=s.x,ds=days(t);return wrap(s.isNew?'Nouvelle activité':'Modifier l’activité',`
<label class="f">Quoi?<input type="text" data-k="title" value="${esc(x.title)}" placeholder="Ex. : Visite du château" maxlength="80"></label>
<div class="two"><label class="f">Jour<select data-k="day"><option value="">Idée (sans date)</option>${ds.map((d,i)=>`<option value="${d}" ${d===x.day?'selected':''}>Jour ${i+1} · ${esc(fmtDay(d))}</option>`).join('')}</select></label>
<label class="f">Heure<input type="time" data-k="time" value="${esc(x.time)}"></label></div>
<label class="f">Lieu ou adresse<input type="text" data-k="place" value="${esc(x.place)}" placeholder="Ex. : Castelo de São Jorge" maxlength="120"></label>
<label class="f">Coût prévu par personne (${esc(t.cur)}, optionnel)<input type="text" inputmode="decimal" data-k="costTxt" value="${esc(x.costTxt)}" placeholder="0,00"></label>
<label class="f">Notes<textarea data-k="note" maxlength="500" placeholder="Réservation, heures d’ouverture, conseils…">${esc(x.note)}</textarea></label>
${err}<button class="btn pri" type="submit">${s.isNew?'Ajouter':'Enregistrer'}</button>
${s.isNew?'':`<button type="button" class="btn danger" data-act="delitem">Supprimer l’activité</button>`}${cancel}`)}
 if(s.type==='doc'){const x=s.x;return wrap(s.isNew?'Nouvelle réservation':'Réservation',`
<label class="f">Type<select data-k="kind">${Object.entries(DOCK).map(([k,v])=>`<option value="${k}" ${k===x.kind?'selected':''}>${v[0]}</option>`).join('')}</select></label>
<label class="f">Nom<input type="text" data-k="title" value="${esc(x.title)}" placeholder="Ex. : Vol Montréal – Lisbonne" maxlength="80"></label>
<div class="two"><label class="f">Date<input type="date" data-k="date" value="${esc(x.date)}"></label><label class="f">Heure<input type="time" data-k="time" value="${esc(x.time)}"></label></div>
<label class="f">Numéro de confirmation<input type="text" data-k="ref" value="${esc(x.ref)}" placeholder="Ex. : 4XK7PQ" maxlength="40" autocapitalize="characters"></label>
<label class="f">Adresse (optionnel)<input type="text" data-k="addr" value="${esc(x.addr)}" placeholder="Pour la retrouver sur la carte" maxlength="160"></label>
<label class="f">Notes<textarea data-k="note" maxlength="500">${esc(x.note)}</textarea></label>
${err}<button class="btn pri" type="submit">${s.isNew?'Ajouter':'Enregistrer'}</button>
${s.isNew?'':`<button type="button" class="btn danger" data-act="delitem">Supprimer</button>`}${cancel}`)}
 if(s.type==='exp'){const x=s.x,P=t.people;return wrap(s.isNew?'Nouvelle dépense':'Modifier la dépense',`
<div class="two"><label class="f">Montant<input type="text" inputmode="decimal" class="big" data-k="amtTxt" value="${esc(x.amtTxt)}" placeholder="0,00" autocomplete="off"></label>
<label class="f">Monnaie<select data-k="cur" style="height:60px">${[...new Set([t.cur,t.home])].map(c=>`<option value="${c}" ${c===x.cur?'selected':''}>${c}</option>`).join('')}</select></label></div>
<label class="f">Pour quoi?<input type="text" data-k="desc" value="${esc(x.desc)}" placeholder="Ex. : Souper au restaurant" maxlength="80"></label>
<div class="two"><label class="f">Catégorie<select data-k="cat">${CATS.map(c=>`<option value="${c[0]}" ${c[0]===x.cat?'selected':''}>${c[1]}</option>`).join('')}</select></label>
<label class="f">Payé par<select data-k="by">${P.map(p=>`<option value="${esc(p.id)}" ${p.id===x.by?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div>
<label class="f">Date<input type="date" data-k="date" value="${esc(x.date)}"></label>
<div class="seg" role="group" aria-label="Façon de partager"><button type="button" data-act="mode" data-v="eq" aria-pressed="${x.mode!=='exact'}">Parts égales</button><button type="button" data-act="mode" data-v="exact" aria-pressed="${x.mode==='exact'}">Montants précis</button></div>
${x.mode==='exact'?P.map(p=>`<div class="split"><span>${esc(p.name)}</span><input type="text" inputmode="decimal" class="inp" data-part="${esc(p.id)}" value="${esc(x.partsTxt[p.id]||'')}" placeholder="0,00" aria-label="Part de ${esc(p.name)}"></div>`).join('')
 :`<fieldset style="border:0;padding:0;margin:0"><legend class="sub" style="margin-bottom:4px">Partagé entre</legend>${P.map(p=>`<label class="ck"><input type="checkbox" data-sp="${esc(p.id)}" ${x.split.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</fieldset>`}
<div class="sub" id="left">${leftTxt()}</div>
${err}<button class="btn pri" type="submit">${s.isNew?'Ajouter':'Enregistrer'}</button>
${s.isNew?'':`<button type="button" class="btn danger" data-act="delitem">Supprimer la dépense</button>`}${cancel}`)}
 if(s.type==='pay'){const x=s.x;return wrap('Remboursement',`<div><b>${esc(nm(t,x.by))}</b> a remboursé <b>${esc(nm(t,x.to))}</b> : <span class="amt">${money(x.amount,t.home)}</span></div><div class="sub">${esc(fmtDay(x.date))}</div>
<button type="button" class="btn danger" data-act="delitem">Supprimer ce remboursement</button><button type="button" class="btn" data-act="close">Fermer</button>`)}
 if(s.type==='invite')return wrap('Inviter les voyageurs',`<div class="sub">${s.copied?'Lien copié! ':''}Envoie ce lien dans la conversation du groupe. Chaque personne l’ouvre, choisit son prénom et voit le même voyage. Toute personne qui a le lien peut modifier le voyage.</div><div class="linkbox">${esc(s.link)}</div><button type="button" class="btn pri" data-act="copylink">Copier le lien</button><button type="button" class="btn" data-act="close">Fermer</button>`);
 if(s.type==='me')return wrap('Ton prénom',`<label class="f">Prénom<input type="text" id="mename" maxlength="40"></label>${err}<button class="btn pri" type="submit">Rejoindre le voyage</button>${cancel}`);
 if(s.type==='leave')return wrap('Retirer de ton téléphone?',`<div class="sub">Le voyage reste intact pour les autres. Tu pourras le retrouver avec le lien d’invitation.</div><button type="button" class="btn pri" data-act="leaveok">Retirer</button>${cancel}`);
 if(s.type==='deltrip')return wrap('Supprimer « '+esc(t.name)+' »?',`<div class="sub">Le programme, les réservations et les dépenses seront effacés. On ne peut pas annuler.</div><button type="button" class="btn pri" data-act="deltripok">Supprimer pour de bon</button>${cancel}`);
 if(s.type==='copy')return wrap('Bilan à envoyer',`<div class="sub">${s.copied?'Copié! Colle-le dans la conversation du groupe.':'Sélectionne le texte et copie-le.'}</div><textarea class="copy" readonly>${esc(s.text)}</textarea><button type="button" class="btn" data-act="close">Fermer</button>`);
 return ''}
function leftTxt(){const s=V.sheet;if(!s||s.type!=='exp')return '';const x=s.x,c=parseAmt(x.amtTxt),t=curT();
 if(x.mode==='exact'){const sum=Object.values(x.partsTxt).reduce((a,v)=>a+(parseAmt(v)||0),0);if(!(c>0))return 'Entre d’abord le montant.';const r=c-sum;return r===0?'Les parts correspondent au montant.':r>0?'Il reste '+money(r,x.cur)+' à répartir.':'Les parts dépassent le montant de '+money(-r,x.cur)+'.'}
 const n=x.split.length;if(!(c>0)||!n)return '';let txt=money(Math.floor(c/n),x.cur)+' par personne';if(x.cur!==t.home)txt+=' (≈ '+money(Math.floor(toHome(t,c,x.cur)/n),t.home)+')';return txt}

/* ---------- Rendu ---------- */
function render(){const r=route(),t=curT();
 $('#app').innerHTML=r&&t?trip(t):r&&St.loaded&&(St.missing[r]||St.mode==='local')?`<div class="wrap"><div class="card empty stack" style="align-items:center"><div>Ce voyage n’existe plus.</div><a class="btn" href="#">Retour</a></div></div>`:home();
 if(!V.sheet)$('#sheet').innerHTML='';paintToast();if(t&&V.tab==='map'&&St.items[t.id])mountMap(t)}
function paintSheet(){const had=document.activeElement&&document.activeElement.closest('.sheet');$('#sheet').innerHTML=sheetHtml();if(V.sheet&&!had){const f=$('#sheet input:not([type=checkbox]),#sheet .btn');if(f)f.focus()}}
let tt;function toast(msg,undo){V.toast={msg,undo};paintToast();clearTimeout(tt);tt=setTimeout(()=>{V.toast=null;paintToast()},6000)}
function paintToast(){$('#toast').innerHTML=V.toast?`<div class="toast"><span>${esc(V.toast.msg)}</span>${V.toast.undo?'<button data-act="undo">Annuler</button>':''}</div>`:''}
const fmtIn=c=>(c/100).toFixed(2).replace('.',',');

/* ---------- Ouvrir les formulaires ---------- */
function openTrip(t){const d=today();
 V.sheet={type:'trip',isNew:!t,x:t?{...t,people:t.people.map(p=>({...p})),rateTxt:String(t.rate||'').replace('.',','),budTxt:t.budget?fmtIn(t.budget):''}
  :{id:secretId(),name:'',dest:'',start:addDays(d,30),end:addDays(d,37),people:[{id:uid(),name:''},{id:uid(),name:''}],home:'CAD',cur:'CAD',rateTxt:'',budTxt:'',rateAuto:true,created:Date.now()}};paintSheet()}
function openAct(a,day){const t=curT();V.sheet={type:'act',isNew:!a,x:a?{...a,costTxt:a.cost?fmtIn(a.cost):''}:{id:uid(),type:'act',title:'',day:day??(today()>=t.start&&today()<=t.end?today():t.start),time:'',place:'',note:'',costTxt:'',done:false,t:Date.now()}};paintSheet()}
function openDoc(x){V.sheet={type:'doc',isNew:!x,x:x?{...x}:{id:uid(),type:'doc',kind:'vol',title:'',date:'',time:'',ref:'',addr:'',note:'',t:Date.now()}};paintSheet()}
function openExp(e){const t=curT();
 if(e&&e.type==='pay'){V.sheet={type:'pay',x:e};return paintSheet()}
 V.sheet={type:'exp',isNew:!e,x:e?{...e,origCur:e.cur,amtTxt:fmtIn(e.amount),split:(e.split||t.people.map(p=>p.id)).slice(),partsTxt:Object.fromEntries(Object.entries(e.parts||{}).map(([k,v])=>[k,fmtIn(v)]))}
  :{id:uid(),type:'exp',amtTxt:'',cur:t.cur,desc:'',cat:'food',by:ME[t.id]||t.people[0].id,date:(today()>=t.start&&today()<=t.end)?today():today(),mode:'eq',split:t.people.map(p=>p.id),partsTxt:{},t:Date.now()}};paintSheet()}

/* ---------- Enregistrer ---------- */
function submitSheet(){const s=V.sheet,t=curT(),x=s.x,bad=m=>{s.err=m;paintSheet()};
 if(s.type==='me'){const n=($('#mename').value||'').trim();if(!n)return bad('Écris ton prénom.');if(t.people.some(p=>p.name.toLowerCase()===n.toLowerCase()))return bad('Ce prénom est déjà dans le voyage : choisis-le dans la liste.');
  const p={id:uid(),name:n};ME[t.id]=p.id;saveMe();V.sheet=null;paintSheet();Save.trip({...t,people:[...t.people,p]});toast('Bienvenue dans le voyage, '+n+'!');return}
 if(s.type==='trip'){
  if(!x.name.trim())return bad('Donne un nom au voyage.');
  if(!x.dest.trim())return bad('Indique la destination.');
  if(!x.start||!x.end)return bad('Choisis les dates de départ et de retour.');
  if(x.end<x.start)return bad('Le retour doit être après le départ.');
  if(diffDays(x.start,x.end)>89)return bad('Un voyage peut durer 90 jours au maximum.');
  const people=x.people.map(p=>({id:p.id,name:p.name.trim()})).filter(p=>p.name);
  if(!people.length)return bad('Écris au moins ton prénom.');
  if(new Set(people.map(p=>p.name.toLowerCase())).size!==people.length)return bad('Deux personnes ont le même prénom : ajoute une initiale.');
  let rate=1;if(x.cur!==x.home){rate=parseRate(x.rateTxt);if(isNaN(rate))return bad('Entre le taux de change (ex. : 1,50).')}
  let budget=0;if(x.budTxt.trim()){budget=parseAmt(x.budTxt);if(!(budget>0))return bad('Le budget doit être un montant valide.')}
  if(!s.isNew&&t){const used=new Set();(St.items[t.id]||[]).forEach(i=>{if(i.by)used.add(i.by);if(i.to)used.add(i.to);(i.split||[]).forEach(p=>used.add(p));Object.keys(i.parts||{}).forEach(p=>used.add(p))});
   const gone=t.people.filter(p=>!people.some(q=>q.id===p.id)&&used.has(p.id));if(gone.length)return bad(gone[0].name+' a des dépenses : on ne peut pas le retirer du voyage.')}
  const trip={id:x.id,name:x.name.trim(),dest:x.dest.trim(),start:x.start,end:x.end,people,home:x.home,cur:x.cur,rate,rateAuto:x.rateAuto!==false,rateDate:x.rateDate||today(),budget,created:x.created||Date.now()};if(x.geo&&x.geo===trip.dest){trip.geo=x.geo;trip.lat=x.lat;trip.lng=x.lng}
  if(s.isNew)ME[trip.id]=people[0].id,saveMe();
  V.sheet=null;paintSheet();Save.trip(trip);locateTrip(trip);if(s.isNew){V.tab=null;location.hash='t-'+trip.id;setTimeout(()=>{V.sheet={type:'invite',link:inviteLink(trip)};paintSheet()},350)}else toast('Voyage mis à jour.');return}
 if(s.type==='act'){
  if(!x.title.trim())return bad('Écris le nom de l’activité.');
  let cost=0;if(x.costTxt.trim()){cost=parseAmt(x.costTxt);if(isNaN(cost)||cost<0)return bad('Le coût doit être un montant valide.')}
  const it={id:x.id,type:'act',title:x.title.trim(),day:x.day||'',time:x.time||'',place:x.place.trim(),note:x.note.trim(),cost,cur:t.cur,done:!!x.done,t:x.t||Date.now()};
  if(x.geo&&x.geo===geoQuery(t,it)){it.geo=x.geo;it.lat=x.lat;it.lng=x.lng}V.sheet=null;paintSheet();Save.item(t.id,it);if(it.place&&it.geo!==geoQuery(t,it))locate(t,it);toast(s.isNew?'Activité ajoutée.':'Activité modifiée.');return}
 if(s.type==='doc'){
  if(!x.title.trim())return bad('Donne un nom à la réservation.');
  const it={id:x.id,type:'doc',kind:x.kind,title:x.title.trim(),date:x.date||'',time:x.time||'',ref:x.ref.trim(),addr:x.addr.trim(),note:x.note.trim(),t:x.t||Date.now()};
  if(x.geo&&x.geo===geoQuery(t,it)){it.geo=x.geo;it.lat=x.lat;it.lng=x.lng}V.sheet=null;paintSheet();Save.item(t.id,it);if(it.addr&&it.geo!==geoQuery(t,it))locate(t,it);toast(s.isNew?'Réservation ajoutée.':'Réservation modifiée.');return}
 if(s.type==='exp'){
  const c=parseAmt(x.amtTxt);if(!(c>0))return bad('Entre un montant plus grand que 0.');if(c>=1e10)return bad('Ce montant est trop élevé.');
  if(!x.desc.trim())return bad('Écris à quoi correspond la dépense.');
  const it={id:x.id,type:'exp',amount:c,cur:x.cur,desc:x.desc.trim(),cat:x.cat,by:x.by,date:x.date||today(),mode:x.mode,t:x.t||Date.now()};if(x.cur!==t.home)it.rate=(x.rate&&x.cur===x.origCur)?x.rate:(t.rate||1);
  if(x.mode==='exact'){const parts={};let sum=0;for(const p of t.people){const v=parseAmt(x.partsTxt[p.id]||'0');if(isNaN(v)||v<0)return bad('Une des parts n’est pas un montant valide.');if(v>0){parts[p.id]=v;sum+=v}}
   if(sum!==c)return bad('La somme des parts ('+money(sum,x.cur)+') doit égaler le montant ('+money(c,x.cur)+').');it.parts=parts}
  else{if(!x.split.length)return bad('Choisis au moins une personne.');it.split=x.split.slice()}
  V.sheet=null;paintSheet();Save.item(t.id,it);toast(s.isNew?'Dépense ajoutée.':'Dépense modifiée.')}}

/* ---------- Événements ---------- */
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target.dataset.form;
 if(f==='sheet')return submitSheet();
 if(f==='todo'){const t=curT(),inp=$('#todo'),v=(inp.value||'').trim();if(!v)return;Save.item(t.id,{id:uid(),type:'todo',text:v,done:false,t:Date.now()});setTimeout(()=>{const i=$('#todo');if(i)i.focus()},0)}});
document.addEventListener('input',e=>{const s=V.sheet,el=e.target;if(!s||!el.closest('.sheet'))return;const x=s.x;
 if(el.dataset.k&&el.tagName!=='SELECT')x[el.dataset.k]=el.value;
 else if(el.dataset.pp)x.people[+el.dataset.pp].name=el.value;
 else if(el.dataset.part)x.partsTxt[el.dataset.part]=el.value;
 const l=$('#left');if(l)l.textContent=leftTxt()});
document.addEventListener('change',e=>{const s=V.sheet,el=e.target;if(!s||!el.closest('.sheet'))return;const x=s.x;
 if(el.dataset.chk){x[el.dataset.chk]=el.checked}
 else if(el.dataset.k){x[el.dataset.k]=el.value;if(s.type==='trip'&&(el.dataset.k==='cur'||el.dataset.k==='home')){s.rateMsg='';paintSheet();sheetRate()}}
 else if(el.dataset.sp)x.split=el.checked?[...new Set([...x.split,el.dataset.sp])]:x.split.filter(i=>i!==el.dataset.sp);
 if(s.type==='exp'&&el.dataset.k==='cur')paintSheet();
 const l=$('#left');if(l)l.textContent=leftTxt()});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;
 if(b.classList.contains('ov')&&e.target!==b)return;
 const a=b.dataset.act,t=curT(),id=b.dataset.id,find=()=>(St.items[t.id]||[]).find(i=>i.id===id);
 if(a==='newtrip')openTrip(null);
 else if(a==='settings')openTrip(t);
 else if(a==='morep'){V.sheet.x.people.push({id:uid(),name:''});paintSheet();const l=document.querySelectorAll('#sheet [data-pp]');l[l.length-1].focus()}
 else if(a==='close'){V.sheet=null;paintSheet()}
 else if(a==='tab'){V.tab=b.dataset.v;render()}
 else if(a==='sub'){V.sub=b.dataset.v;render()}
 else if(a==='iam'){ME[t.id]=id;saveMe();render();toast('C’est noté, '+nm(t,id)+'!')}
 else if(a==='newact')openAct(null,b.dataset.day);
 else if(a==='editact')openAct(find());
 else if(a==='newdoc')openDoc(null);
 else if(a==='editdoc')openDoc(find());
 else if(a==='newexp')openExp(null);
 else if(a==='editexp')openExp(find());
 else if(a==='mode'){V.sheet.x.mode=b.dataset.v;paintSheet()}
 else if(a==='tdone'){const it=find();if(it)Save.item(t.id,{...it,done:!it.done})}
 else if(a==='deltodo'){const it=find();if(it){Save.del(t.id,id);toast('Tâche retirée.',()=>Save.item(t.id,JSON.parse(JSON.stringify(it))))}}
 else if(a==='basics'){['Passeport valide au moins 6 mois après le retour','Assurance voyage','Prévenir la banque du voyage','Adaptateur de prise électrique','Copies des documents importants','Chargeurs et batterie externe','Médicaments','Un peu d’argent local'].forEach((x,i)=>Save.item(t.id,{id:uid(),type:'todo',text:x,done:false,t:Date.now()+i}))}
 else if(a==='delitem'){const x=V.sheet.x,full=(St.items[t.id]||[]).find(i=>i.id===x.id);V.sheet=null;paintSheet();Save.del(t.id,x.id);if(full){const c=JSON.parse(JSON.stringify(full));toast('Supprimé.',()=>Save.item(t.id,c))}}
 else if(a==='paid'){const it={id:uid(),type:'pay',by:b.dataset.f,to:b.dataset.t,amount:+b.dataset.c,date:today(),t:Date.now()};Save.item(t.id,it);toast('Remboursement noté.',()=>Save.del(t.id,it.id))}
 else if(a==='deltrip'){V.sheet={type:'deltrip'};paintSheet()}
 else if(a==='invite'){const link=inviteLink(t);if(navigator.share){try{await navigator.share({title:'Escale – '+t.name,text:'Rejoins notre voyage « '+t.name+' » sur Escale :',url:link});return}catch(err){if(err&&err.name==='AbortError')return}}
  let ok=false;try{await navigator.clipboard.writeText(link);ok=true}catch(err){}V.sheet={type:'invite',link,copied:ok};paintSheet()}
 else if(a==='copylink'){let ok=false;try{await navigator.clipboard.writeText(V.sheet.link);ok=true}catch(err){}V.sheet.copied=ok;paintSheet();if(!ok)toast('Copie impossible : sélectionne le lien à la main.')}
 else if(a==='getrate')sheetRate();
 else if(a==='gobal'){V.tab='money';V.sub='bal';render();scrollTo(0,0)}
 else if(a==='newme'){V.sheet={type:'me'};paintSheet()}
 else if(a==='leave'){V.sheet={type:'leave'};paintSheet()}
 else if(a==='leaveok'){const tid=t.id;V.sheet=null;paintSheet();forget(tid);location.hash='';render()}
 else if(a==='forget'){forget(id);render()}
 else if(a==='geoall'){const l=[...items(t,'act').filter(x=>x.place),...items(t,'doc').filter(x=>x.addr)].filter(x=>x.geo!==geoQuery(t,x));toast('Placement de '+l.length+' lieu'+(l.length>1?'x':'')+' sur la carte…');l.forEach(x=>locate(t,x))}
 else if(a==='deltripok'){const tid=t.id;V.sheet=null;paintSheet();location.hash='';await Save.delTrip(tid);toast('Voyage supprimé.')}
 else if(a==='copy'){const bl=balances(t),st=settle(bl);
  const text=`${t.name} — bilan Escale\nTotal dépensé : ${money(spent(t),t.home)}\n\n`+t.people.map(p=>{const v=bl[p.id]||0;return `${p.name} : ${v>0?'récupère '+money(v,t.home):v<0?'doit '+money(-v,t.home):'quitte'}`}).join('\n')+'\n\n'+(st.length?'Pour tout régler :\n'+st.map(s=>`• ${nm(t,s.from)} doit ${money(s.cents,t.home)} à ${nm(t,s.to)}`).join('\n'):'Tout le monde est quitte!');
  let ok=false;try{await navigator.clipboard.writeText(text);ok=true}catch(err){}V.sheet={type:'copy',text,copied:ok};paintSheet()}
 else if(a==='undo'&&V.toast&&V.toast.undo){const u=V.toast.undo;V.toast=null;paintToast();u()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.sheet){V.sheet=null;paintSheet()}});
function handleHash(){const h=location.hash.slice(1);if(h.startsWith('join-')){const id=h.slice(5).replace(/[^a-z0-9]/gi,'');if(id.length>=16){addMine(id);watch(id);location.replace('#t-'+id);return true}}return false}
window.addEventListener('online',()=>{St.offline=false;render()});window.addEventListener('offline',()=>{St.offline=true;render()});
window.addEventListener('hashchange',()=>{if(handleHash())return;V.tab=null;V.sub='list';V.sheet=null;paintSheet();render();scrollTo(0,0)});

window.__escaleOK=true;
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
handleHash();
render();
if(configured)startFirebase();else startLocal();

}
