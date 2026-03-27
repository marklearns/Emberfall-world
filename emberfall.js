'use strict';
/* ═══════════════════════════════════════════════════════════════
   EMBERFALL: SHADOW OF THE VEIL — 2D WORLD ENGINE
   Pixi.js 6 · Full story · Parallax zones · Walking character
═══════════════════════════════════════════════════════════════ */

// ── GAME STATE ───────────────────────────────────────────────
const GS = {
  hp:100,maxHp:100,mp:60,maxMp:60,xp:0,xpToLevel:100,level:1,
  gold:50,corruption:0,morality:50,
  location:'village',chapter:1,mode:'story',hardcore:false,
  dayCount:1,kills:0,deaths:0,totalChoices:0,
  timePlayed:0,startTime:Date.now(),
  choices:{helpedVillagers:false,followedVoices:false,killedKing:false,freedKing:false,veilChoice:null},
  inventory:[],lore:[],abilities:['basic_attack'],
  questsComplete:[],locationsVisited:[],
  flags:{veilNodeUnlocked:false,dungeon_explored:false,arena_completed:false}
};

// ── SAVE ────────────────────────────────────────────────────
const Save = {
  KEY:'ef_world_v2',
  save(){
    try{
      GS.timePlayed+=Math.floor((Date.now()-GS.startTime)/1000);
      GS.startTime=Date.now();
      localStorage.setItem(this.KEY,JSON.stringify(GS));
    }catch(e){}
  },
  load(){
    try{
      const d=localStorage.getItem(this.KEY);
      if(!d)return false;
      const p=JSON.parse(d);
      const dm=(t,s)=>{
        for(const k in t){
          if(Object.prototype.hasOwnProperty.call(s,k)){
            if(typeof t[k]==='object'&&!Array.isArray(t[k])&&t[k]!==null)dm(t[k],s[k]||{});
            else t[k]=s[k];
          }
        }
      };
      dm(GS,p); GS.startTime=Date.now(); return true;
    }catch(e){return false;}
  },
  exists(){return!!localStorage.getItem(this.KEY);},
  clear(){localStorage.removeItem(this.KEY);}
};

// ── UTILS ───────────────────────────────────────────────────
const U = {
  rand:(a,b)=>Math.floor(Math.random()*(b-a+1))+a,
  rf:(a)=>a[Math.floor(Math.random()*a.length)],
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  $:(id)=>document.getElementById(id),
  sleep:(ms)=>new Promise(r=>setTimeout(r,ms))
};

// ── TOAST ───────────────────────────────────────────────────
const Toast={
  show(msg,type=''){
    const el=document.createElement('div');
    el.className='toast'+(type?' '+type:'');
    el.textContent=msg;
    U.$('toast-wrap').appendChild(el);
    setTimeout(()=>el.remove(),3200);
  }
};

// ── SCREEN FLASH ────────────────────────────────────────────
const Flash={
  fire(type){
    const el=U.$('scene-flash');
    el.className=type; el.offsetWidth;
    setTimeout(()=>el.className='',600);
  }
};

// ── HUD UPDATE ──────────────────────────────────────────────
const HUD={
  update(){
    const s=GS;
    const sw=(id,p)=>{const e=U.$(id);if(e)e.style.width=U.clamp(p,0,100)+'%';};
    const st=(id,v)=>{const e=U.$(id);if(e)e.textContent=v;};
    sw('bar-hp',s.hp/s.maxHp*100);
    sw('bar-mp',s.mp/s.maxMp*100);
    sw('bar-cor',s.corruption);
    st('val-hp',s.hp); st('val-mp',s.mp);
    st('val-cor',s.corruption+'%');
    st('val-gold',s.gold);
    st('hud-lv','Lv.'+s.level);
    // Corruption vignette
    const vig=U.$('vignette');
    if(vig){
      vig.className='';
      if(s.corruption>=80)vig.className='high';
      else if(s.corruption>=50)vig.className='mid';
      else if(s.corruption>=25)vig.className='low';
    }
  }
};

// ── CHOICE MODAL ────────────────────────────────────────────
const Choice={
  cbs:[],
  show(title,body,opts){
    U.$('cm-title').textContent=title;
    U.$('cm-body').textContent=body;
    U.$('cm-opts').innerHTML=opts.map((o,i)=>`<button class="copt" onclick="Choice.pick(${i})">${o.text}</button>`).join('');
    this.cbs=opts.map(o=>o.fn);
    U.$('choice-modal').classList.remove('hidden');
    GS.totalChoices++;
  },
  pick(i){
    U.$('choice-modal').classList.add('hidden');
    if(this.cbs[i])this.cbs[i]();
  }
};

// ── INVENTORY ───────────────────────────────────────────────
const Inv={
  tab:'items',
  open(){this.render();U.$('inv-panel').classList.remove('hidden');},
  close(){U.$('inv-panel').classList.add('hidden');},
  setTab(t,el){
    this.tab=t;
    document.querySelectorAll('.ptab').forEach(x=>x.classList.remove('active'));
    el.classList.add('active'); this.render();
  },
  render(){
    const items=this.tab==='lore'?GS.lore:GS.inventory.filter(i=>(i.type||'items')===this.tab);
    const g=U.$('inv-grid');
    if(!g)return;
    if(!items||!items.length){
      g.innerHTML=`<div style="grid-column:1/-1;font-family:var(--fB);font-style:italic;color:rgba(255,255,255,.25);padding:20px 0;text-align:center;">Nothing yet.</div>`;
      return;
    }
    if(this.tab==='lore'){
      g.innerHTML=items.map(l=>`<div class="inv-item"><div class="ii-ico">📜</div><div class="ii-name">${l.title}</div><div class="ii-desc">${l.text}</div></div>`).join('');
    } else {
      g.innerHTML=items.map(it=>`<div class="inv-item" onclick="Inv.use('${it.id}')"><div class="ii-ico">${it.icon}</div><div class="ii-name">${it.name}</div><div class="ii-desc">${it.desc}</div><div class="ii-val">${it.val}g</div></div>`).join('');
    }
  },
  add(item){
    if(item.id==='health_potion'){GS.inventory.push(item);Toast.show(`+ ${item.icon} ${item.name}`,'veil');return;}
    if(!GS.inventory.find(i=>i.id===item.id)){GS.inventory.push(item);Toast.show(`+ ${item.icon} ${item.name}`,'veil');}
  },
  remove(id){const i=GS.inventory.findIndex(x=>x.id===id);if(i!==-1)GS.inventory.splice(i,1);},
  use(id){
    const it=GS.inventory.find(i=>i.id===id);if(!it)return;
    if(it.id==='health_potion'){
      GS.hp=U.clamp(GS.hp+30,0,GS.maxHp);
      this.remove('health_potion');Toast.show('🧪 +30 HP restored!');HUD.update();this.render();
    }
  }
};

// ── COMBAT ENGINE ───────────────────────────────────────────
const Combat={
  enemy:null,active:false,turn:0,cooldown:false,onWin:null,onLose:null,
  ENEMIES:{
    shadow_echo:   {name:'Shadow Echo',   icon:'👻',hp:40, max:40, atk:[8,14],  loot:'Shadow Shard',   xp:25},
    forest_wraith: {name:'Forest Wraith', icon:'🌿',hp:55, max:55, atk:[10,18], loot:'Wraith Essence', xp:35},
    dungeon_golem: {name:'Stone Golem',   icon:'🪨',hp:80, max:80, atk:[14,22], loot:'Golem Core',     xp:50},
    castle_guard:  {name:'Hollow Guard',  icon:'⚔', hp:65, max:65, atk:[12,20], loot:null,             xp:45},
    arena_champ:   {name:'Echo Champion', icon:'🏆',hp:100,max:100,atk:[18,28], loot:'Champion Echo',  xp:80},
    dark_scout:    {name:'Dark Scout',    icon:'🗡', hp:30, max:30, atk:[6,10],  loot:null,             xp:15},
    echo_warrior:  {name:'Echo Warrior',  icon:'⚔', hp:70, max:70, atk:[14,20], loot:'Warrior Echo',   xp:55},
    veil_avatar:   {name:'Veil Avatar',   icon:'◉', hp:120,max:120,atk:[20,32], loot:'Veil Fragment',  xp:120},
  },
  start(key,onWin,onLose){
    const t=this.ENEMIES[key];if(!t)return;
    this.enemy={...t,hp:t.max,reward:{xp:t.xp,gold:U.rand(5,5+t.xp)}};
    this.onWin=onWin||null; this.onLose=onLose||null;
    this.active=true; this.turn=0; this.cooldown=false;
    World.closeDialogue();
    U.$('combat').classList.remove('hidden');
    U.$('sprite-enemy').textContent=this.enemy.icon;
    U.$('fl-enemy').textContent=this.enemy.name.toUpperCase();
    U.$('combat-log').innerHTML='';
    this.bars(); this.setTurn('⚔ Your Turn');
    Flash.fire('red');
    const sp=U.$('cb-spc');if(sp)sp.disabled=!GS.abilities.includes('veil_strike');
    // combat background per zone
    const cbg=U.$('combat-arena-bg');
    const bgMap={village:'linear-gradient(180deg,#1a0a05 0%,#0d0503 100%)',forest:'linear-gradient(180deg,#041208 0%,#020a04 100%)',dungeon:'linear-gradient(180deg,#06041a 0%,#020212 100%)',castle:'linear-gradient(180deg,#1a0505 0%,#0d0202 100%)',veil:'linear-gradient(180deg,#100525 0%,#050114 100%)',arena:'linear-gradient(180deg,#1a1005 0%,#0d0803 100%)'};
    if(cbg)cbg.style.background=bgMap[GS.location]||bgMap.village;
  },
  setTurn(t){const el=U.$('combat-turn');if(el)el.textContent=t;},
  bars(){
    const ph=U.$('fhp-player'),eh=U.$('fhp-enemy');
    const phv=U.$('fhv-player'),ehv=U.$('fhv-enemy');
    if(ph)ph.style.width=U.clamp(GS.hp/GS.maxHp*100,0,100)+'%';
    if(eh)eh.style.width=this.enemy?U.clamp(this.enemy.hp/this.enemy.max*100,0,100)+'%':'0%';
    if(phv)phv.textContent=`${GS.hp}/${GS.maxHp} HP`;
    if(ehv&&this.enemy)ehv.textContent=`${this.enemy.hp}/${this.enemy.max} HP`;
  },
  log(msg,cls=''){
    const l=U.$('combat-log');if(!l)return;
    const d=document.createElement('div');if(cls)d.className=cls;d.textContent=msg;
    l.appendChild(d); l.scrollTop=l.scrollHeight;
  },
  float(dmg,isEnemy){
    const el=document.createElement('div');
    el.className='dmg-float'+(isEnemy?'':' p');
    el.textContent='-'+dmg;
    const stage=U.$('combat-stage');if(!stage)return;
    el.style.cssText=`left:${isEnemy?'20%':'60%'};top:15%;position:absolute;`;
    stage.appendChild(el);setTimeout(()=>el.remove(),1000);
  },
  attack(){
    if(!this.active||this.cooldown)return;
    this.cooldown=true; this.setTurn('Attacking...');
    document.getElementById('f-player')?.classList.add('attacking');
    setTimeout(()=>document.getElementById('f-player')?.classList.remove('attacking'),500);
    const dmg=U.rand(10,18+GS.level*2);
    this.dealToEnemy(dmg);
    setTimeout(()=>{this.cooldown=false;if(this.active){this.setTurn('Enemy Turn');setTimeout(()=>this.enemyTurn(),700);}},900);
  },
  special(){
    if(!this.active||this.cooldown||!GS.abilities.includes('veil_strike'))return;
    if(GS.mp<20){Toast.show('Not enough MP!','danger');return;}
    this.cooldown=true; this.setTurn('✨ Veil Strike!');
    GS.mp-=20; const dmg=U.rand(25,42+GS.level*3);
    GS.corruption=U.clamp(GS.corruption+5,0,100);
    this.dealToEnemy(dmg,true); Flash.fire('veil'); HUD.update();
    setTimeout(()=>{this.cooldown=false;if(this.active){this.setTurn('Enemy Turn');setTimeout(()=>this.enemyTurn(),750);}},1100);
  },
  heal(){
    if(!this.active||this.cooldown)return;
    const pot=GS.inventory.find(i=>i.id==='health_potion');
    if(!pot){Toast.show('No potions! Buy at the village.','danger');return;}
    this.cooldown=true; this.setTurn('Healing...');
    const amt=U.rand(25,40); GS.hp=U.clamp(GS.hp+amt,0,GS.maxHp);
    Inv.remove('health_potion');
    this.log(`💊 You recover ${amt} HP.`,'lphit'); this.bars(); HUD.update();
    setTimeout(()=>{this.cooldown=false;this.setTurn('Enemy Turn');setTimeout(()=>this.enemyTurn(),600);},850);
  },
  flee(){
    if(!this.active||this.cooldown)return;
    if(Math.random()>.38){this.log('🏃 Escaped into the shadows!','lspec');setTimeout(()=>this.end(true),900);}
    else{this.log('⚠ Escape failed!','lhit');this.setTurn('Enemy Turn');setTimeout(()=>this.enemyTurn(),550);}
  },
  dealToEnemy(dmg,special=false){
    this.enemy.hp=Math.max(0,this.enemy.hp-dmg);
    document.getElementById('f-enemy')?.classList.add('hurt');
    setTimeout(()=>document.getElementById('f-enemy')?.classList.remove('hurt'),400);
    this.float(dmg,false);
    this.log(`${special?'✨ Veil Strike':'⚔ Strike'}: ${dmg} dmg to ${this.enemy.name}!`,special?'lspec':'lphit');
    this.bars();
    if(this.enemy.hp<=0){this.cooldown=true;setTimeout(()=>this.victory(),700);}
  },
  enemyTurn(){
    if(!this.active)return;
    this.turn++;
    let dmg=U.rand(...this.enemy.atk);
    if(this.enemy.hp/this.enemy.max<.3)dmg=Math.round(dmg*1.4);
    if(GS.mode==='chaos'&&Math.random()>.7)dmg*=2;
    if(GS.corruption>70)dmg=Math.round(dmg*.8);
    GS.hp=U.clamp(GS.hp-dmg,0,GS.maxHp);
    document.getElementById('f-player')?.classList.add('hurt');
    setTimeout(()=>document.getElementById('f-player')?.classList.remove('hurt'),400);
    this.float(dmg,true);
    this.log(`💥 ${this.enemy.name}: ${dmg} dmg!`,'lhit');
    Flash.fire('red'); this.bars(); HUD.update();
    if(GS.hp<=0)setTimeout(()=>this.defeat(),700);
    else this.setTurn('⚔ Your Turn');
  },
  victory(){
    this.active=false; const e=this.enemy;
    GS.kills++; GS.xp+=e.reward.xp; GS.gold+=e.reward.gold;
    if(e.loot&&Math.random()>.4)Inv.add({id:e.loot.toLowerCase().replace(/ /g,'_'),name:e.loot,icon:'💎',desc:'Battle drop.',type:'items',val:30});
    this.log(`✨ Victory! +${e.reward.xp} XP, +${e.reward.gold}g`,'lspec');
    this.setTurn('Victory!'); Flash.fire('white');
    if(GS.xp>=GS.xpToLevel)this.levelUp();
    HUD.update();
    setTimeout(()=>{U.$('combat').classList.add('hidden');if(this.onWin)this.onWin();},1600);
    Save.save();
  },
  levelUp(){
    GS.level++; GS.xp-=GS.xpToLevel; GS.xpToLevel=Math.round(GS.xpToLevel*1.4);
    GS.maxHp+=15; GS.hp=GS.maxHp; GS.maxMp+=8; GS.mp=GS.maxMp;
    Toast.show(`⬆ Level Up! Now Lv.${GS.level}`,'veil'); Flash.fire('white'); HUD.update();
  },
  defeat(){
    this.active=false; GS.deaths++;
    U.$('combat').classList.add('hidden');
    if(GS.hardcore){Save.clear();Game.showDeath(true);}else{Game.showDeath(false);}
    if(this.onLose)this.onLose();
  },
  end(fled){
    this.active=false; U.$('combat').classList.add('hidden');
    if(fled)Toast.show('You slipped away into the dark.');
  }
};

// ── DIALOGUE SYSTEM ──────────────────────────────────────────
const Dialogue={
  queue:[],
  choices:null,
  onDone:null,
  show(speaker,portrait,lines,choices,onDone){
    this.queue=[...lines]; this.choices=choices||null; this.onDone=onDone||null;
    U.$('dlg-speaker').textContent=speaker;
    U.$('dlg-portrait').textContent=portrait||'👤';
    U.$('dlg-choices').classList.add('hidden');
    U.$('dlg-choices').innerHTML='';
    U.$('dlg-tap').classList.remove('hidden');
    U.$('dialogue').classList.remove('hidden');
    this.next();
  },
  next(){
    if(this.queue.length>0){
      const txt=this.queue.shift();
      // Corruption glitch effect
      let out=txt;
      if(GS.corruption>60&&Math.random()>.75)out=txt.replace(/[aeiou]/gi,ch=>Math.random()>.5?'█':ch);
      U.$('dlg-text').textContent=out;
    } else if(this.choices){
      U.$('dlg-tap').classList.add('hidden');
      const ch=this.choices;
      U.$('dlg-choices').innerHTML=ch.map((c,i)=>`<button class="dlg-choice" onclick="Dialogue.pick(${i})">${c.text}</button>`).join('');
      U.$('dlg-choices').classList.remove('hidden');
    } else {
      this.close();
    }
  },
  pick(i){
    const c=this.choices[i];
    this.close();
    if(c.fn)c.fn();
  },
  close(){
    U.$('dialogue').classList.add('hidden');
    if(this.onDone)this.onDone();
    this.onDone=null; this.choices=null;
  },
  tap(){if(!U.$('dlg-choices').classList.contains('hidden'))return;this.next();}
};

// ═══════════════════════════════════════════════════════════════
//  PIXI.JS 2D WORLD ENGINE
// ═══════════════════════════════════════════════════════════════
let app, worldContainer, bgLayers=[], charSprite, charBody, npcs=[], triggers=[];
let camX=0, camTargetX=0, worldWidth=3000;
let charX=200, charVX=0, charFacing=1, charWalkFrame=0, charWalkTimer=0;
let keysDown={left:false,right:false,attack:false};
let onGround=true;
let nearNPC=null;

const ZONE_COLORS = {
  village: {sky:[0x1a0a35,0x0d0520], ground:0xc8b890, mid:0x8a7060, far:0x4a3050},
  forest:  {sky:[0x041208,0x020a04], ground:0x2a4a1a, mid:0x1a3010, far:0x0d1808},
  dungeon: {sky:[0x060418,0x030210], ground:0x1a1525, mid:0x2e2838, far:0x1a1628},
  castle:  {sky:[0x0a0508,0x050308], ground:0x4a4040, mid:0x3a3035, far:0x25202a},
  arena:   {sky:[0x302010,0x1a1005], ground:0x706040, mid:0x504030, far:0x302018},
  veil:    {sky:[0x050218,0x020110], ground:0x1a0830, mid:0x100522, far:0x08030f},
};

function initPixi(){
  const mount=U.$('pixi-stage');
  app=new PIXI.Application({
    width:window.innerWidth,
    height:window.innerHeight,
    backgroundColor:0x03020a,
    antialias:true,
    resolution:Math.min(window.devicePixelRatio||1,2),
    autoDensity:true,
  });
  mount.appendChild(app.view);

  worldContainer=new PIXI.Container();
  app.stage.addChild(worldContainer);

  window.addEventListener('resize',()=>{
    app.renderer.resize(window.innerWidth,window.innerHeight);
  });

  buildChar();
  app.ticker.add(gameLoop);
}

// ── BACKGROUND LAYER BUILDER ────────────────────────────────
function buildBgLayers(zone){
  const cols=ZONE_COLORS[zone]||ZONE_COLORS.village;
  const W=app.renderer.width, H=app.renderer.height;

  // Clear old layers
  bgLayers.forEach(l=>worldContainer.removeChild(l));
  bgLayers=[];

  // Layer 0: Sky gradient
  const sky=new PIXI.Graphics();
  const c1=cols.sky[0]||0x050215, c2=cols.sky[1]||0x0d0530;
  sky.beginFill(c1); sky.drawRect(0,0,worldWidth,H*.55); sky.endFill();
  sky.beginFill(c2); sky.drawRect(0,H*.4,worldWidth,H*.6); sky.endFill();
  sky.zIndex=0;

  // Stars
  if(zone!=='dungeon'){
    for(let i=0;i<80;i++){
      const star=new PIXI.Graphics();
      const alpha=.3+Math.random()*.7;
      star.beginFill(0xffffff,alpha);
      star.drawCircle(0,0,Math.random()<.1?1.5:.7);
      star.endFill();
      star.x=Math.random()*worldWidth;
      star.y=Math.random()*H*.4;
      star.userData={twinkle:Math.random()*Math.PI*2,twinkleSpeed:.5+Math.random()};
      sky.addChild(star);
    }
  }
  // Moon
  if(zone!=='dungeon'&&zone!=='arena'){
    const moon=new PIXI.Graphics();
    moon.beginFill(0xfff8d0,.9);
    moon.drawCircle(0,0,22);
    moon.endFill();
    moon.beginFill(cols.sky[0]||0x050215,.95);
    moon.drawCircle(8,-6,18);
    moon.endFill();
    moon.x=worldWidth*.82; moon.y=H*.1;
    sky.addChild(moon);
  }

  worldContainer.addChild(sky);
  bgLayers.push({container:sky,scrollFactor:.1});

  // Layer 1: Distant mountains / silhouettes
  const far=new PIXI.Graphics();
  far.zIndex=1;
  const farCol=cols.far||0x1a0a35;
  // Draw mountain range
  for(let i=0;i<12;i++){
    const bx=i*(worldWidth/10)+(Math.random()*worldWidth/12);
    const bh=H*.25+Math.random()*H*.18;
    far.beginFill(farCol,.9);
    far.moveTo(bx,H*.55);
    far.lineTo(bx+60+Math.random()*80,H*.55-bh);
    far.lineTo(bx+140+Math.random()*80,H*.55);
    far.endFill();
  }
  worldContainer.addChild(far);
  bgLayers.push({container:far,scrollFactor:.25});

  // Layer 2: Mid elements (trees/structures)
  const mid=new PIXI.Graphics();
  mid.zIndex=2;
  drawMidLayer(mid,zone,W,H,cols.mid||0x2a1560);
  worldContainer.addChild(mid);
  bgLayers.push({container:mid,scrollFactor:.5});

  // Layer 3: Ground
  const ground=new PIXI.Graphics();
  ground.zIndex=3;
  ground.beginFill(cols.ground||0xc8b890);
  ground.drawRect(0,H*.72,worldWidth,H*.32);
  ground.endFill();
  // Ground detail stripes
  for(let i=0;i<worldWidth;i+=60){
    ground.beginFill(0x000000,.05);
    ground.drawRect(i,H*.72,30,H*.32);
    ground.endFill();
  }
  // Ground top edge
  ground.beginFill(0xffffff,.06);
  ground.drawRect(0,H*.72,worldWidth,3);
  ground.endFill();
  worldContainer.addChild(ground);
  bgLayers.push({container:ground,scrollFactor:.85});

  // Foreground atmosphere
  if(zone==='forest'){
    const fog=new PIXI.Graphics();
    fog.zIndex=4;
    fog.beginFill(0x203820,.2);
    fog.drawRect(0,H*.6,worldWidth,H*.15);
    fog.endFill();
    worldContainer.addChild(fog);
    bgLayers.push({container:fog,scrollFactor:.9});
  }
  if(zone==='veil'){
    const vfog=new PIXI.Graphics();
    vfog.zIndex=4;
    for(let i=0;i<8;i++){
      vfog.beginFill(0x4020a0,.08+Math.random()*.08);
      vfog.drawEllipse(i*worldWidth/7+worldWidth/14,H*.68,180,30);
      vfog.endFill();
    }
    worldContainer.addChild(vfog);
    bgLayers.push({container:vfog,scrollFactor:.88});
  }
}

function drawMidLayer(g,zone,W,H,col){
  switch(zone){
    case 'village':
      // Houses
      const houseData=[{x:200,w:100,h:90},{x:500,w:120,h:110},{x:1200,w:90,h:80},{x:1600,w:110,h:100},{x:2200,w:130,h:120},{x:2700,w:100,h:90}];
      houseData.forEach(d=>{
        g.beginFill(0x888888,.9);g.drawRect(d.x,H*.72-d.h,d.w,d.h);g.endFill();
        // Roof
        g.beginFill(0xc84030,.9);
        g.moveTo(d.x-10,H*.72-d.h);g.lineTo(d.x+d.w/2,H*.72-d.h-45);g.lineTo(d.x+d.w+10,H*.72-d.h);
        g.endFill();
        // Window
        g.beginFill(0xb8d8f0,.7);g.drawRect(d.x+25,H*.72-d.h+20,22,18);g.endFill();
        g.beginFill(0xb8d8f0,.7);g.drawRect(d.x+d.w-47,H*.72-d.h+20,22,18);g.endFill();
      });
      // Trees between houses
      [350,900,1450,1900,2450].forEach(tx=>drawCSSTree(g,tx,H*.72,col));
      break;

    case 'forest':
      // Dense tree silhouettes
      for(let i=0;i<25;i++){
        const tx=i*(worldWidth/22)+Math.random()*60;
        const scale=.7+Math.random()*.6;
        drawDarkTree(g,tx,H*.72,scale,col);
      }
      // Floating veil lights
      for(let i=0;i<15;i++){
        g.beginFill(0x8040ff,.25+Math.random()*.2);
        g.drawCircle(Math.random()*worldWidth,H*.4+Math.random()*H*.3,2+Math.random()*3);
        g.endFill();
      }
      break;

    case 'dungeon':
      // Stone columns
      for(let i=0;i<15;i++){
        const cx=i*(worldWidth/12);
        g.beginFill(0x2e2838,.95);g.drawRect(cx-18,H*.2,36,H*.55);g.endFill();
        g.beginFill(0x3e3848,.9);g.drawRect(cx-22,H*.2-8,44,16);g.endFill();
        g.beginFill(0x3e3848,.9);g.drawRect(cx-22,H*.72-8,44,16);g.endFill();
      }
      // Torch glow
      for(let i=0;i<8;i++){
        const tx=i*(worldWidth/7)+100;
        g.beginFill(0xff8020,.3);g.drawCircle(tx,H*.35,25);g.endFill();
        g.beginFill(0xff5000,.5);g.drawCircle(tx,H*.35,8);g.endFill();
      }
      break;

    case 'castle':
      // Castle walls + battlements
      g.beginFill(0x3a3035,.95);g.drawRect(0,H*.4,worldWidth,H*.35);g.endFill();
      // Battlements
      for(let i=0;i<worldWidth;i+=60){
        g.beginFill(0x2a2028,.95);g.drawRect(i,H*.3,30,H*.12);g.endFill();
      }
      // Towers
      [200,600,1000,1500,2000,2500].forEach(tx=>{
        g.beginFill(0x4a4048,.95);g.drawRect(tx-30,H*.15,60,H*.58);g.endFill();
        g.beginFill(0x3a3038,.95);g.drawRect(tx-38,H*.12,76,H*.08);g.endFill();
      });
      // Red corruption cracks
      for(let i=0;i<20;i++){
        const cx=Math.random()*worldWidth;
        g.lineStyle(1,0xcc2020,.3);
        g.moveTo(cx,H*.4);g.lineTo(cx+U.rand(-20,20),H*.72);
        g.lineStyle(0);
      }
      break;

    case 'arena':
      // Coliseum walls
      for(let i=0;i<worldWidth;i+=120){
        g.beginFill(0x706040,.85);g.drawRect(i,H*.3,80,H*.45);g.endFill();
        g.beginFill(0x504030,.85);g.drawRect(i,H*.25,80,H*.1);g.endFill();
      }
      // Crowd silhouettes
      for(let i=0;i<50;i++){
        g.beginFill(0x403020,.6);
        g.drawCircle(i*(worldWidth/48)+20,H*.28,6);g.endFill();
      }
      // Arena floor markings
      g.lineStyle(2,0xd4a020,.3);
      g.drawCircle(worldWidth/2,H*.8,200);
      g.lineStyle(0);
      break;

    case 'veil':
      // Broken reality shards
      for(let i=0;i<20;i++){
        const sx=Math.random()*worldWidth, sy=H*.3+Math.random()*H*.4;
        g.beginFill(0x8040ff,.3+Math.random()*.3);
        const pts=[0,-30,15,-10,10,15,-10,15,-15,-10];
        g.drawPolygon(pts.map((v,i)=>i%2===0?v+sx:v+sy));
        g.endFill();
      }
      // Veil core (center)
      g.beginFill(0x6020cc,.5);g.drawCircle(worldWidth/2,H*.5,60);g.endFill();
      g.beginFill(0x8040ff,.3);g.drawCircle(worldWidth/2,H*.5,90);g.endFill();
      g.beginFill(0xc080ff,.15);g.drawCircle(worldWidth/2,H*.5,130);g.endFill();
      break;
  }
}

function drawCSSTree(g,x,groundY,col){
  g.beginFill(0x5c3d1e,.9);g.drawRect(x-5,groundY-80,10,80);g.endFill();
  g.beginFill(col||0x2d7a3a,.85);
  g.moveTo(x,groundY-140);g.lineTo(x-35,groundY-80);g.lineTo(x+35,groundY-80);g.endFill();
  g.moveTo(x,groundY-180);g.lineTo(x-25,groundY-120);g.lineTo(x+25,groundY-120);g.endFill();
}
function drawDarkTree(g,x,groundY,scale,col){
  const h=100*scale, w=55*scale;
  g.beginFill(col||0x0f3c1a,.95);
  g.moveTo(x,groundY-h*1.4);g.lineTo(x-w*.6,groundY-h*.5);g.lineTo(x+w*.6,groundY-h*.5);g.endFill();
  g.moveTo(x,groundY-h);g.lineTo(x-w*.4,groundY-h*.2);g.lineTo(x+w*.4,groundY-h*.2);g.endFill();
  g.beginFill(0x3c1e0a,.8);g.drawRect(x-5,groundY-h*.5,10,h*.5);g.endFill();
}

// ── CHARACTER SPRITE ────────────────────────────────────────
function buildChar(){
  charSprite=new PIXI.Container();
  charBody=new PIXI.Graphics();
  drawCharFrame(charBody,0);
  charSprite.addChild(charBody);
  charSprite.zIndex=10;
  worldContainer.addChild(charSprite);
  charSprite.x=charX;
  charSprite.y=app.renderer.height*.72+2;
}

function drawCharFrame(g,frame){
  g.clear();
  const H=app.renderer.height;
  const gy=0; // character draws upward from 0
  const walkOffset=frame===1?2:frame===3?-2:0;

  // Shadow
  g.beginFill(0x000000,.25);g.drawEllipse(0,6,18,5);g.endFill();

  // Legs
  g.beginFill(0x8a7a50);
  if(frame===0||frame===2){g.drawRect(-10,-50,9,28);g.drawRect(1,-50,9,28);}
  else if(frame===1){g.drawRect(-10,-50,9,24+walkOffset);g.drawRect(1,-54,9,24-walkOffset);}
  else{g.drawRect(-10,-54,9,24-walkOffset);g.drawRect(1,-50,9,24+walkOffset);}
  g.endFill();
  // Shoes
  g.beginFill(0xcc2828);g.drawRect(-12,-22,12,7);g.drawRect(0,-22,12,7);g.endFill();

  // Body/shirt
  g.beginFill(0xe8e0d0);g.drawRoundedRect(-13,-90,26,42,2);g.endFill();
  // Cape glow
  g.beginFill(0x8040ff,.7);g.drawRoundedRect(-14,-92,28,8,2);g.endFill();

  // Arms
  const armSwing=frame===1?.22:frame===3?-.22:0;
  g.beginFill(0xe8e0d0);
  g.drawRect(-20,-88+armSwing*20,8,22);
  g.drawRect(12,-88-armSwing*20,8,22);
  g.endFill();
  // Sword
  g.beginFill(0xd0d0d0);g.drawRect(18,-106,4,30);g.endFill();
  g.beginFill(0xf0c040);g.drawRect(16,-80,8,5);g.endFill();

  // Head
  g.beginFill(0xf0c890);g.drawRoundedRect(-12,-128,24,32,5);g.endFill();
  // Hair
  g.beginFill(0x1a1008);g.drawRoundedRect(-14,-130,28,16,4);g.endFill();
  g.beginFill(0x1a1008);g.drawCircle(-12,-122,7);g.drawCircle(12,-122,7);g.endFill();
  // Eyes
  g.beginFill(0xffffff,.9);g.drawRoundedRect(-8,-114,6,5,2);g.drawRoundedRect(2,-114,6,5,2);g.endFill();
  g.beginFill(0x4060d0);g.drawCircle(-5,-112,2);g.drawCircle(5,-112,2);g.endFill();

  // Veil glow (increases with corruption)
  if(GS.corruption>30){
    const glowAlpha=GS.corruption/200;
    g.beginFill(0x8040ff,glowAlpha);g.drawRoundedRect(-15,-132,30,140,6);g.endFill();
  }
}

// ── NPC SPRITES ─────────────────────────────────────────────
function addNPC(data){
  const c=new PIXI.Container();
  const g=new PIXI.Graphics();
  // Simple NPC - different color body
  g.beginFill(0x000000,.2);g.drawEllipse(0,6,16,5);g.endFill();
  g.beginFill(0x8a7a50);g.drawRect(-9,-50,8,28);g.drawRect(1,-50,8,28);g.endFill();
  g.beginFill(data.bodyColor||0x604080);g.drawRoundedRect(-12,-88,24,40,2);g.endFill();
  g.beginFill(data.skinColor||0xd4b88a);g.drawRoundedRect(-11,-126,22,30,5);g.endFill();
  g.beginFill(data.hairColor||0x1a1008);g.drawRoundedRect(-13,-128,26,14,4);g.endFill();
  c.addChild(g);
  c.x=data.x; c.y=app.renderer.height*.72+2;
  c.userData={...data,graphic:g};
  c.zIndex=9;
  // Name tag
  const style=new PIXI.TextStyle({fontFamily:'Cinzel',fontSize:10,fill:'#f0c040',letterSpacing:1.5});
  const label=new PIXI.Text(data.name,style);
  label.anchor.set(.5,1); label.y=-140;
  c.addChild(label);
  worldContainer.addChild(c);
  npcs.push(c);
  return c;
}

// ── ZONE TRIGGERS (portals/doors) ────────────────────────────
function addTrigger(x,targetZone,unlockChapter=1){
  const g=new PIXI.Graphics();
  const H=app.renderer.height;
  // Portal ring
  g.lineStyle(3,0x8040ff,.8);g.drawEllipse(0,-60,22,60);g.lineStyle(0);
  g.beginFill(0x8040ff,.15);g.drawEllipse(0,-60,22,60);g.endFill();
  // Inner glow
  g.beginFill(0xc080ff,.1);g.drawEllipse(0,-60,16,45);g.endFill();
  g.x=x; g.y=H*.72+2; g.zIndex=8;
  worldContainer.addChild(g);
  // Pulse animation
  let phase=Math.random()*Math.PI*2;
  app.ticker.add(()=>{
    phase+=.04; g.alpha=.6+Math.sin(phase)*.4;
  });
  triggers.push({container:g,x,targetZone,unlockChapter,graphic:g});
}

// ── WORLD: LOAD ZONE ────────────────────────────────────────
const ZONE_META={
  village:{name:"Ash'vel · The Fading Village",ch:'Chapter I',chN:1,nextZone:'forest',
    npcs:[
      {name:'Elder Mora',x:600,skinColor:0xd4b88a,bodyColor:0x604080,hairColor:0x888060,
       speaker:'Elder Mora',portrait:'👵',
       lines:['"Stranger... you look different. Like you don\'t belong to this moment."','"The Veil came three moons ago. People started forgetting. Now they loop — same moments, forever."','"There is a forest north of here. Be cautious, Veilwalker."'],
       choices:[
         {text:'💬 Ask about the Veil',fn:()=>World.villageAct('talkElder')},
         {text:'🤝 Help the villagers',fn:()=>World.villageAct('help')},
         {text:'(leave)',fn:()=>Dialogue.close()},
       ]},
      {name:'Old Mara',x:1100,skinColor:0xe0b888,bodyColor:0x506030,hairColor:0x606050,
       speaker:'Old Mara · Trader',portrait:'🛒',
       lines:['"Looking to trade, wanderer?"'],
       choices:[
         {text:'🧪 Potion (15g)',fn:()=>World.shop('potion')},
         {text:'🛡 Iron Charm (30g)',fn:()=>World.shop('charm')},
         {text:'⚔ Short Sword (40g)',fn:()=>World.shop('sword')},
         {text:'(leave)',fn:()=>Dialogue.close()},
       ]},
    ],
    triggers:[{x:2600,zone:'forest',ch:2}],
    worldW:3000
  },
  forest:{name:'Whispering Forest',ch:'Chapter II',chN:2,nextZone:'dungeon',
    npcs:[
      {name:'The Whisper',x:800,skinColor:0x6040a0,bodyColor:0x3020a0,hairColor:0x2010a0,
       speaker:'The Whisper',portrait:'🌀',
       lines:['"Come deeper, Veilwalker. We know what you seek."','"Power like you\'ve never felt... just follow the voices."'],
       choices:[
         {text:'🌀 Follow the voices',fn:()=>World.forestAct('follow')},
         {text:'🛡 Stay grounded',fn:()=>World.forestAct('resist')},
         {text:'(back away)',fn:()=>Dialogue.close()},
       ]},
      {name:'Forest Sprite',x:1500,skinColor:0xa0d0a0,bodyColor:0x208040,hairColor:0x104020,
       speaker:'Forest Sprite',portrait:'🍃',
       lines:['"Lost traveler... these woods remember every step."','"Gather the herbs near the old altar. They will aid you."'],
       choices:[
         {text:'🌿 Gather herbs',fn:()=>World.forestAct('gather')},
         {text:'⚔ Hunt the creature',fn:()=>World.forestAct('hunt')},
         {text:'(leave)',fn:()=>Dialogue.close()},
       ]},
    ],
    triggers:[{x:200,zone:'village',ch:0},{x:2800,zone:'dungeon',ch:3}],
    worldW:3200
  },
  dungeon:{name:'The Dungeon · Depths Below',ch:'Hidden Path',chN:3,nextZone:'castle',
    npcs:[
      {name:'Stone Golem',x:1800,skinColor:0x9a9080,bodyColor:0x6a6055,hairColor:0x5a5045,
       speaker:'Stone Golem',portrait:'🪨',
       lines:['"..."','"The golem\'s eyes glow red. It will not let you pass."'],
       choices:[
         {text:'💀 Fight the Golem',fn:()=>World.dungeonAct('boss')},
         {text:'🔦 Explore first',fn:()=>World.dungeonAct('explore')},
         {text:'(retreat)',fn:()=>Dialogue.close()},
       ]},
      {name:'Dungeon Spirit',x:600,skinColor:0xb0b8d0,bodyColor:0x404858,hairColor:0x303848,
       speaker:'Dungeon Spirit',portrait:'💀',
       lines:['"These halls hold ancient secrets..."','"The chests are guarded but not locked."'],
       choices:[
         {text:'📦 Search chests',fn:()=>World.dungeonAct('chest')},
         {text:'◉ Veil Fragment',fn:()=>World.dungeonAct('fragment')},
         {text:'(leave)',fn:()=>Dialogue.close()},
       ]},
    ],
    triggers:[{x:100,zone:'forest',ch:0},{x:2900,zone:'castle',ch:3}],
    worldW:3000
  },
  castle:{name:'Broken Castle · Corrupted Throne',ch:'Chapter III',chN:3,nextZone:'veil',
    npcs:[
      {name:'King Aldric',x:1400,skinColor:0xd0c0b0,bodyColor:0x300808,hairColor:0x808080,
       speaker:'King Aldric — Corrupted',portrait:'👑',
       lines:['"You... arrived. I knew someone would come."','"The Veil told me. It told me there would be NO WAY OUT—"'],
       choices:[
         {text:'☠ Strike down the king',fn:()=>World.castleAct('kill')},
         {text:'✨ Break the curse',fn:()=>World.castleAct('free')},
         {text:'⚔ Fight the guards',fn:()=>World.castleAct('guards')},
         {text:'(search castle)',fn:()=>World.castleAct('search')},
       ]},
    ],
    triggers:[{x:100,zone:'dungeon',ch:0},{x:2900,zone:'veil',ch:4,flagReq:'veilNodeUnlocked'}],
    worldW:3000
  },
  arena:{name:'Echo Arena · Trial Grounds',ch:'Trial Mode',chN:2,nextZone:'village',
    npcs:[
      {name:'Arena Master',x:1500,skinColor:0xd0a880,bodyColor:0x806020,hairColor:0x201008,
       speaker:'Arena Master',portrait:'🏆',
       lines:['"Welcome to the Echo Trials, Veilwalker."','"Your enemies are echoes — memories of fallen warriors."'],
       choices:[
         {text:'🗡 Scout Trial (easy)',fn:()=>World.arenaAct(1)},
         {text:'⚔ Warrior Trial (medium)',fn:()=>World.arenaAct(2)},
         {text:'🏆 Champion Trial (hard)',fn:()=>World.arenaAct(3)},
         {text:'∞ Endless Veil',fn:()=>World.arenaAct(0)},
         {text:'(leave)',fn:()=>Dialogue.close()},
       ]},
    ],
    triggers:[{x:100,zone:'village',ch:0}],
    worldW:2000
  },
  veil:{name:'The Veil Core · Reality Fractures',ch:'Chapter IV',chN:4,nextZone:null,
    npcs:[
      {name:'The Veil',x:1500,skinColor:0x8040c0,bodyColor:0x4020a0,hairColor:0x2010a0,
       speaker:'The Veil — Speaking',portrait:'◉',
       lines:['"You\'ve walked far, Veilwalker."','"Every choice you made echoes here."','"Now you must choose what you become."'],
       choices:[
         {text:'💥 Destroy the Veil',fn:()=>VeilCore.destroy()},
         {text:'👁 Control the Veil',fn:()=>VeilCore.control()},
         {text:'◉ Merge with the Veil',fn:()=>VeilCore.merge()},
       ]},
    ],
    triggers:[{x:100,zone:'castle',ch:0}],
    worldW:2400
  },
};

const World={
  zone:'village',

  async load(zone,spawnRight=true){
    GS.location=zone; this.zone=zone;
    // Wipe
    const wipe=U.$('zone-wipe');
    const meta=ZONE_META[zone];
    U.$('zw-name').textContent=meta.name;
    wipe.classList.add('active');
    await U.sleep(350);

    // Clear world
    worldContainer.removeChildren();
    npcs=[]; triggers=[];
    charSprite=null; charBody=null;

    // World width
    worldWidth=meta.worldW||3000;

    // Build background
    buildBgLayers(zone);

    // Add NPCs
    meta.npcs.forEach(n=>addNPC(n));

    // Add triggers (portals)
    meta.triggers.forEach(t=>{
      // Check unlock
      const unlocked=t.ch===0||(t.flagReq?GS.flags[t.flagReq]:GS.chapter>=t.ch);
      if(unlocked||t.ch===0) addTrigger(t.x,t.zone,t.ch);
    });

    // Rebuild character
    buildChar();
    charX=spawnRight?180:worldWidth-180;
    charSprite.x=charX;
    charVX=0;

    // Zone UI
    U.$('zone-name').textContent=meta.name;
    U.$('zone-ch').textContent=meta.ch;

    // Map panel entries
    this.buildMapPanel();

    // Unwipe
    await U.sleep(100);
    wipe.classList.remove('active');

    // Zone entry toast
    const entryMsgs={
      village:'"Time loops here. The fog never fully lifts."',
      forest:'"The voices are real. But are they trustworthy?"',
      dungeon:'"Something ancient breathes in the dark."',
      castle:'"The corrupted king waits on his empty throne."',
      arena:'"Prove your worth. The echoes will not yield."',
      veil:'"Reality fractures. This is where it ends — or begins."',
    };
    setTimeout(()=>Toast.show(entryMsgs[zone]||''),900);

    if(!GS.locationsVisited.includes(zone))GS.locationsVisited.push(zone);
    Save.save();
  },

  buildMapPanel(){
    const el=U.$('map-zones');if(!el)return;
    const zones=[
      {id:'village',name:'The Fading Village',desc:'Where time loops',dot:'#40c8e0',ch:0},
      {id:'forest', name:'Whispering Forest', desc:'Voices in the dark',dot:'#40c060',ch:2},
      {id:'dungeon',name:'The Dungeon',       desc:'Ancient and dangerous',dot:'#8060c0',ch:3},
      {id:'castle', name:'Broken Castle',     desc:'Corrupted throne',dot:'#e04040',ch:3},
      {id:'arena',  name:'Echo Arena',        desc:'Trial grounds',dot:'#e0a040',ch:2},
      {id:'veil',   name:'Veil Core',         desc:'Reality fractures',dot:'#8040ff',ch:4,flagReq:'veilNodeUnlocked'},
    ];
    el.innerHTML=zones.map(z=>{
      const locked=z.ch>0&&(z.flagReq?!GS.flags[z.flagReq]:GS.chapter<z.ch);
      return `<div class="map-zone-entry${locked?' locked':''}" onclick="World.mapTravel('${z.id}',${locked})">
        <div class="mze-dot" style="background:${z.dot}"></div>
        <div><div class="mze-name">${z.name}</div><div class="mze-desc">${z.desc}</div></div>
        ${locked?'<span class="mze-lock">🔒</span>':''}
      </div>`;
    }).join('');
  },

  mapTravel(zone,locked){
    if(locked){Toast.show('This zone is not yet accessible.','danger');return;}
    U.$('map-panel').classList.add('hidden');
    this.load(zone,true);
  },

  closeDialogue(){
    U.$('dialogue').classList.add('hidden');
  },

  // ── VILLAGE ACTIONS ──
  villageAct(act){
    Dialogue.close();
    switch(act){
      case 'talkElder':
        const lines=['"The Veil came three moons ago. People started forgetting."','"My granddaughter said she saw you before. But you only just arrived... didn\'t you?"','"Sometimes I remember things that haven\'t happened yet. That\'s the worst part."'];
        Toast.show('💬 '+U.rf(lines));
        break;
      case 'help':
        if(GS.choices.helpedVillagers){Toast.show('You have already helped the village.');return;}
        GS.choices.helpedVillagers=true; GS.morality=U.clamp(GS.morality+20,0,100);
        GS.xp+=30; GS.gold+=15;
        Inv.add({id:'ember_stone',name:'Ember Stone',icon:'🔥',desc:'Given by Elder Mora.',type:'items',val:50});
        Toast.show('✓ Village helped — Morality +20, XP +30');
        Flash.fire('white'); HUD.update();
        if(GS.chapter<2){GS.chapter=2;Toast.show('🌲 Whispering Forest unlocked!','veil');}
        this.buildMapPanel(); Save.save();
        break;
    }
  },
  shop(item){
    Dialogue.close();
    const items={
      potion:{cost:15,fn:()=>Inv.add({id:'health_potion',name:'Health Potion',icon:'🧪',desc:'Restore 30 HP',type:'items',val:20}),msg:'🧪 Potion acquired!'},
      charm:{cost:30,fn:()=>{GS.maxHp+=5;GS.hp=U.clamp(GS.hp+5,0,GS.maxHp);Inv.add({id:'iron_charm',name:'Iron Charm',icon:'🛡',desc:'+5 Max HP',type:'items',val:40});},msg:'🛡 Iron Charm — Max HP +5'},
      sword:{cost:40,fn:()=>Inv.add({id:'short_sword',name:'Short Sword',icon:'⚔',desc:'+3 Attack',type:'items',val:50}),msg:'⚔ Short Sword equipped!'},
    };
    const it=items[item];if(!it)return;
    if(GS.gold<it.cost){Toast.show('Not enough gold!','danger');return;}
    GS.gold-=it.cost; it.fn(); Toast.show(it.msg); HUD.update(); Save.save();
  },

  // ── FOREST ACTIONS ──
  forestAct(act){
    Dialogue.close();
    switch(act){
      case 'follow':
        if(GS.choices.followedVoices){Toast.show('The voices grow stronger...','veil');return;}
        GS.choices.followedVoices=true; GS.corruption=U.clamp(GS.corruption+15,0,100); GS.xp+=40;
        Inv.add({id:'veil_shard',name:'Veil Shard',icon:'💜',desc:'Hums with dark power.',type:'items',val:60});
        if(!GS.abilities.includes('veil_strike')){GS.abilities.push('veil_strike');Toast.show('✨ Veil Strike unlocked!','veil');}
        Toast.show('⚠ Corruption +15 — Veil Shard obtained','danger');
        Flash.fire('veil'); HUD.update();
        if(GS.chapter<3){GS.chapter=3;Toast.show('🏰 Castle & Dungeon unlocked!','veil');}
        this.buildMapPanel(); Save.save(); break;
      case 'resist':
        GS.morality=U.clamp(GS.morality+10,0,100); GS.xp+=20;
        Toast.show('✓ Stayed grounded — Morality +10'); HUD.update(); Save.save(); break;
      case 'gather':
        const herbs=['Moon Petal','Shadowroot','Ember Moss','Veil Fern'];
        const herb=U.rf(herbs);
        Inv.add({id:herb.toLowerCase().replace(/ /g,'_'),name:herb,icon:'🌿',desc:'Forest herb.',type:'items',val:15});
        Toast.show(`🌿 Gathered ${herb}`); GS.xp+=10; HUD.update(); Save.save(); break;
      case 'hunt':
        Combat.start('forest_wraith',()=>{Toast.show('The wraith dissolves.');GS.xp+=10;HUD.update();Save.save();},()=>Toast.show('You barely escape...','danger'));
        break;
    }
  },

  // ── DUNGEON ACTIONS ──
  dungeonAct(act){
    Dialogue.close();
    switch(act){
      case 'boss':
        Combat.start('dungeon_golem',()=>{
          GS.flags.veilNodeUnlocked=true; this.buildMapPanel();
          Toast.show('◉ Veil Core revealed!','veil'); Flash.fire('veil'); HUD.update(); Save.save();
        },()=>Toast.show('The golem overpowers you.','danger')); break;
      case 'explore':
        const finds=['A skeleton clutches 15 gold.','Ancient writing: "The Veil was opened here first."','A hidden alcove holds supplies.'];
        Toast.show(U.rf(finds)); GS.gold+=15; GS.xp+=20; GS.flags.dungeon_explored=true; HUD.update(); Save.save(); break;
      case 'chest':
        const loot=[{id:'dungeon_key',name:'Dungeon Key',icon:'🗝',desc:'Opens a sealed door.',type:'items',val:25},{id:'bone_charm',name:'Bone Charm',icon:'🦴',desc:'+3 Defense.',type:'items',val:35}];
        Inv.add(U.rf(loot)); GS.gold+=U.rand(5,20); HUD.update(); Save.save(); break;
      case 'fragment':
        if(GS.corruption<20){Toast.show('You sense something but cannot grasp it yet...');return;}
        Inv.add({id:'veil_frag',name:'Veil Fragment',icon:'◉',desc:'Pure Veil energy.',type:'items',val:80});
        GS.corruption=U.clamp(GS.corruption+10,0,100);
        Toast.show('◉ Veil Fragment absorbed','veil'); Flash.fire('veil'); HUD.update(); Save.save(); break;
    }
  },

  // ── CASTLE ACTIONS ──
  castleAct(act){
    Dialogue.close();
    switch(act){
      case 'kill':
        if(GS.choices.killedKing){Toast.show('The throne sits empty.');return;}
        GS.choices.killedKing=true; GS.morality=U.clamp(GS.morality-25,0,100);
        GS.corruption=U.clamp(GS.corruption+20,0,100); GS.xp+=60; GS.gold+=50;
        Toast.show('⚠ King slain — Morality -25, Corruption +20','danger'); Flash.fire('red'); HUD.update(); Save.save(); break;
      case 'free':
        if(GS.choices.freedKing){Toast.show('The king is at peace.');return;}
        GS.choices.freedKing=true; GS.morality=U.clamp(GS.morality+30,0,100); GS.xp+=80;
        Inv.add({id:'royal_seal',name:'Royal Seal',icon:'👑',desc:'Proof of a broken curse.',type:'items',val:100});
        Toast.show('✓ Curse broken — Morality +30, Royal Seal obtained','veil'); Flash.fire('white'); HUD.update(); Save.save(); break;
      case 'guards':
        Combat.start('castle_guard',()=>{Toast.show('The hollow guard crumbles.');GS.xp+=10;HUD.update();Save.save();},()=>Toast.show('The guards overwhelm you.','danger')); break;
      case 'search':
        const f=['Behind a tapestry: 30 gold.','The royal library holds a lore tome.','A servant\'s ghost points to a hidden staircase.'];
        Toast.show(U.rf(f)); GS.gold+=30; GS.xp+=15; HUD.update(); Save.save(); break;
    }
  },

  // ── ARENA ACTIONS ──
  arenaAct(diff){
    Dialogue.close();
    const keys={1:'dark_scout',2:'echo_warrior',3:'arena_champ'};
    if(diff===0){GS.mode='endless';Toast.show('∞ Endless Veil begins...','veil');HUD.update();}
    Combat.start(keys[diff]||'echo_warrior',()=>{
      GS.arenaKills=(GS.arenaKills||0)+1;
      if(diff>=3){GS.flags.arena_completed=true;Toast.show('🏆 Arena Champion!','veil');Flash.fire('white');}
      Save.save();
    },()=>Toast.show('You fall in the arena.','danger'));
  }
};

// ── VEIL CORE ───────────────────────────────────────────────
const VeilCore={
  destroy(){
    Dialogue.close(); GS.choices.veilChoice='destroy';
    Toast.show('You tear the Veil apart. Reality seals.','veil'); Flash.fire('white');
    setTimeout(()=>Game.showEnding('destroy'),2200);
  },
  control(){
    Dialogue.close(); GS.choices.veilChoice='control';
    Toast.show('You claim dominion. The Veil screams — then obeys.','danger'); Flash.fire('red');
    setTimeout(()=>Game.showEnding('control'),2200);
  },
  merge(){
    Dialogue.close(); GS.choices.veilChoice='merge';
    Toast.show('You step into the Veil. It steps into you.','veil'); Flash.fire('veil');
    setTimeout(()=>Game.showEnding('merge'),2200);
  }
};

// ── GAME CONTROLLER ─────────────────────────────────────────
const Game={
  openStats(){
    const s=GS;
    Choice.show('Veilwalker Log',
      `Level ${s.level} | HP ${s.hp}/${s.maxHp} | MP ${s.mp}/${s.maxMp}\nGold: ${s.gold}g | Corruption: ${s.corruption}% | Morality: ${s.morality}\nKills: ${s.kills} | Deaths: ${s.deaths} | Chapter: ${s.chapter}\nMode: ${s.mode} | Days: ${s.dayCount}`,
      [{text:'Close',fn:()=>{}}]);
  },
  openCraft(){
    const sword=GS.inventory.find(i=>i.id==='short_sword');
    const shard=GS.inventory.find(i=>i.id==='veil_shard');
    const stone=GS.inventory.find(i=>i.id==='ember_stone');
    const can=sword&&shard&&stone;
    Choice.show('Crafting',
      can?'You have the materials to forge a Veil Blade!':`Veil Blade requires:\nShort Sword ${sword?'✓':'✗'} | Veil Shard ${shard?'✓':'✗'} | Ember Stone ${stone?'✓':'✗'}`,
      can?[
        {text:'⚔ Forge Veil Blade',fn:()=>{
          Inv.remove('short_sword');Inv.remove('veil_shard');Inv.remove('ember_stone');
          Inv.add({id:'veil_blade',name:'Veil Blade',icon:'⚔',desc:'Infused with Veil energy.',type:'items',val:150});
          Toast.show('⚔ Veil Blade forged!','veil'); Flash.fire('veil');
        }},
        {text:'Cancel',fn:()=>{}}
      ]:[{text:'Close',fn:()=>{}}]);
  },
  showDeath(perm){
    Choice.show('☠ Fallen',
      perm?'Hardcore run ended. Your journey is over.':'You have fallen... but the Veil is not done with you yet.',
      [{text:perm?'↺ New Game':'↺ Rise Again',fn:()=>{
        if(!perm){GS.hp=Math.floor(GS.maxHp*.4);GS.mp=Math.floor(GS.maxMp*.4);World.load('village');HUD.update();}
        else{Save.clear();location.reload();}
      }}]);
  },
  showEnding(type){
    const e={
      destroy:{t:'The Veil Destroyed',b:'The fractures seal shut. The loops end. The forgotten are released. You are ordinary once more — but the world breathes again.'},
      control:{t:'The Veil Claimed',b:'You sit at the center of reality\'s web. Every thread obeys. Was this freedom — or did the Veil simply find a new anchor?'},
      merge:  {t:'The Veil and You',b:'You are everywhere the Veil touches. You watch over the loops, comfort the lost. You are no longer one person. You are the boundary itself.'}
    }[type];
    GS.timePlayed+=Math.floor((Date.now()-GS.startTime)/1000); Save.save();
    Choice.show(e.t,
      e.b+`\n\n— ${GS.kills} enemies defeated · ${GS.totalChoices} choices made · ${GS.dayCount} days —`,
      [{text:'↺ Play Again',fn:()=>{Save.clear();location.reload();}}]);
  }
};

// ── GAME LOOP ───────────────────────────────────────────────
let walkAnim=0;

function gameLoop(delta){
  if(!charSprite)return;
  const W=app.renderer.width, H=app.renderer.height;
  const groundY=H*.72+2;
  const SPEED=3.8*delta;

  // Movement
  let moving=false;
  if(keysDown.left){charVX=-SPEED;charFacing=-1;moving=true;}
  else if(keysDown.right){charVX=SPEED;charFacing=1;moving=true;}
  else{charVX*=.78;if(Math.abs(charVX)<.1)charVX=0;}

  charX+=charVX;
  charX=Math.max(60,Math.min(worldWidth-60,charX));

  // Walk animation
  if(moving||Math.abs(charVX)>.3){
    walkAnim+=delta*.25;
    const frame=Math.floor(walkAnim)%4;
    drawCharFrame(charBody,frame+1);
  } else {
    drawCharFrame(charBody,0);
  }

  // Flip character
  charSprite.scale.x=charFacing;
  charSprite.x=charX;
  charSprite.y=groundY;

  // Camera: follow char, keep within world bounds
  const camIdeal=charX-W/2+80;
  camTargetX=Math.max(0,Math.min(worldWidth-W,camIdeal));
  camX+=(camTargetX-camX)*.1;

  // Scroll background layers at different parallax speeds
  bgLayers.forEach(layer=>{
    if(layer.container){
      layer.container.x=-camX*layer.scrollFactor;
    }
  });

  // Keep char and NPCs in world space (canvas space)
  charSprite.x=charX-camX;

  npcs.forEach(npc=>{
    npc.x=npc.userData.x-camX;
  });
  triggers.forEach(t=>{
    t.container.x=t.x-camX;
  });

  // NPC proximity
  nearNPC=null;
  npcs.forEach(npc=>{
    const dist=Math.abs(charX-npc.userData.x);
    if(dist<80){nearNPC=npc;npc.userData.graphic.alpha=1;}
    else npc.userData.graphic.alpha=.9;
  });

  // Trigger proximity
  triggers.forEach(t=>{
    const dist=Math.abs(charX-t.x);
    if(dist<55&&!U.$('dialogue').classList.contains('hidden')===false){
      // Travel!
      setTimeout(()=>World.load(t.targetZone,charX<t.x),100);
    }
  });

  // Interact prompt
  const ip=U.$('interact-prompt');
  if(nearNPC&&U.$('dialogue').classList.contains('hidden')&&U.$('combat').classList.contains('hidden')){
    ip.classList.remove('hidden');
    ip.textContent='▲ Talk to '+nearNPC.userData.name;
  } else {
    ip.classList.add('hidden');
  }

  // NPC idle animation
  npcs.forEach(npc=>{
    npc.userData._idleT=(npc.userData._idleT||0)+delta*.03;
    npc.children[0].y=Math.sin(npc.userData._idleT)*3;
  });
}

// ── INPUT ───────────────────────────────────────────────────
function interact(){
  if(!nearNPC||!U.$('dialogue').classList.contains('hidden'))return;
  const d=nearNPC.userData;
  const lines=typeof d.lines==='function'?d.lines():d.lines;
  Dialogue.show(d.speaker,d.portrait,lines,d.choices,null);
}

// Keyboard
window.addEventListener('keydown',e=>{
  if(['a','ArrowLeft'].includes(e.key))  keysDown.left=true;
  if(['d','ArrowRight'].includes(e.key)) keysDown.right=true;
  if(['e','E','f','F',' '].includes(e.key)) interact();
  if(['w','ArrowUp'].includes(e.key)) interact(); // also up = interact
});
window.addEventListener('keyup',e=>{
  if(['a','ArrowLeft'].includes(e.key))  keysDown.left=false;
  if(['d','ArrowRight'].includes(e.key)) keysDown.right=false;
});

// D-Pad
function bindDpad(id,dir){
  const btn=U.$(id);if(!btn)return;
  const set=(v)=>{if(dir==='left')keysDown.left=v;if(dir==='right')keysDown.right=v;};
  btn.addEventListener('touchstart',e=>{e.preventDefault();set(true);},{passive:false});
  btn.addEventListener('touchend',e=>{e.preventDefault();set(false);},{passive:false});
  btn.addEventListener('mousedown',()=>set(true));
  btn.addEventListener('mouseup',()=>set(false));
}
bindDpad('dp-l','left'); bindDpad('dp-r','right');

// Attack / skill buttons
U.$('abtn-atk')?.addEventListener('click',()=>{
  if(Combat.active)Combat.attack();
  else{
    // Quick attack nearest enemy-like NPC? Just swing for fun
    Flash.fire('white');
    if(nearNPC&&nearNPC.userData.name==='Stone Golem')World.dungeonAct('boss');
    else if(nearNPC&&nearNPC.userData.name==='Forest Sprite')World.forestAct('hunt');
  }
});
U.$('abtn-skill')?.addEventListener('click',()=>{
  if(Combat.active)Combat.special();
  else Toast.show(GS.abilities.includes('veil_strike')?'✨ Veil Strike ready — enter combat!':'⚠ Learn Veil Strike first.','veil');
});

// Combat buttons
U.$('cb-atk')?.addEventListener('click',()=>Combat.attack());
U.$('cb-spc')?.addEventListener('click',()=>Combat.special());
U.$('cb-heal')?.addEventListener('click',()=>Combat.heal());
U.$('cb-flee')?.addEventListener('click',()=>Combat.flee());

// Dialogue tap
U.$('dialogue')?.addEventListener('click',e=>{
  if(e.target.classList.contains('dlg-choice'))return;
  Dialogue.tap();
});

// Interact prompt
U.$('interact-prompt')?.addEventListener('click',interact);

// Side buttons
U.$('sbtn-map')?.addEventListener('click',()=>{U.$('map-panel').classList.toggle('hidden');U.$('inv-panel').classList.add('hidden');World.buildMapPanel();});
U.$('sbtn-inv')?.addEventListener('click',()=>{U.$('inv-panel').classList.toggle('hidden');U.$('map-panel').classList.add('hidden');Inv.open();});
U.$('sbtn-stat')?.addEventListener('click',()=>Game.openStats());
U.$('sbtn-craft')?.addEventListener('click',()=>Game.openCraft());

// Close panels
document.querySelectorAll('.panel-x').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const id=btn.dataset.close;if(id)U.$(id)?.classList.add('hidden');
  });
});

// Inventory tabs
document.querySelectorAll('.ptab').forEach(btn=>{
  btn.addEventListener('click',()=>Inv.setTab(btn.dataset.inv,btn));
});

// Title screen buttons
U.$('btn-new')?.addEventListener('click',()=>startGame(false));
U.$('btn-continue')?.addEventListener('click',()=>startGame(true));
U.$('btn-modes')?.addEventListener('click',()=>{
  Choice.show('Game Mode','Choose your play style',[
    {text:'📖 Story Mode',fn:()=>{GS.mode='story';Toast.show('Story Mode selected.');}},
    {text:'☠ Hardcore Mode',fn:()=>{GS.mode='hardcore';GS.hardcore=true;Toast.show('Hardcore — permadeath enabled.','danger');}},
    {text:'🌀 Chaos Mode',fn:()=>{GS.mode='chaos';Toast.show('Chaos Mode — anything can happen.','veil');}},
  ]);
  U.$('screen-title').style.display='none'; // show title back after
  U.$('game-world').classList.remove('hidden');
  setTimeout(()=>{U.$('game-world').classList.add('hidden');U.$('screen-title').style.display='';},100);
});
U.$('btn-log')?.addEventListener('click',()=>Game.openStats());

// ── BOOT SEQUENCE ────────────────────────────────────────────
async function startGame(cont){
  U.$('screen-title').classList.add('hidden');
  U.$('game-world').classList.remove('hidden');

  if(cont&&Save.exists()){
    Save.load();
  } else {
    Save.clear();
    Object.assign(GS,{
      hp:100,maxHp:100,mp:60,maxMp:60,xp:0,xpToLevel:100,level:1,
      gold:50,corruption:0,morality:50,location:'village',chapter:1,
      mode:'story',hardcore:false,dayCount:1,kills:0,deaths:0,totalChoices:0,
      timePlayed:0,startTime:Date.now(),
      choices:{helpedVillagers:false,followedVoices:false,killedKing:false,freedKing:false,veilChoice:null},
      inventory:[],lore:[],abilities:['basic_attack'],questsComplete:[],locationsVisited:[],
      flags:{veilNodeUnlocked:false,dungeon_explored:false,arena_completed:false}
    });
  }

  initPixi();
  HUD.update();
  await World.load(GS.location||'village',true);

  // Opening dialogue
  if(!cont){
    setTimeout(()=>{
      Dialogue.show('The Veil','◈',
        ['"You emerge from the fog. The village of Ash\'vel flickers before your eyes."','"You are a Veilwalker — someone who exists between realities."','"Find the truth. Make your choices. The Veil is watching."'],
        null,null);
    },1200);
  }
}

// ── LOADING SEQUENCE ─────────────────────────────────────────
(function boot(){
  // Add title particles
  const tp=U.$('title-particles');
  if(tp){
    for(let i=0;i<20;i++){
      const p=document.createElement('div');
      p.style.cssText=`position:absolute;width:${2+Math.random()*3}px;height:${2+Math.random()*3}px;border-radius:50%;background:rgba(${Math.random()>.5?'128,64,255':'240,192,64'},${.3+Math.random()*.4});left:${Math.random()*100}%;top:${Math.random()*100}%;animation:breathe ${2+Math.random()*3}s ease-in-out ${Math.random()*2}s infinite;`;
      tp.appendChild(p);
    }
  }

  // Loading bar
  const bar=U.$('load-bar');
  const status=U.$('load-status');
  const steps=['Weaving reality...','Loading world fragments...','Summoning echoes...','Initializing Veil...','Ready.'];
  let pct=0,step=0;
  const iv=setInterval(()=>{
    pct=Math.min(pct+8+Math.random()*14,95);
    if(bar)bar.style.width=pct+'%';
    if(status&&step<steps.length)status.textContent=steps[step++];
    if(pct>=95){
      clearInterval(iv);
      if(bar)bar.style.width='100%';
      setTimeout(()=>{
        const ls=U.$('loading-screen');
        if(ls){ls.style.opacity='0';ls.style.transition='opacity .7s';setTimeout(()=>ls.style.display='none',700);}
        U.$('screen-title').classList.remove('hidden');
        if(Save.exists())U.$('btn-continue').style.display='';
      },400);
    }
  },110);
})();
