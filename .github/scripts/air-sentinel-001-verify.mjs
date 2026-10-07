import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const target=path.resolve(process.argv[2]||'target'),base=path.resolve(process.argv[3]||'baseline'),rel='lab/sentinel_v021_candidate';
const root=path.join(target,rel),baseRoot=path.join(base,rel);
const {default:handler}=await import(pathToFileURL(path.join(root,'api/nws.js')));
const {representativePoint}=await import(pathToFileURL(path.join(root,'src/geo.js')));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync('evidence',{recursive:true});
const preserved=['styles.css','index.html','api/nws.js','lib/nws-transport.js','src/adapters/nws-adapter.js','src/adapters/fixture-adapter.js'];
for(const file of preserved)assert.equal(digest(fs.readFileSync(path.join(root,file))),digest(fs.readFileSync(path.join(baseRoot,file))),file+' must remain byte-identical');
const server=http.createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/nws')){res.status=function(n){this.statusCode=n;return this};res.json=function(b){this.end(JSON.stringify(b))};return await handler(req,res)}
 const u=new URL(req.url,'http://localhost'),isBase=u.pathname.startsWith('/baseline/');let p=decodeURIComponent(u.pathname).replace(/^\/(baseline|candidate)\//,'');if(!p||p.endsWith('/'))p+='index.html';
 const r=isBase?baseRoot:root,f=path.resolve(r,p);if(!f.startsWith(r+path.sep))throw Error('invalid_path');
 const bytes=fs.readFileSync(f);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(bytes);
}catch{res.statusCode=404;res.end('not_found')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const geometry={type:'Polygon',coordinates:[[[-84.8,43.2],[-84.0,43.2],[-84.0,44.0],[-84.8,44.0],[-84.8,43.2]]]};
const stamp='2026-10-07T12:00:00Z';
const alert={type:'Feature',id:'test-only-nws-alert',geometry:null,properties:{id:'test-only-nws-alert',event:'Test fixture alert',headline:'Browser test fixture — NOT A LIVE ALERT',description:'Fixture-only source message',instruction:'Fixture-only instruction',senderName:'TEST FIXTURE',areaDesc:'Test county',severity:'Moderate',urgency:'Expected',certainty:'Likely',sent:stamp,effective:stamp,expires:'2026-10-08T12:00:00Z'}};
function envelope(data,op){const bytes=Buffer.from(JSON.stringify(data));return {ok:true,upstream:{url:'https://api.weather.gov/TEST-FIXTURE/'+op,responseReceived:stamp,status:200},representation:{bytes:bytes.toString('base64'),sha256:digest(bytes)}}}
let mode='alert';const evidence={status:'PASS',source_commit:'e4e6bf8197f177861e1fb9e6378a2a8e7bb85c7b',preserved_files:preserved,browser_fixture_tests:[],live_nws:{status:'NOT_RUN'}};
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 for(const [label,size]of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:1000}]]){
 const ctx=await browser.newContext({viewport:size});let geolocation=0;const errors=[];let apiCalls=0;
 await ctx.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){throw Error('GEOLOCATION_FORBIDDEN')},watchPosition(){throw Error('GEOLOCATION_FORBIDDEN')}}})});
 await ctx.route('**/api/nws?*',async route=>{apiCalls++;const op=new URL(route.request().url()).searchParams.get('op');if(mode==='error')return route.fulfill({status:502,json:{ok:false,error:'TEST_UPSTREAM_UNAVAILABLE'}});
 const data=op==='zone'?{type:'Feature',geometry,properties:{id:'MIC111',name:'Test county'}}:op==='alerts'?{type:'FeatureCollection',features:mode==='empty'?[]:[alert]}:op==='point'?{properties:{gridId:'DTX',gridX:65,gridY:90}}:{properties:{periods:[{name:'Test today',temperature:65,temperatureUnit:'F',shortForecast:'TEST FIXTURE',windSpeed:'5 mph',windDirection:'W'}]}};return route.fulfill({json:envelope(data,op)})});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 mode='alert';await page.goto(origin+'/baseline/');await page.locator('[data-go="places"]').first().click();await page.locator('input[name=id]').fill('MIC111');await page.locator('[data-set-area]').click();await page.waitForFunction(()=>document.body.textContent.includes('NWS check complete.'));
 await page.locator('[data-nav=home]').click();await page.screenshot({path:`evidence/${label}-home-baseline.png`,fullPage:true});
 await page.goto(origin+'/candidate/');await page.waitForFunction(()=>document.body.textContent.includes('NWS check complete.'));await page.screenshot({path:`evidence/${label}-home-candidate.png`,fullPage:true});
 assert.equal(digest(fs.readFileSync(`evidence/${label}-home-baseline.png`)),digest(fs.readFileSync(`evidence/${label}-home-candidate.png`)),label+' Home pixels preserved');
 await page.locator('[data-nav=explore]').click();assert.equal(await page.locator('.marker').count(),0);assert.equal(await page.locator('.coverage-map svg').count(),1);assert.ok((await page.locator('.section-title').innerText()).includes('NOAA/NWS'));
 await page.locator('.nws-row').first().click();await page.locator('[data-explain]').click();assert.ok((await page.locator('main').innerText()).includes('does not know your exact location'));await page.locator('[data-return-map]').first().click();assert.equal(await page.locator('[data-explain]').count(),1);
 await page.screenshot({path:`evidence/${label}-real-sheet.png`,fullPage:true});
 await page.locator('[data-close-sheet]').click();await page.locator('[data-plane=sample]').first().click();assert.ok(await page.locator('.marker').count()>0);assert.ok((await page.locator('main').innerText()).includes('SYNTHETIC'));
 await page.locator('[data-plane=nws]').first().click();assert.equal(await page.locator('.marker').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' no horizontal overflow');
 mode='empty';await page.locator('[data-nav=home]').click();await page.locator('[data-refresh-nws]').click();await page.waitForFunction(()=>document.body.textContent.includes('No active NWS alerts for'));
 mode='error';await page.locator('[data-refresh-nws]').click();await page.waitForFunction(()=>document.body.textContent.includes('NWS status is unknown'));assert.ok(!(await page.locator('main').innerText()).includes('No active NWS alerts for'));assert.equal(errors.length,0,errors.join('\n'));
 evidence.browser_fixture_tests.push({viewport:label,size,checks:['Home pixels identical','saved area restored','NWS coverage default; no synthetic markers','real alert sheet → Explain This → same selected sheet','explicit samples toggle','empty success distinguished from unknown','no horizontal overflow','no page errors'],api_calls:apiCalls});await ctx.close();
 }
 // Live test uses the actual candidate API handler. No intercepted responses or fixtures.
 const liveCtx=await browser.newContext({viewport:{width:390,height:844}}),page=await liveCtx.newPage();const responses=[];
 page.on('response',r=>{if(r.url().includes('/api/nws?'))responses.push({url:r.url().replace(origin,''),status:r.status()})});
 await page.goto(origin+'/candidate/');await page.locator('[data-go=places]').first().click();await page.locator('input[name=id]').fill('MIC111');await page.locator('[data-set-area]').click();await page.waitForFunction(()=>document.body.textContent.includes('NWS check complete.')||document.body.textContent.includes('NWS check failed.'),null,{timeout:60000});
 await page.locator('[data-nav=home]').click();const text=await page.locator('main').innerText();await page.screenshot({path:'evidence/mobile-live-nws-home.png',fullPage:true});
 // Independent same-origin raw evidence read, including hashes and official geometry-derived point.
 const z=await fetch(origin+'/api/nws?op=zone&type=county&id=MIC111').then(r=>r.json());assert.ok(z.ok);const zone=JSON.parse(Buffer.from(z.representation.bytes,'base64'));assert.equal(zone.properties.id,'MIC111');const p=representativePoint(zone.geometry);
 const a=await fetch(origin+'/api/nws?op=alerts&zone=MIC111').then(r=>r.json());assert.ok(a.ok);const alerts=JSON.parse(Buffer.from(a.representation.bytes,'base64'));assert.ok(Array.isArray(alerts.features));
 const pt=await fetch(origin+`/api/nws?op=point&lat=${p.lat}&lon=${p.lon}`).then(r=>r.json());assert.ok(pt.ok,'LIVE_POINT_FAILED '+JSON.stringify(pt));const point=JSON.parse(Buffer.from(pt.representation.bytes,'base64')).properties;
 const fc=await fetch(origin+`/api/nws?op=forecast&office=${point.gridId}&x=${point.gridX}&y=${point.gridY}`).then(r=>r.json());assert.ok(fc.ok);const periods=JSON.parse(Buffer.from(fc.representation.bytes,'base64')).properties.periods;assert.ok(periods.length>0);
 assert.ok(text.includes('NWS FORECAST · REAL')&&text.includes('Last checked')&&!text.includes('redirect_rejected')&&!text.includes('invalid_lon'));
 await page.locator('[data-nav=explore]').click();assert.equal(await page.locator('.coverage-map svg').count(),1);assert.equal(await page.locator('.marker').count(),0);
 for(const e of [z,a,pt,fc])assert.equal(new URL(e.upstream.url).hostname,'api.weather.gov');
 evidence.live_nws={status:'PASS',fixture:false,county:'MIC111',representative_point:p,alert_count:alerts.features.length,forecast_periods:periods.length,responses,reads:[z,a,pt,fc].map(e=>({upstream:e.upstream,representation_sha256:e.representation.sha256}))};
 fs.writeFileSync('evidence/live-nws-envelopes.json',JSON.stringify({zone:z,alerts:a,point:pt,forecast:fc},null,2));await liveCtx.close();
}catch(e){evidence.status='FAIL';evidence.error=e.stack;throw e}finally{fs.writeFileSync('evidence/verification.json',JSON.stringify(evidence,null,2));await browser?.close();await new Promise(r=>server.close(r))}
console.log('AIR_SENTINEL_001_BROWSER_AND_LIVE_NWS PASS');
