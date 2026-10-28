import {ABILITIES,ID,number} from './core.mjs';
import {systemPath,effectChanges} from './system-compat.mjs';
const HSR='telys-star-rail-ultimates',modes=new WeakMap(),bindings=new WeakMap();
const get=(object,path)=>foundry.utils.getProperty(object,path);

export function originalSaveTotal(current,baseScore,buffedScore,flatSaveBonus=0){
  return number(current)-(Math.floor((number(buffedScore,10)-10)/2)-Math.floor((number(baseScore,10)-10)/2))-number(flatSaveBonus);
}

// Native 5e uses a filigree-box, not a section. Its containing section is the
// two-column details grid: inserting a summary there displaces both columns.
export function savingThrowPanel(root){
  const details=root.querySelector('.tab[data-tab="details"], [data-application-part="details"]')??root;
  const safe=node=>node&&!node.matches('.tab,.col-2,.left,.right,.top,.rows,.tab-body,.sheet-body,.window-content,.application,.window-app,[data-application-part="body"]');
  const native=details.querySelector('filigree-box.saves,.saves,.saving-throws,[data-section="saving-throws"]');
  if(safe(native))return native;
  const heading=[...details.querySelectorAll('h2,h3,h4,.section-title,.card-header')].find(node=>/^saving throws$/i.test(node.textContent.trim()));
  for(const node of [heading?.closest('filigree-box,.card,section'),heading?.parentElement])if(safe(node))return node;
  return null;
}

const modifier=node=>{
  const value=String(node?.textContent??'').replace(/\s/g,'').replaceAll('−','-');
  return /^[+-]?\d+$/.test(value)?Number(value):NaN;
};
function modifierHTML(element,total){
  const copy=element.cloneNode(true),sign=copy.querySelector('.sign');
  if(sign){
    sign.textContent=total<0?'-':'+';
    const numeric=[...copy.childNodes].find(node=>node.nodeType===3&&/\d/.test(node.textContent));
    if(numeric){numeric.textContent=numeric.textContent.replace(/[+-]?\d+/,String(Math.abs(total)));return copy.innerHTML;}
  }
  copy.textContent=`${total>=0?'+':''}${total}`;return copy.innerHTML;
}

export function injectSheetStats(root,actor,controls){
  const frame=root.closest('.application,.window-app')??root;
  const previous=bindings.get(frame),prior=previous?.actor===actor?previous:null;
  const fields=Object.fromEntries([...ABILITIES.map(key=>[`system.abilities.${key}.value`,get(actor._source,`system.abilities.${key}.value`)]),[systemPath('system.attributes.movement.walk'),get(actor._source,systemPath('system.attributes.movement.walk'))],['system.attributes.ac.bonus',get(actor._source,'system.attributes.ac.bonus')]]);
  const rows=[];
  for(const [name,base]of Object.entries(fields)){
    const input=[...root.querySelectorAll('input[name]')].find(node=>node.name===name);
    if(!input||input.type==='hidden')continue;
    const old=prior?.rows.find(row=>row.input===input);
    rows.push({input,base:String(base??0),buffed:String(get(actor,name)??input.value),locked:old?.locked??input.readOnly,disabled:old?.disabled??input.disabled});
  }
  for(const [field,label]of [['breakEffectScore','Break Effect ability score'],['regenScore','Energy Regen ability score']]){
    const input=root.querySelector(`input[aria-label="${label}"]`);if(!input)continue;
    const old=prior?.rows.find(row=>row.input===input);
    rows.push({input,base:String(number(get(actor._source,`flags.${HSR}.ultimate.${field}`),10)),buffed:old?.buffed??String(input.value),locked:old?.locked??input.readOnly,disabled:old?.disabled??input.disabled});
  }
  const header=frame.querySelector('.window-header,.window-header-container,[data-application-part="header"]');
  if(!rows.length||!header){frame.querySelector('.tp-ability-toggle')?.remove();frame.querySelectorAll('.tp-original-saves').forEach(node=>node.remove());bindings.delete(frame);return;}
  const holder=frame.querySelector('.tp-ability-toggle')??document.createElement('button');
  holder.type='button';holder.className='header-control icon tsru-actor-header-control tp-ability-toggle';holder.dataset.actorControl='planar-stats';holder.dataset.actorControlOrder='45';
  const panel=savingThrowPanel(root),saveRows=[];
  frame.querySelectorAll('.tp-original-saves').forEach(node=>node.remove());
  const changes=effectChanges(actor.effects?.find(effect=>effect.getFlag(ID,'statBonus')));
  const flatFor=key=>{
    const matching=changes.filter(change=>[systemPath(`system.abilities.${key}.bonuses.save`),`system.abilities.${key}.bonuses.save`].includes(change.key));
    return matching.length?matching.reduce((sum,change)=>sum+number(change.value),0):number(actor._planarBonuses?.savingThrow);
  };
  const totalFor=key=>{const save=actor.system.abilities[key]?.save;return number(typeof save==='number'?save:save?.value??save?.total,NaN);};
  for(const key of ABILITIES){
    const label={str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'}[key];
    const row=panel?.querySelector(`[data-ability="${key}"],[data-key="${key}"],[data-ability-id="${key}"]`)
      ??[...panel?.querySelectorAll('li,.saving-throw,.save')??[]].find(node=>new RegExp(`^(${key}|${label})\\b`,'i').test(node.textContent.trim()));
    const value=[...row?.querySelectorAll('.bonus,.mod,.value,[data-save-value],span,strong,button')??[]].find(node=>Number.isFinite(modifier(node)));
    if(!value)continue;
    const old=prior?.saveRows.find(entry=>entry.element===value),buffed=number(totalFor(key),old?.buffed??modifier(value));
    const original=originalSaveTotal(buffed,fields[`system.abilities.${key}.value`],actor.system.abilities[key]?.value,flatFor(key));
    saveRows.push({key,element:value,buffed,buffedHTML:modifierHTML(value,buffed),originalHTML:modifierHTML(value,original)});
  }
  const summary=document.createElement('div');summary.className='tp-original-saves';
  if(panel)for(const key of ABILITIES){
    if(saveRows.some(row=>row.key===key))continue;
    const total=totalFor(key);if(!Number.isFinite(total))continue;
    const original=originalSaveTotal(total,fields[`system.abilities.${key}.value`],actor.system.abilities[key]?.value,flatFor(key));
    const chip=document.createElement('span');chip.textContent=`${key.toUpperCase()} ${original>=0?'+':''}${original}`;summary.append(chip);
  }
  if(summary.childElementCount)panel.prepend(summary);
  let boosted=modes.get(actor)==='boosted';
  const render=()=>{
    holder.innerHTML='<i class="fas '+(boosted?'fa-chart-line':'fa-pencil')+'" aria-hidden="true"></i>';
    holder.setAttribute('aria-label',boosted?'Buffed stats — switch to original stats':'Original stats — switch to buffed stats');holder.setAttribute('aria-pressed',String(boosted));holder.title=boosted?'Show original scores to edit them':'Show scores after planar buffs';
    for(const row of rows){row.input.value=boosted?row.buffed:row.base;row.input.readOnly=boosted||row.locked;row.input.disabled=boosted||row.disabled;row.input.classList.toggle('tp-buffed-field',boosted);}
    for(const row of saveRows)row.element.innerHTML=boosted?row.buffedHTML:row.originalHTML;
    summary.hidden=boosted;
  };
  // A native partial render may replace the body while retaining the header.
  // Rebind that same button to the live fields instead of keeping stale nodes.
  holder.onclick=()=>{if(!boosted)for(const row of rows)row.base=row.input.value;boosted=!boosted;modes.set(actor,boosted?'boosted':'original');render();};
  bindings.set(frame,{actor,rows,saveRows});render();
  (controls??header.querySelector('[data-tsru-actor-controls]')??header).append(holder);
  if(controls)for(const node of [...controls.children].sort((a,b)=>Number(a.dataset.actorControlOrder??99)-Number(b.dataset.actorControlOrder??99)))controls.append(node);
}
