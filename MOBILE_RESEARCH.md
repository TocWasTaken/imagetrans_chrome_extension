# Mobile OCR selection and Orion architecture

Research checked 2026-10-02 UTC. Treat browser support as a testable dependency, not a promise.

## Engine comparison

| Candidate | Korean / boxes | Mobile constraints | Decision |
|---|---|---|---|
| Tesseract.js 7.0.0 + Tesseract WASM + tessdata_fast | Korean LSTM; line/word boxes | One worker, scalar WASM build, compact integer model; all assets bundle locally | Selected practical baseline, not a claim of best Korean accuracy |
| Native Tesseract WASM directly | Same recognition engine | Requires custom decoding, lifecycle and output glue | No accuracy benefit over the maintained JS worker protocol |
| PaddleOCR + ONNX Runtime Web | Korean models and detection | WASM is possible on Safari; multithreading needs cross-origin isolation; detector/recognizer/OpenCV bring more initialization and memory complexity | Retained experimental, not default |
| ocrs | Current mainline models recognize Latin alphabet | Modern Rust/WASM implementation | Does not meet Korean requirement |
| ocrs-cjk | Fork advertises CJK/PaddleOCR and WASM | Promising, but no verified Orion integration or measured Korean iPhone memory/accuracy in reviewed material | Future evaluation; not substitute merely on theoretical target support |
| Manga OCR | Japanese-focused manga recognizer | Python/PyTorch pipeline, not a bundled Korean browser detector | Wrong language/runtime for this MVP |
| Apple Vision OCR | Native platform framework | No ordinary WebExtension JavaScript bridge to Vision | Would require a native app integration |

Tesseract.js 7.0.0 is the npm registry and upstream release version checked during the build. Its v6 output change disables boxes by default; the worker explicitly requests `blocks: true`. The selected `tesseract-core-lstm.wasm.js` is the scalar LSTM-only **embedded-WASM** distribution: a separate `.wasm` download is not missing. Choosing this exact core avoids requiring SIMD/relaxed SIMD, WebGPU, pthreads or SharedArrayBuffer. That sacrifices possible SIMD speedups for a simpler compatibility baseline.

`kor.traineddata` is about 1.6 MiB; English about 3.9 MiB. Both are tessdata_fast integer LSTM models (OEM 1). Models are bundled, optionally cached by the worker in IndexedDB, and reused in memory while the background document survives. No runtime model CDN is used. No HY-MT2 weights exist in this package.

## Orion-specific decisions

Kagi calls iOS extension support preliminary and notes Apple-imposed API limits. No authoritative exhaustive matrix was found certifying the particular combination of workers, CSP, WASM, IndexedDB, Blob worker URLs and background documents needed here. A public background-environment issue further motivates testing the actual manifest rather than assuming desktop Chrome semantics.

The shipping manifest uses **MV2 background scripts with a document**. OCR needs image/canvas APIs; this avoids relying on MV3 service workers, offscreen-document APIs, or sandbox iframe messaging. The original Chromium manifest is retained as a development reference, not an independently supported build.

A direct extension-relative worker is tried first. If startup fails, it is terminated before retrying a Blob worker containing the same bundled script. Core/model paths remain absolute extension-relative URLs. There is no main-thread OCR fallback: synchronous WASM inference could freeze the reading page and cannot be reliably interrupted. Failure is explicit after bounded initialization attempts.

The document owns one engine and queues jobs across tabs. Content scripts send image URLs and receive small JSON statuses/boxes through polling, rather than passing decoded images/ArrayBuffers across extension messaging. This also avoids depending on a single long-lived reply callback. Background-owned image Blobs/ObjectURLs are released after OCR. Saved-file and screen-capture paths use bounded data URLs because cross-context Blob transfer in Orion is unverified. An image still needs decoding as a whole before canvas cropping; a very large compressed image can consume substantial memory before its decoded dimensions are checked.

The page's main JavaScript world gets neither the key nor an OCR worker. No OCR assets need page injection or iframe sandbox privileges. Local settings and IndexedDB persist when supported; in-memory queues do not survive iOS process termination. Polling reports a lost session rather than pretending it can resume.

## Rendering and translation

Line boxes remap chunk coordinates, drop overlapping duplicates, merge nearby aligned lines, and retain top-to-bottom / left-to-right order. This is heuristic and may join separate bubbles or split one bubble. Source/target/geometry fields match ImageTrans's existing renderer format.

The API path batches at most 16 regions / about 3,500 source characters, carries three prior regions as context, and asks for strict ordered JSON. Parsing accepts arrays, `translations`/`texts` wrappers and JSON fences, rejects empty/non-string entries, and enforces exact counts. Invalid output retries once with a stricter instruction. HTTP/auth failures are surfaced directly. No provider-specific forced JSON-schema parameter is required.

## Sources

- Kagi iOS extension installation/support: https://help.kagi.com/orion/browser-extensions/ios-ipados-extensions.html
- Orion background environment report (not a compatibility specification): https://orionfeedback.org/d/13760-incorrect-background-environment-preference-in-extensions
- Tesseract.js releases: https://github.com/naptha/tesseract.js/releases
- Tesseract.js API and worker source: https://github.com/naptha/tesseract.js/tree/v7.0.0
- Fast models and licenses: https://github.com/tesseract-ocr/tessdata_fast
- ONNX Runtime browser support: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- ONNX threading/proxy constraints: https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html
- ocrs language support: https://github.com/robertknight/ocrs
- CJK fork: https://github.com/kent-tokyo/ocrs-cjk
- Manga OCR: https://github.com/kha-white/manga-ocr
- HY-MT2 model: https://openrouter.ai/tencent/hy-mt2-7b

These sources establish component capabilities. They do not establish this extension's on-device reliability or performance on an iPhone 12 Pro Max. No measured iPhone startup time, peak memory or manhwa accuracy is claimed.
