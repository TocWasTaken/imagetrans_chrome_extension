#!/usr/bin/env python3
"""Build a root-manifest Orion ZIP; no source-repository parent directory."""
from pathlib import Path
import zipfile, json, hashlib
root=Path(__file__).resolve().parents[1]
out=root/'dist';out.mkdir(exist_ok=True)
package=out/'ImageTrans-Orion-iPhone-6.0.0.zip'
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted((root/'ImageTrans').rglob('*')):
        if p.is_file() and p.name!='manifest.chromium.json' and '_metadata' not in p.parts:
            z.write(p,p.relative_to(root/'ImageTrans'))
    for name in ['LICENSE','INSTALL_IPHONE.md','MOBILE_RESEARCH.md','TESTING.md']:
        z.write(root/name,name)
with zipfile.ZipFile(package) as z:
    assert 'manifest.json' in z.namelist()
    assert json.loads(z.read('manifest.json'))['manifest_version']==2
    assert z.testzip() is None
    assert not any(n.startswith('ImageTrans/') or n.endswith('.pem') for n in z.namelist())
print(f'{package}\n{package.stat().st_size} bytes\nSHA256 {hashlib.sha256(package.read_bytes()).hexdigest()}')
