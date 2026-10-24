import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG,ID} from '../scripts/core.mjs';
import {systemPath,effectChanges} from '../scripts/system-compat.mjs';
import {applyDamageBonuses,primaryDamageRolls} from '../scripts/midi-compat.mjs';
import {dynamicStats} from '../scripts/effects.mjs';
const get=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
globalThis.Application=class{};globalThis.Hooks={once(){},on(){}};
globalThis.CONST={ACTIVE_EFFECT_MODES:{ADD:2,OVERRIDE:5}};
globalThis.foundry={applications:{api:{ApplicationV2:class{}}},utils:{getProperty:get,deepClone:structuredClone,mergeObject:a=>structuredClone(a)}};
const {planarStatChanges,applyPlanarStatEffect}=await import('../scripts/planar.mjs');
function setup(version='6.0.6'){
  const actor={id:'hero',type:'character',items:[],effects:[],getFlag:()=>null,_source:{system:{attributes:{movement:{speeds:{walk:'30'},walk:30},ac:{bonus:0}}}},system:{attributes:{movement:{speeds:{walk:40}},hp:{value:20,max:20}}}};
  globalThis.game={system:{version},user:{isGM:true},actors:[actor],combat:null,modules:new Map(),settings:{get:(_id,key)=>key==='config'?{}:[]}};
  return actor;
}
test('v6 planar stats use persisted roll, movement and initiative paths',()=>{
  const actor=setup(),changes=planarStatChanges({atkPct:3,speed:5,savingThrow:1,initiativeBonus:2},DEFAULT_CONFIG,actor);
  const find=key=>changes.find(c=>c.key===key)?.value;
  assert.equal(find('system.rolls.attack.mwak.bonus'),'3');assert.equal(find('system.abilities.wis.save.roll.bonus'),'1');
  assert.equal(find('system.attributes.init.roll.bonus'),'2');assert.equal(find('system.attributes.movement.speeds.walk'),'35');
  assert.ok(!changes.some(c=>c.key.startsWith('system.bonuses.')));
});
test('v5 planar stat paths remain available',()=>{
  const actor=setup('5.3.3'),changes=planarStatChanges({atkPct:3,savingThrow:1},DEFAULT_CONFIG,actor);
  assert.ok(changes.some(c=>c.key==='system.bonuses.mwak.attack'));assert.ok(changes.some(c=>c.key==='system.abilities.con.bonuses.save'));
});
test('speed-dependent set conditions read v6 speeds without accessing deprecated getters',()=>{
  const actor=setup();actor.items=['sphere','rope'].map(slot=>({flags:{[ID]:{relic:{setId:'301',slot,equipped:true}}}}));
  Object.defineProperty(actor.system.attributes.movement,'walk',{get(){throw Error('deprecated movement getter');}});
  assert.equal(dynamicStats(actor,{}).str,1);
});
test('planar effects are written in v14 format and system-generated IDs do not cause repeated updates',async()=>{
  const actor=setup(),relic={setId:'custom',slot:'sphere',equipped:true,main:'atkPct',level:15,sub:[{key:'savingThrow',value:1}]};
  actor.items=[{id:'relic',flags:{[ID]:{relic}},getFlag:(_s,key)=>key==='relic'?relic:null}];
  let creates=0,updates=0;
  actor.createEmbeddedDocuments=async(_type,rows)=>{creates++;for(const row of rows){
    assert.equal(row.changes,undefined);assert.ok(row.system.changes.every(c=>typeof c.type==='string'&&c.mode===undefined));
    actor.effects.push({...row,system:{changes:row.system.changes.map(c=>({...c,_id:'native-id',conditions:[],replacement:''}))},getFlag:(_s,key)=>row.flags?.[ID]?.[key],async update(){updates++;}});
  }};
  await applyPlanarStatEffect(actor);assert.equal(creates,1);
  assert.ok(actor.effects[0].system.changes.some(c=>c.key==='system.rolls.attack.mwak.bonus'));
  await applyPlanarStatEffect(actor);assert.equal(creates,1);assert.equal(updates,0);
});
test('legacy effect storage and v14 effect storage can both be read for migration',()=>{
  const c={key:'system.abilities.str.value',mode:2,value:'2',priority:30};
  assert.deepEqual(effectChanges({changes:[c]}),[c]);
  assert.deepEqual(effectChanges({system:{changes:[{...c,mode:undefined,type:'add'}]}}),[c]);
});
test('modern changes never read Foundry\'s deprecated numeric mode getter',()=>{
  const change={key:'system.abilities.str.value',type:'add',value:'2',priority:30};
  Object.defineProperty(change,'mode',{get(){throw Error('deprecated numeric mode getter');}});
  assert.deepEqual(effectChanges({system:{changes:[change]}}),[{key:change.key,mode:2,value:'2',priority:30}]);
});
test('planar stat generation never accesses the deprecated effect mode enum',()=>{
  const actor=setup(),previous=globalThis.CONST;
  globalThis.CONST={get ACTIVE_EFFECT_MODES(){throw Error('deprecated mode enum');}};
  try{
    const changes=planarStatChanges({str:2,atkPct:3,defPct:2,speed:5,savingThrow:1},DEFAULT_CONFIG,actor);
    assert.ok(changes.some(change=>change.mode===2));assert.ok(changes.some(change=>change.mode===5));
  }finally{globalThis.CONST=previous;}
});
class TestRoll{
  constructor(formula,_data={},options={}){this.formula=formula;this.options=options;this.total=String(formula).replace(/\[[^\]]*\]/g,'').split('+').reduce((n,p)=>n+Number(p.trim()),0);this.terms=[];}
  async evaluate(){return this;}
}
function modifierEnv(){return {Roll:TestRoll,CONFIG:{Dice:{DamageRoll:TestRoll}},MidiQOL:{addRollTo:(a,b)=>new TestRoll(String(a.total+b.total),{},structuredClone(a.options))}};}
test('Midi 14.6 modifiers preserve separate damage rolls and await the plural setter',async()=>{
  const fire=new TestRoll('10',{}, {type:'fire'}),cold=new TestRoll('7',{}, {type:'cold'}),w={damageRolls:[fire,cold]};
  let complete=false;w.setDamageRolls=async rows=>{await Promise.resolve();w.damageRolls=rows;complete=true;};
  Object.defineProperty(w,'damageRoll',{get(){throw Error('do not aggregate typed rolls');}});w.setDamageRoll=()=>{throw Error('legacy setter must not be used');};
  await applyDamageBonuses(w,[{amount:3,type:'fire'},{amount:2,type:'cold'}],modifierEnv());
  assert.equal(complete,true);assert.deepEqual(w.damageRolls.map(r=>[r.options.type,r.total]),[['fire',13],['cold',9]]);
  assert.equal(fire.total,10);assert.equal(cold.total,7);
});
test('bonuses of a new damage type become an additional typed roll',async()=>{
  const w={damageRolls:[new TestRoll('10',{}, {type:'fire'})],async setDamageRolls(rows){this.damageRolls=rows;}};
  await applyDamageBonuses(w,[{amount:2,type:'psychic'}],modifierEnv());
  assert.deepEqual(w.damageRolls.map(r=>[r.options.type,r.total]),[['fire',10],['psychic',2]]);
});
test('healing bonuses retain healing type and other damage components',async()=>{
  const w={damageRolls:[new TestRoll('8',{}, {type:'healing'}),new TestRoll('2',{}, {type:'temphp'})],async setDamageRolls(rows){this.damageRolls=rows;}};
  await applyDamageBonuses(w,[{amount:4,type:'healing'}],modifierEnv());
  assert.deepEqual(w.damageRolls.map(r=>[r.options.type,r.total]),[['healing',12],['temphp',2]]);
});
test('legacy Midi setter is supported when no plural setter exists',async()=>{
  const w={damageRoll:new TestRoll('8',{}, {type:'fire'}),async setDamageRoll(roll){await Promise.resolve();this.damageRoll=roll;}};
  await applyDamageBonuses(w,[{amount:2,type:'fire'}],modifierEnv());assert.equal(w.damageRoll.total,10);assert.equal(w.damageRoll.options.type,'fire');
});
test('damage roll getters prefer arrays and unavailable mutation APIs fail explicitly',async()=>{
  const roll=new TestRoll('2');assert.deepEqual(primaryDamageRolls({damageRoll:roll}),[roll]);
  await assert.rejects(applyDamageBonuses({damageRolls:[roll]},[{amount:1}],{}),/modifier API unavailable/);
});
test('the actual Planar damage hook modifies a modern multi-type workflow only once',async()=>{
  const actor=setup(),hooks=new Map(),relic={setId:'custom',slot:'sphere',equipped:true,main:'fire',level:15,sub:[]};
  actor.items=[{id:'sphere',name:'Fire sphere',flags:{[ID]:{relic}},getFlag:(_s,key)=>key==='relic'?relic:null}];
  game.modules.set('telys-star-rail-ultimates',{active:true,api:{getConfig:()=>({elementId:'fire'})}});
  game.settings.get=(_id,key)=>key==='elements'?[{id:'fire',name:'Fire'}]:[];
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn)};
  const env=modifierEnv();Object.assign(globalThis,env);globalThis.ui={notifications:{error:message=>{throw Error(message);}}};globalThis.ChatMessage={getSpeaker:()=>({}),async create(){}};
  foundry.utils.escapeHTML=String;
  const {registerDamageHooks}=await import('../scripts/damage.mjs');registerDamageHooks(()=>structuredClone(DEFAULT_CONFIG));
  let sets=0;const w={actor,damageRolls:[new TestRoll('10',{}, {type:'fire'}),new TestRoll('7',{}, {type:'cold'})],async setDamageRolls(rows){sets++;this.damageRolls=rows;}};
  Object.defineProperty(w,'damageRoll',{get(){throw Error('deprecated aggregate damage');}});
  await hooks.get('midi-qol.DamageRollComplete')(w);await hooks.get('midi-qol.DamageRollComplete')(w);
  assert.equal(sets,1);assert.deepEqual(w.damageRolls.map(r=>[r.options.type,r.total]),[['fire',13],['cold',7]]);
});
