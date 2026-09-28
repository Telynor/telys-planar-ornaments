import {registerDamageHooks} from "./damage.mjs";
import {CANONICAL_SETS} from "./catalog.mjs";
import {visualHtml,layoutFor,pieceStyle,applyLayoutToAll} from "./visuals.mjs";
import {dynamicStats,registerConditionHooks,firstAttackBonus} from './effects.mjs';
import {storedRelics,asItem,ownerOf,equippedRelics,allItems,mergeLegacyRelics} from './inventory.mjs';
import {ID,ABILITIES,STATS,SPHERE,ROPE,SUBSTATS,LABELS,DEFAULT_CONFIG,number,currencyCost,random,generate,generateCustom,customSubstatSlots,advance,bonuses,mainValue,criticalThreshold,critBonusSources,splitInputs} from "./core.mjs";
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
  if(!['generate','generateCustom'].includes(op)&&(!actor||(!requester.isGM&&!actor.testUserPermission(requester,"OWNER"))))return;
  const key='shared-collection';if(pending.has(key))return ui.notifications.warn("Planar transaction already in progress.");
  pending.add(key);
  try{
    const cfg=config();
    if(op==="generate"||op==='generateCustom'){
      if(remote||!requester.isGM)throw Error("Only a local GM can generate relics.");
      const set=cfg.sets.find(s=>s.id===data.setId);if(!set)throw Error("Unknown set.");
      const r=op==='generateCustom'?generateCustom(set,data.slot,data.main,data.level,data.substats):generate(set,data.slot,cfg);
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
      }else if(op==='delete'){
        if(remote||!requester.isGM)throw Error('Only the GM can delete planar ornaments.');
        inventory.splice(index,1);
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
        const cost=currencyCost(xp,cfg.currencyXp);
        if(cost){if(!cfg.currencyItem)throw Error("Configure a credit item first.");lines.push([cfg.currencyItem,cost])}
        const required=new Map();for(const [id,n] of lines)required.set(id,(required.get(id)??0)+n);
        for(const [id,n] of required)if(sum(actor,id)<n)throw Error(`Insufficient ${id}: need ${n}.`);
        const result=advance(r,xp,cfg);
        await consume(actor,required);
        entry.relic=result;await game.settings.set(ID,'relics',inventory);
      }
    }
    for(const a of game.actors)if(a.type==='character')await syncPlanarStats(a);
    Hooks.callAll(`${ID}.changed`,actor);window.TelysPlanar?.app?.render(false);
  }catch(e){console.error(ID,e);ui.notifications.error(`Planar ornaments: ${e.message}`)}finally{pending.delete(key)}
}
function selectActor(id){return game.actors.get(id)||token()||actors()[0]}
class PlanarWindow extends Application{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:"telys-planar-window",title:"Planar Ornaments",width:940,height:740,resizable:true,submitOnChange:false})}
  async _renderInner(){const a=selectActor(this.actorId),cfg=config();this.actorId=a?.id;
    const inventory=storedRelics(),list=inventory.map(asItem);
    const cards=list.map(i=>{const r=relic(i),entry=inventory.find(x=>x.id===i.id),wearer=ownerOf(entry),isWorn=wearer?.id===a?.id,set=cfg.sets.find(s=>s.id===r.setId),value=mainValue(r,cfg);
      const materials=cfg.materials.map(m=>`<label class="tp-material">${esc(m.name||game.items.get(m.uuid.split('.').at(-1))?.name||m.uuid)} (${esc(m.xp)} XP; owned ${sum(a,m.uuid)}) <input type="number" min="0" max="${sum(a,m.uuid)}" value="0" data-material="${esc(m.uuid)}"></label>`).join("");
      const recipient=r.setId==="317"&&isWorn?`<label>Lushaka buff recipient <select data-lushaka-target><option value="">Choose character</option>${game.actors.filter(x=>x.type==="character"&&x.id!==a.id).map(x=>htmlOption(x.id,x.name,r.targetActorId)).join("")}</select></label>`:"";
      const details=`${i.name} +${r.level} · ${LABELS[r.main]} ${value.toFixed(2)} · ${r.sub.map(s=>`${LABELS[s.key]} +${number(s.value)}`).join(', ')||'No substats yet'}`;
      return `<article class="tp-card ${this.selectedRelicId===i.id?'tp-selected':''}" data-item="${i.id}" data-filter-set="${esc(r.setId)}" data-filter-slot="${esc(r.slot)}" data-filter-worn="${wearer?'yes':'no'}" data-filter-wearer="${esc(wearer?.id??'')}" title="${esc(details)}" tabindex="0"><div class="tp-relic-art"><img src="${esc(i.img)}" alt="${esc(i.name)}">${wearer?`<img class="tp-wearer" src="${esc(wearer.prototypeToken?.texture?.src||wearer.img)}" title="Equipped by ${esc(wearer.name)}" alt="${esc(wearer.name)}">`:''}</div><div><h3>${esc(i.name)} <small>+${r.level}</small></h3><p>${esc(LABELS[r.main])}: ${value.toFixed(2)}${r.main==="speed"?" ft":""}</p><p>${r.sub.map(s=>`${esc(LABELS[s.key])} +${number(s.value).toFixed(2)}`).join(" · ")||"No substats yet"}</p><div class="tp-card-actions"><p>${wearer?`Equipped by ${esc(wearer.name)}`:'Unequipped'}</p><button type="button" data-op="equip" data-equipped="${!isWorn}">${isWorn?'Unequip':`Equip for ${esc(a?.name??'character')}`}</button>${recipient}${r.level<15?`<details><summary>Upgrade · ${r.xp}/${cfg.xpPerLevel} XP</summary>${materials}<p>Cost: 1 ${esc(game.items.get(cfg.currencyItem?.split('.').at(-1))?.name||'currency item')} per ${number(cfg.currencyXp,1)} XP · owned ${sum(a,cfg.currencyItem)}</p><button type="button" data-op="upgrade">Spend selected materials</button></details>`:"<p>Maximum level</p>"}${game.user.isGM?'<button type="button" data-op="delete" class="tp-delete-relic"><i class="fas fa-trash"></i> Delete ornament</button>':''}</div></div></article>`
    }).join("");
    const gm='';
    const activeSet=cfg.sets.find(s=>['sphere','rope'].every(slot=>inventory.some(i=>i.equippedActorId===a?.id&&i.relic.setId===s.id&&i.relic.slot===slot)));
    const wornSet=cfg.sets.find(s=>inventory.some(i=>i.equippedActorId===a?.id&&i.relic.setId===s.id));
    const chosen=cfg.sets.find(s=>s.id===this.selectedSetId)??activeSet??wornSet??cfg.sets[0];
    const visibleSlots=['sphere','rope'].filter(slot=>inventory.some(i=>i.equippedActorId===a?.id&&i.relic.setId===chosen?.id&&i.relic.slot===slot));
    const preview=`<div class="tp-stage">${visualHtml(chosen,esc,{equipped:activeSet?.id===chosen?.id,defaultLayout:cfg.defaultLayout,visibleSlots})}<div class="tp-stage-info"><h3>Planar Ornaments</h3><label>Display set <select data-preview-set>${cfg.sets.map(s=>htmlOption(s.id,s.name,chosen?.id)).join('')}</select></label><p>${esc(chosen?.adaptedEffect??'Equip a matching Sphere and Link Rope for the two-piece bonus.')}</p><p>${activeSet?.id===chosen?.id?'Matching set equipped':'Equip matching pieces to activate this set.'}</p></div></div>`;
    return $(`<div class="tp-window tp-main"><header><h2>Planar Ornaments · Shared Collection</h2><select data-actor>${actors().map(x=>htmlOption(x.id,x.name,a?.id)).join("")}</select></header>${gm}${preview}<div class="tp-relic-filters"><label>Set <select data-filter-set><option value="">All sets</option>${cfg.sets.map(s=>htmlOption(s.id,s.name)).join('')}</select></label><label>Piece <select data-filter-slot><option value="">Both</option><option value="sphere">Spheres</option><option value="rope">Link Ropes</option></select></label><label>Status <select data-filter-worn><option value="">All</option><option value="yes">Equipped</option><option value="no">Unequipped</option></select></label><label>Equipped by <select data-filter-wearer><option value="">Anyone</option>${game.actors.filter(x=>x.type==='character'&&inventory.some(i=>i.equippedActorId===x.id)).map(x=>htmlOption(x.id,x.name)).join('')}</select></label></div><div class="tp-grid">${cards||"<p>No planar ornaments have been generated yet.</p>"}</div></div>`)}
  activateListeners(html){super.activateListeners(html);html.find("[data-actor]").on("change",e=>{this.actorId=e.target.value;this.selectedSetId=null;this.render(false)});
    const filter=()=>{for(const card of html[0].querySelectorAll('.tp-card'))card.hidden=[['set','filterSet'],['slot','filterSlot'],['worn','filterWorn'],['wearer','filterWearer']].some(([key,field])=>{const choice=html[0].querySelector(`[data-filter-${key}]`)?.value;return choice&&card.dataset[field]!==choice})};
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
      if(op==='delete'){
        if(!game.user.isGM)return;
        const name=card.querySelector('h3')?.textContent?.trim()??'this ornament';
        if(!await Dialog.confirm({title:'Delete Planar Ornament',content:`<p>Delete <strong>${esc(name)}</strong> from the shared collection? This also unequips it.</p>`}))return;
        this.selectedRelicId=null;
        return send('delete',{actorId:a?.id,itemId:card.dataset.item});
      }
      const data={actorId:a.id,itemId:card.dataset.item};
      if(op==="equip")data.equipped=e.currentTarget.dataset.equipped==="true";
      if(op==="upgrade")data.materials=Object.fromEntries([...card.querySelectorAll("[data-material]")].map(el=>[el.dataset.material,el.value]));
      await send(op,data);
    })}
  async _updateObject(){}
}
class PlanarDesigner extends Application{
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
class ConfigWindow extends Application{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{id:"telys-planar-config",title:"Planar Ornament Configuration",width:1020,height:850,resizable:true})}
  async _renderInner(){const c=this.draft??config(),items=game.items.contents.filter(i=>i.type==="loot").sort((a,b)=>a.name.localeCompare(b.name));
    const itemOptions=(selected)=>`<option value="">Choose item</option>${items.map(i=>htmlOption(i.uuid,i.name,selected)).join("")}`;
    const fixedMain={atkPct:[0,3],hpPct:[5,20],defPct:[1,4],healing:[1,4],breakEffect:[0,3]};
    const stats=STATS.map(k=>`<tr><td>${esc(LABELS[k])}</td><td>${fixedMain[k]?`+${fixedMain[k][0]} at +0`:`<input data-main="${k}" data-field="min" type="number" step="any" value="${number(c.main[k]?.min)}">`}</td><td>${fixedMain[k]?`+${fixedMain[k][1]} at +15 (steps at +5/+10)`:`<input data-main="${k}" data-field="max" type="number" step="any" value="${number(c.main[k]?.max)}">`}</td><td>${SUBSTATS.includes(k)?`<input data-sub="${k}" data-field="enabled" type="checkbox" ${c.sub[k]?.enabled!==false?"checked":""}><span title="90% +1, 9% +2, 1% +3; Speed uses 5/10/15 ft">90/9/1</span>`:"—"}</td><td><input data-mapping="${k}" value="${esc(c.mapping[k]??"")}" placeholder="Ability key or system path"></td><td><input data-flat="${k}" type="number" step="any" value="${number(c.flat[k],1)}"></td></tr>`).join("");
    const dropItem=(uuid,name,attribute)=>`<div class="tp-item-drop" data-item-drop="${attribute}" tabindex="0"><i class="fas fa-hand-pointer"></i><span class="tp-drop-name">${esc(name||game.items.get(uuid?.split('.').at(-1))?.name||'Drop an item here')}</span><input type="hidden" value="${esc(uuid||'')}"></div>`;
    const mats=c.materials.slice(0,3).map((m,index)=>`<div class="tp-row" data-mat-row="${index}">${dropItem(m.uuid,m.name,`material:${index}`)}<label>XP per item <input type="number" min="1" data-mat-xp="${index}" value="${esc(m.xp)}"></label><button type="button" data-remove-mat="${index}">Remove</button></div>`).join("");
    const sets=c.sets.map((s,index)=>`<div class="tp-set" data-set-row="${index}"><input data-set-name="${index}" value="${esc(s.name)}" placeholder="Set name"><input data-set-sphere="${index}" value="${esc(s.sphereImage??"")}" placeholder="Sphere image path"><input data-set-rope="${index}" value="${esc(s.ropeImage??"")}" placeholder="Rope image path"><button type="button" data-remove-set="${index}">Remove</button><p>Two-piece bonus builder: choose a substat and a flat amount.</p><div data-bonus-container="${index}">${(s.bonuses??[]).map((b,n)=>`<div class="tp-row" data-bonus="${index}"><select data-bonus-stat="${index}:${n}">${[...new Set([...SUBSTATS,b.stat])].filter(Boolean).map(stat=>htmlOption(stat,LABELS[stat]??stat,b.stat)).join("")}</select><input type="number" step="any" data-bonus-value="${index}:${n}" value="${number(b.value)}"><button type="button" data-remove-bonus>×</button></div>`).join("")}</div><button type="button" data-add-bonus="${index}">Add bonus</button></div>`).join("");
    return $(`<div class="tp-window tp-config"><p>Fixed main bonuses for Attack, HP, AC, Healing and Break Effect increase at +5, +10 and +15. Other percentage fields use percentage points.</p><h3>Upgrade currency</h3>${dropItem(c.currencyItem,c.currencyName,'currency')}<label>One currency item pays for <input type="number" min="1" step="1" data-currency-xp value="${Math.max(1,number(c.currencyXp,1))}"> XP (round cost up)</label><label>XP per level <input type="number" min="1" data-xp-level value="${c.xpPerLevel}"></label><h3>Upgrade materials (up to 3)</h3><div data-mat-container>${mats}</div><button type="button" data-add-mat ${c.materials.length>=3?'disabled':''}>Add material</button><h3>Planar sets</h3><div data-set-container>${sets}</div><button type="button" data-add-set>Add custom set</button><h3>Stats and mappings</h3><p>Mapping examples: <code>str</code> for ability, <code>system.attributes.movement.walk</code> for movement, <code>system.attributes.ac.bonus</code> for AC. Unmapped effects remain visible in the module API.</p><table><thead><tr><th>Stat</th><th>Main +0</th><th>Main +15</th><th>Sub enabled / fixed roll odds</th><th>Target</th><th>Flat multiplier</th></tr></thead><tbody>${stats}</tbody></table><label>Base crit threshold <input type="number" min="2" max="20" data-crit-base value="${c.crit.base}"></label><label>Crit rate points per expanded face <input type="number" min="0.01" step="any" data-crit-points value="${c.crit.pointsPerRange}"></label><footer><button type="button" data-save>Save configuration</button></footer></div>`)}
  activateListeners(html){super.activateListeners(html);
    html.find('[data-item-drop]').on('dragover',event=>{event.preventDefault();event.currentTarget.classList.add('is-dragover')}).on('dragleave',event=>event.currentTarget.classList.remove('is-dragover')).on('drop',async event=>{
      event.preventDefault();const zone=event.currentTarget;zone.classList.remove('is-dragover');
      let data;try{data=JSON.parse(event.originalEvent.dataTransfer.getData('text/plain')||'{}')}catch{return}
      const uuid=data.uuid||data.data?.uuid||(data.type==='Item'&&data.id?`Item.${data.id}`:'');
      const item=uuid?await fromUuid(uuid).catch(()=>null):null;
      if(item?.documentName!=='Item')return ui.notifications.warn('Drop an Item from the Items sidebar or a compendium.');
      zone.querySelector('input').value=uuid;zone.querySelector('.tp-drop-name').textContent=item.name;
      zone.dataset.itemName=item.name;
    });
    html.find("[data-add-mat]").on("click",()=>{this.capture(html);if(this.draft.materials.length>=3)return;this.draft.materials.push({uuid:"",xp:100});this.render(false)});
    html.find("[data-remove-mat]").on("click",e=>{this.capture(html);this.draft.materials.splice(Number(e.currentTarget.dataset.removeMat),1);this.render(false)});
    html.find("[data-add-set]").on("click",()=>{this.capture(html);this.draft.sets.push({id:foundry.utils.randomID(),name:"New Set",bonuses:[]});this.render(false)});
    html.find("[data-remove-set]").on("click",e=>{this.capture(html);this.draft.sets.splice(Number(e.currentTarget.dataset.removeSet),1);this.render(false)});
    html.find("[data-add-bonus]").on("click",e=>{this.capture(html);this.draft.sets[Number(e.currentTarget.dataset.addBonus)].bonuses.push({stat:SUBSTATS[0],value:1});this.render(false)});
    html.find("[data-remove-bonus]").on("click",e=>{const row=e.currentTarget.closest("[data-bonus]"),idx=Number(row.dataset.bonus),n=[...row.parentElement.children].indexOf(row);this.capture(html);this.draft.sets[idx].bonuses.splice(n,1);this.render(false)});
    html.find("[data-save]").on("click",async()=>{this.capture(html);this.draft.materials=this.draft.materials.filter(m=>m.uuid);await game.settings.set(ID,"config",this.draft);for(const a of game.actors)if(a.type==='character')await syncPlanarStats(a);ui.notifications.info("Planar configuration saved.");this.close()})
  }
  capture(h){const c=this.draft??config(),currency=h[0].querySelector('[data-item-drop="currency"]');c.currencyItem=currency?.querySelector('input')?.value??'';c.currencyName=currency?.dataset.itemName||currency?.querySelector('.tp-drop-name')?.textContent||'';c.currencyXp=Math.max(1,Math.floor(number(h.find('[data-currency-xp]').val(),1)));c.xpPerLevel=Math.max(1,Math.floor(number(h.find("[data-xp-level]").val(),100)));
    c.materials=[...h[0].querySelectorAll("[data-mat-row]")].slice(0,3).map(row=>({uuid:row.querySelector('[data-item-drop] input')?.value??'',name:row.querySelector('[data-item-drop]')?.dataset.itemName||row.querySelector('.tp-drop-name')?.textContent||'',xp:Math.max(1,Math.floor(number(row.querySelector("[data-mat-xp]").value)))}));
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
const statSyncs=new Map();
function syncPlanarStats(actor){
  const previous=statSyncs.get(actor.id)??Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>applyPlanarStatEffect(actor));statSyncs.set(actor.id,next);
  void next.finally(()=>{if(statSyncs.get(actor.id)===next)statSyncs.delete(actor.id)}).catch(()=>{});
  return next;
}
export function planarStatChanges(b,cfg){
  const changes=[],mode=CONST.ACTIVE_EFFECT_MODES.ADD;
  const add=(key,value)=>{if(Number.isFinite(value)&&value!==0)changes.push({key,mode,value:String(value),priority:30})};
  for(const key of ABILITIES)add(`system.abilities.${key}.value`,number(b[key]));
  for(const [stat,paths] of Object.entries({atkPct:['mwak','rwak','msak','rsak','spell'].map(k=>`system.bonuses.${k}.attack`),atkFlat:['mwak','rwak','msak','rsak','spell'].map(k=>`system.bonuses.${k}.attack`),hpPct:['system.attributes.hp.bonuses.overall'],hpFlat:['system.attributes.hp.bonuses.overall'],defPct:['system.attributes.ac.bonus'],defFlat:['system.attributes.ac.bonus']}))
    for(const path of paths)add(path,Math.floor(number(b[stat])));
  for(const [stat,value] of Object.entries(b)){
    if([...ABILITIES,'atkPct','atkFlat','hpPct','hpFlat','defPct','defFlat','breakEffect','energyRegen'].includes(stat))continue;
    if(stat==='savingThrow'){for(const key of ABILITIES)add(`system.abilities.${key}.bonuses.save`,Math.floor(number(value)));continue}
    if(stat==='effectHit'){for(const type of ['msak','rsak'])add(`system.bonuses.${type}.attack`,Math.floor(number(value)));continue}
    if(stat==='initiativeBonus'){add('system.attributes.init.bonus',Math.floor(number(value)));continue}
    const target=cfg.mapping[stat],delta=number(value)*number(cfg.flat?.[stat],1);
    if(ABILITIES.includes(target))add(`system.abilities.${target}.value`,delta);
    else if(/^system\.[a-zA-Z0-9_.]+$/.test(target)&&!target.includes('__proto__')&&!target.includes('constructor'))add(target,stat.endsWith('Pct')?Math.floor(delta):delta);
  }
  return changes;
}
async function applyPlanarStatEffect(actor){
  if(!game.user.isGM||actor?.type!=='character')return;
  const cfg=config(),b=bonuses(allItems(actor),cfg);
  for(const [key,value] of Object.entries(dynamicStats(actor,cfg)))b[key]=(b[key]??0)+value;
  const changes=planarStatChanges(b,cfg),existing=actor.effects.find(e=>e.getFlag(ID,'statBonus'));
  if(!changes.length){if(existing)await existing.delete();return}
  if(existing){if(JSON.stringify(existing.changes)!==JSON.stringify(changes))await existing.update({changes});return}
  await actor.createEmbeddedDocuments('ActiveEffect',[{name:'Planar ornament bonuses',img:'icons/magic/light/orb-sphere-gold.webp',changes,disabled:false,flags:{[ID]:{statBonus:true}}}]);
}
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
  // These main stats are flat D&D bonuses, including in worlds with older
  // percentage mappings saved in the configuration.
  const attack=Math.floor(number(b.atkPct));
  if(attack>0)for(const type of ["mwak","rwak","msak","rsak","spell"]){
    const bonus=model.bonuses?.[type];if(!bonus)continue;
    if(typeof bonus.attack==="string")bonus.attack=`${bonus.attack.trim()?`${bonus.attack.trim()} + `:""}${attack}`;
    else if(typeof bonus.attack==="number")bonus.attack+=attack;
  }
  const hp=Math.floor(number(b.hpPct));
  const hpBonus=model.attributes?.hp?.bonuses;
  if(hp>0&&hpBonus){
    const old=hpBonus.overall;
    if(typeof old==="string")hpBonus.overall=`${old.trim()?`${old.trim()} + `:""}${hp}`;
    else if(typeof old==="number")hpBonus.overall=old+hp;
  }
  const ac=Math.floor(number(b.defPct));
  if(ac>0&&model.attributes?.ac){
    const old=model.attributes.ac.bonus;
    if(typeof old==="number")model.attributes.ac.bonus=old+ac;
    else if(typeof old==="string")model.attributes.ac.bonus=`${old.trim()?`${old.trim()} + `:""}${ac}`;
  }
  const additions={};
  for(const [stat,value] of Object.entries(b)){
    if(["atkPct","hpPct","defPct"].includes(stat))continue;
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
function patchCharacter(){}
function openGenerator(){
  if(!game.user.isGM)return;
  const sets=config().sets;
  if(!sets.length)return ui.notifications.warn('A planar set is required.');
  const mainChoices=[...new Set([...SPHERE,...ROPE])].map(key=>`<label class="tp-main-choice" data-main-slot="${SPHERE.includes(key)?'sphere ':''}${ROPE.includes(key)?'rope':''}"><input type="checkbox" name="main" value="${key}"> ${esc(LABELS[key])}</label>`).join('');
  const subRows=Array.from({length:4},(_,index)=>`<label class="tp-sub-row" data-sub-row="${index}">Substat ${index+1} <select name="sub-${index}"><option value="">None</option>${SUBSTATS.map(key=>htmlOption(key,LABELS[key])).join('')}</select> <select name="bonus-${index}"><option value="1">+1</option><option value="2">+2</option><option value="3">+3</option></select></label>`).join('');
  const content=`<form class="tp-generate-form"><label>Planar set <select name="setId">${sets.map(s=>htmlOption(s.id,s.name)).join('')}</select></label><label>Piece <select name="slot"><option value="sphere">Planar Sphere</option><option value="rope">Link Rope</option></select></label><fieldset><legend>Main stat (choose one)</legend><div class="tp-main-choices">${mainChoices}</div></fieldset><label>Level <input type="number" name="level" min="0" max="15" step="1" value="0"></label><fieldset><legend>Substats (1 at +0; unlock another at +5, +10 and +15)</legend>${subRows}</fieldset><p>Speed bonuses use 5, 10, or 15 ft. Choose each desired substat before generating.</p></form>`;
  const read=html=>{const form=(html?.[0]??html)?.querySelector?.('.tp-generate-form');if(!form)return null;const level=Number(form.elements.level.value);const substats=[...form.querySelectorAll('[data-sub-row]')].filter(row=>!row.hidden).map(row=>{const key=row.querySelector('select[name^="sub-"]')?.value,tier=Number(row.querySelector('select[name^="bonus-"]')?.value);return key?{key,value:key==='speed'?tier*5:tier}:null}).filter(Boolean);return {setId:form.elements.setId.value,slot:form.elements.slot.value,main:form.querySelector('input[name="main"]:checked')?.value,level,substats}};
  return new Dialog({title:'Generate Planar Relic',content,buttons:{generate:{icon:'<i class="fas fa-hammer"></i>',label:'Generate Custom Relic',callback:html=>{const data=read(html);if(data)void send('generateCustom',data)}},random:{icon:'<i class="fas fa-dice"></i>',label:'Generate Random',callback:html=>{const data=read(html);if(data)void send('generate',{setId:data.setId,slot:data.slot})}}},default:'generate',render:html=>{
    const form=(html?.[0]??html)?.querySelector?.('.tp-generate-form');if(!form)return;
    const refresh=()=>{const slot=form.elements.slot.value,level=Math.max(0,Math.min(15,Number(form.elements.level.value)||0));for(const choice of form.querySelectorAll('[data-main-slot]')){choice.hidden=!choice.dataset.mainSlot.split(' ').includes(slot);if(choice.hidden)choice.querySelector('input').checked=false}for(const row of form.querySelectorAll('[data-sub-row]')){row.hidden=Number(row.dataset.subRow)>=customSubstatSlots(level);for(const input of row.querySelectorAll('select'))input.disabled=row.hidden}};
    form.addEventListener('change',event=>{if(event.target.matches('input[name="main"]')&&event.target.checked)for(const checkbox of form.querySelectorAll('input[name="main"]'))if(checkbox!==event.target)checkbox.checked=false;if(event.target.matches('[name="slot"], [name="level"]'))refresh()});form.elements.level.addEventListener('input',refresh);refresh();
  }}).render(true);
}
function sheetRoot(app,html){
  const element=html?.jquery?html[0]:html instanceof HTMLElement?html:null;
  const appElement=app?.element?.jquery?app.element[0]:app?.element;
  const enclosing=element?.closest?.('.application, .window-app, [data-appid]');
  const candidates=[element,enclosing,appElement].filter(x=>x instanceof HTMLElement);
  return candidates.find(x=>x.querySelector('nav.tabs[data-group="primary"], nav.sheet-tabs[data-group="primary"], .tabs-right nav.tabs')&&x.querySelector('.tab-body, .sheet-body, [data-application-part="body"]'))??enclosing??appElement??element;
}
function injectHub(app,html){
  const element=html?.jquery?html[0]:html instanceof HTMLElement?html:null;
  const root=[element,app?.element?.jquery?app.element[0]:app?.element].find(x=>x instanceof HTMLElement&&x.querySelector('.tsru-phone-button-field'));
  const field=root?.querySelector('.tsru-phone-button-field');if(!field)return;
  const removeLegacy=()=>root.querySelectorAll('.tp-hub-entry,.tp-gm-designer,.tp-phone-tile').forEach(element=>element.remove());
  removeLegacy();
  if(!root._telysPlanarLegacyObserver){
    const observer=new MutationObserver(removeLegacy);
    observer.observe(root,{childList:true,subtree:true});root._telysPlanarLegacyObserver=observer;
  }
  const actions={
    'planar-relics':()=>open(),
    'planar-config':()=>new ConfigWindow().render(true),
    'planar-generate':openGenerator,
    'planar-designer':()=>new PlanarDesigner().render(true)
  };
  for(const button of field.querySelectorAll('[data-hub-action^="planar-"]'))if(!game.user.isGM&&button.dataset.hubAction!=='planar-relics')button.hidden=true;
  if(field._telysPlanarActionsInstalled)return;
  field._telysPlanarActionsInstalled=true;
  field.addEventListener('click',event=>{
    const button=event.target.closest('[data-hub-action^="planar-"]');
    if(!button||!field.contains(button))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!game.user.isGM&&button.dataset.hubAction!=='planar-relics')return;
    actions[button.dataset.hubAction]?.();
  },true);
}
const PHONE_ACTIONS=[['planar-relics','Planar Relics (player)'],['planar-config','Planar Relics Config (GM)'],['planar-generate','Generate Planar Relics (GM)'],['planar-designer','Set Display Designer (GM)']];
function injectHubConfig(app,html){
  if(app.options?.id!=='tsru-hub-config')return;
  const element=html?.jquery?html[0]:html instanceof HTMLElement?html:null;
  const root=[element,app?.element?.jquery?app.element[0]:app?.element].find(x=>x instanceof HTMLElement&&x.querySelector('[data-hub-button-action]'));
  for(const select of root?.querySelectorAll('[data-hub-button-action]')??[]){
    for(const [value,label] of PHONE_ACTIONS)if(!select.querySelector(`option[value="${value}"]`))select.add(new Option(label,value));
    const index=Number(select.name.match(/^buttons\.(\d+)\.action$/)?.[1]);
    const selected=app.buttonsDraft?.[index]?.action;
    if(selected?.startsWith('planar-'))select.value=selected;
    const row=select.closest('[data-hub-button-editor]');
    row?.classList.toggle('is-gm-only',selected?.startsWith('planar-')&&selected!=='planar-relics');
    if(!select._telysPlanarConfigured){select._telysPlanarConfigured=true;select.addEventListener('change',()=>{
      queueMicrotask(()=>row?.classList.toggle('is-gm-only',select.value.startsWith('planar-')&&select.value!=='planar-relics'));
    })}
  }
}
function injectPlanarSheetTab(app,root,actor){
  if(root.querySelector('.tp-sheet-tab')||!editable(actor))return;
  const nav=root.querySelector('nav.tabs[data-group="primary"], nav.sheet-tabs[data-group="primary"], .tabs-right nav.tabs, nav.tabs, [role="tablist"]');
  const body=root.querySelector('.tab-body, .sheet-body, [data-application-part="body"], .sheet-content, .tab-content, .sheet-main');
  if(!nav||!body){
    const header=root.querySelector('.window-header, .sheet-header, header');if(!header)return;
    const button=document.createElement('button');button.type='button';button.className='tp-sheet-tab';button.textContent='Planar Relics';
    button.addEventListener('click',event=>{event.preventDefault();open(actor.id)});header.append(button);return;
  }
  const group=nav.dataset.group||nav.querySelector('[data-group]')?.dataset.group||'primary';
  const tab=document.createElement('a');tab.className='item control tp-sheet-tab';tab.dataset.action='tab';tab.dataset.tab='telys-planar';tab.dataset.group=group;tab.setAttribute('role','tab');tab.setAttribute('aria-label','Planar Relics');tab.title='Planar Relics';tab.innerHTML='<i class="fas fa-circle-nodes" aria-hidden="true"></i>';
  const panel=document.createElement('section');panel.className='tab tp-sheet-panel';panel.dataset.tab='telys-planar';panel.dataset.group=group;panel.hidden=true;
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
  const deactivate=()=>{
    if(panel.hidden&&!panel.classList.contains('active'))return;
    planarSheetOpen.set(app,false);tab.classList.remove('active');tab.setAttribute('aria-selected','false');panel.classList.remove('active');
    panel.hidden=true;panel.inert=true;panel.style.setProperty('display','none','important');
  };
  const activate=()=>{
    otherTabs.forEach(el=>{el.classList.remove('active');el.setAttribute('aria-selected','false')});
    // HSR inserts its settings tab elsewhere in the sheet root, outside .tab-body.
    // Its own tab handler clears every primary panel and the tsru-tab-open mode.
    root.querySelectorAll(`.tab[data-group="${group}"]`).forEach(el=>el.classList.remove('active'));
    root.classList.remove('tsru-tab-open');
    tab.classList.add('active');tab.setAttribute('aria-selected','true');panel.classList.add('active');panel.hidden=false;panel.inert=false;panel.style.removeProperty('display');
    if(app.tabGroups)app.tabGroups[group]='telys-planar';
  };
  root.addEventListener('click',event=>{
    const target=event.target.closest('[data-tab], [data-action="tab"]');
    if(!target)return;
    if(target===tab||target.closest('.tp-sheet-tab')){
      event.preventDefault();event.stopImmediatePropagation();planarSheetOpen.set(app,true);activate();
    }else deactivate();
  },true);
  nav.append(tab);body.append(panel);
  const observer=new MutationObserver(()=>{
    const anotherTab=[...nav.querySelectorAll('[data-tab]')].some(control=>control!==tab&&(control.classList.contains('active')||control.getAttribute('aria-selected')==='true'));
    if(anotherTab&&!tab.classList.contains('active'))deactivate();
  });
  observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
  if(planarSheetOpen.get(app))activate();else deactivate();
}
function injectSheet(app,html){const actor=app.actor??app.document;if(actor?.documentName!=='Actor'||actor.type!=="character")return;
  const root=sheetRoot(app,html);if(!root)return;
  injectPlanarSheetTab(app,root,actor);
  if(root.querySelector(".tp-ability-toggle"))return;
  const fields=Object.fromEntries(ABILITIES.map(key=>[`system.abilities.${key}.value`,foundry.utils.getProperty(actor._source,`system.abilities.${key}.value`)]));
  const holder=document.createElement("button");holder.type="button";holder.className="tp-ability-toggle";
  const rows=[];
  for(const [name,base] of Object.entries(fields)){
    const input=[...root.querySelectorAll("input[name]")].find(el=>el.name===name);
    if(!input||input.type==="hidden")continue;
    rows.push({input,base:String(base),buffed:String(foundry.utils.getProperty(actor,name)??input.value),locked:input.readOnly,disabled:input.disabled});
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
  render();
  root.append(holder);
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
  Hooks.on("renderApplication",(app,html)=>{injectHub(app,html);injectHubConfig(app,html)});
  Hooks.on('renderApplicationV2',(app,html)=>{injectHub(app,html);injectHubConfig(app,html);injectSheet(app,html);requestAnimationFrame(()=>{injectHub(app,app.element);injectHubConfig(app,app.element);injectSheet(app,app.element)})});
  Hooks.on("renderActorSheet",injectSheet);
  Hooks.on('renderCharacterActorSheet',injectSheet);
  Hooks.on('renderActorSheetV2',injectSheet);
  Hooks.on('updateSetting',setting=>{if(setting.key!==`${ID}.relics`)return;for(const actor of game.actors)if(actor.type==='character'){actor.prepareData();if(game.user.isGM){void syncHsrBonuses(actor).catch(error=>console.error(`${ID} | HSR bonus sync`,error));void syncPlanarStats(actor).catch(error=>console.error(`${ID} | Planar stat sync`,error))}if(actor.sheet?.rendered)actor.sheet.render(false)}window.TelysPlanar?.app?.render(false)});
  if(game.user.isGM)for(const actor of game.actors){void syncHsrBonuses(actor).catch(error=>console.error(`${ID} | HSR bonus sync`,error));void syncPlanarStats(actor).catch(error=>console.error(`${ID} | Planar stat sync`,error))}
  for(const event of ["createItem","updateItem","deleteItem"])Hooks.on(event,item=>{if(item.parent?.type==="character")void syncHsrBonuses(item.parent).catch(error=>console.error(`${ID} | HSR bonus sync`,error))});
  Hooks.on("updateActor",(actor,change)=>{if(foundry.utils.hasProperty(foundry.utils.expandObject(change),`flags.${HSR_ID}.ultimate`))void syncHsrBonuses(actor).catch(error=>console.error(`${ID} | HSR bonus sync`,error))});
  for(const event of ["createItem","updateItem","deleteItem"])Hooks.on(event,item=>{if(item.parent?.type!=="character"||!item.getFlag?.(ID,"relic"))return;
    for(const actor of game.actors)if(actor.type==="character"&&actor.id!==item.parent.id)actor.prepareData();
  });
  ui.notifications.info("Planar Ornaments ready.");
});
