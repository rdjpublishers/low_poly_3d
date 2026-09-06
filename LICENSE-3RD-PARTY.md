# LICENSE — 3RD-PARTY MODELS / DATA (PART 84)

This file documents the LICENSE, ATTRIBUTION, and HASH for every
third-party model / data dependency used by LBL v1.25 / v8.17+
(PART 75-89). Per PART 84, this repo NEVER ships a model-weights
bundle; all model weights are downloaded on first use from the
official source, with a SHA-256 integrity hash check.

## 1. BodyPix (TensorFlow.js) — used by PART 79 (2D-pose-estimation humanoid auto-rigger)

- **Source**: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
- **License**: Apache 2.0
- **Attribution**: Google LLC; the BodyPix model + the tfjs-models
  port. The model is the "ResNet50" variant by default; the
  "MobileNetV1" variant is the lighter option (~2 MB).
- **Load URL**: <https://tfhub.dev/google/tfjs-model/body-pix/2.0/>+
  (or the equivalent CDN URL for the version pinned at load time)
- **SHA-256**: populated on first load; checked against the hash
  shipped in the runtime glue (see `__lblLoadBodyPix` in
  index.html, future release).
- **Cache**: IndexedDB; the model is downloaded once per device,
  re-used across sessions.

## 2. Future TF.js model ports — to be added as they ship

When a future PART ships a TF.js port of any of the 7 models in
PART 83.1 (RigNet, UniRig, SkinTokens / TokenRig, MagicArticulate,
Puppeteer, RigAnything, Anymate), a new section is appended here
with the same 5 fields: Source, License, Attribution, Load URL,
SHA-256. No silently-shipped weights.

## 3. 10 reference repos (algorithmic inspiration only, no code imported)

The following 10 reference repos are CITED in PART 75-89 as the
source of the algorithmic patterns. NO code, NO weights, NO
binaries from these repos are imported; the patterns are
re-implemented in JS in three-rig-helpers.js (PART 75) or as
renderer-side stubs in index.html (PART 76-87).

  | Repo                                              | License  | Used in        |
  | ------------------------------------------------- | -------- | -------------- |
  | VAST-AI-Research/UniRig                           | Apache 2.0 | PART 75.2, 76 |
  | Baran & Popovic Pinocchio                        | (paper)  | PART 75.3      |
  | Mesh2Motion/mesh2motion-app                       | MIT      | PART 76, 77    |
  | davebenson/glb-rigger                             | MIT      | PART 75.4, 78  |
  | cansik/instance-rig                               | MIT      | PART 79, 75.5  |
  | sketchpunklabs/autoskinning                       | MIT      | PART 80        |
  | Wenzy--/Procedural-Rigging-in-Unity               | MIT      | PART 81        |
  | cardosoandre/Animation-Rigging-Examples           | MIT      | PART 82        |
  | zeljkovranjes/auto-rigger                         | MIT      | PART 83, 84, 85|
  | Aero-Ex/ComfyUI-SkinTokens                        | MIT      | PART 86, 87    |

For each repo, the relevant algorithm is re-implemented in JS; no
copy-paste, no fork, no vendoring. The 10 repos are listed here
purely for attribution, per PART 84.2.

## 4. Mixamo bone-name convention — used by PART 77 (bone remap)

The 21 Mixamo bone names in the `MIXAMO_TO_BONE_PRESET` constant
(in index.html) follow Mixamo's standard FBX export convention
(<https://www.mixamo.com>). Mixamo is a free service from Adobe;
the bone names themselves are not copyrightable. No Mixamo assets
are shipped or redistributed.

---

Last updated: 2026-09-06 (v1.25 / v8.17 release).
