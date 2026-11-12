CLOUD ATLAS — models developed from the approved reference grid

Blender project: reference-cloud-atlas.blend
Website model: reference-clouds.glb
Visual reference: approved-cloud-grid.png (also packed into the Blender file)
Generator: build_reference_clouds.py

Twelve named mesh prototypes cover all ten cloud types, including three cumulus
variations. The meshes have merged smaller billows, smooth normals and painted
pastel colour with soft local shadowing. Cirrus uses a feathered mesh of tapered
strands; the sheet clouds keep different thickness and opacity treatments.

The website shares these geometries among formations. The cloud-type selectors,
upward scrolling journey, rain, high-cloud halo and ground-view captures use the
new models. The runtime surface shader reads their CloudColour vertex colours;
it does not regenerate cloud noise or march through cloud volumes.

The Blender file is an editable gallery arranged after export. To export manual
mesh edits, keep the prototype names Cu_0, Cu_1, Cu_2, Sc, St, Cb, Ns, Ac, As,
Ci, Cs, Cc; temporarily move their gallery locations back to the origin and export
only these meshes as a GLB with vertex colours. The original gallery placement
is for editing, not part of the exported website layout. Browser positions,
cloud opacity and presentation are set in scene3d.js.

The generator rebuilds the models and gallery beside itself. Its reference image
must remain beside it. Running it replaces the generated models, so preserve any
manual edits in a separate Blender version before regenerating.

Earlier meshes and Blender studies remain on disk. The renderer before this
change is backed up in outputs/before-reference-models.

Validation checks all ten type names, normals, colour attributes, finite mesh
bounds, export data and browser loading. Physical-phone performance is untested.
