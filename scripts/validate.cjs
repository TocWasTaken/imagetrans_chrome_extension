const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../ImageTrans'),m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
assert.equal(m.manifest_version,2);assert(!m.background.service_worker);assert(m.background.scripts.includes('mobile/background.js'));
const refs=[...m.background.scripts,m.browser_action.default_popup,m.options_ui.page,...Object.values(m.icons),...m.content_scripts.flatMap(x=>[...x.js,...x.css])];
for(const ref of refs)assert(fs.existsSync(path.join(root,ref)),ref);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const f of walk(root).filter(x=>x.endsWith('.html'))){for(const match of fs.readFileSync(f,'utf8').matchAll(/<script[^>]*src=["']([^"']+)/g)){if(!/^https?:/.test(match[1]))assert(fs.existsSync(path.resolve(path.dirname(f),match[1])),`${f}: ${match[1]}`);}}
for(const f of [...walk(path.join(root,'mobile')).filter(x=>x.endsWith('.js')&&!x.includes('/vendor/')), ...['background.js','getImage.js','options.js','popup.js'].map(x=>path.join(root,x))])execFileSync(process.execPath,['--check',f]);
for(const ref of ['mobile/vendor/worker.min.js','mobile/vendor/tesseract-core-lstm.wasm.js','mobile/models/kor.traineddata','mobile/models/eng.traineddata'])assert(fs.statSync(path.join(root,ref)).size>1000);
// The selected .wasm.js is the upstream embedded-WASM distribution, no separate .wasm fetch.
assert(fs.readFileSync(path.join(root,'mobile/vendor/tesseract-core-lstm.wasm.js'),'utf8').includes('AGFzbQ'));
assert(fs.readFileSync(path.join(root,'getImage.js'),'utf8').includes("areaName !== 'local'"));
console.log('PASS: manifest, entry points, HTML resources, embedded WASM/models, syntax and local-settings listener');
for(const [name,hash] of Object.entries(JSON.parse(fs.readFileSync(path.resolve(__dirname,'assets.sha256.json')))))assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',name))).digest('hex'),hash,name);
for(const ref of m.web_accessible_resources.filter(x=>!x.includes('*')))assert(fs.existsSync(path.join(root,ref)),ref);
console.log('PASS: pinned asset hashes and all explicit web-accessible resource paths');
