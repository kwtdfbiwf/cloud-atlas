Raindrop FX by SardineFish
https://github.com/SardineFish/raindrop-fx
MIT license; see LICENSE.
Downloaded 2026-10-30 from master/bundle/index.js.

upstream.js is the unmodified upstream bundle.
raindrop-fx.js adds one opt-in windowOverlay render branch: clear to transparent
and omit the opaque background draw. Upstream's normal-map water simulation,
collision/merging, trails, droplet asset and refraction shader remain intact.
The normal default rendering path is unchanged.

window-rain.js owns scheduling, seeds droplets, and uploads a bounded live sky
source at 12 Hz without allocating a new texture each update. Simulation/render
is capped at 30 Hz. Only Cb and Ns selections activate it. Off-screen/dry
selections stop work after the fade. Reduced motion freezes drop simulation.
