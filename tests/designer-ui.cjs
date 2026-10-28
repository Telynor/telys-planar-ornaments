// Actual module/menu/render/save paths with mocked Foundry platform boundaries.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),prefix='/modules/telys-planar-ornaments/';
const boot=String.raw`
window.onceHooks=new Map();window.menus=new Map();window.values=new Map();window.notices=[];
window.Hooks={once:(name,fn)=>onceHooks.set(name,fn),on(){},callAll(){}};
window.Application=class{
 static get defaultOptions(){return {}}
 async render(){this.element??=document.createElement('section');this.element.id='planar-loadouts';this.element.className='application';this.element.innerHTML=(await this._renderInner())[0].outerHTML;if(!this.element.isConnected)document.body.append(this.element);this.activateListeners($(this.element));return this}
 activateListeners(){}
};window.FormApplication=class extends Application{};
class ApplicationV2{
  constructor(){this.element=document.createElement('section');this.element.className='application';this.element.innerHTML='<div class="window-content"></div>';this.closed=false;this.renderCount=0;}
  async render(options={}){
    if(typeof options!=='object')throw Error('ApplicationV2 render expects an options object');
    this._replaceHTML(await this._renderHTML({},options),this.element.querySelector('.window-content'),options);
    if(!this.element.isConnected)document.body.append(this.element);
    this._onRender({},options);this.renderCount++;return this;
  }
  _onRender(){}
  async close(){this.closed=true;this.element.remove();return this;}
}
function mergeObject(original,other,{inplace=true}={}){
  const target=inplace?original:structuredClone(original);
  for(const [key,value]of Object.entries(other??{})){
    if(value&&typeof value==='object'&&!Array.isArray(value))target[key]=mergeObject(target[key]??{},value);
    else target[key]=structuredClone(value);
  }
  return target;
}
window.foundry={applications:{api:{ApplicationV2}},utils:{deepClone:value=>structuredClone(value),mergeObject,escapeHTML:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),getProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o)}};
window.game={user:{id:'gm',isGM:true},system:{version:'6.0.6'},actors:[],items:new Map(),modules:new Map(),settings:{
  register(_id,key,definition){if(!values.has(key))values.set(key,structuredClone(definition.default));},
  registerMenu(_id,key,definition){
    if(!(definition.type.prototype instanceof FormApplication)&&!(definition.type.prototype instanceof ApplicationV2))throw Error('You must provide a menu type that is a FormApplication or ApplicationV2 instance or subclass');
    menus.set(key,definition);
  },
  get:(_id,key)=>values.get(key),set:async(_id,key,value)=>{values.set(key,structuredClone(value));return value;}
}};
window.ui={notifications:{info:message=>notices.push(message),warn:message=>notices.push(message),error:message=>{throw Error(message);}}};
const planar=await import('/modules/telys-planar-ornaments/scripts/planar.mjs');window.planar=planar;onceHooks.get('init')();
window.openDesigner=async()=>{const Type=menus.get('displayDesigner').type;window.designer=new Type();await designer.render({force:true});};
await openDesigner();window.booted=true;
`;
(async()=>{
  const server=http.createServer(async(req,res)=>{try{
    const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="'+prefix+'styles/planar.css"><style>body{background:#18202d;color:white;font-family:system-ui;padding:20px}.application{width:720px;height:850px;margin:auto}.window-content{height:100%;overflow:auto}input,button,select{font:inherit}input{max-width:120px}img{max-width:100%}</style><script src="/jquery.js"></script></head><body><script type="module">'+boot+'</script></body></html>');return;}
    if(pathname==='/jquery.js'){res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(require.resolve('jquery')));return;}
    if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
    const file=path.resolve(root,pathname.slice(prefix.length));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    let data=await fs.readFile(file);if(file.endsWith('/scripts/planar.mjs'))data=data.toString()+'\nexport {PlanarWindow,processRequest}; syncPlanarStats=async()=>{};';
    res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(data);
  }catch(error){res.writeHead(500);res.end(error.message);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1000,height:1000}}),errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.booted===true);
    assert.equal(await page.evaluate(()=>designer instanceof foundry.applications.api.ApplicationV2),true);
    const first=await page.locator('[data-designer-set]').inputValue();
    await page.locator('[data-layout-value="sphere:x"]').fill('63.7');
    assert.equal(await page.evaluate(()=>designer.layouts[designer.setId].sphere.x),63.7);
    const scale=Number(await page.locator('[data-layout-value="sphere:scale"]').inputValue());
    await page.locator('.tp-sphere').dispatchEvent('wheel',{deltaY:-100});
    assert.equal(Number(await page.locator('[data-layout-value="sphere:scale"]').inputValue()),Math.min(5,scale+.1));
    const next=await page.locator('[data-designer-set] option').nth(1).getAttribute('value');
    let renders=await page.evaluate(()=>designer.renderCount);await page.locator('[data-designer-set]').selectOption(next);
    await page.waitForFunction(count=>designer.renderCount>count,renders);
    renders=await page.evaluate(()=>designer.renderCount);await page.locator('[data-designer-set]').selectOption(first);
    await page.waitForFunction(count=>designer.renderCount>count,renders);
    assert.equal(Number(await page.locator('[data-layout-value="sphere:x"]').inputValue()),63.7);
    await page.locator('[data-apply-default="sphere"]').click();
    await page.locator('[data-designer-save]').click();await page.waitForFunction(()=>designer.closed===true);
    assert.equal(await page.evaluate(()=>values.get('config').defaultLayout.sphere.x),63.7);
    assert.equal(await page.evaluate(()=>values.get('config').sets.every(set=>set.layout.sphere.x===63.7)),true);
    await page.evaluate(()=>openDesigner());
    assert.equal(Number(await page.locator('[data-layout-value="sphere:x"]').inputValue()),63.7);
    const output=process.env.BROWSER_ARTIFACTS||path.join(root,'artifacts');await fs.mkdir(output,{recursive:true});
    await page.screenshot({path:path.join(output,'planar-designer.png')});
    await page.evaluate(async()=>{
      await designer.close();const HSR='telys-star-rail-ultimates';window.loadoutCatalog={activeId:'hunt',profiles:[{id:'hunt',original:true,name:'Hunt build',pathId:'hunt'},{id:'ice',name:'Ice build',pathId:'remembrance'}]};
      const actor={id:'hero',name:'Hero',type:'character',items:[],getFlag:(_scope,key)=>key==='pathChanging'?loadoutCatalog:undefined};game.actors.push(actor);game.actors.get=id=>game.actors.find(a=>a.id===id);game.users=[game.user];game.users.get=id=>game.users.find(u=>u.id===id);game.modules.set(HSR,{active:true});
      const get=game.settings.get;game.settings.get=(scope,key)=>scope===HSR&&key==='paths'?[{id:'hunt',icon:'modules/telys-planar-ornaments/assets/relic/301_0.png'},{id:'remembrance',icon:'modules/telys-planar-ornaments/assets/relic/302_0.png'}]:get(scope,key);
      const sets=values.get('config').sets;values.set('relics',[0,1].flatMap(i=>['sphere','rope'].map(slot=>({id:'set'+i+'-'+slot,name:sets[i].name+' '+slot,img:sets[i].sphereImage||'modules/telys-planar-ornaments/assets/relic/'+sets[i].id+'_'+(slot==='sphere'?0:1)+'.png',relic:{setId:sets[i].id,slot,main:'speed',level:15,xp:0,sub:[]},equippedActorId:null}))));
      window.loadouts=new planar.PlanarWindow();loadouts.actorId='hero';await loadouts.render(true);
    });
    async function equip(id){await page.locator('[data-item="'+id+'"]').click();await page.locator('[data-item="'+id+'"] [data-op="equip"]').click();await page.waitForFunction(id=>values.get('relics').find(r=>r.id===id).equippedActorId==='hero',id);await page.evaluate(()=>loadouts.render(false));}
    await equip('set0-sphere');await equip('set0-rope');await page.locator('[data-equipment-path]').selectOption('ice');await page.waitForFunction(()=>loadouts.pathId==='ice');await equip('set1-sphere');await equip('set1-rope');
    assert.equal(await page.locator('[data-item="set0-sphere"] [data-equipped-path="hunt"]').count(),1);assert.equal(await page.locator('[data-item="set1-sphere"] [data-equipped-path="ice"]').count(),1);
    assert.match(await page.locator('.tp-path-status').innerText(),/only while this Path is active/);assert.match(await page.locator('[data-item="set1-sphere"]').innerText(),/Ice build/);
    await page.locator('[data-equipment-path]').selectOption('hunt');await page.waitForFunction(()=>loadouts.pathId==='hunt');await page.evaluate(async()=>{loadoutCatalog.activeId='ice';await loadouts.render(false)});
    assert.equal(await page.locator('[data-equipment-path]').inputValue(),'ice');assert.match(await page.locator('.tp-path-status').innerText(),/This Path is active/);
    await page.screenshot({path:path.join(output,'planar-path-loadouts.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS: strict v14 settings-menu registration; actual ApplicationV2 render, layout editing, wheel resize, set switching, defaults, save and reopen.');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
