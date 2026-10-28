// D&D5e 6.0.6 details structure: filigree-box.saves is inside the right
// column; data-ability also appears on native ability cards elsewhere.
export const abilities=['str','dex','con','int','wis','cha'];
export function detailsHTML({localized=false,missing=false,prepared=7}={}){
  return `<div class="left"><filigree-box class="skills"><h3>Skills</h3><ul><li>Acrobatics <b>+4</b></li><li>Arcana <b>+6</b></li></ul></filigree-box></div><div class="right"><div class="top flexrow"><filigree-box class="saves"><h3>${localized?'Tiradas de salvación':'Saving Throws'}</h3><ul>${abilities.map((key,index)=>`<li data-ability="${key}"><a class="name saving-throw abbr">${key.toUpperCase()}</a>${missing&&key==='cha'?'':`<div class="bonus"><span class="sign">+</span>${prepared}</div>`}</li>`).join('')}</ul></filigree-box><div class="pills-lg">Species and Background</div></div><section class="scores">${abilities.map(key=>`<label>${key.toUpperCase()} <input name="system.abilities.${key}.value" value="18"></label>`).join('')}<input aria-label="Energy Regen ability score" value="14"><input aria-label="Break Effect ability score" value="14"></section></div>`;
}
export function character(id='hero'){
  return {documentName:'Actor',id,type:'character',system:{abilities:Object.fromEntries(abilities.map(key=>[key,{value:18,save:{value:7}}]))},_source:{system:{abilities:Object.fromEntries(abilities.map(key=>[key,{value:14}]))},flags:{'telys-star-rail-ultimates':{ultimate:{regenScore:10,breakEffectScore:10}}}},_planarBonuses:{savingThrow:1},effects:[]};
}
