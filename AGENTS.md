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
- `src/build_wand_v2.py`: deterministic Blender build for the reference-led cat wand; save the editable source as `output/cat_wand_v2.blend`, export a small runtime GLB to `web/public/assets/`, and review the mesh and render before shipping.
- `reference/wand_reference_v1.png`: private visual reference supplied in chat. Keep it locally for reconstruction, but do not publish the product photograph without a rights decision.
- `qa/`: small verification reports and reviewed screenshots only. Generated caches, local environments and frame sequences stay out of Git.

## Conventions
- Keep original file names and version suffixes so links and scripts remain unambiguous.
- Document user-facing setup and limits in Chinese. Keep references and prior working project intact.
- Commit no credentials, local virtual environments, `node_modules`, build caches, large ZIP archives or render frame sequences.
- Run model integrity checks, `npm test`, `npm run build`, and inspect the deployed page before calling the publication complete.
- Do not add an open source license for user artwork or generated model without an explicit rights decision.
- V1 uses Pointer Events for pen XY/tilt. A browser must not claim physical hover distance unless it exposes an actual distance field; label any height slider as a simulation. Preserve raw and filtered samples separately and keep exported research logs local to the user.
