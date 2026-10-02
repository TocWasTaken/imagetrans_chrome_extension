/* One single-threaded Tesseract worker. Own its lifecycle so timeouts terminate it. */
class MobileEngine {
  constructor(url) { this.url=url; this.worker=null; this.lang=null; this.pending=null; this.next=0; this.progress=()=>{}; }
  stop() {
    if(this.worker) this.worker.terminate();
    this.worker=null; this.lang=null;
    if(this.pending) { clearTimeout(this.pending.timer); this.pending.reject(Error('OCR stopped; please retry')); this.pending=null; }
    if(this.blobURL) URL.revokeObjectURL(this.blobURL);
    this.blobURL=null;
  }
  rpc(action,payload,ms=90000) {
    if(this.pending) return Promise.reject(Error('OCR engine busy'));
    return new Promise((resolve,reject)=>{
      const jobId=String(++this.next);
      const timer=setTimeout(()=>{ this.pending=null; this.stop(); reject(Error('OCR timed out. Orion may have suspended the extension; keep it foreground and retry.')); },ms);
      this.pending={resolve,reject,timer,jobId};
      try { this.worker.postMessage({workerId:'mobile',jobId,action,payload}); }
      catch(e) {clearTimeout(timer);this.pending=null;reject(e);}
    });
  }
  async init(lang) {
    if(this.worker && this.lang===lang) return;
    this.stop();
    let last;
    for(const blobMode of [false,true]) {
      try {
        this.progress(blobMode?'Retrying OCR with bundled Blob worker…':'Loading OCR worker…');
        let path=this.url('mobile/vendor/worker.min.js');
        if(blobMode) {
          const resp=await fetch(path); if(!resp.ok) throw Error('Bundled worker missing');
          this.blobURL=URL.createObjectURL(new Blob([await resp.text()],{type:'text/javascript'})); path=this.blobURL;
        }
        this.worker=new Worker(path);
        this.worker.onmessage=({data:m})=>{
          if(m.status==='progress') {this.progress(`${m.data.status} ${Math.round((m.data.progress||0)*100)}%`);return;}
          const p=this.pending; if(!p || p.jobId!==m.jobId)return;
          clearTimeout(p.timer);this.pending=null;
          if(m.status==='resolve')p.resolve(m.data);else p.reject(Error(String(m.data)));
        };
        this.worker.onerror=e=>{ const p=this.pending;this.pending=null;if(p){clearTimeout(p.timer);p.reject(Error(e.message || 'Worker initialization failed'));}this.stop();};
        await this.rpc('load',{options:{lstmOnly:true,corePath:this.url('mobile/vendor/tesseract-core-lstm.wasm.js'),logging:false}},25000);
        this.progress('Loading bundled Korean OCR model…');
        await this.rpc('loadLanguage',{langs:lang,options:{langPath:this.url('mobile/models'),gzip:false,cacheMethod:'write',cachePath:'imagetrans-fast-v1',lstmOnly:true}},45000);
        await this.rpc('initialize',{langs:lang,oem:1,config:{}},45000);
        await this.rpc('setParameters',{params:{tessedit_pageseg_mode:'11',preserve_interword_spaces:'1',user_defined_dpi:'150'}});
        this.lang=lang;return;
      } catch(e) {console.warn('Mobile OCR worker initialization failed:',e.message);last=e;this.stop();}
    }
    throw Error('OCR model failed to load: '+last.message+' Open Mobile OCR diagnostics in Options.');
  }
  async scan(img, lang, progress) {
    this.progress=progress;
    for(let attempt=0;attempt<2;attempt++) {
      let canvas;
      try {
        await this.init(lang);
        const list=MobileCommon.tiles(img.naturalWidth,img.naturalHeight,attempt?640:960,attempt?768:1280,attempt?96:160);
        let boxes=[];
        for(let i=0;i<list.length;i++) {
          const tile=list[i];progress(`Scanning image… chunk ${i+1}/${list.length}`);
          canvas=document.createElement('canvas');canvas.width=tile.width;canvas.height=tile.height;
          const ctx=canvas.getContext('2d');if(!ctx)throw Error('Not enough memory for image chunk');
          ctx.drawImage(img,0,tile.y,img.naturalWidth,tile.sh,0,0,tile.width,tile.height);
          const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Not enough memory for image chunk')),'image/png'));
          canvas.width=canvas.height=1;canvas=null;
          const bytes=new Uint8Array(await blob.arrayBuffer());
          const data=await this.rpc('recognize',{image:bytes,options:{},output:{text:true,blocks:true,hocr:false,tsv:false,pdf:false,imageColor:false,imageGrey:false,imageBinary:false}});
          boxes.push(...MobileCommon.linesFromResult(data,tile));
          await new Promise(r=>setTimeout(r,0));
        }
        return MobileCommon.group(boxes);
      }catch(e){
        this.stop();
        if(attempt===0 && /memory|alloc|bounds|abort/i.test(e.message)){progress('Not enough memory — retrying with smaller image chunks');continue;}
        throw e;
      }finally{if(canvas)canvas.width=canvas.height=1;}
    }
  }
}
globalThis.MobileEngine=MobileEngine;
