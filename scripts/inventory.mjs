import {ID} from './core.mjs';

export const storedRelics=()=>game.settings?.get?.(ID,'relics')??[];
export const ownerOf=entry=>entry.equippedActorId?game.actors.get(entry.equippedActorId):null;
export const relicFor=entry=>({...entry.relic,equipped:!!entry.equippedActorId});
export function asItem(entry){
  const value=relicFor(entry);
  return {id:entry.id,name:entry.name,img:entry.img,flags:{[ID]:{relic:value}},getFlag:(scope,key)=>scope===ID&&key==='relic'?value:undefined};
}
export function equippedRelics(actor){
  if(!actor)return [];
  const global=storedRelics().filter(entry=>entry.equippedActorId===actor.id).map(asItem);
  return [...(actor.items?.filter(item=>(item.getFlag?.(ID,'relic')??item.flags?.[ID]?.relic)?.equipped)??[]),...global];
}
export function allItems(actor){return [...(actor.items??[]),...equippedRelics(actor).filter(item=>!actor.items?.some(existing=>existing.id===item.id))]}
export function mergeLegacyRelics(inventory,source,makeId){
  const merged=structuredClone(inventory),known=new Set(merged.map(entry=>entry.migratedFrom));
  for(const {actorId,itemId,name,img,relic} of source){
    const migratedFrom=`${actorId}:${itemId}`;if(known.has(migratedFrom))continue;
    merged.push({id:makeId(),name,img,relic:structuredClone(relic),equippedActorId:relic.equipped?actorId:null,migratedFrom});known.add(migratedFrom);
  }
  return merged;
}
