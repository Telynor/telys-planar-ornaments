export const ID = "telys-planar-ornaments";
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const STATS = ["savingThrow", "initiativeBonus", "critRange", "critDamageDice", "str", "dex", "con", "int", "wis", "cha", "hpFlat", "atkFlat", "defFlat", "hpPct", "atkPct", "defPct", "speed", "speedPct", "critRate", "critDamage", "effectHit", "effectRes", "breakEffect", "energyRegen", "healing", "damagePct", "physical", "fire", "ice", "wind", "lightning", "quantum", "imaginary", "elation"];
export const SPHERE = ["hpPct", "atkPct", "defPct", "physical", "fire", "ice", "wind", "lightning", "quantum", "imaginary"];
export const ROPE = ["hpPct", "atkPct", "defPct", "breakEffect", "energyRegen", "healing"];
export const SUBSTATS = ["savingThrow", "initiativeBonus", "critRange", "critDamageDice", "str", "dex", "con", "int", "wis", "cha", "speed", "breakEffect", "effectHit"];
export const LABELS = {savingThrow:"Saving throw bonus",initiativeBonus:"Initiative bonus",critRange:"Crit range",critDamageDice:"Critical damage dice",str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma",hpFlat:"HP",atkFlat:"ATK",defFlat:"DEF",hpPct:"HP %",atkPct:"ATK %",defPct:"DEF %",speed:"Speed (ft)",speedPct:"Movement Speed %",critRate:"Crit Rate %",critDamage:"Crit Damage %",effectHit:"Effect Hit Rate",effectRes:"Effect RES %",breakEffect:"Break Effect",energyRegen:"Energy Regeneration",healing:"Outgoing Healing %",damagePct:"Damage %",physical:"Physical Damage",fire:"Fire Damage",ice:"Ice Damage",wind:"Wind Damage",lightning:"Lightning Damage",quantum:"Quantum Damage",imaginary:"Imaginary Damage",elation:"Elation Damage"};
export const DEFAULT_CONFIG = {
  sets:[],currencyItem:"",currencyXp:1,xpPerLevel:100,
  defaultLayout:{sphere:{x:51,y:58,scale:1.5},rope:{x:50,y:45,scale:1.9}},
  materials:[], // {uuid,xp}: owned inventory items and XP per copy
  main:{}, // {stat:{min,max}} values in points or percentage points
  sub:Object.fromEntries(SUBSTATS.map(key=>[key,{min:1,max:3,enabled:true}])),
  mapping:{hpPct:"con",atkPct:"str",defPct:"dex",hpFlat:"system.attributes.hp.bonuses.overall",atkFlat:"system.bonuses.mwak.attack",defFlat:"system.attributes.ac.bonus",speed:"system.attributes.movement.walk",speedPct:"system.attributes.movement.walk",critRate:"",critDamage:"",effectHit:"",effectRes:"",breakEffect:"",energyRegen:"",healing:"",physical:"",fire:"",ice:"",wind:"",lightning:"",quantum:"",imaginary:"",elation:"",damagePct:""},
  flat:{hpFlat:1,atkFlat:1,defFlat:1,speed:1},
  crit:{base:20,pointsPerRange:1}
};
export const number = (v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
export const currencyCost=(xp,currencyXp)=>Math.ceil(Math.max(0,number(xp))/Math.max(1,Math.floor(number(currencyXp,1))));
export const random = (array,rng=Math.random)=>array[Math.floor(rng()*array.length)];
export function generate(set,slot,config,rng=Math.random){
  if(!set || !["sphere","rope"].includes(slot))throw Error("Choose a set and a slot.");
  const stat=random(slot==="sphere"?SPHERE:ROPE,rng);
  return {setId:set.id,slot,level:0,xp:0,main:stat,sub:[],equipped:false};
}
export function generateCustom(set,slot,main,level,substats=[]){
  if(!set||!['sphere','rope'].includes(slot))throw Error('Choose a set and a piece.');
  if(!(slot==='sphere'?SPHERE:ROPE).includes(main))throw Error('Choose a valid main stat for that piece.');
  const n=Number(level);
  if(!Number.isInteger(n)||n<0||n>15)throw Error('Level must be between 0 and 15.');
  if(!Array.isArray(substats)||substats.length>Math.min(n,4))throw Error('Too many substats for this level.');
  const seen=new Set();
  const sub=substats.map(({key,value})=>{
    const v=Number(value);
    if(!SUBSTATS.includes(key)||key===main||seen.has(key))throw Error('Choose distinct valid substats.');
    if(!(key==='speed'?[5,10,15]:[1,2,3]).includes(v))throw Error('Choose a valid substat bonus.');
    seen.add(key);return {key,value:v,rolls:1};
  });
  return {setId:set.id,slot,level:n,xp:0,main,sub,equipped:false};
}
export function mainValue(relic,config){
  if(relic.main==="healing")return relic.level>=15?3:relic.level>=8?2:1;
  const bounds=config.main?.[relic.main]??{};
  const min=number(bounds.min),max=number(bounds.max,min);
  return min+(max-min)*Math.min(15,Math.max(0,number(relic.level)))/15;
}
export function nextSub(relic,config,rng=Math.random){
  const available=SUBSTATS.filter(k=>k!==relic.main&&config.sub?.[k]?.enabled!==false&&!relic.sub.some(s=>s.key===k));
  if(relic.sub.length<4&&available.length){
    const key=random(available,rng);
    relic.sub.push({key,value:rollSubstat(key,rng),rolls:1});
  }else if(relic.sub.length){
    const existing=random(relic.sub,rng);existing.value+=rollSubstat(existing.key,rng);existing.rolls++;
  }
}
export function rollSubstat(key,rng=Math.random){
  const value=rng(),tier=value<0.90?1:value<0.99?2:3;
  return key==="speed"?tier*5:tier;
}
export function advance(relic,xp,config,rng=Math.random){
  relic={...relic,sub:relic.sub.map(s=>({...s}))};
  const step=Math.max(1,Math.floor(number(config.xpPerLevel,100)));
  relic.xp=Math.max(0,number(relic.xp))+Math.max(0,Math.floor(number(xp)));
  while(relic.level<15&&relic.xp>=step){relic.level++;relic.xp-=step;nextSub(relic,config,rng)}
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

export function damageBreakdown(base,effects){
  const original=Math.max(0,number(base));
  const lines=effects.filter(e=>number(e.rate)>0).map(e=>({label:String(e.label),rate:number(e.rate),bonus:Math.floor(original*number(e.rate)/100)}));
  return {base:original,lines,total:original+lines.reduce((sum,line)=>sum+line.bonus,0)};
}
export function arcadiaRate(allies){
  const diff=Math.floor(number(allies,4))-4;
  return diff>0?Math.min(4,diff)*9:Math.min(3,Math.abs(diff))*12;
}
export function criticalThreshold(baseThreshold, bonusPoints, rng=Math.random){
  const base=Math.max(2,Math.min(20,Math.floor(number(baseThreshold,20))));
  return Math.max(2,base-Math.max(0,Math.floor(number(bonusPoints))));
}
export function critBonusSources(items,config){
  const equipped=items.map(item=>item.flags?.[ID]?.relic).filter(r=>r?.equipped);
  let count=0;
  for(const relic of equipped){
    if(relic.main==="critRate"&&mainValue(relic,config)>0)count++;
    count+=relic.sub.filter(sub=>["critRate","critRange"].includes(sub.key)&&number(sub.value)>0).reduce((n,sub)=>n+(sub.key==="critRange"?Math.floor(number(sub.value)):1),0);
  }
  for(const set of config.sets??[]){
    const pieces=equipped.filter(r=>r.setId===set.id);
    if(pieces.some(r=>r.slot==="sphere")&&pieces.some(r=>r.slot==="rope"))
      count+=(set.bonuses??[]).filter(b=>["critRate","critRange"].includes(b.stat)&&number(b.value)>0).reduce((n,b)=>n+(b.stat==="critRange"?Math.floor(number(b.value)):1),0);
  }
  return count;
}
export const ELEMENT_DAMAGE_TYPES={physical:["bludgeoning","piercing","slashing"],fire:["fire"],ice:["cold"],wind:["thunder"],lightning:["lightning"],quantum:["force"],imaginary:["psychic"],elation:["psychic"]};
export function elementalDamageBonus(relic){return relic.level>=15?3:relic.level>=8?2:1}
