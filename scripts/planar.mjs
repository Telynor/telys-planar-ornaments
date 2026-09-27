import {ID,ABILITIES,STATS,SPHERE,ROPE,SUBSTATS,LABELS,DEFAULT_CONFIG,number,random,generate,advance,bonuses,mainValue,splitInputs} from "./core.mjs";
const clone=x=>foundry.utils.deepClone(x);
const esc=s=>foundry.utils.escapeHTML(String(s??""));
const config=()=>foundry.utils.mergeObject(clone(DEFAULT_CONFIG),clone(game.settings.get(ID,"config")),{inplace:false});
const relic=i=>i.getFlag(ID,"relic");
const editable=a=>game.user.isGM||a?.testUserPermission(game.user,"OWNER");
const actors=()=>game.actors.filter(a=>a.type==="character"&&editable(a));
const token=()=>game.user.isGM?game.actors.contents.find(a=>a.type==="character"):game.modules.get("telys-star-rail-ultimates")?.api?.getSelectedMainCharacter?.()??actors()[0];
const owned=(a,uuid)=>{const source=game.items.get(uuid.split(".").at(-1));return a.items.filter(i=>i.uuid===uuid||i.id===uuid||i.getFlag("core","sourceId")===uuid||i._stats?.compendiumSource===uuid||(source&&i.name===source.name&&i.type===source.type))};
const sum=(a,uuid)=>owned(a,uuid).reduce((n,i)=>n+number(i.system.quantity,1),0);
const htmlOption=(v,label,selected)=>`<option value="${esc(v)}" ${v===selected?"selected":""}>${esc(label)}</option>`;
let pending=new Set();
function send(op,data){
  if(game.user.isGM)return processRequest({op,data,user:game.user.id});
  if(!game.users.some(u=>u.isGM&&u.active))throw Error("A GM must be online to make changes.");
  game.socket.emit(`module.${ID}`,{op,data,user:game.user.id});
  ui.notifications.info("Planar request sent to the GM.");
}
async function consume(actor,lines){
  const updates=[],deletes=[];
  for(const [id,qty] of lines){let left=qty;for(const item of owned(actor,id)){
    if(!left)break;const count=number(item.system.quantity,1),take=Math.min(count,left);left-=take;
    if(count===take)deletes.push(item.id);else updates.push({_id:item.id,"system.quantity":count-take});
  }if(left)throw Error("Insufficient materials or credits.")}
  if(updates.length)await actor.updateEmbeddedDocuments("Item",updates);
  if(deletes.length)await actor.deleteEmbeddedDocuments("Item",deletes);
}
async function processRequest({op,data,user},remote=false){
  if(!game.user.isGM)return;
  const requester=game.users.get(user);if(!requester)return;
  const actor=game.actors.get(data.actorId);
  if(!actor||(!requester.isGM&&!actor.testUserPermission(requester,"OWNER")))return;
  const key=actor.id;if(pending.has(key))return ui.notifications.warn("Planar transaction already in progress.");
  pending.add(key);
  try{
    const cfg=config();
    if(op==="generate"){
      if(remote||!requester.isGM)throw Error("Only a local GM can generate relics.");
      const set=cfg.sets.find(s=>s.id===data.setId);if(!set)throw Error("Unknown set.");
      const r=generate(set,data.slot,cfg);
      await actor.createEmbeddedDocuments("Item",[{name:`${set.name} ${r.slot==="sphere"?"Planar Sphere":"Link Rope"}`,type:"loot",img:r.slot==="sphere"?(set.sphereImage||"icons/magic/earth/orb-stone-smoke-teal.webp"):(set.ropeImage||"icons/commodities/cloth/cord-rope-gold.webp"),system:{quantity:1},flags:{[ID]:{relic:r}}}]);
    }else{
      const item=actor.items.get(data.itemId),r=item&&relic(item);if(!r)throw Error("Relic not found.");
      if(op==="equip"){
        if(data.equipped){const old=actor.items.filter(i=>relic(i)?.equipped&&relic(i)?.slot===r.slot&&i.id!==item.id);
          if(old.length)await actor.updateEmbeddedDocuments("Item",old.map(i=>({_id:i.id,[`flags.${ID}.relic.equipped`]:false})));
        }
        await item.update({[`flags.${ID}.relic.equipped`]:!!data.equipped});
      }else if(op==="upgrade"){
        if(r.level>=15)throw Error("Already at +15.");
        const spend=data.materials??{},lines=[],xp=Object.entries(spend).reduce((total,[uuid,qty])=>{
          const mat=cfg.materials.find(m=>m.uuid===uuid),count=Math.floor(number(qty));
          if(!mat||count<0||count>10000)throw Error("Invalid upgrade material.");
          if(count)lines.push([uuid,count]);return total+count*number(mat.xp);
        },0);
        if(!xp)throw Error("Choose upgrade materials.");
        const cost=Math.ceil(xp*Math.max(0,number(cfg.creditCostPerXp)));
        if(cost){if(!cfg.currencyItem)throw Error("Configure a credit item first.");lines.push([cfg.currencyItem,cost])}
        const required=new Map();for(const [id,n] of lines)required.set(id,(required.get(id)??0)+n);
        for(const [id,n] of required)if(sum(actor,id)<n)throw Error(`Insufficient ${id}: need ${n}.`);
        const result=advance(r,xp,cfg);
        await consume(actor,required);
        await item.update({[`flags.${ID}.relic`]:result});
      }
    }
    Hooks.callAll(`${ID}.changed`,actor);window.TelysPlanar?.app?.render(false);
  }catch(e){console.error(ID,e);ui.notifications.error(`Planar ornaments: ${e.message}`)}finally{pending.delete(key)}
}
function selectActor(id){return game.actors.get(id)||token()||actors()[0]}
class PlanarWindow extends FormApplication{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:"telys-planar-window",title:"Planar Ornaments",width:940,height:740,resizable:true,submitOnChange:false})}
  async _renderInner(){const a=selectActor(this.actorId),cfg=config();this.actorId=a?.id;
    const list=a?.items.filter(relic)??[];
    const cards=list.map(i=>{const r=relic(i),set=cfg.sets.find(s=>s.id===r.setId),value=mainValue(r,cfg);
      const materials=cfg.materials.map(m=>`<label class="tp-material">${esc(m.name||m.uuid)} (${esc(m.xp)} XP; owned ${sum(a,m.uuid)}) <input type="number" min="0" max="${sum(a,m.uuid)}" value="0" data-material="${esc(m.uuid)}"></label>`).join("");
      return `<article class="tp-card" data-item="${i.id}"><img src="${esc(i.img)}"><div><h3>${esc(i.name)} <small>+${r.level}</small></h3><p>${esc(LABELS[r.main])}: ${value.toFixed(2)}${r.main.endsWith("Pct")||["energyRegen","breakEffect",...SPHERE.filter(k=>!["hpPct","atkPct","defPct"].includes(k))].includes(r.main)?"%":""}</p><p>${r.sub.map(s=>`${esc(LABELS[s.key])} +${number(s.value).toFixed(2)}`).join(" · ")||"No substats yet"}</p><button type="button" data-op="equip" data-equipped="${!r.equipped}">${r.equipped?"Unequip":"Equip"}</button>${r.level<15?`<details><summary>Upgrade · ${r.xp}/${cfg.xpPerLevel} XP</summary>${materials}<p>Cost: ${cfg.creditCostPerXp} credits per XP · owned ${sum(a,cfg.currencyItem)}</p><button type="button" data-op="upgrade">Spend selected materials</button></details>`:"<p>Maximum level</p>"}</div></article>`
    }).join("");
    const gm=game.user.isGM?`<nav><button type="button" data-op="settings">GM Configuration</button><select data-set>${cfg.sets.map(s=>htmlOption(s.id,s.name)).join("")}</select><select data-slot><option value="sphere">Sphere</option><option value="rope">Rope</option></select><button type="button" data-op="generate">Generate random planar reward</button></nav>`:"";
    return $(`<div class="tp-window"><header><h2>Planar Ornaments</h2><select data-actor>${actors().map(x=>htmlOption(x.id,x.name,a?.id)).join("")}</select></header>${gm}<div class="tp-grid">${cards||"<p>No planar ornaments in this character’s inventory.</p>"}</div></div>`)}
  activateListeners(html){super.activateListeners(html);html.find("[data-actor]").on("change",e=>{this.actorId=e.target.value;this.render(false)});
    html.find("[data-op]").on("click",async e=>{const op=e.currentTarget.dataset.op,a=selectActor(this.actorId);
      if(op==="settings")return new ConfigWindow().render(true);
      if(op==="generate")return send(op,{actorId:a.id,setId:html.find("[data-set]").val(),slot:html.find("[data-slot]").val()});
      const card=e.currentTarget.closest("[data-item]");if(!card)return;
      const data={actorId:a.id,itemId:card.dataset.item};
      if(op==="equip")data.equipped=e.currentTarget.dataset.equipped==="true";
      if(op==="upgrade")data.materials=Object.fromEntries([...card.querySelectorAll("[data-material]")].map(el=>[el.dataset.material,el.value]));
      await send(op,data);
    })}
  async _updateObject(){}
}
class ConfigWindow extends FormApplication{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:"telys-planar-config",title:"Planar Ornament Configuration",width:1020,height:850,resizable:true})}
  async _renderInner(){const c=this.draft??config(),items=game.items.contents.filter(i=>i.type==="loot").sort((a,b)=>a.name.localeCompare(b.name));
    const itemOptions=(selected)=>`<option value="">Choose item</option>${items.map(i=>htmlOption(i.uuid,i.name,selected)).join("")}`;
    const stats=STATS.map(k=>`<tr><td>${esc(LABELS[k])}</td><td><input data-main="${k}" data-field="min" type="number" step="any" value="${number(c.main[k]?.min)}"></td><td><input data-main="${k}" data-field="max" type="number" step="any" value="${number(c.main[k]?.max)}"></td><td>${SUBSTATS.includes(k)?`<input data-sub="${k}" data-field="enabled" type="checkbox" ${c.sub[k]?.enabled!==false?"checked":""}><input data-sub="${k}" data-field="min" type="number" step="any" value="${number(c.sub[k]?.min,1)}"><input data-sub="${k}" data-field="max" type="number" step="any" value="${number(c.sub[k]?.max,3)}">`:"—"}</td><td><input data-mapping="${k}" value="${esc(c.mapping[k]??"")}" placeholder="Ability key or system path"></td><td><input data-flat="${k}" type="number" step="any" value="${number(c.flat[k],1)}"></td></tr>`).join("");
    const mats=c.materials.map((m,index)=>`<div class="tp-row" data-mat-row="${index}"><select data-mat-item="${index}">${itemOptions(m.uuid)}</select><input type="number" min="1" data-mat-xp="${index}" value="${esc(m.xp)}"><button type="button" data-remove-mat="${index}">Remove</button></div>`).join("");
    const sets=c.sets.map((s,index)=>`<div class="tp-set" data-set-row="${index}"><input data-set-name="${index}" value="${esc(s.name)}" placeholder="Set name"><input data-set-sphere="${index}" value="${esc(s.sphereImage??"")}" placeholder="Sphere image path"><input data-set-rope="${index}" value="${esc(s.ropeImage??"")}" placeholder="Rope image path"><button type="button" data-remove-set="${index}">Remove</button><p>Two piece bonuses: stat key and value. For arbitrary sheet fields use a <code>system.*</code> path.</p><div data-bonus-container="${index}">${(s.bonuses??[]).map((b,n)=>`<div class="tp-row" data-bonus="${index}"><input data-bonus-stat="${index}:${n}" value="${esc(b.stat)}" placeholder="stat key or system path"><input type="number" step="any" data-bonus-value="${index}:${n}" value="${number(b.value)}"><button type="button" data-remove-bonus>×</button></div>`).join("")}</div><button type="button" data-add-bonus="${index}">Add bonus</button></div>`).join("");
    return $(`<div class="tp-window tp-config"><p>All percentage fields use percentage points. Bonuses to ability keys use the base score and round down.</p><label>Credits item <select data-currency>${itemOptions(c.currencyItem)}</select></label><label>Credits per XP <input type="number" min="0" step="any" data-cost value="${c.creditCostPerXp}"></label><label>XP per level <input type="number" min="1" data-xp-level value="${c.xpPerLevel}"></label><h3>Upgrade materials</h3><div data-mat-container>${mats}</div><button type="button" data-add-mat>Add material</button><h3>Planar sets</h3><div data-set-container>${sets}</div><button type="button" data-add-set>Add custom set</button><h3>Stats and mappings</h3><p>Mapping examples: <code>str</code> for ability, <code>system.attributes.movement.walk</code> for movement, <code>system.attributes.ac.bonus</code> for AC. Unmapped effects remain visible in the module API.</p><table><thead><tr><th>Stat</th><th>Main +0</th><th>Main +15</th><th>Sub enabled / min / max</th><th>Target</th><th>Flat multiplier</th></tr></thead><tbody>${stats}</tbody></table><label>Base crit threshold <input type="number" min="2" max="20" data-crit-base value="${c.crit.base}"></label><label>Crit rate points per expanded face <input type="number" min="0.01" step="any" data-crit-points value="${c.crit.pointsPerRange}"></label><footer><button type="button" data-save>Save configuration</button></footer></div>`)}
  activateListeners(html){super.activateListeners(html);
    html.find("[data-add-mat]").on("click",()=>{this.capture(html);this.draft.materials.push({uuid:"",xp:100});this.render(false)});
    html.find("[data-remove-mat]").on("click",e=>{this.capture(html);this.draft.materials.splice(Number(e.currentTarget.dataset.removeMat),1);this.render(false)});
    html.find("[data-add-set]").on("click",()=>{this.capture(html);this.draft.sets.push({id:foundry.utils.randomID(),name:"New Set",bonuses:[]});this.render(false)});
    html.find("[data-remove-set]").on("click",e=>{this.capture(html);this.draft.sets.splice(Number(e.currentTarget.dataset.removeSet),1);this.render(false)});
    html.find("[data-add-bonus]").on("click",e=>{this.capture(html);this.draft.sets[Number(e.currentTarget.dataset.addBonus)].bonuses.push({stat:"",value:0});this.render(false)});
    html.find("[data-remove-bonus]").on("click",e=>{const row=e.currentTarget.closest("[data-bonus]"),idx=Number(row.dataset.bonus),n=[...row.parentElement.children].indexOf(row);this.capture(html);this.draft.sets[idx].bonuses.splice(n,1);this.render(false)});
    html.find("[data-save]").on("click",async()=>{this.capture(html);await game.settings.set(ID,"config",this.draft);for(const a of game.actors)a.prepareData();ui.notifications.info("Planar configuration saved.");this.close()})
  }
  capture(h){const c=this.draft??config();c.currencyItem=h.find("[data-currency]").val();c.creditCostPerXp=Math.max(0,number(h.find("[data-cost]").val()));c.xpPerLevel=Math.max(1,Math.floor(number(h.find("[data-xp-level]").val(),100)));
    c.materials=[...h[0].querySelectorAll("[data-mat-row]")].map(row=>({uuid:row.querySelector("[data-mat-item]").value,xp:Math.max(1,number(row.querySelector("[data-mat-xp]").value))})).filter(m=>m.uuid);
    c.sets=[...h[0].querySelectorAll("[data-set-row]")].map(row=>{const i=Number(row.dataset.setRow);return{id:c.sets[i]?.id||foundry.utils.randomID(),name:row.querySelector("[data-set-name]").value.trim(),sphereImage:row.querySelector("[data-set-sphere]").value.trim(),ropeImage:row.querySelector("[data-set-rope]").value.trim(),bonuses:[...row.querySelectorAll("[data-bonus]")].map(b=>({stat:b.querySelector("[data-bonus-stat]").value.trim(),value:number(b.querySelector("[data-bonus-value]").value)})).filter(b=>b.stat)}}).filter(s=>s.name);
    for(const el of h[0].querySelectorAll("[data-main]")){const k=el.dataset.main;c.main[k]??={};c.main[k][el.dataset.field]=number(el.value)}
    for(const el of h[0].querySelectorAll("[data-sub]")){const k=el.dataset.sub;c.sub[k]??={};c.sub[k][el.dataset.field]=el.type==="checkbox"?el.checked:number(el.value)}
    for(const el of h[0].querySelectorAll("[data-mapping]"))c.mapping[el.dataset.mapping]=el.value.trim();
    for(const el of h[0].querySelectorAll("[data-flat]"))c.flat[el.dataset.flat]=number(el.value,1);
    c.crit={base:number(h.find("[data-crit-base]").val(),20),pointsPerRange:number(h.find("[data-crit-points]").val(),1)};this.draft=c;
  }
  async _updateObject(){}
}
const originalScores=new WeakMap();
function applyBonuses(model){const actor=model.parent;if(!actor||actor.type!=="character")return;
  const cfg=config(),b=bonuses(actor.items,cfg),scores={};
  for(const key of ABILITIES)scores[key]=number(model.abilities?.[key]?.value);
  originalScores.set(actor,scores);
  const additions={};
  for(const [stat,value] of Object.entries(b)){
    const target=cfg.mapping[stat];if(!target||!Number.isFinite(value))continue;
    const delta=value*number(cfg.flat?.[stat],1);
    if(ABILITIES.includes(target)){
      (additions[target]??=[]).push({value:delta,percent:stat.endsWith("Pct")});
    }else if(/^system\.[a-zA-Z0-9_.]+$/.test(target)&&!target.includes("__proto__")&&!target.includes("constructor")){
      const path=target.slice(7),old=foundry.utils.getProperty(model,path);
      if(typeof old==="number")foundry.utils.setProperty(model,path,old+delta);
      else if(typeof old==="string"&&/^[-+]?\d+(\.\d+)?$/.test(old))foundry.utils.setProperty(model,path,String(number(old)+delta));
    }
  }
  for(const [ability,entries] of Object.entries(additions)){const base=scores[ability];const flat=entries.filter(e=>!e.percent).reduce((n,e)=>n+e.value,0);
    const pct=entries.filter(e=>e.percent).reduce((n,e)=>n+e.value,0);
    model.abilities[ability].value=Math.floor(base+flat+base*pct/100);
  }
  actor._planarBonuses=b;
  // dnd5e computes ability modifiers, HP and derived rolls after this wrapper runs.
}
function patchCharacter(){const prototype=CONFIG.Actor.dataModels.character?.prototype;if(!prototype||prototype._telysPlanarPatched)return;
  const original=prototype.prepareDerivedData;prototype.prepareDerivedData=function(...args){applyBonuses(this);return original.apply(this,args)};
  prototype._telysPlanarPatched=true;
}
async function patchCriticalRange(){
  try{
    const {default: AttackData}=await import('/systems/dnd5e/module/data/activity/attack-data.mjs');
    const descriptor=Object.getOwnPropertyDescriptor(AttackData.prototype,'criticalThreshold');
    if(!descriptor?.get||AttackData.prototype._telysPlanarCritPatched)return;
    Object.defineProperty(AttackData.prototype,'criticalThreshold',{configurable:true,get(){
      const normal=descriptor.get.call(this),rate=number(this.actor?._planarBonuses?.critRate);
      if(rate<=0)return normal;
      return Math.min(normal,Math.max(2,20-Math.floor(rate/Math.max(.01,number(config().crit.pointsPerRange,1)))));
    }});
    AttackData.prototype._telysPlanarCritPatched=true;
  }catch(error){console.warn(`${ID} | Critical range integration unavailable`,error)}
}
function injectHub(app,html){if(app.id!=="tsru-hub")return;
  const root=html[0]??html;if(!root||root.querySelector(".tp-hub-entry"))return;
  const button=document.createElement("button");button.type="button";button.className="tp-hub-entry";button.innerHTML='<i class="fas fa-circle-nodes"></i> Upgrade Planar Relics';
  button.addEventListener("click",e=>{e.stopPropagation();open()});root.querySelector(".tsru-phone-scroll")?.append(button);
}
function injectSheet(app,html){const actor=app.actor;if(actor?.type!=="character")return;
  const root=html[0]??html;if(root.querySelector(".tp-ability-toggle"))return;
  const scores=originalScores.get(actor),b=actor._planarBonuses;if(!scores||!Object.keys(b??{}).length)return;
  const holder=document.createElement("button");holder.type="button";holder.className="tp-ability-toggle";holder.title="Toggle original and planar adjusted ability scores";holder.textContent="Show original ability scores";
  let shown=false;holder.addEventListener("click",()=>{shown=!shown;holder.textContent=shown?"Show equipped ability scores":"Show original ability scores";
    for(const key of ABILITIES){const input=root.querySelector(`[name="system.abilities.${key}.value"]`);if(!input)continue;
      let badge=input.parentElement.querySelector(".tp-score-preview");if(!badge){badge=document.createElement("span");badge.className="tp-score-preview";input.after(badge)}
      badge.textContent=shown?`Original: ${scores[key]}`:`Equipped: ${actor.system.abilities[key].value}`;
    }
  });
  // Keep the editable source input untouched, including during ASIs.
  const first=root.querySelector('[name="system.abilities.str.value"]');if(first){first.closest(".ability-score,.ability,.abilities")?.prepend(holder)}else root.querySelector("form")?.prepend(holder);
}
export function open(actorId){const app=window.TelysPlanar.app??new PlanarWindow();window.TelysPlanar.app=app;app.actorId=actorId||app.actorId||token()?.id;app.render(true);return app}
Hooks.once("init",()=>{game.settings.register(ID,"config",{scope:"world",config:false,type:Object,default:clone(DEFAULT_CONFIG)});patchCharacter()});
Hooks.once("ready",()=>{
  patchCharacter();patchCriticalRange();game.socket.on(`module.${ID}`,msg=>{if(game.user.isGM&&game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id)processRequest(msg,true)});
  window.TelysPlanar={open,openConfig:()=>new ConfigWindow().render(true),generate,advance,bonuses,mainValue,app:null};
  Hooks.on("renderApplication",injectHub);
  Hooks.on("renderActorSheet",injectSheet);
  ui.notifications.info("Planar Ornaments ready.");
});
