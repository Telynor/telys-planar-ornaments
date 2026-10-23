export function systemPath(path,env=globalThis) {
  if(Number(String(env.game?.system?.version??"5").split(".")[0])<6)return path;
  return path
    .replace(/^(system\.abilities\.[^.]+)\.bonuses\.(check|save)$/, "$1.$2.roll.bonus")
    .replace(/^(system\.(?:skills|tools)\.[^.]+)\.bonuses\.check$/, "$1.roll.bonus")
    .replace(/^system\.bonuses\.(mwak|rwak|msak|rsak)\.(attack|damage)$/, "system.rolls.$2.$1.bonus")
    .replace(/^system\.bonuses\.abilities\.(check|save|skill)$/, "system.rolls.ability.$1.bonus")
    .replace(/^system\.attributes\.init\.bonus$/, "system.attributes.init.roll.bonus")
    .replace(/^(system\.attributes\.movement)\.(walk|fly|swim|climb|burrow|jump)$/, "$1.speeds.$2");
}
const changeTypes=["custom","multiply","add","downgrade","upgrade","override"];
export function typedChanges(changes) {
  return changes.map(c=>({key:systemPath(c.key),type:c.type??changeTypes[c.mode]??"add",value:String(c.value??""),priority:Number(c.priority??20)}));
}
export function effectChanges(effect) {
  return (effect?.system?.changes??effect?.changes??[]).map(c=>({key:c.key,mode:c.mode??changeTypes.indexOf(c.type),value:String(c.value??""),priority:Number(c.priority??20)}));
}
export function effectSystem(changes){return {changes:typedChanges(changes)};}
export function addAttackBonus(system,amount,{spellOnly=false}={}) {
  if(!Number(amount))return;
  for(const key of spellOnly?["msak","rsak"]:["mwak","rwak","msak","rsak"]){
    const modern=system.rolls?.attack?.[key],legacy=system.bonuses?.[key];
    const target=modern??legacy,field=modern?"bonus":"attack";
    if(target)target[field]=`(${target[field]||0}) + ${amount}`;
  }
}
