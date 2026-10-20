import {test} from "node:test";
import assert from "node:assert/strict";
import {planarSheetActor} from "../scripts/sheet-controls.mjs";
test("Planar configuration belongs to actual Actor sheets",()=>{
 for(const type of ["character","npc"]){const actor={documentName:"Actor",type};assert.equal(planarSheetActor({actor}),actor);assert.equal(planarSheetActor({document:actor,actor}),actor);assert.equal(planarSheetActor({object:actor}),actor);}
});
test("spell, Item and Activity windows never inherit Planar configuration from an actor getter",()=>{
 const actor={documentName:"Actor",type:"character"};
 for(const document of [{documentName:"Item",actor},{documentName:"Activity",actor},{type:"summon",item:{actor}}])assert.equal(planarSheetActor({document,actor}),null);
 assert.equal(planarSheetActor({object:{documentName:"Item",actor},actor}),null);
});
