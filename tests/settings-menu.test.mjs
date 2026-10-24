import test from 'node:test';
import assert from 'node:assert/strict';

class LegacyApplication{}
class FormApplication extends LegacyApplication{}
class ApplicationV2{}
const hooks=new Map(),menus=new Map(),settings=new Map();
globalThis.Application=LegacyApplication;
globalThis.Hooks={once:(name,callback)=>hooks.set(name,callback),on(){}};
globalThis.foundry={applications:{api:{ApplicationV2}},utils:{deepClone:structuredClone}};
function registerMenu(id,key,options){
  if(!(options.type.prototype instanceof FormApplication)&&!(options.type.prototype instanceof ApplicationV2))throw Error('You must provide a menu type that is a FormApplication or ApplicationV2 instance or subclass');
  menus.set(`${id}.${key}`,options);
}
globalThis.game={settings:{register:(id,key,value)=>settings.set(`${id}.${key}`,value),registerMenu}};
await import('../scripts/planar.mjs');

test('the settings boundary rejects a plain legacy Application as reported by Foundry',()=>{
  assert.throws(()=>registerMenu('test','legacy',{type:class extends LegacyApplication{}}),/FormApplication or ApplicationV2/);
});
test('the actual init hook registers a valid ApplicationV2 designer menu',()=>{
  assert.doesNotThrow(()=>hooks.get('init')());
  const menu=menus.get('telys-planar-ornaments.displayDesigner');
  assert.ok(menu);assert.equal(menu.restricted,true);
  assert.ok(menu.type.prototype instanceof ApplicationV2);
  assert.equal(menu.type.DEFAULT_OPTIONS.window.title,'Planar Set Display Designer');
  assert.equal(typeof menu.type.prototype._renderHTML,'function');
  assert.equal(typeof menu.type.prototype._replaceHTML,'function');
  assert.ok(settings.has('telys-planar-ornaments.config'));
});
