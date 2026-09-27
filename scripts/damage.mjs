import {ID,number,damageBreakdown,arcadiaRate} from './core.mjs';
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
    if(set.id==='arcadia-of-woven-dreams'||set.name==='Arcadia of Woven Dreams'){
      const rate=arcadiaRate(alliesInCombat(actor));if(rate)effects.push({label:`${set.name} (${alliesInCombat(actor)} allies)`,rate});
    }
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
    if(['healing','temphp'].includes(roll.options?.type))return;
    const effects=activeDamageEffects(workflow.actor,getConfig());if(!effects.length)return;
    processed.add(workflow);
    const details=damageBreakdown(roll.total,effects),extra=details.total-details.base;
    if(extra<=0)return;
    try{
      const api=globalThis.MidiQOL;
      if(typeof api?.addRollTo!=='function'||typeof workflow.setDamageRoll!=='function')throw Error('Midi-QOL evaluated roll modifier API unavailable.');
      const added=await new Roll(effects.map(e=>`${Math.floor(details.base*e.rate/100)}[${e.label.replace(/[\[\]]/g,'')}]`).filter(s=>!s.startsWith('0[')).join(' + ')).evaluate();
      const combined=api.addRollTo(roll,added);
      await workflow.setDamageRoll(combined);
      await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:workflow.actor}),content:breakdownHtml(workflow.actor,details),flags:{[ID]:{breakdown:details}}});
    }catch(error){processed.delete(workflow);console.error(`${ID} | Damage modifier failed`,error);ui.notifications.error('Planar damage modifier could not be applied; original damage remains.');}
  });
}
