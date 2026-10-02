# Installing on Orion for iPhone

This is an experimental Orion-targeted build, not a confirmed iOS-tested release. It contains its own Korean OCR engine and models; no computer, ImageTrans server, Docker, or local translation model is needed. Translation requires an internet connection and your API account.

1. Download **ImageTrans-Orion-iPhone-6.0.0.zip** and choose **Save to Files**. Keep it as a ZIP; do not use GitHub's “Download ZIP” source archive.
2. Open Orion. Tap **••• → Settings**, find **Extensions**, and enable Chrome/Firefox extension support if disabled.
3. Open **••• → Extensions → +**, choose the **file-based installation** option (its wording can vary), and select the downloaded ZIP in Files.
4. Enable **ImageTrans Mobile — Orion** and allow it on the comic website. If another ImageTrans extension is installed, disable that copy to avoid two overlays.
5. Open its popup → **Options**. Tap **Use OpenRouter + HY-MT2 preset**.
6. Paste your OpenRouter key, confirm the settings below, and tap **Save**. Reload the comic page.

The ZIP has `manifest.json` at its root. Kagi documents file-based installation, but its public guide does not specify every accepted archive suffix or guarantee this manifest/worker combination. Importing this exact ZIP still needs confirmation on your Orion version. If it is rejected, send the exact error and Orion version; do not install an unrelated desktop server.

## OpenRouter + HY-MT2

| Setting | Value |
|---|---|
| Translation Mode | Local OCR + Translation API |
| OCR method | Mobile OCR (Recommended for iOS) |
| Source | Korean (`ko`) |
| Target | English (`en`) |
| Enable OpenAI-compatible API | On |
| API URL | `https://openrouter.ai/api/v1` |
| API Key | Your own OpenRouter API key |
| Model | `tencent/hy-mt2-7b` |
| Prompt | Preset Korean-webtoon prompt |
| Extra params | Empty |

Get a key from https://openrouter.ai/settings/keys and ensure your account can use the model. Only OCR text goes to the translation API in the mobile pipeline. API usage may cost money. The key is stored in local extension settings, not synced or placed in a web page. Custom HTTPS OpenAI-compatible endpoints remain supported: replace URL, key and model, leaving `/chat/completions` off the base URL.

## First test — do this before a full chapter

1. Options → **Mobile OCR diagnostics & saved-image translator** → **Test OCR initialization**. It should report worker, WASM and Korean model initialized. This test needs no API key.
2. Choose a small, clear Korean speech-bubble image from Files/Photos (under 5 MB) → **Scan locally**. Red boxes and recognized text should appear.
3. Tap **Scan + translate**. Check that every source region receives one English translation.
4. On a comic page, center a small image in the viewport and choose **Translate** in the extension popup. Use the original/translated command to toggle.
5. Try a tall image. Progress should name each sequential chunk; translated text appears as a DOM overlay. Resize/rotate, scroll, and test the toggle.
6. Finally try automatic translation. Keep Orion foreground. Start without auto-scroll; a whole chapter can take time.

The popup's existing local-translator link opens diagnostics in Mobile OCR mode. Enable the floating translate button in Options for easier touch access. Screen capture remains available, but Orion's capture API and site image access may prevent it; saving an image and choosing it in diagnostics is the alternate route.

## What to report

Send the Orion version, iOS version, the last visible status or error, whether initialization passed, and a small example image. Never include your API key. No need to import OCR models: both models are already in the extension.

## Known limits

- The build has not run on a physical iPhone or Orion. Web Workers, extension-relative fetch, MV2 background persistence, WASM CSP, messaging, and import acceptance remain on-device gates.
- Tesseract fast Korean is general OCR, not a manhwa-trained model. Tiny, angled, vertical or decorative text, SFX, low contrast, and art behind text can be missed or wrong. Grouping is a geometric heuristic, not actual speech-bubble segmentation.
- The mobile build uses a persistent background document, avoiding MV3 service-worker DOM/lifetime requirements. iOS can still suspend or kill it. Models remain bundled, but the in-memory engine reloads after process loss. Jobs interrupted by process loss must be retried.
- Typical tiles are at most 960 × 1,280 pixels (~4.7 MiB raw RGBA). One retry uses 640 × 768. The decoded original image still occupies memory; tiling is not streaming image decoding. Images over 25 MB compressed or 40 megapixels decoded are refused (decoded-size check occurs after decode).
- Tall images use lightweight white text overlays rather than exporting one enormous translated raster. These overlays currently do not apply all upstream CSS/background-color options. They assume an ordinary, unrotated image displaying its full natural rectangle.
- Small images (at most 1.5 MP and 2,400 px high) reuse the existing canvas renderer and replacement/toggle behavior. Advanced desktop LaMa/PatchMatch inpainting was never bundled; it is not provided here.
- Mobile text/box history is separate from the existing rendered-image reader. The mobile history retains up to 200 records; the existing reader still handles saved small raster results. Tall-image history requires the original site's image to remain accessible; no offline tall-image raster export.
- Sites may reject cross-origin image fetches, require unavailable cookies, or use private Blob URLs. Screen capture and saved-image mode are fallback options, not guaranteed bypasses.
- PaddleOCR and ImageTrans Server options are retained for compatibility, not needed for Mobile OCR, and not certified on iOS. PaddleOCR's upstream assets increase ZIP size but are not loaded by the mobile pipeline.
- Mobile mode always uses the configured translation API. The existing free-translation presets apply to the upstream paths, not this mobile path.
- No live paid OpenRouter request was made; request/response flow was tested with mocked API responses.
