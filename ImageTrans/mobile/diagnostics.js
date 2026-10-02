const status=document.getElementById('status'),result=document.getElementById('result');
let src='',objectURL='';
function message(req){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Background unavailable. Reload Orion and retry.')),12000);chrome.runtime.sendMessage(req,r=>{clearTimeout(timer);if(chrome.runtime.lastError || !r)reject(Error(chrome.runtime.lastError?.message || 'No reply'));else if(r.error)reject(Error(r.error));else resolve(r);});});}
async function job(kind){
  for(const b of document.querySelectorAll('button'))b.disabled=true;
  try{
    if(kind!=='diagnostic' && !src)throw Error('Choose an image first');
    const {id}=await message({action:'mobileStart',kind,src});let deadline=Date.now()+180000,last='';
    for(;;){const j=await message({action:'mobilePoll',id});status.textContent=j.status;if(j.status!==last){last=j.status;deadline=Date.now()+180000;}if(j.done){result.textContent=JSON.stringify(j.result,null,2);draw(j.result);break;}if(Date.now()>deadline)throw Error('OCR timed out; keep Orion foreground.');await new Promise(r=>setTimeout(r,650));}
  }catch(e){status.textContent=e.message;}finally{for(const b of document.querySelectorAll('button'))b.disabled=false;}
}
function draw(r){const layer=document.getElementById('boxes');layer.replaceChildren();for(const b of r.boxes || []){const el=document.createElement('div'),g=b.geometry;el.style.cssText=`left:${g.X/r.width*100}%;top:${g.Y/r.height*100}%;width:${g.width/r.width*100}%;height:${g.height/r.height*100}%`;layer.appendChild(el);}}
document.getElementById('test').onclick=()=>job('diagnostic');
document.getElementById('ocr').onclick=()=>job('ocr');
document.getElementById('translate').onclick=()=>job('image');
document.getElementById('file').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024){status.textContent='Choose an image under 5 MB for file-mode messaging.';return;}
 if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);document.getElementById('image').src=objectURL;
 src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});status.textContent='Image ready. Tap Scan locally.';
};
