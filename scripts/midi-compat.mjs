export function primaryDamageRolls(workflow){
  if(Array.isArray(workflow?.damageRolls)&&workflow.damageRolls.length)return workflow.damageRolls;
  return workflow?.damageRoll?[workflow.damageRoll]:[];
}

// Preserve separate damage types. Midi 14.6's legacy setDamageRoll flattens
// the array and does not await setDamageRolls; prefer the plural API.
export async function applyDamageBonuses(workflow,bonuses,env=globalThis){
  const api=env.MidiQOL,rolls=primaryDamageRolls(workflow);
  if(!rolls.length||typeof api?.addRollTo!=="function")throw Error("Midi-QOL evaluated roll modifier API unavailable.");
  const additions=bonuses.filter(b=>Number.isFinite(b.amount)&&b.amount!==0);
  if(!additions.length)return;
  if(typeof workflow.setDamageRolls==="function"){
    const next=rolls.slice();
    for(const bonus of additions){
      const type=bonus.type||rolls[0].options?.type||workflow.defaultDamageType||"none";
      const RollClass=env.CONFIG?.Dice?.DamageRoll??env.Roll;
      const added=await new RollClass(String(bonus.amount),{}, {type}).evaluate();
      const index=next.findIndex(r=>(r.options?.type||"none")===type);
      if(index<0)next.push(added);else next[index]=api.addRollTo(next[index],added);
    }
    await workflow.setDamageRolls(next);
    return;
  }
  if(typeof workflow.setDamageRoll!=="function")throw Error("Midi-QOL evaluated roll setter unavailable.");
  const formula=additions.map(b=>`${b.amount}[${String(b.type||rolls[0].options?.type||"untyped").replace(/[\[\]]/g,"")}]`).join(" + ");
  const added=await new env.Roll(formula).evaluate();
  await workflow.setDamageRoll(api.addRollTo(rolls[0],added));
}
