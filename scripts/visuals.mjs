import {number} from './core.mjs';
export const LAYOUT={sphere:{x:51,y:58,scale:1.5},rope:{x:50,y:45,scale:1.9}};
export function layoutFor(set){return {sphere:{...LAYOUT.sphere,...set?.layout?.sphere},rope:{...LAYOUT.rope,...set?.layout?.rope}}}
export function pieceStyle(part){
  const x=Math.max(0,Math.min(100,number(part.x,50))),y=Math.max(0,Math.min(100,number(part.y,50))),scale=Math.max(.2,Math.min(5,number(part.scale,1)));
  return `left:${x}%;top:${y}%;transform:translate(-50%,-50%) scale(${scale})`;
}
export function visualHtml(set,escape,{equipped=false,designer=false}={}){
  if(!set)return '<div class="tp-orbit tp-empty">Select a planar set</div>';
  const layout=layoutFor(set),piece=(slot)=>`<img class="tp-projected tp-${slot}" data-drag-piece="${designer?slot:''}" draggable="false" src="${escape(set[slot+'Image']||'icons/svg/item-bag.svg')}" alt="${escape(set[slot+'Name']||slot)}" style="${pieceStyle(layout[slot])}">`;
  return `<section class="tp-orbit ${equipped?'tp-complete':''}" data-set-preview="${escape(set.id)}"><div class="tp-orbit-ring"></div><div class="tp-orbit-runes"></div>${piece('rope')}${piece('sphere')}<img class="tp-set-seal" src="${escape(set.setImage||set.sphereImage||'icons/svg/item-bag.svg')}" alt="${escape(set.name)} icon"><div class="tp-orbit-title"><strong>${escape(set.name)}</strong><span>${equipped?'2-piece set active':'Set preview'}</span></div></section>`;
}
