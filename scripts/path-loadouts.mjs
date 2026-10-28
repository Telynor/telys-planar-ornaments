export const HSR='telys-star-rail-ultimates';
export const pathCatalog=actor=>actor?.getFlag?.(HSR,'pathChanging')??{};
export const activePath=actor=>pathCatalog(actor).activeId??'';
export function pathProfiles(actor){
  const catalog=pathCatalog(actor),paths=globalThis.game?.modules?.get?.(HSR)?.active?globalThis.game?.settings?.get?.(HSR,'paths'):[];
  return (catalog.profiles?.length?catalog.profiles:[{id:'',name:actor?.name??'Character'}]).map(profile=>{
    const pathId=profile.id===activePath(actor)?actor?.getFlag?.(HSR,'ultimate')?.pathId??profile.pathId:profile.pathId;
    const path=Array.isArray(paths)?paths.find(p=>p.id===pathId):null;
    return {id:profile.id,name:profile.name,active:profile.id===activePath(actor),icon:path?.icon||profile.snapshot?.token?.texture?.src||profile.previewImage||actor?.prototypeToken?.texture?.src||actor?.img||''};
  });
}
export function assignmentPaths(entry,actor){
  if(Array.isArray(entry.equippedPathIds)){const valid=new Set(pathProfiles(actor).map(p=>p.id));return entry.equippedPathIds.filter(id=>valid.has(id));}
  const catalog=pathCatalog(actor);
  if(!catalog.profiles?.length)return [''];
  const original=catalog.profiles.find(p=>p.original);return original?[original.id]:[];
}
export const assignedTo=(entry,actor,pathId=activePath(actor))=>Boolean(actor)&&entry.equippedActorId===actor.id&&assignmentPaths(entry,actor).includes(pathId);
export function assignRelic(inventory,entry,actor,pathId,equipped){
  if(!pathProfiles(actor).some(p=>p.id===pathId))throw Error('This Path no longer exists. Reopen Planar Relics.');
  if(pathCatalog(actor).pending)throw Error('Finish or recover the character’s Path change before editing equipment.');
  if(equipped){
    for(const other of inventory)if(other.equippedActorId===actor.id&&other.relic.slot===entry.relic.slot){
      other.equippedPathIds=assignmentPaths(other,actor).filter(id=>id!==pathId);
      if(!other.equippedPathIds.length)other.equippedActorId=null;
    }
    if(entry.equippedActorId!==actor.id){entry.equippedPathIds=[];entry.pathTargets={};entry.relic.targetActorId=null;}
    entry.equippedActorId=actor.id;entry.equippedPathIds=[...new Set([...(entry.equippedPathIds??[]),pathId])];
  }else{
    if(!assignedTo(entry,actor,pathId))throw Error('This relic is not equipped for the selected Path.');
    entry.equippedPathIds=assignmentPaths(entry,actor).filter(id=>id!==pathId);
    if(!entry.equippedPathIds.length)entry.equippedActorId=null;
  }
}
