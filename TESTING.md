# Validation record

## Passed in the cloud

- Eight automated unit/integration tests: tile coverage and limits, remapping into ImageTrans geometry, overlap deduplication, line grouping, defensive JSON formats/types/counts, OpenRouter request structure, actual queued translation retry, and failure after a second invalid response.
- The **shipped browser worker** and embedded scalar WASM initialized with the shipped Korean model in a Node worker/VM harness providing Web Worker APIs. This is not an iOS/WebKit test.
- Actual Korean OCR ran on `tests/korean-fixture.png` with `blocks: true`; conversion produced six ImageTrans boxes. First sentence and final question were recognized correctly; the middle sentence contained errors. This is a functional smoke test, not an accuracy benchmark.
- Manifest entry-point paths, HTML script paths, core/model existence, embedded WASM signature, JS syntax and local settings listener checked automatically.
- ZIP integrity and root manifest checked by packaging script.
- Manual diff review fixed the screen-capture Paddle initialization path, local-storage change listener, popup server regression, image changes during queued OCR, and hidden whole-image canvas use for tall images.

## Not tested / must test on iPhone

1. Orion accepts this MV2 ZIP and permits background script startup.
2. Extension-origin Worker, importScripts, WASM CSP and model fetch work. Diagnostic status isolates this test; Blob retry is automatic.
3. Orion stores/reuses IndexedDB model cache and local options across restart.
4. Background lifetime with a real long chapter, navigating, locking the phone, or switching apps. Interrupted jobs should fail visibly and be retryable; uninterrupted execution is not guaranteed.
5. Real comic-site image permissions/cookies, rendered image replacement, touch selection, automatic translation, and screen capture.
6. Overlay alignment on actual site layouts and iPhone rotation.
7. Real OpenRouter key/account/model access and translation quality. No paid/live API call was made.
8. Memory, temperature, speed and Korean accuracy on iPhone 12 Pro Max. The cloud smoke fixture already demonstrates recognition errors.

## Reproduce tests (development only; user needs no computer)

`npm ci && npm test`

`npm run package`

The test fixture is generated Korean text, not a downloaded copyrighted comic. `tests/worker-shim.cjs` executes the packaged browser-worker bundle under a VM; it is deliberately not labeled a browser compatibility test. All runtime OCR assets are already checked into the extension.
