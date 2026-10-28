import {ID} from './core.mjs';
import {activePath,assignedTo,assignmentPaths} from './path-loadouts.mjs';

export const storedRelics=()=>game.settings?.get?.(ID,'relics')??[];
export const ownerOf=entry=>entry.equippedActorId?game.actors.get?.(entry.equippedActorId)??game.actors.find?.(a=>a.id===entry.equippedActorId):null;
export const relicFor=(entry,actor=ownerOf(entry),pathId=activePath(actor))=>({...entry.relic,equipped:actor?assignedTo(entry,actor,pathId):!!entry.equippedActorId,targetActorId:entry.pathTargets?.[pathId]??entry.relic.targetActorId});
export function asItem(entry,actor,pathId){
  const value=relicFor(entry,actor,pathId);
  return {id:entry.id,name:entry.name,img:entry.img,flags:{[ID]:{relic:value}},getFlag:(scope,key)=>scope===ID&&key==='relic'?value:undefined};
}
export function equippedRelics(actor,pathId=activePath(actor)){
  if(!actor)return [];
  const global=storedRelics().filter(entry=>assignedTo(entry,actor,pathId)).map(entry=>asItem(entry,actor,pathId));
  return [...(actor.items?.filter(item=>{const r=item.getFlag?.(ID,'relic')??item.flags?.[ID]?.relic;return r?.equipped&&assignmentPaths(r,actor).includes(pathId)})??[]),...global];
}
export function allItems(actor){
  const equipped=equippedRelics(actor),active=new Set(equipped.map(item=>item.id));
  const inventory=(actor.items??[]).map(item=>{
    const r=item.getFlag?.(ID,'relic')??item.flags?.[ID]?.relic;if(!r||active.has(item.id))return item;
    const value={...r,equipped:false};return {id:item.id,name:item.name,system:item.system,flags:{...item.flags,[ID]:{...item.flags?.[ID],relic:value}},getFlag:(scope,key)=>scope===ID&&key==='relic'?value:item.getFlag?.(scope,key)};
  });
  return [...inventory,...equipped.filter(item=>!actor.items?.some(existing=>existing.id===item.id))];
}
export function mergeLegacyRelics(inventory,source,makeId){
  const merged=structuredClone(inventory),known=new Set(merged.map(entry=>entry.migratedFrom));
  for(const {actorId,itemId,name,img,relic} of source){
    const migratedFrom=`${actorId}:${itemId}`;if(known.has(migratedFrom))continue;
    merged.push({id:makeId(),name,img,relic:structuredClone(relic),equippedActorId:relic.equipped?actorId:null,migratedFrom});known.add(migratedFrom);
  }
  return merged;
}
