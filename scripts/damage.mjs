import {ID,number,damageBreakdown,ELEMENT_DAMAGE_TYPES,elementalDamageBonus,bonuses} from './core.mjs';
import {dynamicStats,conditionalDamage,summonerFor,activeSets} from './effects.mjs';
const processed=new WeakSet();
const relic=item=>item.getFlag?.(ID,'relic');
const escape=s=>foundry.utils.escapeHTML(String(s??''));
function alliesInCombat(actor){
  const combat=game.combat;if(!combat)return 4;
  const wearer=combat.combatants.find(c=>c.actor?.id===actor.id);
  const side=wearer?.token?.disposition??wearer?.token?.document?.disposition;
  if(side===undefined)return combat.combatants.filter(c=>c.actor?.type==='character'&&number(c.actor.system.attributes.hp.value)>0).length;
  return combat.combatants.filter(c=>c.actor&&number(c.actor.system.attributes.hp.value)>0&&(c.token?.disposition??c.token?.document?.disposition)===side).length;
}
export function activeDamageEffects(actor,config){
  const slots=new Map();
  for(const item of actor.items){const r=relic(item);if(!r?.equipped)continue;
    const entry=slots.get(r.setId)??new Set();entry.add(r.slot);slots.set(r.setId,entry)}
  const effects=[];
  for(const set of config.sets){const pair=slots.get(set.id);if(!pair?.has('sphere')||!pair.has('rope'))continue;
    for(const bonus of set.bonuses??[])if(bonus.stat==='damagePct')effects.push({label:set.name,rate:number(bonus.value)});
  }
  return effects;
}
function breakdownHtml(actor,details){
  const rows=details.lines.map(line=>`<tr><td>${escape(line.label)} (${line.rate}%)</td><td>+${line.bonus}</td></tr>`).join('');
  return `<div class="tp-damage-breakdown"><h3>Planar damage · ${escape(actor.name)}</h3><table><tr><td>Rolled damage</td><td>${details.base}</td></tr>${rows}<tr><th>Damage before target mitigation</th><th>${details.total}</th></tr></table></div>`;
}
export function registerDamageHooks(getConfig){
  Hooks.on('midi-qol.DamageRollComplete',async workflow=>{
    if(!workflow?.actor||processed.has(workflow))return;
    const roll=workflow.damageRoll;if(!roll||!Number.isFinite(roll.total)||roll.total<=0)return;
    if(roll.options?.type==='healing'){
      const owner=summonerFor(workflow.actor),ownerHealing=owner&&activeSets(owner).has('320')?(number(owner.system?.attributes?.movement?.walk)>=55?2:number(owner.system?.attributes?.movement?.walk)>=40?1:0):0;
      const amount=Math.max(0,Math.floor(number(bonuses(workflow.actor.items,getConfig()).healing)+number(dynamicStats(workflow.actor,getConfig()).healing)+ownerHealing));
      if(!amount)return;
      processed.add(workflow);
      try{
        const api=globalThis.MidiQOL;
        if(typeof api?.addRollTo!=='function'||typeof workflow.setDamageRoll!=='function')throw Error('Midi-QOL healing roll modifier API unavailable.');
        const added=await new Roll(`${amount}[healing]`).evaluate();
        await workflow.setDamageRoll(api.addRollTo(roll,added));
      }catch(error){processed.delete(workflow);console.error(`${ID} | Healing modifier failed`,error)}
      return;
    }
    if(roll.options?.type==='temphp')return;
    const cfg=getConfig(),effects=activeDamageEffects(workflow.actor,cfg);
    const typed=[];
    for(const item of workflow.actor.items){const r=relic(item);if(!r?.equipped||r.slot!=='sphere'||!ELEMENT_DAMAGE_TYPES[r.main])continue;
      const types=ELEMENT_DAMAGE_TYPES[r.main];
      const terms=roll.terms?.filter(t=>t?.options?.damageType&&types.includes(t.options.damageType));
      if(terms?.length||types.includes(roll.options?.type))typed.push({label:`${item.name} (${r.main})`,amount:elementalDamageBonus(r),type:types.includes(roll.options?.type)?roll.options.type:terms[0].options.damageType});
    }
    typed.push(...conditionalDamage(workflow.actor,workflow));
    const owner=summonerFor(workflow.actor);if(owner&&activeSets(owner).has('321'))typed.push(...conditionalDamage(owner,workflow).filter(e=>e.label==='Arcadia'));
    const ownerDice=owner&&activeSets(owner).has('319')&&number(owner.system?.attributes?.hp?.max)>=60?1:0;
    const critDice=Math.max(0,Math.floor(number(bonuses(workflow.actor.items,cfg).critDamageDice)+number(dynamicStats(workflow.actor,cfg).critDamageDice)+ownerDice));
    const isCrit=Boolean(workflow.isCritical||workflow.attackRoll?.isCritical);
    const die=roll.terms?.find(t=>Number.isInteger(t.faces)&&t.faces>=2)?.faces;
    if(!effects.length&&!typed.length&&!(isCrit&&critDice&&die))return;
    processed.add(workflow);
    const details=damageBreakdown(roll.total,effects),extra=details.total-details.base;
    if(extra<=0&&!typed.length&&!(isCrit&&critDice&&die))return;
    try{
      const api=globalThis.MidiQOL;
      if(typeof api?.addRollTo!=='function'||typeof workflow.setDamageRoll!=='function')throw Error('Midi-QOL evaluated roll modifier API unavailable.');
      const parts=effects.map(e=>`${Math.floor(details.base*e.rate/100)}[${e.label.replace(/[\[\]]/g,'')}]`).filter(s=>!s.startsWith('0['));
      for(const bonus of typed)parts.push(`${bonus.amount}[${bonus.type}]`);
      if(isCrit&&critDice&&die)parts.push(`${critDice}d${die}[${roll.options?.type||'untyped'}]`);
      const added=await new Roll(parts.join(' + ')).evaluate();
      const combined=api.addRollTo(roll,added);
      await workflow.setDamageRoll(combined);
      await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:workflow.actor}),content:`${breakdownHtml(workflow.actor,details)}${typed.map(x=>`<p>${escape(x.label)}: +${x.amount} ${escape(x.type)}</p>`).join('')}${isCrit&&critDice&&die?`<p>Planar critical damage: +${critDice}d${die}</p>`:''}`,flags:{[ID]:{breakdown:details}}});
    }catch(error){processed.delete(workflow);console.error(`${ID} | Damage modifier failed`,error);ui.notifications.error('Planar damage modifier could not be applied; original damage remains.');}
  });
}
