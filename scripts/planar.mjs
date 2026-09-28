import {registerDamageHooks} from "./damage.mjs";
import {CANONICAL_SETS} from "./catalog.mjs";
import {visualHtml,layoutFor,pieceStyle,applyLayoutToAll} from "./visuals.mjs";
import {dynamicStats,registerConditionHooks,firstAttackBonus} from './effects.mjs';
import {storedRelics,asItem,ownerOf,equippedRelics,allItems,mergeLegacyRelics} from './inventory.mjs';
import {ID,ABILITIES,STATS,SPHERE,ROPE,SUBSTATS,LABELS,DEFAULT_CONFIG,number,random,generate,advance,bonuses,mainValue,criticalThreshold,critBonusSources,splitInputs} from "./core.mjs";
const clone=x=>foundry.utils.deepClone(x);
const esc=s=>foundry.utils.escapeHTML(String(s??""));
const config=()=>{const saved=clone(game.settings.get(ID,"config"));const merged=foundry.utils.mergeObject(clone(DEFAULT_CONFIG),saved,{inplace:false});const customized=new Map(merged.sets.map(s=>[s.id,s]));merged.sets=[...CANONICAL_SETS.map(s=>customized.get(s.id)??clone(s)),...merged.sets.filter(s=>!CANONICAL_SETS.some(c=>c.id===s.id))];return merged};
const relic=i=>i.getFlag(ID,"relic");
const editable=a=>game.user.isGM||a?.testUserPermission(game.user,"OWNER");
const actors=()=>game.actors.filter(a=>a.type==="character"&&editable(a));
const token=()=>game.user.isGM?game.actors.contents.find(a=>a.type==="character"):game.modules.get("telys-star-rail-ultimates")?.api?.getSelectedMainCharacter?.()??actors()[0];
const owned=(a,uuid)=>{const source=game.items.get(uuid.split(".").at(-1));return a.items.filter(i=>i.uuid===uuid||i.id===uuid||i.getFlag("core","sourceId")===uuid||i._stats?.compendiumSource===uuid||(source&&i.name===source.name&&i.type===source.type))};
const sum=(a,uuid)=>a?owned(a,uuid).reduce((n,i)=>n+number(i.system.quantity,1),0):0;
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
  if(op!=='generate'&&(!actor||(!requester.isGM&&!actor.testUserPermission(requester,"OWNER"))))return;
  const key='shared-collection';if(pending.has(key))return ui.notifications.warn("Planar transaction already in progress.");
  pending.add(key);
  try{
    const cfg=config();
    if(op==="generate"){
      if(remote||!requester.isGM)throw Error("Only a local GM can generate relics.");
      const set=cfg.sets.find(s=>s.id===data.setId);if(!set)throw Error("Unknown set.");
      const r=generate(set,data.slot,cfg);
      const name=r.slot==='sphere'?(set.sphereName||`${set.name} Planar Sphere`):(set.ropeName||`${set.name} Link Rope`);
      const img=r.slot==='sphere'?(set.sphereImage||'icons/magic/earth/orb-stone-smoke-teal.webp'):(set.ropeImage||'icons/commodities/cloth/cord-rope-gold.webp');
      await game.settings.set(ID,'relics',[...storedRelics(),{id:foundry.utils.randomID(),name,img,relic:r,equippedActorId:null}]);
    }else{
      const inventory=clone(storedRelics()),index=inventory.findIndex(entry=>entry.id===data.itemId),entry=inventory[index],r=entry?.relic;
      if(!r)throw Error('Relic not found in the shared Planar collection.');
      if(op==="equip"){
        if(data.equipped){for(const other of inventory)if(other.equippedActorId===actor.id&&other.relic.slot===r.slot)other.equippedActorId=null;if(entry.equippedActorId!==actor.id)entry.relic.targetActorId=null;entry.equippedActorId=actor.id}
        else if(entry.equippedActorId===actor.id)entry.equippedActorId=null;
        else throw Error('This relic is equipped by a different character.');
        await game.settings.set(ID,'relics',inventory);
      }else if(op==="target"){
        const target=game.actors.get(data.targetActorId);
        if(r.setId!=="317"||entry.equippedActorId!==actor.id||!target||target.type!=="character"||target.id===actor.id)throw Error("Choose a different character for Lushaka.");
        entry.relic.targetActorId=target.id;await game.settings.set(ID,'relics',inventory);
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
        entry.relic=result;await game.settings.set(ID,'relics',inventory);
      }
    }
    for(const a of game.actors)if(a.type==='character')a.prepareData();
    Hooks.callAll(`${ID}.changed`,actor);window.TelysPlanar?.app?.render(false);
  }catch(e){console.error(ID,e);ui.notifications.error(`Planar ornaments: ${e.message}`)}finally{pending.delete(key)}
}
function selectActor(id){return game.actors.get(id)||token()||actors()[0]}
class PlanarWindow extends FormApplication{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:"telys-planar-window",title:"Planar Ornaments",width:940,height:740,resizable:true,submitOnChange:false})}
  async _renderInner(){const a=selectActor(this.actorId),cfg=config();this.actorId=a?.id;
    const inventory=storedRelics(),list=inventory.map(asItem);
    const cards=list.map(i=>{const r=relic(i),entry=inventory.find(x=>x.id===i.id),wearer=ownerOf(entry),isWorn=wearer?.id===a?.id,set=cfg.sets.find(s=>s.id===r.setId),value=mainValue(r,cfg);
      const materials=cfg.materials.map(m=>`<label class="tp-material">${esc(m.name||m.uuid)} (${esc(m.xp)} XP; owned ${sum(a,m.uuid)}) <input type="number" min="0" max="${sum(a,m.uuid)}" value="0" data-material="${esc(m.uuid)}"></label>`).join("");
      const recipient=r.setId==="317"&&isWorn?`<label>Lushaka buff recipient <select data-lushaka-target><option value="">Choose character</option>${game.actors.filter(x=>x.type==="character"&&x.id!==a.id).map(x=>htmlOption(x.id,x.name,r.targetActorId)).join("")}</select></label>`:"";
      const details=`${i.name} +${r.level} · ${LABELS[r.main]} ${value.toFixed(2)} · ${r.sub.map(s=>`${LABELS[s.key]} +${number(s.value)}`).join(', ')||'No substats yet'}`;
      return `<article class="tp-card ${this.selectedRelicId===i.id?'tp-selected':''}" data-item="${i.id}" data-filter-set="${esc(r.setId)}" data-filter-slot="${esc(r.slot)}" data-filter-worn="${wearer?'yes':'no'}" title="${esc(details)}" tabindex="0"><div class="tp-relic-art"><img src="${esc(i.img)}" alt="${esc(i.name)}">${wearer?`<img class="tp-wearer" src="${esc(wearer.prototypeToken?.texture?.src||wearer.img)}" title="Equipped by ${esc(wearer.name)}" alt="${esc(wearer.name)}">`:''}</div><div><h3>${esc(i.name)} <small>+${r.level}</small></h3><p>${esc(LABELS[r.main])}: ${value.toFixed(2)}${r.main.endsWith("Pct")?"%":r.main==="speed"?" ft":""}</p><p>${r.sub.map(s=>`${esc(LABELS[s.key])} +${number(s.value).toFixed(2)}`).join(" · ")||"No substats yet"}</p><div class="tp-card-actions"><p>${wearer?`Equipped by ${esc(wearer.name)}`:'Unequipped'}</p><button type="button" data-op="equip" data-equipped="${!isWorn}">${isWorn?'Unequip':`Equip for ${esc(a?.name??'character')}`}</button>${recipient}${r.level<15?`<details><summary>Upgrade · ${r.xp}/${cfg.xpPerLevel} XP</summary>${materials}<p>Cost: ${cfg.creditCostPerXp} credits per XP · owned ${sum(a,cfg.currencyItem)}</p><button type="button" data-op="upgrade">Spend selected materials</button></details>`:"<p>Maximum level</p>"}</div></div></article>`
    }).join("");
    const gm=game.user.isGM?`<nav><button type="button" data-op="settings">GM Configuration</button><button type="button" data-op="designer">Set Display Designer</button><label>Trailblaze Companion <input type="checkbox" data-trailblaze ${a?.getFlag(ID,"trailblazeCompanion")?"checked":""}></label><select data-set>${cfg.sets.map(s=>htmlOption(s.id,s.name)).join("")}</select><select data-slot><option value="sphere">Sphere</option><option value="rope">Rope</option></select><button type="button" data-op="generate">Generate random planar reward</button></nav>`:"";
    const activeSet=cfg.sets.find(s=>['sphere','rope'].every(slot=>inventory.some(i=>i.equippedActorId===a?.id&&i.relic.setId===s.id&&i.relic.slot===slot)));
    const chosen=cfg.sets.find(s=>s.id===this.selectedSetId)??activeSet??cfg.sets[0];
    const visibleSlots=['sphere','rope'].filter(slot=>inventory.some(i=>i.equippedActorId===a?.id&&i.relic.setId===chosen?.id&&i.relic.slot===slot));
    const preview=`<div class="tp-stage">${visualHtml(chosen,esc,{equipped:activeSet?.id===chosen?.id,defaultLayout:cfg.defaultLayout,visibleSlots})}<div class="tp-stage-info"><h3>Planar Ornaments</h3><label>Display set <select data-preview-set>${cfg.sets.map(s=>htmlOption(s.id,s.name,chosen?.id)).join('')}</select></label><p>${esc(chosen?.adaptedEffect??'Equip a matching Sphere and Link Rope for the two-piece bonus.')}</p><p>${activeSet?.id===chosen?.id?'Matching set equipped':'Equip matching pieces to activate this set.'}</p></div></div>`;
    return $(`<div class="tp-window tp-main"><header><h2>Planar Ornaments · Shared Collection</h2><select data-actor>${actors().map(x=>htmlOption(x.id,x.name,a?.id)).join("")}</select></header>${gm}${preview}<div class="tp-relic-filters"><label>Set <select data-filter-set><option value="">All sets</option>${cfg.sets.map(s=>htmlOption(s.id,s.name)).join('')}</select></label><label>Piece <select data-filter-slot><option value="">Both</option><option value="sphere">Spheres</option><option value="rope">Link Ropes</option></select></label><label>Status <select data-filter-worn><option value="">All</option><option value="yes">Equipped</option><option value="no">Unequipped</option></select></label></div><div class="tp-grid">${cards||"<p>No planar ornaments have been generated yet.</p>"}</div></div>`)}
  activateListeners(html){super.activateListeners(html);html.find("[data-actor]").on("change",e=>{this.actorId=e.target.value;this.render(false)});
    const filter=()=>{for(const card of html[0].querySelectorAll('.tp-card'))card.hidden=[['set','filterSet'],['slot','filterSlot'],['worn','filterWorn']].some(([key,field])=>{const choice=html[0].querySelector(`[data-filter-${key}]`)?.value;return choice&&card.dataset[field]!==choice})};
    html.find('.tp-relic-filters select').on('change',filter);
    html.find('.tp-card').on('click keydown',e=>{if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;if(e.target.closest('button,select,input,details,label'))return;this.selectedRelicId=e.currentTarget.dataset.item;html.find('.tp-card').removeClass('tp-selected');e.currentTarget.classList.add('tp-selected')});
    html.find("[data-preview-set]").on("change",e=>{this.selectedSetId=e.currentTarget.value;this.render(false)});
    html.find("[data-trailblaze]").on("change",async e=>{if(!game.user.isGM)return;const actor=selectActor(this.actorId);if(actor){await actor.setFlag(ID,"trailblazeCompanion",e.currentTarget.checked);for(const a of game.actors)if(a.type==="character")a.prepareData()}});
    html.find("[data-lushaka-target]").on("change",e=>send("target",{actorId:this.actorId,itemId:e.currentTarget.closest("[data-item]").dataset.item,targetActorId:e.currentTarget.value}));
    html.find("[data-op]").on("click",async e=>{const op=e.currentTarget.dataset.op,a=selectActor(this.actorId);
      if(op==="settings")return new ConfigWindow().render(true);
      if(op==="designer")return new PlanarDesigner().render(true);
      if(op==="generate")return send(op,{actorId:a?.id,setId:html.find("[data-set]").val(),slot:html.find("[data-slot]").val()});
      const card=e.currentTarget.closest("[data-item]");if(!card)return;
      const data={actorId:a.id,itemId:card.dataset.item};
      if(op==="equip")data.equipped=e.currentTarget.dataset.equipped==="true";
      if(op==="upgrade")data.materials=Object.fromEntries([...card.querySelectorAll("[data-material]")].map(el=>[el.dataset.material,el.value]));
      await send(op,data);
    })}
  async _updateObject(){}
}
class PlanarDesigner extends FormApplication{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:'telys-planar-designer',title:'Planar Set Display Designer',width:720,height:750,resizable:true})}
  async _renderInner(){if(!game.user.isGM)return $('<p>GM access required.</p>');
    const cfg=config(),sets=cfg.sets,set=sets.find(s=>s.id===this.setId)??sets[0];this.setId=set?.id;this.defaults??=clone(cfg.defaultLayout);
    const preview={...set,layout:this.layouts?.[set.id]??set.layout};const layout=layoutFor(preview,this.defaults);
    const controls=['sphere','rope'].map(slot=>`<fieldset data-layout-slot="${slot}"><legend>${slot==='sphere'?'Sphere':'Link Rope'}</legend>${['x','y','scale'].map(key=>`<label>${key.toUpperCase()} <input type="number" step="0.1" data-layout-value="${slot}:${key}" value="${number(layout[slot][key])}"></label>`).join('')}<button type="button" data-apply-default="${slot}">Apply ${slot==='sphere'?'Sphere':'Link Rope'} to all sets</button></fieldset>`).join('');
    return $(`<div class="tp-window tp-designer"><label>Planar set <select data-designer-set>${sets.map(s=>htmlOption(s.id,s.name,set?.id)).join('')}</select></label><p>Drag the Sphere or Rope to place it. Scroll over either image to resize it. Apply either piece to all sets to make its layout the default for new sets, too.</p>${visualHtml(preview,esc,{equipped:true,designer:true,defaultLayout:this.defaults})}<div class="tp-designer-controls">${controls}</div><button type="button" data-designer-save>Save set layouts</button></div>`)
  }
  activateListeners(html){super.activateListeners(html);if(!game.user.isGM)return;
    const remember=()=>{this.layouts??={};const set=this.layouts[this.setId]??=layoutFor(config().sets.find(s=>s.id===this.setId),this.defaults);for(const input of html[0].querySelectorAll('[data-layout-value]')){const [slot,key]=input.dataset.layoutValue.split(':');set[slot][key]=number(input.value,set[slot][key])}};
    const paint=()=>{const layout=this.layouts?.[this.setId];if(!layout)return;for(const slot of ['sphere','rope']){const image=html[0].querySelector(`.tp-${slot}`);if(image)image.style.cssText=pieceStyle(layout[slot])}};
    html.find('[data-designer-set]').on('change',e=>{remember();this.setId=e.currentTarget.value;this.render(false)});
    html.find('[data-layout-value]').on('input',()=>{remember();paint()});
    html.find('[data-apply-default]').on('click',event=>{remember();const slot=event.currentTarget.dataset.applyDefault;const sets=config().sets.map(set=>({...set,layout:this.layouts?.[set.id]??set.layout}));const result=applyLayoutToAll(sets,slot,this.layouts[this.setId][slot],this.defaults);this.defaults=result.defaults;this.layouts=Object.fromEntries(result.sets.map(set=>[set.id,set.layout]));ui.notifications.info(`${slot==='sphere'?'Sphere':'Link Rope'} layout applied to all planar sets. Save set layouts to keep it.`)});
    const orbit=html[0].querySelector('.tp-orbit');
    orbit?.querySelectorAll('[data-drag-piece]').forEach(image=>{
      const slot=image.dataset.dragPiece;if(!slot)return;
      image.addEventListener('pointerdown',event=>{event.preventDefault();image.setPointerCapture(event.pointerId)});
      image.addEventListener('pointermove',event=>{if(!image.hasPointerCapture(event.pointerId))return;remember();const rect=orbit.getBoundingClientRect(),part=this.layouts[this.setId][slot];part.x=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100));part.y=Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100));paint();for(const key of ['x','y'])html[0].querySelector(`[data-layout-value="${slot}:${key}"]`).value=part[key].toFixed(1)});
      image.addEventListener('wheel',event=>{event.preventDefault();remember();const part=this.layouts[this.setId][slot];part.scale=Math.max(.2,Math.min(5,part.scale+(event.deltaY<0?.1:-.1)));paint();html[0].querySelector(`[data-layout-value="${slot}:scale"]`).value=part.scale.toFixed(1)},{passive:false});
    });
    html.find('[data-designer-save]').on('click',async()=>{remember();const updated=config();updated.defaultLayout=this.defaults;updated.sets=updated.sets.map(set=>this.layouts?.[set.id]?{...set,layout:this.layouts[set.id]}:set);await game.settings.set(ID,'config',updated);ui.notifications.info('Planar set layouts saved.');this.close()});
  }
  async _updateObject(){}
}
class ConfigWindow extends FormApplication{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:"telys-planar-config",title:"Planar Ornament Configuration",width:1020,height:850,resizable:true})}
  async _renderInner(){const c=this.draft??config(),items=game.items.contents.filter(i=>i.type==="loot").sort((a,b)=>a.name.localeCompare(b.name));
    const itemOptions=(selected)=>`<option value="">Choose item</option>${items.map(i=>htmlOption(i.uuid,i.name,selected)).join("")}`;
    const stats=STATS.map(k=>`<tr><td>${esc(LABELS[k])}</td><td>${k==="healing"?"+1 at levels 0–7":`<input data-main="${k}" data-field="min" type="number" step="any" value="${number(c.main[k]?.min)}">`}</td><td>${k==="healing"?"+2 at 8, +3 at 15":`<input data-main="${k}" data-field="max" type="number" step="any" value="${number(c.main[k]?.max)}">`}</td><td>${SUBSTATS.includes(k)?`<input data-sub="${k}" data-field="enabled" type="checkbox" ${c.sub[k]?.enabled!==false?"checked":""}><span title="90% +1, 9% +2, 1% +3; Speed uses 5/10/15 ft">90/9/1</span>`:"—"}</td><td><input data-mapping="${k}" value="${esc(c.mapping[k]??"")}" placeholder="Ability key or system path"></td><td><input data-flat="${k}" type="number" step="any" value="${number(c.flat[k],1)}"></td></tr>`).join("");
    const mats=c.materials.map((m,index)=>`<div class="tp-row" data-mat-row="${index}"><select data-mat-item="${index}">${itemOptions(m.uuid)}</select><input type="number" min="1" data-mat-xp="${index}" value="${esc(m.xp)}"><button type="button" data-remove-mat="${index}">Remove</button></div>`).join("");
    const sets=c.sets.map((s,index)=>`<div class="tp-set" data-set-row="${index}"><input data-set-name="${index}" value="${esc(s.name)}" placeholder="Set name"><input data-set-sphere="${index}" value="${esc(s.sphereImage??"")}" placeholder="Sphere image path"><input data-set-rope="${index}" value="${esc(s.ropeImage??"")}" placeholder="Rope image path"><button type="button" data-remove-set="${index}">Remove</button><p>Two-piece bonus builder: choose a substat and a flat amount.</p><div data-bonus-container="${index}">${(s.bonuses??[]).map((b,n)=>`<div class="tp-row" data-bonus="${index}"><select data-bonus-stat="${index}:${n}">${[...new Set([...SUBSTATS,b.stat])].filter(Boolean).map(stat=>htmlOption(stat,LABELS[stat]??stat,b.stat)).join("")}</select><input type="number" step="any" data-bonus-value="${index}:${n}" value="${number(b.value)}"><button type="button" data-remove-bonus>×</button></div>`).join("")}</div><button type="button" data-add-bonus="${index}">Add bonus</button></div>`).join("");
    return $(`<div class="tp-window tp-config"><p>All percentage fields use percentage points. Bonuses to ability keys use the base score and round down.</p><label>Credits item <select data-currency>${itemOptions(c.currencyItem)}</select></label><label>Credits per XP <input type="number" min="0" step="any" data-cost value="${c.creditCostPerXp}"></label><label>XP per level <input type="number" min="1" data-xp-level value="${c.xpPerLevel}"></label><h3>Upgrade materials</h3><div data-mat-container>${mats}</div><button type="button" data-add-mat>Add material</button><h3>Planar sets</h3><div data-set-container>${sets}</div><button type="button" data-add-set>Add custom set</button><h3>Stats and mappings</h3><p>Mapping examples: <code>str</code> for ability, <code>system.attributes.movement.walk</code> for movement, <code>system.attributes.ac.bonus</code> for AC. Unmapped effects remain visible in the module API.</p><table><thead><tr><th>Stat</th><th>Main +0</th><th>Main +15</th><th>Sub enabled / fixed roll odds</th><th>Target</th><th>Flat multiplier</th></tr></thead><tbody>${stats}</tbody></table><label>Base crit threshold <input type="number" min="2" max="20" data-crit-base value="${c.crit.base}"></label><label>Crit rate points per expanded face <input type="number" min="0.01" step="any" data-crit-points value="${c.crit.pointsPerRange}"></label><footer><button type="button" data-save>Save configuration</button></footer></div>`)}
  activateListeners(html){super.activateListeners(html);
    html.find("[data-add-mat]").on("click",()=>{this.capture(html);this.draft.materials.push({uuid:"",xp:100});this.render(false)});
    html.find("[data-remove-mat]").on("click",e=>{this.capture(html);this.draft.materials.splice(Number(e.currentTarget.dataset.removeMat),1);this.render(false)});
    html.find("[data-add-set]").on("click",()=>{this.capture(html);this.draft.sets.push({id:foundry.utils.randomID(),name:"New Set",bonuses:[]});this.render(false)});
    html.find("[data-remove-set]").on("click",e=>{this.capture(html);this.draft.sets.splice(Number(e.currentTarget.dataset.removeSet),1);this.render(false)});
    html.find("[data-add-bonus]").on("click",e=>{this.capture(html);this.draft.sets[Number(e.currentTarget.dataset.addBonus)].bonuses.push({stat:SUBSTATS[0],value:1});this.render(false)});
    html.find("[data-remove-bonus]").on("click",e=>{const row=e.currentTarget.closest("[data-bonus]"),idx=Number(row.dataset.bonus),n=[...row.parentElement.children].indexOf(row);this.capture(html);this.draft.sets[idx].bonuses.splice(n,1);this.render(false)});
    html.find("[data-save]").on("click",async()=>{this.capture(html);await game.settings.set(ID,"config",this.draft);for(const a of game.actors)a.prepareData();ui.notifications.info("Planar configuration saved.");this.close()})
  }
  capture(h){const c=this.draft??config();c.currencyItem=h.find("[data-currency]").val();c.creditCostPerXp=Math.max(0,number(h.find("[data-cost]").val()));c.xpPerLevel=Math.max(1,Math.floor(number(h.find("[data-xp-level]").val(),100)));
    c.materials=[...h[0].querySelectorAll("[data-mat-row]")].map(row=>({uuid:row.querySelector("[data-mat-item]").value,xp:Math.max(1,number(row.querySelector("[data-mat-xp]").value))})).filter(m=>m.uuid);
    c.sets=[...h[0].querySelectorAll("[data-set-row]")].map(row=>{const i=Number(row.dataset.setRow);return{...c.sets[i],id:c.sets[i]?.id||foundry.utils.randomID(),name:row.querySelector("[data-set-name]").value.trim(),sphereImage:row.querySelector("[data-set-sphere]").value.trim(),ropeImage:row.querySelector("[data-set-rope]").value.trim(),bonuses:[...row.querySelectorAll("[data-bonus]")].map(b=>({stat:b.querySelector("[data-bonus-stat]").value.trim(),value:number(b.querySelector("[data-bonus-value]").value)})).filter(b=>b.stat)}}).filter(s=>s.name);
    for(const el of h[0].querySelectorAll("[data-main]")){const k=el.dataset.main;c.main[k]??={};c.main[k][el.dataset.field]=number(el.value)}
    for(const el of h[0].querySelectorAll("[data-sub]")){const k=el.dataset.sub;c.sub[k]??={};c.sub[k][el.dataset.field]=el.type==="checkbox"?el.checked:number(el.value)}
    for(const el of h[0].querySelectorAll("[data-mapping]"))c.mapping[el.dataset.mapping]=el.value.trim();
    for(const el of h[0].querySelectorAll("[data-flat]"))c.flat[el.dataset.flat]=number(el.value,1);
    c.crit={base:number(h.find("[data-crit-base]").val(),20),pointsPerRange:number(h.find("[data-crit-points]").val(),1)};this.draft=c;
  }
  async _updateObject(){}
}
const originalScores=new WeakMap();
const originalFields=new WeakMap();
const sheetModes=new WeakMap();
const planarSheetOpen=new WeakMap();
const HSR_ID="telys-star-rail-ultimates";
const HSR_EFFECT_NAME="Planar Break and Energy bonuses";
const hsrSyncs=new Map();
function syncHsrBonuses(actor){
  const previous=hsrSyncs.get(actor.id)??Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>applyHsrBonuses(actor));hsrSyncs.set(actor.id,next);
  void next.finally(()=>{if(hsrSyncs.get(actor.id)===next)hsrSyncs.delete(actor.id)}).catch(()=>{});
  return next;
}
async function applyHsrBonuses(actor){
  if(!game.user.isGM||actor?.type!=="character")return;
  const b=bonuses(allItems(actor),config()),changes=[];for(const [key,value] of Object.entries(dynamicStats(actor,config())))b[key]=(b[key]??0)+value;
  for(const [stat,field] of [["breakEffect","breakEffectScore"],["energyRegen","regenScore"]]){
    const boost=Math.floor(number(b[stat]));if(!boost)continue;
    const base=number(foundry.utils.getProperty(actor._source,`flags.${HSR_ID}.ultimate.${field}`),10);
    changes.push({key:`flags.${HSR_ID}.ultimate.${field}`,mode:CONST.ACTIVE_EFFECT_MODES.OVERRIDE,value:String(Math.max(1,Math.min(30,base+boost))),priority:50});
  }
  const existing=actor.effects.find(e=>e.getFlag(ID,"hsrBonus"));
  if(!changes.length){if(existing)await existing.delete();return}
  if(existing){if(JSON.stringify(existing.changes)!==JSON.stringify(changes))await existing.update({changes});return}
  await actor.createEmbeddedDocuments("ActiveEffect",[{name:HSR_EFFECT_NAME,img:"icons/magic/light/orb-sphere-gold.webp",changes,disabled:false,flags:{[ID]:{hsrBonus:true}}}]);
}
function applyBonuses(model){const actor=model.parent;if(!actor||actor.type!=="character")return;
  const cfg=config(),b=bonuses(allItems(actor),cfg),scores={},fields={};
  for(const [key,value] of Object.entries(dynamicStats(actor,cfg)))b[key]=(b[key]??0)+value;
  for(const key of ABILITIES){scores[key]=number(model.abilities?.[key]?.value);fields[`system.abilities.${key}.value`]=scores[key]}
  originalScores.set(actor,scores);
  const additions={};
  for(const [stat,value] of Object.entries(b)){
    const target=cfg.mapping[stat];if(!target||!Number.isFinite(value))continue;
    const delta=value*number(cfg.flat?.[stat],1);
    if(ABILITIES.includes(target)){
      (additions[target]??=[]).push({value:delta,percent:stat.endsWith("Pct")});
    }else if(/^system\.[a-zA-Z0-9_.]+$/.test(target)&&!target.includes("__proto__")&&!target.includes("constructor")){
      const path=target.slice(7),old=foundry.utils.getProperty(model,path);
      if((typeof old==="number"||typeof old==="string")&&!(target in fields))fields[target]=old;
      if(typeof old==="number")foundry.utils.setProperty(model,path,old+(stat.endsWith("Pct")?Math.floor(old*delta/100):delta));
      else if(typeof old==="string"&&/^[-+]?\d+(\.\d+)?$/.test(old))foundry.utils.setProperty(model,path,String(number(old)+delta));
    }
  }
  for(const key of ABILITIES)if(number(b[key]))(additions[key]??=[]).push({value:number(b[key]),percent:false});
  if(number(b.effectHit)){
    const amount=Math.floor(number(b.effectHit));
    if(typeof model.bonuses?.rsak?.attack==="string")model.bonuses.rsak.attack=`${model.bonuses.rsak.attack} + ${amount}`;
    if(typeof model.bonuses?.msak?.attack==="string")model.bonuses.msak.attack=`${model.bonuses.msak.attack} + ${amount}`;
    if(typeof model.bonuses?.spell?.dc==="number")model.bonuses.spell.dc+=amount;
    else if(typeof model.bonuses?.spell?.dc==="string")model.bonuses.spell.dc=`${model.bonuses.spell.dc} + ${amount}`;
  }
  if(number(b.savingThrow)){
    const amount=Math.floor(number(b.savingThrow));
    for(const key of ABILITIES)if(typeof model.abilities?.[key]?.bonuses?.save==="string")model.abilities[key].bonuses.save=`${model.abilities[key].bonuses.save} + ${amount}`;
  }
  if(number(b.initiativeBonus)){
    const amount=Math.floor(number(b.initiativeBonus));
    const init=model.attributes?.init;
    if(typeof init?.bonus==="number")init.bonus+=amount;
    else if(typeof init?.bonus==="string")init.bonus=`${init.bonus} + ${amount}`;
  }
  for(const [ability,entries] of Object.entries(additions)){const base=scores[ability];const flat=entries.filter(e=>!e.percent).reduce((n,e)=>n+e.value,0);
    const pct=entries.filter(e=>e.percent).reduce((n,e)=>n+e.value,0);
    model.abilities[ability].value=Math.floor(base+flat+base*pct/100);
  }
  actor._planarBonuses=b;
  originalFields.set(actor,fields);
  // dnd5e computes ability modifiers, HP and derived rolls after this wrapper runs.
}
function patchCharacter(){const prototype=CONFIG.Actor.dataModels.character?.prototype;if(!prototype||prototype._telysPlanarPatched)return;
  const original=prototype.prepareDerivedData;prototype.prepareDerivedData=function(...args){applyBonuses(this);return original.apply(this,args)};
  prototype._telysPlanarPatched=true;
}
function openGenerator(){
  if(!game.user.isGM)return;
  const sets=config().sets;
  if(!sets.length)return ui.notifications.warn('A planar set is required.');
  const content=`<form class="tp-generate-form"><label>Planar set <select name="setId">${sets.map(s=>htmlOption(s.id,s.name)).join('')}</select></label><label>Piece <select name="slot"><option value="random">Random Sphere or Link Rope</option><option value="sphere">Sphere</option><option value="rope">Link Rope</option></select></label></form>`;
  return new Dialog({title:'Generate Planar Relic',content,buttons:{generate:{icon:'<i class="fas fa-dice"></i>',label:'Generate',callback:html=>{const form=html[0].querySelector('.tp-generate-form');if(!form)return;const data=Object.fromEntries(new FormData(form));if(data.slot==='random')data.slot=Math.random()<0.5?'sphere':'rope';void send('generate',data)}}},default:'generate'}).render(true);
}
function injectHub(app,html){
  if(app.id!=="tsru-hub")return;
  const root=html[0]??html,field=root?.querySelector('.tsru-phone-button-field');if(!field)return;
  // Remove the old full-width control, including one inserted later by a stale hook.
  const removeLegacy=()=>root.querySelectorAll('.tp-hub-entry,.tp-gm-designer').forEach(element=>element.remove());
  removeLegacy();
  if(!root._telysPlanarLegacyObserver){
    const observer=new MutationObserver(removeLegacy);
    observer.observe(root,{childList:true,subtree:true});root._telysPlanarLegacyObserver=observer;
  }
  if(field.querySelector('.tp-phone-tile'))return;
  const actions=[['Planar Relics','fa-circle-nodes',()=>open()]];
  if(game.user.isGM)actions.push(['Planar Relics Config','fa-gear',()=>new ConfigWindow().render(true)],['Generate Planar Relics','fa-dice',openGenerator],['Set Display Designer','fa-object-group',()=>new PlanarDesigner().render(true)]);
  const base=Math.max(field.scrollHeight,field.getBoundingClientRect().height,parseFloat(getComputedStyle(field).height)||0);
  const tileHeight=Math.max(76,window.innerHeight*.12),gap=12,rows=Math.ceil(actions.length/2);
  field.style.height=`${Math.ceil(base+rows*(tileHeight+gap)+gap)}px`;
  actions.forEach(([label,icon,action],index)=>{
    const button=document.createElement('button');button.type='button';button.className=`tp-phone-tile${index&&game.user.isGM?' tsru-phone-button-gm':''}`;
    button.style.cssText=`left:${index%2?52:6}%;top:${Math.ceil(base+gap+Math.floor(index/2)*(tileHeight+gap))}px;width:42%;height:${Math.ceil(tileHeight)}px`;
    button.innerHTML=`<i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();action()});field.append(button);
  });
}
function injectPlanarSheetTab(app,root,actor){
  if(root.querySelector('.tp-sheet-tab')||!editable(actor))return;
  const nav=root.querySelector('nav.sheet-tabs, .sheet-navigation nav.tabs, nav.tabs, [role="tablist"]');
  const body=root.querySelector('.sheet-body, .sheet-content, .tab-content, .sheet-main');
  if(!nav||!body){
    const header=root.querySelector('.window-header, .sheet-header, header');if(!header)return;
    const button=document.createElement('button');button.type='button';button.className='tp-sheet-tab';button.textContent='Planar Relics';
    button.addEventListener('click',event=>{event.preventDefault();open(actor.id)});header.append(button);return;
  }
  const group=nav.dataset.group||nav.querySelector('[data-group]')?.dataset.group||'primary';
  const tab=document.createElement('a');tab.className='item tp-sheet-tab';tab.dataset.tab='telys-planar';tab.dataset.group=group;tab.setAttribute('role','tab');tab.innerHTML='<i class="fas fa-circle-nodes"></i> Planar Relics';
  const panel=document.createElement('section');panel.className='tab tp-sheet-panel';panel.dataset.tab='telys-planar';panel.dataset.group=group;panel.style.display='none';
  const cfg=config(),pieces=storedRelics().map(asItem),equipped=equippedRelics(actor);
  const selected=cfg.sets.find(s=>equipped.some(i=>relic(i)?.setId===s.id))??cfg.sets[0];
  const slots=['sphere','rope'].map(slot=>{
    const worn=equipped.find(i=>relic(i)?.slot===slot);
    const choices=pieces.filter(i=>relic(i)?.slot===slot).map(i=>`<div class="tp-sheet-piece"><img src="${esc(i.img)}" alt=""><span>${esc(i.name)} +${number(relic(i).level)}</span><button type="button" data-planar-equip="${esc(i.id)}" data-equip="${worn?.id===i.id?'false':'true'}">${worn?.id===i.id?'Unequip':'Equip'}</button></div>`).join('');
    return `<section><h3>${slot==='sphere'?'Planar Sphere':'Link Rope'}</h3>${choices||'<p>No relics in this slot.</p>'}</section>`;
  }).join('');
  const visibleSlots=['sphere','rope'].filter(slot=>equipped.some(i=>{const r=relic(i);return r?.setId===selected?.id&&r.slot===slot}));
  panel.innerHTML=`<div class="tp-sheet-content"><h2>Planar Relics</h2>${selected?visualHtml(selected,esc,{equipped:visibleSlots.length===2,defaultLayout:cfg.defaultLayout,visibleSlots}):''}<div class="tp-sheet-slots">${slots}</div><button type="button" data-planar-open>Open upgrades and set details</button></div>`;
  panel.querySelector('[data-planar-open]').addEventListener('click',()=>open(actor.id));
  panel.querySelectorAll('[data-planar-equip]').forEach(button=>button.addEventListener('click',async()=>{
    await send('equip',{actorId:actor.id,itemId:button.dataset.planarEquip,equipped:button.dataset.equip==='true'});
    if(game.user.isGM)app.render(false);
  }));
  const otherTabs=[...nav.querySelectorAll('[data-tab]')];
  const otherPanels=[...body.querySelectorAll(`.tab[data-group="${group}"]`)].filter(el=>el!==panel);
  const activate=()=>{otherTabs.forEach(el=>el.classList.remove('active'));otherPanels.forEach(el=>el.classList.remove('active'));tab.classList.add('active');panel.classList.add('active');panel.style.display='block'};
  tab.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();planarSheetOpen.set(app,true);activate()});
  nav.addEventListener('click',event=>{if(event.target.closest('.tp-sheet-tab'))return;planarSheetOpen.set(app,false);tab.classList.remove('active');panel.classList.remove('active');panel.style.display='none'},true);
  nav.append(tab);body.append(panel);if(planarSheetOpen.get(app))activate();
}
function injectSheet(app,html){const actor=app.actor;if(actor?.type!=="character")return;
  const root=html[0]??html;if(!root)return;
  injectPlanarSheetTab(app,root,actor);
  if(root.querySelector(".tp-ability-toggle"))return;
  const fields=originalFields.get(actor),b=actor._planarBonuses;if(!fields||!Object.keys(b??{}).length)return;
  const form=root.querySelector("form")??root;
  const holder=document.createElement("button");holder.type="button";holder.className="tp-ability-toggle";
  const rows=[];
  for(const [name,base] of Object.entries(fields)){
    const input=[...root.querySelectorAll("input[name]")].find(el=>el.name===name);
    if(!input||input.type==="hidden")continue;
    rows.push({input,base:String(base),buffed:String(input.value),locked:input.readOnly,disabled:input.disabled});
  }
  for(const [field,label] of [["breakEffectScore","Break Effect ability score"],["regenScore","Energy Regen ability score"]]){
    const input=root.querySelector(`input[aria-label="${label}"]`);
    if(!input)continue;
    const base=number(foundry.utils.getProperty(actor._source,`flags.${HSR_ID}.ultimate.${field}`),10);
    rows.push({input,base:String(base),buffed:String(input.value),locked:input.readOnly,disabled:input.disabled});
  }
  if(!rows.length)return;
  let boosted=sheetModes.get(actor)==="boosted";
  const render=()=>{
    holder.textContent=boosted?"Buffed stats · view only":"Original stats · editable";
    holder.setAttribute("aria-pressed",String(boosted));
    holder.title=boosted?"Show original scores to edit them":"Show scores after planar buffs";
    for(const row of rows){row.input.value=boosted?row.buffed:row.base;row.input.readOnly=boosted||row.locked;row.input.disabled=boosted||row.disabled;row.input.classList.toggle("tp-buffed-field",boosted)}
  };
  holder.addEventListener("click",()=>{
    if(!boosted){for(const row of rows)row.base=row.input.value}
    boosted=!boosted;sheetModes.set(actor,boosted?"boosted":"original");render();
  });
  render();form.prepend(holder);
}
export function open(actorId){const app=window.TelysPlanar.app??new PlanarWindow();window.TelysPlanar.app=app;app.actorId=actorId||app.actorId||token()?.id;app.render(true);return app}
async function migrateLegacyRelics(){
  if(!game.user.isGM||game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id!==game.user.id)return;
  const source=[...game.actors].filter(a=>a.type==='character').flatMap(actor=>actor.items.filter(relic).map(item=>({actor,item})));
  if(!source.length)return;
  const inventory=mergeLegacyRelics(storedRelics(),source.map(({actor,item})=>({actorId:actor.id,itemId:item.id,name:item.name,img:item.img,relic:relic(item)})),()=>foundry.utils.randomID());
  if(inventory.length>storedRelics().length)await game.settings.set(ID,'relics',inventory);
  for(const actor of new Set(source.map(x=>x.actor)))await actor.deleteEmbeddedDocuments('Item',source.filter(x=>x.actor===actor).map(x=>x.item.id));
  ui.notifications.info('Existing planar relics moved to the shared Planar collection.');
}
Hooks.once("init",()=>{game.settings.register(ID,"config",{scope:"world",config:false,type:Object,default:clone(DEFAULT_CONFIG)});game.settings.register(ID,'relics',{scope:'world',config:false,type:Array,default:[]});game.settings.registerMenu(ID,'displayDesigner',{name:'Planar Set Display Designer',label:'Design Sphere and Rope Positions',hint:'Adjust each planar set projection.',icon:'fas fa-circle-nodes',type:PlanarDesigner,restricted:true});patchCharacter()});
Hooks.once("ready",async()=>{
  await migrateLegacyRelics().catch(error=>{console.error(`${ID} | Relic migration failed`,error);ui.notifications.error('Planar relic migration failed. Original actor items were kept.')});
  patchCharacter();registerDamageHooks(config);registerConditionHooks();
  Hooks.on("dnd5e.preRollAttackV2",rollConfig=>{
    const actor=rollConfig.subject?.actor,count=actor?critBonusSources(allItems(actor),config())+Math.floor(number(dynamicStats(actor,config()).critRange))+firstAttackBonus(actor,number(bonuses(allItems(actor),config()).critDamageDice)+number(dynamicStats(actor,config()).critDamageDice)):0;
    if(!actor||count<=0||!rollConfig.rolls?.[0])return;
    const opts=rollConfig.rolls[0].options??={};
    opts.criticalSuccess=criticalThreshold(opts.criticalSuccess??rollConfig.subject.criticalThreshold??20,count);
  });game.socket.on(`module.${ID}`,msg=>{if(game.user.isGM&&game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id)processRequest(msg,true)});
  window.TelysPlanar={open,openConfig:()=>new ConfigWindow().render(true),generate,advance,bonuses,mainValue,app:null};
  Hooks.on("renderApplication",injectHub);
  Hooks.on('renderApplicationV2',(app,html)=>{injectHub(app,html);injectSheet(app,html)});
  Hooks.on("renderActorSheet",injectSheet);
  Hooks.on('renderActorSheetV2',injectSheet);
  Hooks.on('updateSetting',setting=>{if(setting.key!==`${ID}.relics`)return;for(const actor of game.actors)if(actor.type==='character'){actor.prepareData();if(game.user.isGM)void syncHsrBonuses(actor).catch(error=>console.error(`${ID} | HSR bonus sync`,error));if(actor.sheet?.rendered)actor.sheet.render(false)}window.TelysPlanar?.app?.render(false)});
  if(game.user.isGM)for(const actor of game.actors)void syncHsrBonuses(actor).catch(error=>console.error(`${ID} | HSR bonus sync`,error));
  for(const event of ["createItem","updateItem","deleteItem"])Hooks.on(event,item=>{if(item.parent?.type==="character")void syncHsrBonuses(item.parent).catch(error=>console.error(`${ID} | HSR bonus sync`,error))});
  Hooks.on("updateActor",(actor,change)=>{if(foundry.utils.hasProperty(foundry.utils.expandObject(change),`flags.${HSR_ID}.ultimate`))void syncHsrBonuses(actor).catch(error=>console.error(`${ID} | HSR bonus sync`,error))});
  for(const event of ["createItem","updateItem","deleteItem"])Hooks.on(event,item=>{if(item.parent?.type!=="character"||!item.getFlag?.(ID,"relic"))return;
    for(const actor of game.actors)if(actor.type==="character"&&actor.id!==item.parent.id)actor.prepareData();
  });
  ui.notifications.info("Planar Ornaments ready.");
});
