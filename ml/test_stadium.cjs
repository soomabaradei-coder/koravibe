const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.pulses=[];Object.defineProperty(navigator,'vibrate',{value:p=>{window.pulses.push(p);return true;}});});
 await page.goto(process.env.STADIUM_URL||'http://127.0.0.1:8000/stadium.html');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);}
 await page.setViewportSize({width:390,height:844});
 for(const [key,name,pattern]of [['goal','Goal',[450,180,450,180,450]],['shot','Shot on target',[140,130,140]],['yellow','Yellow card',[600]],['red','Red card',[600,200,600]],['substitution','Substitution',[140,180,600]]]){
  await page.locator('[data-event="'+key+'"]').click();assert.equal(await page.locator('#moment-title').textContent(),name);assert.deepEqual(await page.evaluate(()=>window.pulses.at(-1)),pattern);assert.equal(await page.locator('#moment-label').textContent(),'SIMULATED EVENT');
 }
 assert.equal(await page.locator('#history li').count(),5);
 await page.locator('#haptics').click();const before=await page.evaluate(()=>window.pulses.length);await page.locator('[data-event="goal"]').click();assert.deepEqual(await page.evaluate(n=>window.pulses.slice(n),before),[0]);
 await page.locator('#clear').click();assert.equal(await page.locator('#history .empty').count(),1);
 await page.locator('#demo').click();assert.equal(await page.locator('#demo-label').textContent(),'Stop demo');await page.locator('#demo').click();const count=await page.locator('#history li').count();await page.waitForTimeout(2800);assert.equal(await page.locator('#history li').count(),count);
 await page.locator('#help').click();assert(await page.locator('#help-dialog').isVisible());await page.locator('#got-it').click();assert(!(await page.locator('#help-dialog').isVisible()));
 await page.evaluate(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('denied','NotAllowedError');}});});
 await page.locator('#listen').click();await page.waitForFunction(()=>document.getElementById('sound-description').textContent.includes('denied'));assert.equal(await page.locator('#listen').getAttribute('aria-pressed'),'false');
 await page.evaluate(()=>{window.trackStopped=0;window.audioClosed=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>({getTracks:()=>[{stop:()=>window.trackStopped++,addEventListener:()=>{}}]})});window.AudioContext=class{resume(){return Promise.resolve();}close(){window.audioClosed++;return Promise.resolve();}createAnalyser(){return{fftSize:1024,getByteTimeDomainData:a=>a.fill(132)};}createMediaStreamSource(){return{connect:()=>{}};}};});
 await page.locator('#listen').click();await page.waitForFunction(()=>document.getElementById('sound-state').textContent==='LISTENING');assert.equal(await page.locator('#mode').textContent(),'MICROPHONE PREVIEW');const moments=await page.locator('#history li').count();await page.waitForTimeout(300);assert.equal(await page.locator('#history li').count(),moments,'Meter must not invent events');
 await page.locator('#listen').click();assert.equal(await page.evaluate(()=>window.trackStopped),1);assert.equal(await page.evaluate(()=>window.audioClosed),1);
 await page.locator('[data-event="goal"]').click();
 if(process.env.STADIUM_SCREENSHOT)await page.screenshot({path:process.env.STADIUM_SCREENSHOT,fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('Stadium UI passed: five haptics, demo stop, mic lifecycle/errors, no fabricated events, responsive widths.');
})().catch(e=>{console.error(e);process.exit(1);});
