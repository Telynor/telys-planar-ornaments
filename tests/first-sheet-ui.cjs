// Production Planar sheet hooks with the native D&D5e 6 details layout.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),prefix='/modules/telys-planar-ornaments/';
(async()=>{
  const {detailsHTML,character}=await import('./fixtures/character-sheet.mjs');
  const source=await fs.readFile(path.join(__dirname,'designer-ui.cjs'),'utf8'),box={require,__dirname};vm.createContext(box);vm.runInContext(source.slice(0,source.indexOf('(async()=>{'))+'\nthis.bootstrap=boot;',box);
  const boot=box.bootstrap.replace('await openDesigner();window.booted=true;',`
    window.actor=${JSON.stringify(character())};Object.assign(actor,{uuid:'Actor.hero',name:'Hero',items:[],isOwner:true,getFlag:(_scope,key)=>actor._source.flags?.[_scope]?.[key]});
    window.sheet=document.querySelector('#first-sheet');window.details=sheet.querySelector('.col-2');window.detailsMarkup=${JSON.stringify(detailsHTML())};
    window.app={document:actor,actor,element:sheet};window.draw=()=>planar.injectSheet(app,sheet);
    draw();window.firstToggle=sheet.querySelector('.tp-ability-toggle');window.booted=true;
  `);
  const css='body{background:#18202d;color:#eee;font:14px system-ui;margin:8px}#first-sheet{width:960px;max-width:calc(100vw - 16px);margin:0 auto;border:1px solid #756c54;border-radius:8px;box-sizing:border-box}.window-header{display:flex;align-items:center;gap:8px;background:#292c36;padding:8px}.window-header h2{flex:1;font-size:16px;margin:0}.window-header button{color:inherit;background:none;border:1px solid #726b58}.tab-body{padding:12px}.col-2{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px}.left,.right{display:flex;flex-direction:column;gap:8px;min-width:0}.top{display:flex;gap:12px;align-items:start}filigree-box{display:block;border:2px solid #777263;border-radius:12px;background:#252832;min-width:0;padding:12px}filigree-box h3{margin:0 0 12px;color:#d0bd86;font-size:15px}filigree-box ul{list-style:none;padding:0;margin:0}filigree-box li{display:flex;gap:16px;padding:8px;border-bottom:1px dotted #64645f}.saves{flex:1}.saves ul{display:grid;grid-template-columns:1fr 1fr}.bonus{margin-left:auto;font-weight:bold}.sign{color:#b9aa85}.pills-lg{font-size:12px;color:#b9aa85;max-width:100px}.scores{display:grid;grid-template-columns:1fr 1fr;gap:8px}.scores label{display:flex;justify-content:space-between;align-items:center}.scores input{width:50px;background:#151823;color:#eee;border:1px solid #777263;padding:5px}';
  const server=http.createServer(async(req,res)=>{try{
    const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="'+prefix+'styles/planar.css"><script src="/jquery.js"></script><style>'+css+'</style></head><body><section id="first-sheet" class="application dnd5e2 sheet actor character"><header class="window-header"><h2>Character — First Open</h2><button data-action="close">×</button></header><div class="tab-body"><section class="tab col-2 active" data-tab="details">'+detailsHTML()+'</section></div></section><script type="module">'+boot+'</script></body></html>');return;}
    if(pathname==='/jquery.js'){res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(require.resolve('jquery')));return;}
    if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
    const file=path.resolve(root,pathname.slice(prefix.length));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    let data=await fs.readFile(file);if(file.endsWith('/scripts/planar.mjs'))data=data.toString()+'\nexport {injectSheet};';
    res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(data);
  }catch(error){res.writeHead(500);res.end(error.message);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.booted);
    const score=page.locator('[name="system.abilities.str.value"]'),bonus=page.locator('.saves [data-ability="str"] .bonus');
    const checkColumns=async()=>{
      const geometry=await page.locator('.col-2').evaluate(grid=>{const [left,right]=grid.children,a=left.getBoundingClientRect(),b=right.getBoundingClientRect();return {children:[...grid.children].map(node=>node.className),left:a.left,right:b.left,deltaY:Math.abs(a.top-b.top),overflow:grid.scrollWidth-grid.clientWidth};});
      assert.deepEqual(geometry.children,['left','right']);assert.ok(geometry.left<geometry.right);assert.ok(geometry.deltaY<1);assert.ok(geometry.overflow<=1);
    };
    await checkColumns();assert.equal(await score.inputValue(),'14');assert.equal(await bonus.innerText(),'+4');assert.equal(await bonus.locator('.sign').count(),1);assert.equal(await page.locator('.tp-original-saves').count(),0);
    await page.evaluate(()=>{for(let i=0;i<5;i++)draw()});assert.equal(await page.locator('.tp-ability-toggle').count(),1);
    await page.locator('.tp-ability-toggle').click();assert.equal(await score.inputValue(),'18');assert.equal(await bonus.innerText(),'+7');
    await page.evaluate(()=>{details.innerHTML=detailsMarkup;details.querySelector('.saves h3').textContent='Tiradas de salvación';draw()});
    assert.equal(await page.evaluate(()=>firstToggle===sheet.querySelector('.tp-ability-toggle')),true,'native partial renders retain the header button and bind it to the replacement body');
    assert.equal(await score.inputValue(),'18');await page.locator('.tp-ability-toggle').click();assert.equal(await score.inputValue(),'14');assert.equal(await score.getAttribute('readonly'),null);assert.equal(await bonus.innerText(),'+4');
    for(const width of [1100,982,800,640]){await page.setViewportSize({width,height:850});await checkColumns();}
    await page.evaluate(()=>{details.querySelector('.saves [data-ability="cha"] .bonus').remove();draw()});
    assert.equal(await page.locator('.saves > .tp-original-saves').count(),1);await checkColumns();
    await page.locator('.tp-ability-toggle').click();assert.equal(await page.locator('.tp-original-saves').isVisible(),false);await page.locator('.tp-ability-toggle').click();assert.equal(await page.locator('.tp-original-saves').isVisible(),true);
    const output=process.env.BROWSER_ARTIFACTS||path.join(root,'artifacts');await fs.mkdir(output,{recursive:true});await page.setViewportSize({width:1100,height:850});await page.locator('#first-sheet').screenshot({path:path.join(output,'first-sheet-layout.png')});
    assert.deepEqual(errors,[]);console.log('PASS: actual Planar first-open injection, native D&D5e 6 two-column geometry at 1100/982/800/640px, signed saving throws, localized panel, preserved stats mode, retained-header partial rerenders, repeat hooks and contained fallback summary.');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
