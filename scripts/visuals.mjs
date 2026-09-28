import {number} from './core.mjs';
export const LAYOUT={sphere:{x:51,y:58,scale:1.5},rope:{x:50,y:45,scale:1.9}};
export function layoutFor(set,defaults=LAYOUT){return {sphere:{...LAYOUT.sphere,...defaults?.sphere,...set?.layout?.sphere},rope:{...LAYOUT.rope,...defaults?.rope,...set?.layout?.rope}}}
export function applyLayoutToAll(sets,slot,position,defaults=LAYOUT){
  if(!['sphere','rope'].includes(slot))throw Error('Unknown planar piece.');
  const value={x:number(position.x,50),y:number(position.y,50),scale:number(position.scale,1)};
  return {defaults:{...defaults,[slot]:{...value}},sets:sets.map(set=>({...set,layout:{...set.layout,[slot]:{...value}}}))};
}
export function pieceStyle(part){
  const x=Math.max(0,Math.min(100,number(part.x,50))),y=Math.max(0,Math.min(100,number(part.y,50))),scale=Math.max(.2,Math.min(5,number(part.scale,1)));
  return `left:${x}%;top:${y}%;transform:translate(-50%,-50%) scale(${scale})`;
}
export function visualHtml(set,escape,{equipped=false,designer=false,defaultLayout=LAYOUT,visibleSlots=[]}={}){
  if(!set)return '<div class="tp-orbit tp-empty">Select a planar set</div>';
  const layout=layoutFor(set,defaultLayout),piece=(slot)=>`<img class="tp-projected tp-${slot}" data-drag-piece="${designer?slot:''}" draggable="false" src="${escape(set[slot+'Image']||'icons/svg/item-bag.svg')}" alt="${escape(set[slot+'Name']||slot)}" style="${pieceStyle(layout[slot])}">`;
  const show=slot=>designer||visibleSlots.includes(slot);
  return `<section class="tp-orbit ${equipped?'tp-complete':''}" data-set-preview="${escape(set.id)}"><div class="tp-orbit-ring"></div>${show('rope')?piece('rope'):''}${show('sphere')?piece('sphere'):''}<div class="tp-orbit-title"><strong>${escape(set.name)}</strong><span>${equipped?'2-piece set active':'Set preview'}</span></div></section>`;
}
