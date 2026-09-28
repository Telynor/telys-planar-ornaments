import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,advance,mainValue,bonuses,currencyCost,DEFAULT_CONFIG,SPHERE,ROPE,SUBSTATS,ID} from '../scripts/core.mjs';
import {CANONICAL_SETS} from '../scripts/catalog.mjs';
import {visualHtml,layoutFor,applyLayoutToAll} from '../scripts/visuals.mjs';
import {activeSets,dynamicStats} from '../scripts/effects.mjs';
import {storedRelics,equippedRelics,allItems,mergeLegacyRelics} from '../scripts/inventory.mjs';
test('currency costs one item per configured XP with the remainder rounded up',()=>{
 assert.equal(currencyCost(100,40),3);
 assert.equal(currencyCost(80,40),2);
 assert.equal(currencyCost(0,40),0);
});
test('canonical main stats stay in their slot and interpolate from +0 to +15',()=>{
 const c=structuredClone(DEFAULT_CONFIG);c.main.hpPct={min:4,max:34};
 const s=generate({id:'x'},'sphere',c,()=>0),r=generate({id:'x'},'rope',c,()=>0);
 assert(SPHERE.includes(s.main));assert(ROPE.includes(r.main));assert.equal(mainValue(s,c),4);
 s.level=5;assert.equal(mainValue(s,c),14);s.level=15;assert.equal(mainValue(s,c),34);
});
test('every level reveals or increases one of four substats, never beyond +15',()=>{
 const c=structuredClone(DEFAULT_CONFIG);c.xpPerLevel=100;
 let r=generate({id:'x'},'sphere',c,()=>0);assert.deepEqual(r.sub,[]);
 r=advance(r,350,c,()=>0);assert.equal(r.level,3);assert.equal(r.xp,50);assert.equal(r.sub.length,3);
 r=advance(r,10000,c,()=>0);assert.equal(r.level,15);assert.equal(r.xp,0);assert.equal(r.sub.length,4);
 assert.equal(new Set(r.sub.map(x=>x.key)).size,4);assert.equal(r.sub.reduce((n,x)=>n+x.rolls,0),15);
});
test('substats use exact 90/9/1 tiers; speed rolls feet',async()=>{
 const {rollSubstat}=await import('../scripts/core.mjs');
 assert.deepEqual([.0,.899999,.9,.989999,.99,.99999].map(n=>rollSubstat('savingThrow',()=>n)),[1,1,2,2,3,3]);
 assert.deepEqual([.2,.95,.995].map(n=>rollSubstat('speed',()=>n)),[5,10,15]);
});
test('set bonus requires matching equipped sphere and rope',()=>{
 const c=structuredClone(DEFAULT_CONFIG);c.sets=[{id:'x',bonuses:[{stat:'atkPct',value:12}]}];c.main.hpPct={min:0,max:20};
 const item=(slot,eq=true)=>({flags:{[ID]:{relic:{setId:'x',slot,main:'hpPct',level:15,sub:[],equipped:eq}}}});
 assert.equal(bonuses([item('sphere')],c).atkPct,undefined);
 assert.equal(bonuses([item('sphere'),item('rope')],c).atkPct,12);
 assert.equal(bonuses([item('sphere'),item('rope',false)],c).hpPct,20);
});
test('each equipped crit bonus source lowers the current threshold by one',async()=>{
 const {criticalThreshold,critBonusSources}=await import('../scripts/core.mjs');
 assert.equal(criticalThreshold(19,2),17);
 assert.equal(criticalThreshold(20,30),2);
 const c=structuredClone(DEFAULT_CONFIG);c.sets=[{id:'x',bonuses:[{stat:'critRate',value:8}]}];
 const item=(slot,sub=[])=>({flags:{[ID]:{relic:{setId:'x',slot,main:'hpPct',level:0,sub,equipped:true}}}});
 assert.equal(critBonusSources([item('sphere'),item('rope')],c),1);
 assert.equal(critBonusSources([item('sphere',[{key:'critRate',value:4}]),item('rope')],c),2);
});
test('each percentage bonus is floored separately and displayed with its base',async()=>{
 const {damageBreakdown,arcadiaRate}=await import('../scripts/core.mjs');
 assert.deepEqual(damageBreakdown(23,[{label:'Arcadia',rate:arcadiaRate(5)},{label:'Other',rate:12}]),{base:23,lines:[{label:'Arcadia',rate:9,bonus:2},{label:'Other',rate:12,bonus:2}],total:27});
 assert.equal(arcadiaRate(3),12);
});
test('elemental main stats advance at levels eight and fifteen',async()=>{
 const {elementalDamageBonus,ELEMENT_DAMAGE_TYPES}=await import('../scripts/core.mjs');
 assert.deepEqual([0,7,8,14,15].map(level=>elementalDamageBonus({level})),[1,1,2,2,3]);
 assert(ELEMENT_DAMAGE_TYPES.physical.includes('slashing'));
 assert(!ELEMENT_DAMAGE_TYPES.fire.includes('cold'));
});
test('healing and energy regeneration are main only; healing rope caps at +3',()=>{
 assert(ROPE.includes('healing'));assert(ROPE.includes('energyRegen'));
 for(const key of ['healing','energyRegen','fire','ice','wind','lightning','physical','quantum','imaginary'])assert(!SUBSTATS.includes(key));
 const c=structuredClone(DEFAULT_CONFIG),relic={main:'healing',level:0};
 assert.equal(mainValue(relic,c),1);relic.level=8;assert.equal(mainValue(relic,c),2);
 relic.level=15;assert.equal(mainValue(relic,c),3);
});
test('all 28 canonical sets have translated two-piece bonuses and local emblems',()=>{
 assert.equal(CANONICAL_SETS.length,28);
 for(const set of CANONICAL_SETS){assert(set.adaptedEffect);assert.match(set.setImage,/assets\/sets\/\d+\.png$/);assert(set.sphereImage&&set.ropeImage)}
 assert.deepEqual(CANONICAL_SETS.find(s=>s.id==='311').bonuses,[{stat:'str',value:1}]);
 assert.deepEqual(CANONICAL_SETS.find(s=>s.id==='317').bonuses,[{stat:'energyRegen',value:1}]);
});
test('set projection uses per-set positions and shows matched status',()=>{
 const set={...CANONICAL_SETS[0],layout:{rope:{x:35,y:70,scale:2}}};
 assert.equal(layoutFor(set).rope.x,35);
 const markup=visualHtml(set,s=>s,{equipped:true,visibleSlots:['sphere','rope']});
 assert.match(markup,/tp-complete/);assert.match(markup,/left:35%;top:70%/);
 assert.match(markup,/2-piece set active/);
});
test('conditional stat bonus needs a complete matching pair',()=>{
 const piece=(slot)=>({flags:{[ID]:{relic:{setId:'301',slot,equipped:true}}}});
 const actor={id:'test',type:'character',items:[piece('sphere')],system:{attributes:{movement:{walk:35},hp:{value:40,max:40}}},getFlag:()=>null};
 const previous=globalThis.game;globalThis.game={actors:[],combat:null};
 try{assert.equal(activeSets(actor).size,0);assert.equal(dynamicStats(actor,{}).str,undefined);
  actor.items.push(piece('rope'));assert.equal(activeSets(actor).has('301'),true);assert.equal(dynamicStats(actor,{}).str,1);
 }finally{globalThis.game=previous}
});
test('applying one piece layout to all preserves the other and becomes the new-set default',()=>{
 const sets=[{id:'a',layout:{sphere:{x:10,y:20,scale:1},rope:{x:35,y:40,scale:1.3}}},{id:'b',layout:{rope:{x:72,y:80,scale:2}}}];
 const result=applyLayoutToAll(sets,'sphere',{x:44,y:55,scale:2.5});
 assert.deepEqual(result.sets.map(s=>s.layout.sphere),[{x:44,y:55,scale:2.5},{x:44,y:55,scale:2.5}]);
 assert.equal(result.sets[0].layout.rope.x,35);assert.equal(result.sets[1].layout.rope.x,72);
 assert.equal(layoutFor({id:'new'},result.defaults).sphere.scale,2.5);
 assert.equal(sets[0].layout.sphere.x,10);
});
test('player projection shows only equipped slots and has no baked set art',()=>{
 const set={id:'301',name:'Space Sealing Station',sphereImage:'sphere.png',ropeImage:'rope.png'};
 const empty=visualHtml(set,x=>x);
 assert.doesNotMatch(empty,/sphere.png|rope.png|tp-set-seal/);
 const one=visualHtml(set,x=>x,{visibleSlots:['rope']});
 assert.match(one,/rope.png/);assert.doesNotMatch(one,/sphere.png/);
 const designer=visualHtml(set,x=>x,{designer:true});
 assert.match(designer,/sphere.png/);assert.match(designer,/rope.png/);
});
test('shared collection contributes relics only to their equipped character',()=>{
 const previous=globalThis.game;
 const collection=[{id:'sphere',name:'Sphere',relic:{setId:'301',slot:'sphere'},equippedActorId:'one'},{id:'rope',name:'Rope',relic:{setId:'301',slot:'rope'},equippedActorId:'one'},{id:'free',name:'Free',relic:{setId:'302',slot:'rope'},equippedActorId:null}];
 globalThis.game={settings:{get:()=>collection},actors:[],combat:null};
 try{
  const one={id:'one',items:[]},two={id:'two',items:[]};
  assert.equal(storedRelics().length,3);assert.equal(equippedRelics(one).length,2);
  assert.equal(allItems(two).length,0);assert.equal(activeSets(one).has('301'),true);
  assert.equal(activeSets(two).size,0);
 }finally{globalThis.game=previous}
});
test('migration preserves each wearer and does not duplicate relics on retry',()=>{
 const source=[{actorId:'pc1',itemId:'old1',name:'Sphere',img:'sphere.png',relic:{setId:'301',slot:'sphere',equipped:true,level:4}},{actorId:'pc2',itemId:'old2',name:'Rope',img:'rope.png',relic:{setId:'301',slot:'rope',equipped:false,level:2}}];
 let count=0;const once=mergeLegacyRelics([],source,()=>`relic${++count}`);
 assert.deepEqual(once.map(x=>x.equippedActorId),['pc1',null]);
 const twice=mergeLegacyRelics(once,source,()=>`relic${++count}`);
 assert.deepEqual(twice,once);assert.equal(count,2);
});
