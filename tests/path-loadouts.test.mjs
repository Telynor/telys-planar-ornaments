import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ID,DEFAULT_CONFIG,bonuses,critBonusSources} from '../scripts/core.mjs';
import {HSR,pathProfiles,assignedTo,assignRelic,assignmentPaths} from '../scripts/path-loadouts.mjs';
import {equippedRelics,allItems} from '../scripts/inventory.mjs';
import {activeSets,dynamicStats} from '../scripts/effects.mjs';
function world(){
 const catalog={activeId:'hunt',profiles:[{id:'hunt',original:true,name:'Hunt build',pathId:'hunt'},{id:'ice',name:'Ice build',pathId:'remembrance'}]};
 const actor={id:'hero',name:'Hero',type:'character',items:[],system:{attributes:{movement:{walk:50},hp:{value:40,max:40}}},getFlag:(scope,key)=>scope===HSR&&key==='pathChanging'?catalog:undefined};
 const relic=(id,setId,slot)=>({id,name:id,img:id+'.png',relic:{setId,slot,main:'speed',level:0,sub:[{key:setId==='301'?'critRange':'str',value:1}],equipped:false},equippedActorId:null});
 const collection=[relic('a-sphere','301','sphere'),relic('a-rope','301','rope'),relic('b-sphere','317','sphere'),relic('b-rope','317','rope')];
 const actors=[actor];actors.get=id=>actors.find(a=>a.id===id);
 globalThis.game={actors,combat:null,settings:{get:(scope,key)=>key==='relics'?collection:key==='paths'?[{id:'hunt',icon:'hunt.svg'},{id:'remembrance',icon:'ice.svg'}]:undefined},modules:{get:()=>({active:true})}};
 return {actor,catalog,collection,equip:(id,path)=>assignRelic(collection,collection.find(r=>r.id===id),actor,path,true)};
}
test('two saved Path sets contribute only the active Path’s main, substat, crit and set bonuses',()=>{
 const w=world();for(const id of ['a-sphere','a-rope'])w.equip(id,'hunt');for(const id of ['b-sphere','b-rope'])w.equip(id,'ice');
 assert.equal(w.collection.filter(e=>e.equippedActorId==='hero').length,4);assert.deepEqual([...activeSets(w.actor)],['301']);
 const cfg={...DEFAULT_CONFIG,sets:[]};assert.equal(critBonusSources(allItems(w.actor),cfg),2);assert.equal(bonuses(allItems(w.actor),cfg).str,undefined);
 w.catalog.activeId='ice';assert.deepEqual([...activeSets(w.actor)],['317']);assert.equal(critBonusSources(allItems(w.actor),cfg),0);assert.equal(bonuses(allItems(w.actor),cfg).str,2);
});
test('one relic can belong to both Paths and replacing a slot only alters the selected Path',()=>{
 const w=world();w.equip('a-sphere','hunt');w.equip('a-sphere','ice');assert.deepEqual(assignmentPaths(w.collection[0],w.actor),['hunt','ice']);
 w.equip('b-sphere','ice');assert.equal(assignedTo(w.collection[0],w.actor,'hunt'),true);assert.equal(assignedTo(w.collection[0],w.actor,'ice'),false);assert.equal(assignedTo(w.collection[2],w.actor,'ice'),true);
 assignRelic(w.collection,w.collection[2],w.actor,'ice',false);assert.equal(assignedTo(w.collection[0],w.actor,'hunt'),true);
});
test('legacy equipment belongs to the original Path and ordinary actors keep their equipment',()=>{
 const w=world();w.collection[0].equippedActorId='hero';w.collection[1].equippedActorId='hero';assert.equal(equippedRelics(w.actor).length,2);
 w.catalog.activeId='ice';assert.equal(equippedRelics(w.actor).length,0);
 w.catalog.profiles=[];w.catalog.activeId='';assert.equal(equippedRelics(w.actor).length,2);
});
test('local relic Items also exclude inactive Path bonuses from every allItems consumer',()=>{
 const w=world();w.actor.items=['hunt','ice'].flatMap((path,index)=>['sphere','rope'].map(slot=>({id:path+slot,flags:{[ID]:{relic:{setId:index?'317':'301',slot,main:'speed',level:0,sub:[],equipped:true,equippedPathIds:[path]}}}})));
 assert.deepEqual([...activeSets(w.actor)],['301']);assert.equal(allItems(w.actor).filter(i=>i.flags[ID].relic.equipped).length,2);
 w.catalog.activeId='ice';assert.deepEqual([...activeSets(w.actor)],['317']);
});
test('Path icons identify assignments and deleted or interrupted Paths cannot accept equipment',()=>{
 const w=world();assert.deepEqual(pathProfiles(w.actor).map(p=>p.icon),['hunt.svg','ice.svg']);assert.throws(()=>w.equip('a-sphere','missing'),/no longer exists/);
 w.catalog.pending={};assert.throws(()=>w.equip('a-sphere','hunt'),/recover/);w.catalog.pending=null;w.equip('b-sphere','ice');w.catalog.profiles.pop();assert.equal(equippedRelics(w.actor,'ice').length,0);
});
test('an inactive Lushaka set cannot grant a second character its recipient bonus',()=>{
 const w=world();w.equip('b-sphere','ice');w.equip('b-rope','ice');w.collection[2].pathTargets={ice:'ally'};
 const ally={id:'ally',type:'character',items:[],system:{attributes:{movement:{walk:30},hp:{value:20,max:20}}},getFlag:()=>undefined};game.actors.push(ally);
 assert.equal(dynamicStats(ally,DEFAULT_CONFIG).str,undefined);w.catalog.activeId='ice';assert.equal(dynamicStats(ally,DEFAULT_CONFIG).str,1);w.catalog.activeId='hunt';assert.equal(dynamicStats(ally,DEFAULT_CONFIG).str,undefined);
});
test('relic upgrades and rolls remain the same shared documents across Path switches',()=>{
 const w=world();w.equip('a-sphere','hunt');w.equip('a-sphere','ice');w.collection[0].relic.level=12;w.collection[0].relic.xp=25;
 for(const path of ['hunt','ice','hunt']){w.catalog.activeId=path;assert.equal(equippedRelics(w.actor)[0].getFlag(ID,'relic').level,12);assert.equal(equippedRelics(w.actor)[0].getFlag(ID,'relic').xp,25)}
});
test('standalone Planar worlds never read unregistered Ultimates settings',()=>{
 const w=world();game.modules={get:()=>undefined};game.settings.get=(scope)=>{if(scope===HSR)throw Error('Unregistered setting');return w.collection};
 assert.doesNotThrow(()=>pathProfiles(w.actor));assert.doesNotThrow(()=>equippedRelics(w.actor));
});
test('removing the original Path cannot silently transfer its legacy relics to another build',()=>{
 const w=world();w.collection[0].equippedActorId='hero';w.catalog.profiles.shift();w.catalog.activeId='ice';assert.equal(equippedRelics(w.actor).length,0);
});
