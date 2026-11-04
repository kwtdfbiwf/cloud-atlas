CLOUD ATLAS — prepared-volume sky

All ten types now use prepared density and sunlight data. The same renderer is
used by the main Cloud Ascent 2 guide and the expanded sky-study preview.

Low: Cumulus, Stratocumulus, Stratus, Cumulonimbus
Middle: Altocumulus, Altostratus, Nimbostratus
High: Cirrus, Cirrostratus, Cirrocumulus

Same-level selection preserves altitude. Each level remembers its own selected
type. Other levels remain softly visible for context. Keyboard arrows move
between selectors. Reduced motion and paused drift show new selections instantly.

Runtime:
- 12 RG8 volumes: 3 cumulus formations and one prepared field per other type.
- 4,608,076 compressed bytes of cloud data before any raw-data retries.
- Density and fixed sunlight transmittance are prepared offline in Blender's
  Python environment. There are no live procedural noise or shadow marches.
- 40–64 samples per intersected volume with distance-based pixel budgets.
- Shared GPU context for the sky and cached ground-view images. Quiz/comparison
  captures use these same cloud models, rather than the old PNG fallback art.
- Soft fades between types; sparse world-space rain for the rain-bearing types.
- Content-versioned asset requests with a raw-data retry on compressed failure.

Blender:
cloud-ascent 3/3d/cloud-atlas-study.blend contains the expanded study. The
Cumulus Study scene retains editable cumulus lobe meshes. Cloud types • source
shapes contains reference geometry/curves and density-seed controls for the
other nine types. Their actual prepared volume recipes are in bake_all_clouds.py;
editing a guide mesh alone does not update the browser volume. Change the recipe
and rebake to update those nine types. Layouts are stored in layout.json.
Original cloud-ascent.blend and the older cumulus-study.blend are preserved.

Rebake all nine additional types: run Blender --background --python
bake_all_clouds.py. CLOUD_TYPES=3 limits a rebake to cumulonimbus; comma-separated
IDs select multiple types. The script uses the existing expanded study for
partial bakes, retaining the other source guides and manifest entries.

Validation:
verify_clouds.py checks all ten type mappings, twelve distinct data volumes,
dimensions, density variation, layouts and lossless gzip decompression.
Browser checks cover selectors, unchanged altitude while switching, ground-view
cards and comparison captures. Physical-phone performance remains untested.

Previous implementation backups are in this task's outputs/before-all-clouds.
