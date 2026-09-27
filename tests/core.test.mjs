import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,advance,mainValue,bonuses,DEFAULT_CONFIG,SPHERE,ROPE,ID} from '../scripts/core.mjs';
test('canonical main stats stay in their slot and interpolate from +0 to +15',()=>{
 const c=structuredClone(DEFAULT_CONFIG);c.main.hpPct={min:4,max:34};
 const s=generate({id:'x'},'sphere',c,()=>0),r=generate({id:'x'},'rope',c,()=>0);
 assert(SPHERE.includes(s.main));assert(ROPE.includes(r.main));assert.equal(mainValue(s,c),4);
 s.level=5;assert.equal(mainValue(s,c),14);s.level=15;assert.equal(mainValue(s,c),34);
});
test('five milestones add four different stats then roll one again, never beyond +15',()=>{
 const c=structuredClone(DEFAULT_CONFIG);c.xpPerLevel=100;c.sub.hpFlat={min:2,max:2,enabled:true};
 let r={setId:'x',slot:'sphere',main:'hpPct',level:0,xp:0,sub:[],equipped:false};
 r=advance(r,350,c,()=>0);assert.equal(r.level,3);assert.equal(r.xp,50);assert.equal(r.sub.length,1);
 r=advance(r,10000,c,()=>0);assert.equal(r.level,15);assert.equal(r.xp,0);assert.equal(r.sub.length,4);
 assert.equal(new Set(r.sub.map(x=>x.key)).size,4);assert.equal(r.sub.reduce((n,x)=>n+x.rolls,0),5);
});
test('set bonus requires matching equipped sphere and rope',()=>{
 const c=structuredClone(DEFAULT_CONFIG);c.sets=[{id:'x',bonuses:[{stat:'atkPct',value:12}]}];c.main.hpPct={min:0,max:20};
 const item=(slot,eq=true)=>({flags:{[ID]:{relic:{setId:'x',slot,main:'hpPct',level:15,sub:[],equipped:eq}}}});
 assert.equal(bonuses([item('sphere')],c).atkPct,undefined);
 assert.equal(bonuses([item('sphere'),item('rope')],c).atkPct,12);
 assert.equal(bonuses([item('sphere'),item('rope',false)],c).hpPct,20);
});
test('8 crit points yields 13% total crit chance over many attacks without shifting by eight faces',async()=>{
 const {criticalThreshold}=await import('../scripts/core.mjs');
 let state=0;const rng=()=>{state=(state+1)%10;return state/10};
 const thresholds=Array.from({length:10},()=>criticalThreshold(20,8,rng));
 assert.equal(thresholds.filter(n=>n===18).length,6);
 assert.equal(thresholds.filter(n=>n===19).length,4);
 assert.equal(thresholds.reduce((sum,t)=>sum+(21-t)/20,0)/10,.13);
});
test('each percentage bonus is floored separately and displayed with its base',async()=>{
 const {damageBreakdown,arcadiaRate}=await import('../scripts/core.mjs');
 assert.deepEqual(damageBreakdown(23,[{label:'Arcadia',rate:arcadiaRate(5)},{label:'Other',rate:12}]),{base:23,lines:[{label:'Arcadia',rate:9,bonus:2},{label:'Other',rate:12,bonus:2}],total:27});
 assert.equal(arcadiaRate(3),12);
});
