import {ID,number} from './core.mjs';
import {equippedRelics} from './inventory.mjs';
const relic=item=>item.getFlag?.(ID,'relic')??item.flags?.[ID]?.relic;
export function activeSets(actor){
 const pieces=new Map();for(const item of equippedRelics(actor)){const r=relic(item);if(!r?.equipped)continue;let slots=pieces.get(r.setId);if(!slots){slots=new Map();pieces.set(r.setId,slots)}slots.set(r.slot,r)}
 return new Set([...pieces].filter(([,slots])=>slots.has('sphere')&&slots.has('rope')).map(([id])=>id));
}
export function hsr(actor){return game.modules.get('telys-star-rail-ultimates')?.api?.getConfig?.(actor)??actor.getFlag?.('telys-star-rail-ultimates','ultimate')??{}}
export function summoned(actor){const c=actor.getFlag?.('telys-memosprites','config');return !!(c?.summoned&&c?.summonedTokenId)}
export function summonerFor(actor){
 for(const scene of game.scenes??[])for(const token of scene.tokens??[]){
  if(token.actor?.id!==actor.id&&token.actorId!==actor.id)continue;
  const ownerId=token.getFlag?.('telys-memosprites','summonerId');if(ownerId)return game.actors.get(ownerId)
 }
 return null;
}
export function allyActors(actor){
 const combat=game.combat;if(!combat?.started)return [];
 const member=combat.combatants.find(c=>c.actor?.id===actor.id),side=member?.token?.disposition??member?.token?.document?.disposition;
 return combat.combatants.filter(c=>c.actor?.type==='character'&&number(c.actor.system?.attributes?.hp?.value)>0&&(c.token?.disposition??c.token?.document?.disposition)===side).map(c=>c.actor);
}
const subspaceCombatWearers=new Map();
function subspaceWearers(combat){
 if(!subspaceCombatWearers.has(combat.id))subspaceCombatWearers.set(combat.id,new Set(combat.combatants.filter(c=>c.actor&&activeSets(c.actor).has('329')&&number(c.actor.system?.attributes?.movement?.walk)>=45).map(c=>c.actor.id)));
 return subspaceCombatWearers.get(combat.id);
}
export function dynamicStats(actor,config){
 const result={},add=(k,v)=>{result[k]=(result[k]??0)+v};const sets=activeSets(actor),walk=number(actor.system?.attributes?.movement?.walk);
 const combatBuffs=actor.getFlag?.('telys-star-rail-ultimates','combatStatBuffs');
 if(game.combat?.started&&combatBuffs?.combatId===game.combat.id)for(const [key,value] of Object.entries(combatBuffs.planar??{}))add(key,number(value));
 if(sets.has('301')&&walk>=35)add('str',1);
 if(sets.has('303'))add('str',1);
 if(sets.has('304')&&number(actor._planarBonuses?.effectHit)>=2)add('dex',1);
 if(sets.has('307')&&walk>=45)add('breakEffect',1);
 if(sets.has('314')&&allyActors(actor).some(other=>other.id!==actor.id&&hsr(other).pathId&&hsr(other).pathId===hsr(actor).pathId))add('critRange',1);
 if(sets.has('327')&&allyActors(actor).some(other=>other.id!==actor.id&&other.getFlag?.(ID,'trailblazeCompanion')))add('critDamageBonus',2);
 if(sets.has('319')&&number(actor.system?.attributes?.hp?.max)>=60)add('critDamageBonus',1);
 if(sets.has('320')&&walk>=40)add('healing',walk>=55?2:1);
 if(sets.has('318')&&summoned(actor))add('critDamageBonus',2);
 if(sets.has('325')&&game.combat?.started&&game.modules.get('telys-star-rail-ultimates')?.active){const punchline=number(game.settings.get('telys-star-rail-ultimates','punchline'));if(punchline>=4)add('critDamageBonus',punchline>=8?2:1)}
 if(sets.has('328')){const max=number(hsr(actor).max);if(max>=59)add('damageFlat',2);else if(max>=41)add('damageFlat',1)}
 if(game.combat?.started&&game.combat.combatants.some(c=>c.actor?.id===actor.id)&&allyActors(actor).some(wearer=>subspaceWearers(game.combat).has(wearer.id)))add('breakEffect',1);
 // Party buffs never multiply the same named nonstacking set.
 let lushaka=false,amphoreus=false;
 for(const wearer of game.actors??[]){if(wearer.type!=='character'||wearer.id===actor.id)continue;const wsets=activeSets(wearer);
  if(wsets.has('302')&&number(wearer.system?.attributes?.movement?.walk)>=35)add('str',1);
  if(wsets.has('317')&&!lushaka&&equippedRelics(wearer).some(i=>relic(i)?.setId==='317'&&relic(i)?.targetActorId===actor.id)){add('str',1);lushaka=true}
  if(wsets.has('323')&&summoned(wearer)&&!amphoreus){add('speed',5);amphoreus=true}
  if(wsets.has('310')&&number(wearer._planarBonuses?.savingThrow)>=2&&!result.keelDice){add('critDamageBonus',1);result.keelDice=true}
 }
 delete result.keelDice;
 for(const [key,value] of Object.entries(temporaryStats(actor)))add(key,value);
 return result;
}
export function conditionalDamage(actor,workflow){
 const sets=activeSets(actor),speed=number(actor.system?.attributes?.movement?.walk),str=number(actor.system?.abilities?.str?.value),effects=[];
 const add=(name,amount,type)=>{if(amount>0)effects.push({label:name,amount,type})};
 const type=workflow.damageRoll?.options?.type||'untyped';
 if(sets.has('311')&&speed>=40)add('Glamoth',speed>=50?2:1,type);
 if(sets.has('321')){const n=allyActors(actor).length||4;add('Arcadia',n>4?Math.min(4,n-4):Math.min(3,4-n),type)}
 if(sets.has('328')){const energy=number(hsr(actor).max);add('Cosmic Life Sciences Institute',energy>=59?2:energy>=41?1:0,type)}
 if(sets.has('325')&&String(type).toLowerCase()==='elation')add('Punklorde Stage Zero',1,type);
 if(sets.has('315')&&state(actor).merit>0&&/follow[ -]?up/i.test(String(workflow.activity?.name??workflow.item?.name??'')))add('Duran',1,type);
 const threshold=number(workflow.attackRoll?.options?.criticalSuccess,20);
 if(sets.has('306')&&threshold<=11&&/ultimate|follow[ -]?up/i.test(String(workflow.activity?.name??workflow.item?.name??'')))add('Inert Salsotto',1,type);
 if(sets.has('309')&&threshold<=7&&/basic|skill/i.test(String(workflow.activity?.name??workflow.item?.name??'')))add('Rutilant Arena',1,type);
 if(sets.has('312'))for(const wearer of allyActors(actor))if(wearer.id!==actor.id&&activeSets(wearer).has('312')&&hsr(wearer).elementId&&hsr(wearer).elementId===hsr(actor).elementId){add('Penacony',1,type);break}
 if(sets.has('322')&&/dot|ongoing/i.test(String(workflow.activity?.name??workflow.item?.name??'')))add('Revelry',str>=22?2:str>=18?1:0,type);
 return effects;
}

const combatState=new Map();
function state(actor){const combatId=game.combat?.id??'none';const key=`${combatId}:${actor.id}`;if(!combatState.has(key))combatState.set(key,{sigonia:0,sigoniaTurns:0,merit:0,tengokuTurns:0,cityTurns:0,cityParty:false});return combatState.get(key)}
function fireWeak(target){
 const elements=game.modules.get('telys-star-rail-ultimates')?.active?game.settings.get('telys-star-rail-ultimates','elements'):[];
 const fireIds=new Set((elements??[]).filter(e=>/fire/i.test(e.name??e.id??'')).map(e=>e.id));fireIds.add('fire');
 const weakness=target?.getFlag?.('telys-star-rail-ultimates','toughness')?.weaknesses??[];
 return weakness.some(id=>fireIds.has(id));
}
export function firstAttackBonus(actor,critDice){
 if(!game.combat?.started||!activeSets(actor).has('305')||critDice<2)return 0;
 const s=state(actor);if(s.celestialUsed)return 0;s.celestialUsed=true;return 3;
}
export function temporaryStats(actor){if(!game.combat?.started)return {};const s=state(actor),sets=activeSets(actor),out={};
 if(sets.has('313')&&s.sigoniaTurns>0&&s.sigonia)out.critDamageBonus=s.sigonia>=2?2:1;
 if(sets.has('315')&&s.merit>=5)out.critDamageBonus=(out.critDamageBonus??0)+1;
 if(sets.has('324')&&s.tengokuTurns>0)out.critDamageBonus=(out.critDamageBonus??0)+2;
 if(sets.has('316')&&s.fireTurns>0)out.breakEffect=2;
 if(sets.has('326')&&s.cityTurns>0)out.str=1;
 if(s.cityParty)out.critDamageBonus=(out.critDamageBonus??0)+1;
 return out;
}
export function registerConditionHooks(){
 const refresh=()=>{for(const actor of game.actors)if(actor.type==='character')actor.prepareData()};
 const firstJoyTurn=async combat=>{
  if(!game.user.isGM||game.users.filter(user=>user.isGM&&user.active).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id!==game.user.id||!combat?.started)return;
  const combatant=combat.combatant,actor=combatant?.actor;
  if(!actor||combatant.getFlag?.(ID,'joyFirstTurn')||combatant.getFlag?.('telys-star-rail-ultimates','actionAdvance')||!activeSets(actor).has('330'))return;
  const api=game.modules.get('telys-star-rail-ultimates')?.api;
  if(typeof api?.setPunchline!=='function'||typeof api?.insertActionAdvanceTurn!=='function')return;
  await combatant.setFlag(ID,'joyFirstTurn',true);
  await api.setPunchline(4);
  await api.insertActionAdvanceTurn(combatant.id);
 };
 Hooks.on('combatStart',async combat=>{
  subspaceWearers(combat);
  const api=game.modules.get('telys-star-rail-ultimates')?.api;
  if(game.user.isGM&&typeof api?.insertActionAdvanceTurn==='function')for(const combatant of combat.combatants){const actor=combatant.actor;if(actor&&activeSets(actor).has('308')&&number(actor.system?.attributes?.movement?.walk)>=35)await api.insertActionAdvanceTurn(combatant.id)}
  await firstJoyTurn(combat);
 });
 Hooks.on('updateCombat',async(combat,change)=>{
  if(!('turn' in change)&&!('round' in change))return;
  const actor=combat.combatant?.actor;if(!actor||!combat.started)return;
  const s=state(actor),marker=`${combat.round}:${combat.combatant.id}`;if(s.lastTurn===marker)return;s.lastTurn=marker;
  if(s.sigoniaTurns>0&&--s.sigoniaTurns===0)s.sigonia=0;
  if(s.tengokuTurns>0)s.tengokuTurns--;
  if(s.cityTurns>0)s.cityTurns--;
  if(s.fireTurns>0)s.fireTurns--;
  s.skillSpent=0;s.lastSkillPoints=game.modules.get('telys-star-rail-ultimates')?.api?.getSkillPoints?.();
  refresh();
  await firstJoyTurn(combat);
 });
 Hooks.on('tsruSkillPointsChanged',(value)=>{
  const actor=game.combat?.combatant?.actor;if(!actor)return;
  const s=state(actor),previous=s.lastSkillPoints;s.lastSkillPoints=number(value);
  if(previous!==undefined&&previous>number(value))s.skillSpent=(s.skillSpent??0)+previous-number(value);
  if(s.skillSpent>=3&&activeSets(actor).has('324')){s.tengokuTurns=3;refresh()}
 });
 Hooks.on('midi-qol.RollComplete',workflow=>{
  const actor=workflow?.actor;if(!actor||!game.combat?.started)return;
  const s=state(actor),name=String(workflow.activity?.name??workflow.item?.name??'');
  const followUp=/follow[ -]?up/i.test(name);
  if(followUp){if(activeSets(actor).has('326'))s.cityTurns=2;
   for(const ally of allyActors(actor))if(activeSets(ally).has('315'))state(ally).merit=Math.min(5,state(ally).merit+1)}
  const list=workflow.damageList??[];
  if(activeSets(actor).has('316')&&[...(workflow.hitTargets??workflow.targets??[])].some(t=>fireWeak(t.actor??t.document?.actor))){s.fireTurns=1}
  for(const target of list){const oldHP=number(target.oldHP,NaN),newHP=number(target.newHP,NaN);
   if(!(oldHP>0&&newHP<=0))continue;
   const victim=target.actorId??target.tokenId??target.actor?.id;
   s.kills??=new Set();if(s.kills.has(victim))continue;s.kills.add(victim);
   if(activeSets(actor).has('313')){s.sigonia=Math.min(2,s.sigonia+1);s.sigoniaTurns=3}
   if(activeSets(actor).has('326'))for(const ally of allyActors(actor))state(ally).cityParty=true;
  }
  refresh();
 });
 Hooks.on('deleteCombat',combat=>{combatState.clear();subspaceCombatWearers.delete(combat.id);refresh()});
 Hooks.on('tsruPunchlineChanged',refresh);
}
