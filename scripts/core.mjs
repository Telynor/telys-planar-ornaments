export const ID = "telys-planar-ornaments";
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const STATS = ["hpFlat", "atkFlat", "defFlat", "hpPct", "atkPct", "defPct", "speed", "critRate", "critDamage", "effectHit", "effectRes", "breakEffect", "energyRegen", "healing", "physical", "fire", "ice", "wind", "lightning", "quantum", "imaginary"];
export const SPHERE = ["hpPct", "atkPct", "defPct", "physical", "fire", "ice", "wind", "lightning", "quantum", "imaginary"];
export const ROPE = ["hpPct", "atkPct", "defPct", "breakEffect", "energyRegen"];
export const SUBSTATS = ["hpFlat", "atkFlat", "defFlat", "hpPct", "atkPct", "defPct", "speed", "critRate", "critDamage", "effectHit", "effectRes", "breakEffect"];
export const LABELS = {hpFlat:"HP",atkFlat:"ATK",defFlat:"DEF",hpPct:"HP %",atkPct:"ATK %",defPct:"DEF %",speed:"Speed",critRate:"Crit Rate %",critDamage:"Crit Damage %",effectHit:"Effect Hit Rate %",effectRes:"Effect RES %",breakEffect:"Break Effect %",energyRegen:"Energy Regeneration %",healing:"Outgoing Healing %",physical:"Physical Damage %",fire:"Fire Damage %",ice:"Ice Damage %",wind:"Wind Damage %",lightning:"Lightning Damage %",quantum:"Quantum Damage %",imaginary:"Imaginary Damage %"};
export const DEFAULT_CONFIG = {
  sets:[],currencyItem:"",creditCostPerXp:1,xpPerLevel:100,
  materials:[], // {uuid,xp}: owned inventory items and XP per copy
  main:{}, // {stat:{min,max}} values in points or percentage points
  sub:Object.fromEntries(SUBSTATS.map(key=>[key,{min:1,max:3,enabled:true}])),
  mapping:{hpPct:"con",atkPct:"str",defPct:"dex",hpFlat:"system.attributes.hp.bonuses.overall",atkFlat:"system.bonuses.mwak.attack",defFlat:"system.attributes.ac.bonus",speed:"system.attributes.movement.walk",critRate:"",critDamage:"",effectHit:"",effectRes:"",breakEffect:"",energyRegen:"",healing:"",physical:"",fire:"",ice:"",wind:"",lightning:"",quantum:"",imaginary:""},
  flat:{hpFlat:1,atkFlat:1,defFlat:1,speed:1},
  crit:{base:20,pointsPerRange:1}
};
export const number = (v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
export const random = (array,rng=Math.random)=>array[Math.floor(rng()*array.length)];
export function generate(set,slot,config,rng=Math.random){
  if(!set || !["sphere","rope"].includes(slot))throw Error("Choose a set and a slot.");
  const stat=random(slot==="sphere"?SPHERE:ROPE,rng);
  return {setId:set.id,slot,level:0,xp:0,main:stat,sub:[],equipped:false};
}
export function mainValue(relic,config){
  const bounds=config.main?.[relic.main]??{};
  const min=number(bounds.min),max=number(bounds.max,min);
  return min+(max-min)*Math.min(15,Math.max(0,number(relic.level)))/15;
}
export function nextSub(relic,config,rng=Math.random){
  const available=SUBSTATS.filter(k=>k!==relic.main&&config.sub?.[k]?.enabled!==false&&!relic.sub.some(s=>s.key===k));
  if(relic.sub.length<4&&available.length){
    const key=random(available,rng),bounds=config.sub?.[key]??{};
    relic.sub.push({key,value:roll(bounds,rng),rolls:1});
  }else if(relic.sub.length){
    const existing=random(relic.sub,rng);existing.value+=roll(config.sub?.[existing.key]??{},rng);existing.rolls++;
  }
}
function roll(bounds,rng){const min=number(bounds.min,1),max=Math.max(min,number(bounds.max,min));return min+(max-min)*rng()}
export function advance(relic,xp,config,rng=Math.random){
  relic={...relic,sub:relic.sub.map(s=>({...s}))};
  const step=Math.max(1,Math.floor(number(config.xpPerLevel,100)));
  relic.xp=Math.max(0,number(relic.xp))+Math.max(0,Math.floor(number(xp)));
  while(relic.level<15&&relic.xp>=step){relic.level++;relic.xp-=step;if(relic.level%3===0)nextSub(relic,config,rng)}
  if(relic.level===15)relic.xp=0;
  return relic;
}
export function bonuses(items,config){
  const result={};const bySet={};
  for(const item of items){const r=item.flags?.[ID]?.relic;if(!r?.equipped)continue;
    result[r.main]=(result[r.main]??0)+mainValue(r,config);
    for(const sub of r.sub)result[sub.key]=(result[sub.key]??0)+number(sub.value);
    (bySet[r.setId]??=[]).push(r.slot);
  }
  for(const [id,slots] of Object.entries(bySet))if(slots.includes("sphere")&&slots.includes("rope")){
    const set=config.sets.find(s=>s.id===id);for(const bonus of set?.bonuses??[])result[bonus.stat]=(result[bonus.stat]??0)+number(bonus.value);
  }
  return result;
}
export function splitInputs(text){return String(text??"").split(",").map(s=>s.trim()).filter(Boolean)}
