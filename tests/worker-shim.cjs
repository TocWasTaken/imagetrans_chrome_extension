// Execute the shipped browser worker in a VM with Web Worker APIs, not Node Tesseract.
const {parentPort,workerData}=require('node:worker_threads');const fs=require('node:fs');const vm=require('node:vm');const {fileURLToPath}=require('node:url');
let listener;
const scope={console,WebAssembly,TextDecoder,TextEncoder,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,URL,Blob,atob,btoa,setTimeout,clearTimeout,performance,fetch:async url=>{console.log('TEST FETCH',String(url));if(String(url).startsWith('file:'))return new Response(fs.readFileSync(fileURLToPath(url)));return fetch(url);},Response,Request,Headers,postMessage:m=>parentPort.postMessage(m),addEventListener:(name,fn)=>{if(name==='message')listener=fn;}};
scope.WorkerGlobalScope=function(){};Object.setPrototypeOf(scope,scope.WorkerGlobalScope.prototype);scope.self=scope;scope.globalThis=scope;scope.location={href:workerData.url};const ctx=vm.createContext(scope);
scope.importScripts=(...urls)=>urls.forEach(url=>vm.runInContext(fs.readFileSync(fileURLToPath(url),'utf8'),ctx,{filename:url}));
vm.runInContext(fs.readFileSync(fileURLToPath(workerData.url),'utf8'),ctx);
parentPort.on('message',data=>{if(listener)listener({data});else scope.onmessage({data});});
