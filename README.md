<div align="center">

# ◈ PRISM

### Refract reality.

**An on-device AI vision studio that runs entirely in your browser. No servers. No uploads. Nothing ever leaves your device.**

[**▶ Live demo**](https://nroze22.github.io/create/) · Built with [Transformers.js](https://github.com/huggingface/transformers.js), [Three.js](https://threejs.org) & WebGPU

</div>

---

PRISM turns your phone into a pocket AI lab. Every model — depth estimation, background removal, vision-language — is downloaded once, cached, and then runs **100% locally** on your GPU (via WebGPU) or CPU (via WebAssembly). The network is used only to fetch the open-source weights; your images are never sent anywhere.

## Three lenses

| Lens | What it does | Model |
| --- | --- | --- |
| **◈ Depth** | Turns any flat photo into an **interactive 3D point cloud** you can orbit with a finger. Per-pixel depth is estimated on-device, then rendered live in WebGL. | [Depth Anything V2 (small)](https://huggingface.co/onnx-community/depth-anything-v2-small) |
| **✂ Cutout** | Erases the background and gives you a downloadable transparent PNG. Press and hold to compare with the original. | [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) |
| **✦ Describe** | A vision-language model reads the image and narrates what it sees, character by character. | [ViT-GPT2](https://huggingface.co/Xenova/vit-gpt2-image-captioning) |

## Why it's interesting

- **Zero backend.** A static site on GitHub Pages performs real neural-network inference. There is no API, no key, no cost per request, and full privacy by construction.
- **WebGPU acceleration** with automatic WebAssembly fallback, so it runs on modern desktops and phones alike.
- **The hero moment:** watching a 2D photo bloom into explorable 3D space, computed in your hand with no round-trip to a server, is genuinely magical.
- **Mobile-first**, touch-native, with a premium animated interface.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Deploy

Pushing to `main` triggers the [GitHub Pages workflow](.github/workflows/deploy.yml), which builds the site and publishes `dist/`. Enable **Settings → Pages → Source: GitHub Actions** once.

The production base path is `/create/` (see `vite.config.ts`); override it with the `BASE_PATH` env var if you rename or relocate the repo.

## How it works

```
Photo ──▶ Transformers.js pipeline ──▶ on-device model (WebGPU / WASM) ──▶ result
                                                                   │
 Depth ─────────────────────────────────────────────────────────▶ Three.js point cloud
 Cutout ────────────────────────────────────────────────────────▶ alpha-matte composite
 Describe ──────────────────────────────────────────────────────▶ typed caption
```

The first time you open a lens, its weights download to your browser cache (this can take a moment — the loader shows progress). Every run after that is instant and offline-capable.

## Tech

`Transformers.js` · `ONNX Runtime Web` · `WebGPU` · `Three.js` · `TypeScript` · `Vite`

---

<div align="center"><sub>All inference runs on your device. Your camera never leaves your hand.</sub></div>
