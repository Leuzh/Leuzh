  import {createRun, updateRun, getUpgradeChoices} from './engine.mjs';
  import {joystickPosition} from './controls.mjs';
  (()=>{'use strict';
const root=document.getElementById('in-night'),canvas=document.getElementById('in-canvas'),ctx=canvas.getContext('2d'),$=id=>document.getElementById('in-'+id),storeKey='infiniteNight.v1';
let data;
try{data=JSON.parse(localStorage.getItem(storeKey))||{runs:[],name:''}}catch(e){data={runs:[],name:''}}const save=()=>{try{localStorage.setItem(storeKey,JSON.stringify(data))}catch(e){}};
let S=null,last=0,raf=0,keys={},joystick={x:0,y:0,pointer:null},db=null,boardCount=100,boardSearch="",visualEffects=[];
function page(n){document.querySelectorAll('#in-night .in-page').forEach(x=>x.classList.toggle('active',x.dataset.view===n));
document.querySelectorAll('.in-nav [data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===n));
if(n==='board')renderBoard();
if(n==='profile')renderProfile()}document.querySelectorAll('.in-nav [data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
$('night-launch').onclick=()=>root.classList.add('open');
const projectLaunch=$('project-launch');if(projectLaunch)projectLaunch.onclick=()=>{root.classList.add('open');page('home')};
$('close').onclick=()=>{root.classList.remove('open');
stop()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('open')){$('close').click();
return}const key=e.key.toLowerCase();if(S&&['arrowup','arrowdown','arrowleft','arrowright'].includes(key)&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))e.preventDefault();keys[key]=true});
document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
const stick=$('stick'),knob=$('stick-knob');
function updateStick(e){const p=joystickPosition(e.clientX,e.clientY,stick.getBoundingClientRect());joystick.x=p.x;joystick.y=p.y;knob.style.transform=`translate(calc(-50% + ${p.offsetX}px),calc(-50% + ${p.offsetY}px))`}
stick.addEventListener('pointerdown',e=>{e.preventDefault();joystick.pointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e)});
stick.addEventListener('pointermove',e=>{if(joystick.pointer===e.pointerId){e.preventDefault();updateStick(e)}});
function releaseStick(e){if(joystick.pointer!==e.pointerId)return;joystick.pointer=null;joystick.x=0;joystick.y=0;knob.style.transform='translate(-50%,-50%)'}
stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);stick.addEventListener('lostpointercapture',releaseStick);stick.addEventListener('contextmenu',e=>e.preventDefault());
$('name').value=data.name||'';
$('name').onchange=()=>{data.name=$('name').value.trim().slice(0,18);
save()};
$('start').onclick=()=>start();
$('overlay-action').onclick=()=>{if(!S)start();
else if(S.dead)start()};
$('clear').onclick=()=>{data.runs=[];
save();
renderProfile()};
['signup','signin','signout'].forEach(id=>$(id).onclick=()=>{$('auth-status').textContent='Configure Supabase pour activer les comptes mondiaux (voir infinite-night/README.md).'});
$('quality').onchange=resize;
document.querySelectorAll('[data-board]').forEach(b=>b.onclick=()=>{boardCount=b.dataset.board==='local'?'local':Number(b.dataset.board);
renderBoard()});
$('search-button').onclick=()=>{boardSearch=$('search').value.trim();
renderBoard()};
$('search').addEventListener('keydown',e=>{if(e.key==='Enter')$('search-button').click()});
function show(title,msg,choices,action){$('overlay-title').textContent=title;
$('overlay-text').textContent=msg;
const box=$('choices');
box.innerHTML='';
box.className=choices?'in-choices':'';
if(choices)choices.forEach((u,i)=>{const b=document.createElement('button');
b.className='in-choice';
b.textContent=u[0]+' — '+u[1];
b.onclick=()=>{u[2](S);
S.paused=false;
$('overlay').hidden=true;
last=performance.now()};
box.append(b)});
$('overlay-action').textContent=action;
$('overlay-action').hidden=!!choices;
$('overlay').hidden=false}
function start(){data.name=$('name').value.trim().slice(0,18)||'Voyageur';
$('name').value=data.name;
save();
S=createRun();
visualEffects=[];
page('game');
resize();
$('overlay').hidden=true;
last=performance.now();
cancelAnimationFrame(raf);
raf=requestAnimationFrame(loop)}
function stop(){cancelAnimationFrame(raf);
S=null;visualEffects=[]}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,Number($('quality')?.value||1.5));
canvas.width=Math.max(1,r.width*d);
canvas.height=Math.max(1,r.height*d)}window.addEventListener('resize',resize);
function loop(now){if(!S)return;
const dt=Math.min(.04,(now-last)/1000||0);
last=now;
for(const effect of visualEffects)effect.age+=dt;
visualEffects=visualEffects.filter(effect=>effect.age<effect.duration);
if(!S.paused&&!S.dead){const rect=canvas.getBoundingClientRect(),emberTarget=nearestEmberTarget(S),emberCooldown=S.emberCooldown,bellCooldown=S.bellCooldown,event=updateRun(S,dt,{x:(keys.d||keys.arrowright||keys.l?1:0)-(keys.a||keys.arrowleft||keys.q?1:0)+joystick.x,y:(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup||keys.z?1:0)+joystick.y},{width:rect.width,height:rect.height});
if(emberTarget&&S.emberCooldown>emberCooldown){visualEffects.push({type:'ember',x:emberTarget.x,y:emberTarget.y,age:0,duration:.38,radius:42+S.emberLevel*7});if(visualEffects.length>16)visualEffects.shift()}
if(S.bellLevel&&S.bellCooldown>bellCooldown){visualEffects.push({type:'bell',x:S.x,y:S.y,age:0,duration:.42,radius:82+S.bellLevel*12});if(visualEffects.length>16)visualEffects.shift()}
if(event==='level-up')show('Choisis une relique','Niveau '+S.level+' atteint. Une nouvelle stratégie commence.',getUpgradeChoices(S),'');
if(event==='death')handleDeath(S)}
draw();
raf=requestAnimationFrame(loop)}
function handleDeath(s){
data.runs.push({name:data.name,score:Math.floor(s.elapsed*10+s.kills*5+s.level*100),time:s.elapsed,kills:s.kills,level:s.level,date:new Date().toISOString()});
data.runs.sort((a,b)=>b.score-a.score);
data.runs=data.runs.slice(0,100);
save();
show('La nuit t’a vaincu',`${fmt(s.elapsed)} · ${s.kills} éliminations · niveau ${s.level}`,null,'Nouvelle partie');
submitRun(s)}
async function submitRun(s){if(!db)return;
const {data:{session}}=await db.auth.getSession();
if(!session)return;
const {error}=await db.functions.invoke('submit-run',{body:{clientRunId:crypto.randomUUID(),survivalSeconds:Math.floor(s.elapsed),kills:s.kills,level:s.level}});
if(error)console.warn('Infinite Night score not submitted:',error.message)}
function fmt(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}
function nearestEmberTarget(s){if(!s.emberLevel)return null;let target=null,distance=350;for(const e of s.enemies){const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<distance){distance=d;target=e}}return target}
function draw(){if(!S)return;
const d=Math.min(devicePixelRatio||1,Number($('quality')?.value||1.5)),w=canvas.width/d,h=canvas.height/d;
ctx.setTransform(d,0,0,d,0,0);
ctx.clearRect(0,0,w,h);
const ox=w/2-S.x,oy=h/2-S.y;
drawArena(w,h,ox,oy);
for(const g of S.gems)drawGem(g.x+ox,g.y+oy);
if(S.orbitLevel){const count=S.orbitLevel>=5?6:S.orbitLevel;for(let i=0;i<count;i++){const a=S.orbitAngle+i*Math.PI*2/count;drawRune(w/2+Math.cos(a)*58,h/2+Math.sin(a)*58,S.orbitLevel>=5)}}
for(const e of S.enemies)drawEnemy(e,e.x+ox,e.y+oy);
for(const effect of visualEffects){if(effect.type==='bell')drawBell(effect,effect.x+ox,effect.y+oy);else drawEmber(effect,effect.x+ox,effect.y+oy)}
for(const sh of S.shots){const progress=1-Math.max(0,Math.min(1,S.fire/Math.max(.01,S.rate))),alpha=Math.sin(Math.PI*progress);if(alpha>.04)drawSpellLine(sh.x+ox,sh.y+oy,sh.tx+ox,sh.ty+oy,alpha)}
drawPlayer(w/2,h/2,S.orbitAngle);
$('time').textContent=fmt(S.elapsed);
$('lvl').textContent='Niveau '+S.level;
$('kills').textContent=S.kills+' éliminations';
$('hpbar').style.width=100*S.hp/S.maxHp+'%';
$('xpbar').style.width=100*S.xp/S.need+'%'}
function drawArena(w,h,ox,oy){
const bg=ctx.createRadialGradient(w*.5,h*.46,8,w*.5,h*.5,Math.max(w,h)*.78);
bg.addColorStop(0,'#211522');bg.addColorStop(.52,'#121018');bg.addColorStop(1,'#08080d');
ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
ctx.lineWidth=1;ctx.strokeStyle='rgba(190,151,177,.075)';
for(let x=((ox%48)+48)%48;x<w;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
for(let y=((oy%48)+48)%48;y<h;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
ctx.strokeStyle='rgba(202,160,191,.10)';
const tileX=((ox%192)+192)%192,tileY=((oy%192)+192)%192;
for(let x=tileX;x<w;x+=192){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
for(let y=tileY;y<h;y+=192){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
const startX=Math.floor((S.x-w/2)/384)*384,startY=Math.floor((S.y-h/2)/384)*384;
ctx.strokeStyle='rgba(186,137,186,.16)';ctx.lineWidth=1.2;
for(let wx=startX;wx<S.x+w/2+384;wx+=384)for(let wy=startY;wy<S.y+h/2+384;wy+=384){
const x=wx+192+ox,y=wy+192+oy;if(x<-24||y<-24||x>w+24||y>h+24)continue;
ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.moveTo(x-21,y);ctx.lineTo(x-8,y);ctx.moveTo(x+8,y);ctx.lineTo(x+21,y);ctx.moveTo(x,y-21);ctx.lineTo(x,y-8);ctx.moveTo(x,y+8);ctx.lineTo(x,y+21);ctx.stroke();
ctx.fillStyle='rgba(204,156,188,.18)';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();
}
const vignette=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.72);
vignette.addColorStop(0,'rgba(4,3,8,0)');vignette.addColorStop(1,'rgba(3,3,7,.55)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
}
function drawGem(x,y){
ctx.save();ctx.translate(x,y);ctx.fillStyle='#8ce7d2';ctx.strokeStyle='#d5fff1';ctx.lineWidth=1;
ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(5,0);ctx.lineTo(0,7);ctx.lineTo(-5,0);ctx.closePath();ctx.fill();ctx.stroke();
ctx.fillStyle='rgba(239,255,246,.8)';ctx.fillRect(-.7,-4,1.4,4);ctx.restore();
}
function drawRune(x,y,awakened){
const color=awakened?'#f1d28f':'#9ed4c4';ctx.save();ctx.translate(x,y);ctx.rotate(S.orbitAngle*.3);ctx.shadowColor=color;ctx.shadowBlur=awakened?10:5;
ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(7,0);ctx.lineTo(0,9);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();
ctx.shadowBlur=0;ctx.strokeStyle='rgba(24,16,25,.8)';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.stroke();ctx.restore();
}
function drawEnemy(e,x,y){
const r=e.r,elite=e.elite;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(S.y-e.y,S.x-e.x));
if(elite){ctx.shadowColor='#ff8c69';ctx.shadowBlur=10;ctx.strokeStyle='rgba(255,179,115,.72)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r+4,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}
ctx.fillStyle=elite?'#a34d49':'#633442';ctx.strokeStyle=elite?'#ffc083':'#b36a78';ctx.lineWidth=elite?1.5:1;
ctx.beginPath();ctx.moveTo(-r*.78,-r*.45);ctx.lineTo(-r*.35,-r*.9);ctx.lineTo(0,-r*.7);ctx.lineTo(r*.45,-r*.9);ctx.lineTo(r*.82,-r*.38);ctx.lineTo(r*.68,r*.4);ctx.lineTo(0,r);ctx.lineTo(-r*.68,r*.4);ctx.closePath();ctx.fill();ctx.stroke();
if(elite){ctx.fillStyle='#ffbe79';ctx.beginPath();ctx.moveTo(-r*.44,-r*.67);ctx.lineTo(-r*.95,-r*1.45);ctx.lineTo(-r*.13,-r*.82);ctx.moveTo(r*.44,-r*.67);ctx.lineTo(r*.95,-r*1.45);ctx.lineTo(r*.13,-r*.82);ctx.fill()}
ctx.fillStyle=elite?'#ffe0a1':'#db8b83';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=elite?6:2;
ctx.beginPath();ctx.arc(-r*.28,-r*.08,Math.max(1.5,r*.12),0,Math.PI*2);ctx.arc(r*.28,-r*.08,Math.max(1.5,r*.12),0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawSpellLine(x1,y1,x2,y2,alpha){
const gradient=ctx.createLinearGradient(x1,y1,x2,y2);gradient.addColorStop(0,`rgba(213,174,255,${alpha*.12})`);gradient.addColorStop(.72,`rgba(238,206,255,${alpha*.58})`);gradient.addColorStop(1,`rgba(255,226,166,${alpha})`);
ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=gradient;ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.lineDashOffset=-S.elapsed*28;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);ctx.shadowColor='#ffe2a6';ctx.shadowBlur=7;ctx.fillStyle='#fff0c4';ctx.beginPath();ctx.arc(x2,y2,3,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawEmber(effect,x,y){
const progress=Math.max(0,Math.min(1,effect.age/effect.duration)),fade=1-progress,reach=effect.radius*(.35+.8*progress);
ctx.save();ctx.globalAlpha=fade;ctx.translate(x,y);ctx.rotate(effect.age*2.4);ctx.strokeStyle='#ff9a58';ctx.fillStyle='rgba(255,111,55,.12)';ctx.lineWidth=2;ctx.shadowColor='#ff6d3a';ctx.shadowBlur=7;
ctx.beginPath();ctx.arc(0,0,reach,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*reach*.68,Math.sin(a)*reach*.68);ctx.lineTo(Math.cos(a)*reach*1.18,Math.sin(a)*reach*1.18);ctx.stroke()}
ctx.restore();
}
function drawBell(effect,x,y){
const progress=Math.max(0,Math.min(1,effect.age/effect.duration)),fade=1-progress,reach=effect.radius*(.32+.82*progress);
ctx.save();ctx.globalAlpha=fade;ctx.translate(x,y);ctx.strokeStyle='#c6a6ff';ctx.fillStyle='rgba(150,102,219,.12)';ctx.lineWidth=2;ctx.shadowColor='#b88aff';ctx.shadowBlur=8;
ctx.beginPath();ctx.arc(0,0,reach,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(0,0,reach*.72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function drawPlayer(x,y,angle){
ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(angle*.2)*.045);
const aura=ctx.createRadialGradient(0,0,3,0,0,29);aura.addColorStop(0,'rgba(197,145,255,.34)');aura.addColorStop(1,'rgba(114,67,160,0)');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.fill();
ctx.shadowColor='#b477ff';ctx.shadowBlur=12;ctx.fillStyle='#34223f';ctx.strokeStyle='#d8b8ff';ctx.lineWidth=1.5;
ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(11,-6);ctx.lineTo(9,7);ctx.lineTo(0,14);ctx.lineTo(-9,7);ctx.lineTo(-11,-6);ctx.closePath();ctx.fill();ctx.stroke();
ctx.shadowBlur=0;ctx.fillStyle='#efdbff';ctx.beginPath();ctx.arc(0,-3,4.5,0,Math.PI*2);ctx.fill();
ctx.strokeStyle='rgba(241,216,255,.8)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(0,10);ctx.moveTo(-6,1);ctx.lineTo(6,1);ctx.stroke();ctx.restore();
}
async function renderBoard(){const status=$('board-status'),el=$('board');
$('position').textContent='';
if(boardCount==='local'||!db){status.textContent='Classement local à cet appareil.';
let rs=data.runs.slice(0,boardCount==='local'?100:boardCount);
if(boardSearch)rs=rs.filter(r=>r.name.toLowerCase().includes(boardSearch.toLowerCase()));
el.innerHTML=rs.length?'<table class="in-board"><tr><th>#</th><th>Joueur</th><th>Score</th><th>Survie</th><th>KO</th><th>Niv.</th></tr>'+rs.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${r.score}</td><td>${fmt(r.time)}</td><td>${r.kills}</td><td>${r.level}</td></tr>`).join('')+'</table>':'<p>Aucune partie trouvée sur cet appareil.</p>';
return}status.textContent='Chargement du classement mondial…';
let q=db.from('leaderboard').select('*').order('rank',{ascending:true}).limit(boardCount);
if(boardSearch)q=q.ilike('username','%'+boardSearch+'%');
const {data:rows,error}=await q;
if(error){status.textContent='Le classement mondial est momentanément indisponible.';
el.textContent=error.message;
return}status.textContent='Classement mondial · Top '+boardCount;
el.innerHTML=rows.length?'<table class="in-board"><tr><th>#</th><th>Joueur</th><th>Score</th><th>Survie</th><th>KO</th><th>Niv.</th></tr>'+rows.map(r=>`<tr><td>${r.rank}</td><td>${esc(r.username)}</td><td>${r.score}</td><td>${fmt(r.survival_seconds)}</td><td>${r.kills}</td><td>${r.level}</td></tr>`).join('')+'</table>':'<p>Aucun joueur trouvé.</p>';
const {data:{user}}=await db.auth.getUser();
if(user){const {data:best}=await db.from('runs').select('score').eq('user_id',user.id).order('score',{ascending:false}).limit(1).maybeSingle();
if(best){const {data:rank}=await db.from('leaderboard').select('rank').eq('score',best.score).limit(1).maybeSingle();
$('position').textContent=rank?'Ta meilleure partie : rang mondial #'+rank.rank:''}}}
function renderProfile(){const rs=data.runs, best=rs[0];
$('profile').innerHTML=`<p>Pseudonyme : <strong>${esc(data.name||'Voyageur')}</strong></p><p>Parties : ${rs.length} · Éliminations cumulées : ${rs.reduce((a,r)=>a+r.kills,0)}</p><p>Meilleur score : ${best?best.score:0} · Meilleure survie : ${fmt(Math.max(0,...rs.map(r=>r.time)))}</p>`;
$('history').innerHTML=rs.length?'<table class="in-board"><tr><th>Date</th><th>Score</th><th>Survie</th><th>KO</th><th>Niv.</th></tr>'+rs.slice(0,20).map(r=>`<tr><td>${new Date(r.date).toLocaleDateString('fr-FR')}</td><td>${r.score}</td><td>${fmt(r.time)}</td><td>${r.kills}</td><td>${r.level}</td></tr>`).join('')+'</table>':'<p>Ton historique apparaîtra ici.</p>'}
function esc(v){const e=document.createElement('span');
e.textContent=v;
return e.innerHTML}renderBoard();
initBackend();
  async function initBackend(){const cfg=window.INFINITE_NIGHT_SUPABASE;
if(!cfg?.url||!cfg?.anonKey)return;
try{const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
db=createClient(cfg.url,cfg.anonKey);
$('auth-status').textContent='Backend connecté · invité';
db.auth.onAuthStateChange((_event,session)=>{$('auth-status').textContent=session?'Connecté · '+(session.user.email||'compte'):'Mode invité';
if(document.querySelector('[data-view="board"].active'))renderBoard()});
$('signup').onclick=async()=>{const {data:d,error}=await db.auth.signUp({email:$('email').value,password:$('password').value,options:{data:{username:$('username').value}}});
$('auth-status').textContent=error?error.message:(d.session?'Compte créé et connecté.':'Vérifie ton email pour confirmer le compte.');
};
$('signin').onclick=async()=>{const {error}=await db.auth.signInWithPassword({email:$('email').value,password:$('password').value});
$('auth-status').textContent=error?error.message:'Connexion réussie.'};
$('signout').onclick=async()=>{await db.auth.signOut();
$('auth-status').textContent='Déconnecté.'};
const {data:{session}}=await db.auth.getSession();
if(session)$('auth-status').textContent='Connecté · '+session.user.email}catch(e){$('auth-status').textContent='Configuration Supabase invalide : '+e.message}}})();
