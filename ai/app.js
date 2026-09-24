'use strict';
const el=id=>document.getElementById(id),names={background:'Regular play',card:'Card',goal:'Goal',shot:'Shot'};
const pulses={goal:[400,100,400,100,900],card:[150,80,150],shot:[250]};
let model=null,examples=[],recognition=null,listening=false,buffer=[],pulseTimer=null;
const vibrate=typeof navigator.vibrate==='function'?navigator.vibrate.bind(navigator):null;
function cancelPulse(){clearTimeout(pulseTimer);el('phone').classList.remove('pulsing');if(vibrate)try{vibrate(0);}catch(_){}}
function analyze(text,source='typed commentary'){
 if(!model)return;
 if(!text.trim()){el('input-status').textContent='Please add English commentary first.';return;}
 const start=performance.now(),result=model.predict(text);
 el('event-label').textContent=result.hasFeatures?names[result.label]:'Not enough information';
 el('event-detail').textContent=result.hasFeatures?Math.round(result.score*100)+'% model score · '+source:'Try a longer passage.';
 el('scores').replaceChildren();
 for(const [label,score] of Object.entries(result.scores)){
  const row=document.createElement('div');row.className='score-row';const name=document.createElement('span');name.textContent=names[label];const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.style.width=score*100+'%';track.append(fill);const value=document.createElement('span');value.textContent=Math.round(score*100)+'%';row.append(name,track,value);el('scores').append(row);
 }
 el('result-status').textContent='Research prediction only. Automatic vibration is paused.';
 el('input-status').textContent='Analyzed locally in '+(performance.now()-start).toFixed(1)+' ms. This measures text inference only.';
 window.dispatchEvent(new CustomEvent('koravibe:prediction',{detail:{...result,source}}));return result;
}
el('analyze').onclick=()=>analyze(el('commentary').value);
function stopListening(){listening=false;buffer=[];if(recognition)recognition.abort();cancelPulse();el('stop').disabled=true;el('listen').disabled=!recognition||!model;el('speech-status').textContent=recognition?'Microphone stopped.':'Speech recognition is not supported here. Paste commentary instead.';}
el('stop').onclick=stopListening;
el('clear').onclick=()=>{stopListening();el('commentary').value='';el('example-source').textContent='';el('scores').replaceChildren();el('event-label').textContent='Ready to feel';el('event-detail').textContent='Add commentary to begin';el('result-status').textContent='No event analyzed yet.';el('input-status').textContent='Cleared.';};
el('haptic-support').textContent=vibrate?'Vibration depends on device and browser support. Try a manual test.':'This browser does not support vibration (including iPhone Safari). Visual previews still work.';
document.querySelectorAll('[data-pattern]').forEach(button=>button.onclick=()=>{
 const type=button.dataset.pattern,pattern=pulses[type];let ok=false;if(vibrate)try{ok=vibrate(pattern)!==false;}catch(_){}
 clearTimeout(pulseTimer);el('phone').classList.add('pulsing');pulseTimer=setTimeout(()=>el('phone').classList.remove('pulsing'),pattern.reduce((a,b)=>a+b,0));
 el('result-status').textContent='Manual '+names[type].toLowerCase()+' pattern test. '+(ok?'Vibration command sent.':'Visual preview only; vibration unavailable.');
});
el('load-example').onclick=()=>{const r=examples[Number(el('example').value)];if(!r)return;stopListening();el('commentary').value=r.text;el('example-source').textContent=r.game.split('/').pop()+' · half '+r.half+' · window ending '+r.window_end_s+'s. Timestamp label: '+names[r.label]+'.';analyze(r.text,'held-out transcript');};
const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Speech){
 recognition=new Speech();recognition.lang='en-GB';recognition.continuous=true;recognition.interimResults=false;
 recognition.onstart=()=>{if(!listening){recognition.abort();return;}el('speech-status').textContent='Listening for English commentary…';};
 recognition.onresult=e=>{if(!listening)return;const now=Date.now();for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)buffer.push({time:now,text:e.results[i][0].transcript});buffer=buffer.filter(x=>now-x.time<=15000);const text=buffer.map(x=>x.text).join(' ').slice(-2000);el('commentary').value=text;if(text)analyze(text,'microphone transcript');};
 recognition.onerror=e=>{listening=false;el('listen').disabled=!model;el('stop').disabled=true;el('speech-status').textContent='Microphone recognition failed: '+e.error+'. You can still paste commentary.';};
 recognition.onend=()=>{listening=false;el('listen').disabled=!model;el('stop').disabled=true;if(el('speech-status').textContent.startsWith('Listening'))el('speech-status').textContent='Listening ended. Press Start microphone to continue.';};
 el('speech-status').textContent='Starts only when you press the button. HTTPS or localhost is required.';
 el('listen').onclick=()=>{if(listening||!model)return;buffer=[];listening=true;el('listen').disabled=true;el('stop').disabled=false;el('example-source').textContent='';try{recognition.start();}catch(e){listening=false;el('listen').disabled=false;el('stop').disabled=true;el('speech-status').textContent='Could not start microphone: '+e.message;}};
}else el('speech-status').textContent='Speech recognition is not supported here. Paste English commentary above.';
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopListening();});
(async()=>{
 try{model=await KoraVibeAI.load();window.koraVibeModel=model;el('model-status').textContent='● Trained model ready';el('analyze').disabled=false;el('listen').disabled=!recognition;const m=model.data.metrics;
 for(const [value,label] of [[m.matches,'matches in sample'],[m.windows.toLocaleString(),'commentary windows'],[(m.test_macro_f1*100).toFixed(1)+'%','held-out macro F1'],[m.test_samples.toLocaleString(),'test windows']]){const div=document.createElement('div');div.className='metric';const strong=document.createElement('strong');strong.textContent=value;const span=document.createElement('span');span.textContent=label;div.append(strong,span);el('metrics').append(div);}
 }catch(e){el('model-status').textContent='Model unavailable';el('input-status').textContent=e.message+' The training build may still be running.';return;}
 try{const r=await fetch('ai/examples.json');if(!r.ok)throw Error();examples=await r.json();el('example').replaceChildren();examples.forEach((x,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Excerpt '+(i+1)+' · '+names[x.label]+' (timestamp label)';el('example').append(o);});el('example').disabled=false;el('load-example').disabled=false;}catch(_){el('example-source').textContent='Samples unavailable. You can still type commentary.';}
})();
