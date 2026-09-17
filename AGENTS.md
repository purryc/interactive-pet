# Interactive Pet

## Purpose
- Publish the current quadruped Siamese cat and its interactive Three.js V0 as an independent GitHub repository named `interactive-pet`.
- Preserve the original working project at `../siamese_cat/`; this directory is a reviewed publication copy.

## Structure
- `reference/`: selected user-authored character and quadruped action references, plus provenance notes.
- `src/`: Blender and Python scripts needed to rebuild or validate v10.
- `output/`: editable current Blender asset, GLB, mapping, preview and selected stills; v6 is the local reconstruction input.
- `web/`: Vite application and tests; `web/public/assets/` is the runtime copy of the reviewed GLB and mapping.
- `web/src/v1/`: V1 spatial input, virtual wand and feather, cat perception/decision, two-finger treat, and local CSV logging. Keep browser events at the input boundary; the cat reacts to perceived objects.
- `web/src/v2/`: V2 Pencil pose normalization, Rapier rope/lure physics, bone-following cat colliders, and contact reactions. Physics owns the lure pose and rope path; rendering reads its state.
- `ios/heihei_hover/`: optional WKWebView host and native Pencil-hover bridge, used only when Safari does not deliver changing pose values. Keep its sources editable and its signing profile local.
- `src/build_wand_v2.py`: deterministic Blender build for the reference-led cat wand; save the editable source as `output/cat_wand_v2.blend`, export a small runtime GLB to `web/public/assets/`, and review the mesh and render before shipping.
- `src/build_wand_v3.py`: rebuild the independently deformable plume assemblies, save `output/cat_wand_v3.blend`, and export `web/public/assets/cat_wand_v3.glb`. Preserve v2.
- `reference/wand_reference_v1.png`: private visual reference supplied in chat. Keep it locally for reconstruction, but do not publish the product photograph without a rights decision.
- `qa/`: small verification reports and reviewed screenshots only. Generated caches, local environments and frame sequences stay out of Git.
- `qa/device/`: locally retained, compressed iPad acceptance recordings; keep raw captures and videos out of Git. Name files by date and tested release.

## Conventions
- Keep original file names and version suffixes so links and scripts remain unambiguous.
- Document user-facing setup and limits in Chinese. Keep references and prior working project intact.
- Commit no credentials, local virtual environments, `node_modules`, build caches, large ZIP archives or render frame sequences.
- Run model integrity checks, `npm test`, `npm run build`, and inspect the deployed page before calling the publication complete.
- Do not add an open source license for user artwork or generated model without an explicit rights decision.
- V1 uses Pointer Events for pen XY/tilt. A browser must not claim physical hover distance unless it exposes an actual distance field; label any height slider as a simulation. Preserve raw and filtered samples separately and keep exported research logs local to the user.
- V2 samples must preserve the input source, raw orientation fields and availability flags. Distinguish a supported but neutral Pencil pose from a browser default. Native pose packets are accepted only from the bundled WKWebView bridge and must not be double-counted as browser Pointer Events.
- Run physics at a fixed step. The Rapier world is the sole authority for rope, ball, plume and collision poses; cat animation remains the authority for the cat rig. Do not regress to a visual-only rope on physics load failure.
