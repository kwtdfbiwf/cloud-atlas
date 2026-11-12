# Cloud Atlas

**Put your head in the clouds.** A field guide to the ten cloud types that you scroll *up* through, from the ground to the top of the weather.

- Live site: https://kwtdfbiwf.github.io/cloud-atlas/
- Process file (Figma): https://www.figma.com/design/i1CYKGTsml2akI3uq4dWHN
- BSc UX Design 2026/27 · Unit BSc3a · Microsite brief 2 of 3 · Aleena Hussain

## Optimised for

- **Desktop Chrome** with WebGL2, at 1440 × 900 or larger.
- A responsive phone layout (portrait and landscape), checked in browser emulation. A physical iPhone / Android check is still to do.
- Without WebGL2 the site shows cloud photographs instead of the 3D sky.

## What's here

- `cloud-ascent 2/`: the website (`index.html` the climb, `sky.html` your local sky), assets, the cloud model and tests. See `cloud-ascent 2/REVIEW-NOTES.txt` for how it works.
- `cloud-ascent 3/3d/`: the Blender projects and textures.

## Run locally

```bash
cd "cloud-ascent 2" && python3 -m http.server 4190
```

Then open http://localhost:4190/. Tests: `node tests/verify.mjs`, `node tests/ui-contracts.mjs`, `node tests/sky-weather.mjs`.

Weather data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).
