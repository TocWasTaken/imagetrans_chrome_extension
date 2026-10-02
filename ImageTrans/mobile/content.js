/* Loaded in the isolated content world; keys never enter page scripts/DOM. */
const mobileLayers=new Map();
function mobileToast(text,error=false){
  let el=document.getElementById('imagetrans-mobile-toast');
  if(!el){el=document.createElement('div');el.id='imagetrans-mobile-toast';el.setAttribute('role','status');document.documentElement.appendChild(el);}
  el.style.cssText='position:fixed;bottom:80px;left:12px;right:12px;z-index:2147483647;padding:14px;border-radius:12px;background:'+(error?'#8b2424':'#152337')+';color:white;font:14px/1.4 system-ui;pointer-events:none;white-space:pre-wrap';
  el.textContent=text;clearTimeout(el.timer);el.timer=setTimeout(()=>el.remove(),error?14000:6000);
}
function mobileMessage(request){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Orion extension did not respond. Reload this page and retry.')),12000);chrome.runtime.sendMessage(request,r=>{clearTimeout(timer);if(chrome.runtime.lastError || !r)reject(Error(chrome.runtime.lastError?.message || 'Extension unavailable'));else if(r.error)reject(Error(r.error));else resolve(r);});});}
async function mobileJob(request,progress=mobileToast){
  const {id}=await mobileMessage({action:'mobileStart',...request});
  let last='',deadline=Date.now()+180000;
  for(;;){
    await new Promise(r=>setTimeout(r,650));
    const j=await mobileMessage({action:'mobilePoll',id});
    if(j.status!==last){last=j.status;progress(last);deadline=Date.now()+180000;}
    if(j.done)return j.result;
    if(Date.now()>deadline)throw Error('OCR stopped responding. Keep Orion foreground and retry.');
  }
}
function mobileToggle(img){const layer=mobileLayers.get(img);if(!layer)return false;layer.hidden=!layer.hidden;return true;}
let mobileLayoutPending=false;
function mobileLayout(){
  mobileLayoutPending=false;
  for(const [img,layer] of mobileLayers){
    if(!img.isConnected){layer.remove();mobileResize?.unobserve(img);mobileLayers.delete(img);continue;}
    const r=img.getBoundingClientRect();layer.style.left=(r.left+scrollX)+'px';layer.style.top=(r.top+scrollY)+'px';layer.style.width=r.width+'px';layer.style.height=r.height+'px';
    for(const el of layer.children){const g=el.box.geometry;el.style.fontSize=Math.max(7,Math.min(24,g.height* r.width/img.naturalWidth*.55,Math.sqrt(g.width*g.height/Math.max(1,el.textContent.length))*r.width/img.naturalWidth*1.25))+'px';}
  }
}
function mobileScheduleLayout(){if(!mobileLayoutPending){mobileLayoutPending=true;requestAnimationFrame(mobileLayout);}}
addEventListener('resize',mobileScheduleLayout,{passive:true});addEventListener('scroll',mobileScheduleLayout,{passive:true});
const mobileResize=typeof ResizeObserver!=='undefined'?new ResizeObserver(mobileScheduleLayout):null;
function mobileOverlay(img,result){
  mobileLayers.get(img)?.remove();
  const layer=document.createElement('div');layer.style.cssText='position:absolute;z-index:2147483000;pointer-events:none;overflow:hidden';
  for(const box of result.boxes){const g=box.geometry,el=document.createElement('div');el.box=box;el.textContent=box.target;el.title=box.source;
    el.style.cssText=`position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;padding:2px;background:white;color:black;border-radius:8%;font-family:system-ui;line-height:1.1;left:${g.X/result.width*100}%;top:${g.Y/result.height*100}%;width:${g.width/result.width*100}%;height:${g.height/result.height*100}%;`;
    layer.appendChild(el);
  }
  document.documentElement.appendChild(layer);mobileLayers.set(img,layer);mobileResize?.observe(img);mobileLayout();
}
async function ajaxMobile(src,img,checkData,showOverlay){
  try{
    if(!img)throw Error('Image could not be captured — center the image on screen first');
    let input=img.getAttribute('original-src') || img.currentSrc || src;
    if(input.startsWith('blob:'))throw Error('This page uses a private Blob image. Use Screen capture or save it and open Mobile OCR diagnostics.');
    const result=await mobileJob({kind:'image',src:input},text=>{mobileToast(text);const overlay=img._translatingOverlay;if(overlay)overlay.textContent=text;});
    if (!img.isConnected || (img.getAttribute('original-src') || img.currentSrc || src)!==input) throw Error('Image changed during OCR. Translate the new image again.');
    mobileToast('Rendering…');
    // Reuse upstream replacement renderer on bounded images. Tall images remain DOM overlays.
    if(result.width*result.height<=1500000 && result.height<=2400){
      try{
        const data=await getDataURLFromImg(img);
        const rendered=await renderTranslatedImageCanvas(data,result.boxes);
        replaceImgSrc(src,rendered,checkData,img,result.boxes,data);
        saveTranslationResultToDB(data,rendered,{boxes:result.boxes});
      }catch{mobileOverlay(img,result);}
    }else mobileOverlay(img,result);
    mobileToast(`Done — ${result.boxes.length} regions. Use Original/translated to toggle.`);
  }catch(e){mobileToast(e.message,true);if(typeof translatedSrcs!=='undefined')delete translatedSrcs[src];}
  finally{document.body.classList.remove('imagetrans-wait');if(img)hideTranslatingOverlay(img);}
}
