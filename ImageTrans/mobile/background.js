/* MV2 background document: shared engine, small JSON polling messages, no service worker/iframe. */
(() => {
'use strict';
const engine=new MobileEngine(p=>chrome.runtime.getURL(p));
const jobs=new Map();let tail=Promise.resolve(), waiting=0;
const defaults={sourceLang:'ko',targetLang:'en',openaiURL:'https://openrouter.ai/api/v1',openaiKey:'',openaiModel:'tencent/hy-mt2-7b',openaiPrompt:MobileCommon.PROMPT,openaiExtraParams:'',saveTranslationResult:true,useTranslationCache:true};
function settings(){return new Promise(r=>chrome.storage.local.get(defaults,r));}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('ImageTransMobile',1);r.onupgradeneeded=()=>r.result.createObjectStore('results');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function cache(key,value){const d=await db();try{return await new Promise((resolve,reject)=>{const t=d.transaction('results',value?'readwrite':'readonly'),s=t.objectStore('results');const r=value?s.put(value,key):s.get(key);r.onsuccess=()=>{if(!value)resolve(r.result);};if(value){t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);const count=s.count();count.onsuccess=()=>{let excess=count.result-200;if(excess>0){const cursor=s.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c && excess-->0){c.delete();c.continue();}};}};}r.onerror=()=>reject(r.error);});}finally{d.close();}}
async function loadImage(src){
  if(!/^(https?:|data:image\/|blob:)/i.test(src))throw Error('Image could not be captured: unsupported URL');
  let obj;
  try {
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
    let blob;try{const r=await fetch(src,{signal:ctrl.signal});if(!r.ok)throw Error(`HTTP ${r.status}`);blob=await r.blob();}finally{clearTimeout(timer);}
    if(blob.size>25*1024*1024)throw Error('Image exceeds 25 MB; use a smaller image or screen capture');
    obj=URL.createObjectURL(blob);
    const img=new Image();
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Image decoding timed out')),30000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('Image could not be decoded'));};img.src=obj;});
    if(img.naturalWidth*img.naturalHeight>40e6){img.src='';throw Error('Image exceeds 40 megapixels; use screen capture to select a smaller area');}
    return {img,release(){img.src='';URL.revokeObjectURL(obj);}};
  }catch(e){if(obj)URL.revokeObjectURL(obj);throw Error('Image could not be captured: '+e.message);}
}
async function translate(texts,s,progress){
  if(!s.openaiKey.trim())throw Error('OpenRouter API key missing — add it in Options');
  const endpoint=new URL(s.openaiURL);if(endpoint.protocol!=='https:')throw Error('Use an HTTPS API URL');
  const all=[];
  for(let start=0;start<texts.length;){
    const batch=[];let chars=0;
    while(start+batch.length<texts.length && batch.length<16){const t=texts[start+batch.length];if(t.length>3500)throw Error('OCR region too large for translation');if(batch.length && chars+t.length>3500)break;batch.push(t);chars+=t.length;}
    progress(`Translating ${start+1}–${start+batch.length} of ${texts.length} regions…`);
    let translated;
    for(let retry=0;retry<2;retry++){
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),60000);
      let result;
      try {
        const r=await fetch(s.openaiURL.replace(/\/+$/,'')+'/chat/completions',{method:'POST',signal:ctrl.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.openaiKey},body:JSON.stringify(MobileCommon.requestBody(batch,s,!!retry,texts.slice(Math.max(0,start-3),start)))});
        if(!r.ok)throw Error(`HY-MT2 request failed: HTTP ${r.status}${r.status===401?' — check API key':r.status===402?' — check OpenRouter credits':''}`);
        result=await r.json();
      }finally{clearTimeout(timer);}
      try {translated=MobileCommon.parseTranslations(result.choices?.[0]?.message?.content,batch.length);break;}
      catch(e){if(retry)throw e;progress('Translation response was invalid — retrying once…');}
    }
    all.push(...translated);start+=batch.length;
  }
  return all;
}
async function run(job,request){
  const progress=t=>{job.status=t;job.updated=Date.now();};
  try {
    const s=await settings();
    if(request.kind==='translate'){job.result=await translate(request.texts,s,progress);return;}
    if(request.kind==='diagnostic'){
      engine.progress=progress;await engine.init('kor');
      job.result={worker:true,wasm:true,koreanModel:true,message:'Worker, WASM and Korean model initialized. Next test a Korean image.'};return;
    }
    if(!['ko','kor','Korean','auto','en','eng','English'].includes(s.sourceLang))throw Error('Mobile OCR bundles Korean and English. Select Korean or English as source language.');
    if(request.kind!=='ocr' && !s.openaiKey.trim())throw Error('OpenRouter API key missing — add it in Options');
    // Cache includes configuration, never the API key. OCR version invalidates old geometry.
    const key=JSON.stringify([request.src,s.sourceLang,s.targetLang,s.openaiURL,s.openaiModel,s.openaiPrompt,s.openaiExtraParams,'mobile-v1']);
    if(request.kind!=='ocr' && s.useTranslationCache){try{const hit=await cache(key);if(hit){job.result=hit;progress('Done — cached translation');return;}}catch{progress('Cache unavailable — continuing');}}
    progress('Loading image…');const loaded=await loadImage(request.src);
    try{
      const lang=['en','eng','English'].includes(s.sourceLang)?'eng':'kor';
      const boxes=await engine.scan(loaded.img,lang,progress);
      progress(`Detected ${boxes.length} text regions`);
      if(!boxes.length)throw Error('No Korean text detected — try a clearer crop or larger text');
      if(request.kind!=='ocr'){
        const texts=await translate(boxes.map(b=>b.source),s,progress);
        boxes.forEach((b,i)=>b.target=texts[i]);
      }
      job.result={boxes,width:loaded.img.naturalWidth,height:loaded.img.naturalHeight};
      if(request.kind!=='ocr' && s.saveTranslationResult){try{await cache(key,{...job.result,src:request.src,timestamp:Date.now()});}catch{progress('Translation complete; cache could not be saved');}}
    }finally{loaded.release();}
    progress('Done');
  }catch(e){job.error=e.message || String(e);job.status=job.error;}
  finally{job.done=true;job.updated=Date.now();waiting--;setTimeout(()=>jobs.delete(job.id),300000);}
}
chrome.runtime.onMessage.addListener((request,sender,reply)=>{
  if(request?.action==='mobileStart'){
    if(waiting>=20){reply({error:'OCR queue full — wait for current images'});return;}
    const id=crypto.randomUUID(),job={id,status:'Queued…',updated:Date.now(),done:false,owner:sender.tab?.id};jobs.set(id,job);waiting++;
    tail=tail.then(()=>run(job,request)).catch(()=>{});reply({id});
  }else if(request?.action==='mobilePoll'){
    const job=jobs.get(request.id);
    if(!job)reply({error:'OCR session ended. Orion may have suspended it; retry with Orion in the foreground.'});
    else if(job.owner!==sender.tab?.id)reply({error:'This OCR job belongs to another tab'});
    else reply(job);
  }
});
})();
