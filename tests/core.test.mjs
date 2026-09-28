import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,advance,mainValue,bonuses,DEFAULT_CONFIG,SPHERE,ROPE,SUBSTATS,ID} from '../scripts/core.mjs';
import {CANONICAL_SETS} from '../scripts/catalog.mjs';
import {visualHtml,layoutFor} from '../scripts/visuals.mjs';
import {activeSets,dynamicStats} from '../scripts/effects.mjs';
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
 const markup=visualHtml(set,s=>s,{equipped:true});
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
