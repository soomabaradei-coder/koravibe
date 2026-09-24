const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.pulseCalls=[];Object.defineProperty(navigator,'vibrate',{value:p=>{window.pulseCalls.push(p);return true;},configurable:true});window.SpeechRecognition=class{constructor(){window.mockSpeech=this;}start(){this.onstart();}abort(){this.onend();}};});
 await page.goto('http://127.0.0.1:8000/ai.html');await page.waitForFunction(()=>window.koraVibeModel);
 assert.equal(await page.locator('#analyze').isEnabled(),true);
 await page.locator('#commentary').fill('The referee shows a yellow card for that late tackle.');await page.locator('#analyze').click();
 assert.equal(await page.locator('.score-row').count(),4);assert.equal(await page.evaluate(()=>window.pulseCalls.length),0);
 await page.locator('#load-example').click();assert.match(await page.locator('#example-source').textContent(),/Timestamp label/);
 await page.locator('[data-pattern="goal"]').click();assert.match(await page.locator('#result-status').textContent(),/Manual goal/);
 await page.locator('#commentary').fill('<img src=x onerror="window.bad=true"> not a goal.');await page.locator('#analyze').click();assert.equal(await page.evaluate(()=>window.bad),undefined);
 await page.screenshot({path:'ml/reports/desktop.png',fullPage:true});
 await page.locator('#clear').click();assert.equal(await page.locator('#commentary').inputValue(),'');
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'ml/reports/mobile.png',fullPage:true});
 await page.locator('#listen').click();assert.equal(await page.locator('#stop').isEnabled(),true);
 await page.evaluate(()=>window.mockSpeech.onresult({resultIndex:0,results:[Object.assign([{transcript:'The ball is in the net. Goal!'}],{isFinal:true})]}));assert.match(await page.locator('#event-detail').textContent(),/microphone transcript/);
 await page.locator('#stop').click();const old=await page.locator('#commentary').inputValue();
 await page.evaluate(()=>window.mockSpeech.onresult({resultIndex:0,results:[Object.assign([{transcript:'Ignore late result'}],{isFinal:true})]}));assert.equal(await page.locator('#commentary').inputValue(),old);
 await page.locator('#listen').click();await page.evaluate(()=>window.mockSpeech.onerror({error:'not-allowed'}));assert.match(await page.locator('#speech-status').textContent(),/not-allowed/);
 await page.route('**/ai/model.json',r=>r.abort());await page.reload();await page.waitForFunction(()=>document.getElementById('model-status').textContent==='Model unavailable');assert.equal(await page.locator('#analyze').isDisabled(),true);
 assert.deepEqual(errors,[]);await browser.close();
 const report={status:'passed',browser:'Chromium',checks:['model load','actual inference','no automatic vibration','held-out examples','manual pulse command','text injection safety','clear','390/768/1440px overflow','mock microphone lifecycle','late transcript suppression','recognition error','model load failure'],physical_phone_tested:false,real_microphone_tested:false,errors};fs.writeFileSync('ml/reports/browser_tests.json',JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
