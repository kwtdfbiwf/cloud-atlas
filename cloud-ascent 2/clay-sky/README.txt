CLOUD SHAPE REWORK

Cumulus positions are preserved byte-for-byte from the previous exported mesh.
The nine other cloud types have been rebuilt:
- Stratocumulus: joined irregular low heaps in broad rolling banks.
- Altocumulus / cirrocumulus: unevenly spaced tufts with small bases and tops.
- Stratus / altostratus / nimbostratus: continuous low billowing sheets, with
  different thicknesses. Nimbostratus also has lightweight falling raindrops.
- Cumulonimbus: a wide billowing body and asymmetric spreading anvil, with rain.
- Cirrus: varied tapering feather hooks instead of regular strings of spheres.
- Cirrostratus: a thin translucent blanket; the sun halo remains.

Cloud-bank viewing angles have been adjusted so they do not appear edge-on.
The current opalescent colour shader is preserved. Same-level cloud selectors,
altitude and the shared ground-view capture API remain intact.

Blender source: cloud-ascent 3/3d/cloud-shape-study.blend.
Browser data: cloud-ascent 2/clay-sky/cloud-shapes-v2.glb.
Generator: build_cloud_shapes.py. The Blender gallery is arranged after export;
remove its display offsets if manually exporting edited prototypes.
Previous mesh and renderer: outputs/before-cloud-shape-rework.
