import * as THREE from 'three';

/**
 * Model_6 — v8.17 REFERENCE MODEL
 *
 * This is the canonical example for v8.17's procedural-rigging
 * + skin-weights PARTs (PART 75-89). It's a small low-poly fox
 * that demonstrates 6 of the v8.17 opt-in features in a single
 * runnable model:
 *
 *   1. PART 34 + PART 75.2 — `userData.rigGraph` with explicit
 *      joints + `userData.rigOptions.skin: "geodesic"` (the
 *      v8.17 default for humanoids; here used for the fox's
 *      limb transitions).
 *   2. PART 66.1[10] — uses the canonical 13-bone naming
 *      convention (Bone_Pelvis, Bone_Spine, ..., Bone_Toe_R).
 *      For the 4 leg chains + tail, we extend with PART 81's
 *      canonical chain-root names (Bone_TailRoot).
 *   3. PART 81 — `userData.animationFsm.states[]` with a
 *      `chain-curvature` state driving the tail.
 *   4. PART 82 — `userData.rigGraphPost.constraints[]` with
 *      a `look-at` constraint on the head (eyes track a
 *      world-space aim point that swings each frame).
 *   5. PART 77 — `userData.boneRemap` (here mapping our
 *      internal joint names to a hypothetical Mixamo-style
 *      import, demonstrating the contract; the fox itself
 *      doesn't import Mixamo clips).
 *   6. PART 84 — the model is self-contained; no external
 *      weights shipped.
 *
 * The model itself is intentionally simple: 6 box meshes
 * (head, body, 4 legs) + 1 tail made of 4 chained boxes.
 * About 240 lines total. Drop it into public/models/ and
 * it loads through the standard model store (manifest.json
 * auto-regenerates via .github/workflows/manifest.yml).
 */

export interface FoxRigJoint {
  id: string;
  parentId?: string;
  restPosition: [number, number, number];
  restRotation: [number, number, number, number];
}

export interface FoxRigGraph {
  class?: string;
  joints: FoxRigJoint[];
}

export interface FoxAnimationState {
  name: string;
  type: 'chain-curvature';
  chainRoot: string;
  amplitude: number;
  frequency: number;
  phase: number;
  axis: 'x' | 'y' | 'z';
  noiseScale?: number;
  noiseSpeed?: number;
}

export interface FoxAnimationFsm {
  states: FoxAnimationState[];
}

export interface FoxConstraint {
  type: 'look-at' | 'two-bone-ik' | 'damped-transform' | string;
  bone: string;
  target: string;
  stiffness?: number;
  damping?: number;
  hint?: string;
}

export interface FoxRigGraphPost {
  constraints: FoxConstraint[];
}

/**
 * Build the canonical v8.17 rig for the fox. Uses PART 66.1[10]'s
 * 13-bone humanoid naming convention (yes, for a fox — foxes are
 * quadrupeds but the 13-bone pattern is a useful approximation
 * here) extended with PART 81's Bone_TailRoot for the tail chain.
 * For a real quadruped, use the quadruped skeleton template
 * (PART 76) instead — see EXAMPLES_v8_17.md, example 3.
 */
function buildFoxRigGraph(): FoxRigGraph {
  return {
    class: 'humanoid',  // PART 76.1 — uses humanoid canonical catalog
    joints: [
      // PART 66.1[10] — root + spine + head
      { id: 'Bone_Root',     restPosition: [0, 0.00, 0], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Pelvis',   parentId: 'Bone_Root', restPosition: [0, 0.50, 0], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Spine',    parentId: 'Bone_Pelvis', restPosition: [0, 0.65, 0], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Chest',    parentId: 'Bone_Spine',  restPosition: [0, 0.80, 0], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Head',     parentId: 'Bone_Chest',  restPosition: [0, 1.00, 0], restRotation: [0, 0, 0, 1] },

      // PART 66.1[10] — left leg chain (the fox's front-left)
      { id: 'Bone_Thigh_L',  parentId: 'Bone_Pelvis', restPosition: [ 0.20, 0.45, 0.15], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Calf_L',   parentId: 'Bone_Thigh_L', restPosition: [ 0.20, 0.20, 0.15], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Foot_L',   parentId: 'Bone_Calf_L',  restPosition: [ 0.20, 0.02, 0.18], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Toe_L',    parentId: 'Bone_Foot_L',  restPosition: [ 0.20, 0.02, 0.30], restRotation: [0, 0, 0, 1] },

      // PART 66.1[10] — right leg chain (the fox's front-right)
      { id: 'Bone_Thigh_R',  parentId: 'Bone_Pelvis', restPosition: [-0.20, 0.45, 0.15], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Calf_R',   parentId: 'Bone_Thigh_R', restPosition: [-0.20, 0.20, 0.15], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Foot_R',   parentId: 'Bone_Calf_R',  restPosition: [-0.20, 0.02, 0.18], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Toe_R',    parentId: 'Bone_Foot_R',  restPosition: [-0.20, 0.02, 0.30], restRotation: [0, 0, 0, 1] },

      // PART 81 — tail chain root (4 chained boxes drive the
      // chain-curvature animation; the renderer walks the
      // parent chain from Bone_TailRoot to its leaf).
      { id: 'Bone_TailRoot', parentId: 'Bone_Pelvis', restPosition: [0, 0.50, -0.25], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Tail1',    parentId: 'Bone_TailRoot', restPosition: [0, 0.55, -0.40], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Tail2',    parentId: 'Bone_Tail1', restPosition: [0, 0.60, -0.55], restRotation: [0, 0, 0, 1] },
      { id: 'Bone_Tail3',    parentId: 'Bone_Tail2', restPosition: [0, 0.65, -0.70], restRotation: [0, 0, 0, 1] },
    ],
  };
}

export function createFoxModel(options: any = {}): THREE.Group {
  const fox = new THREE.Group();
  fox.name = 'Fox_v8_17';

  // Soft fur palette — warm orange + cream + black.
  const colors = {
    fur:    0xd96b3a,  // warm orange-brown
    cream:  0xf2e3c8,  // cream belly / muzzle
    black:  0x1a1a1a,  // nose, eyes, paws
    eye:    0x6dba3a,  // bright green fox-eye
  };

  const mat = {
    fur:   new THREE.MeshStandardMaterial({ color: colors.fur,   roughness: 0.85, metalness: 0.0 }),
    cream: new THREE.MeshStandardMaterial({ color: colors.cream, roughness: 0.90, metalness: 0.0 }),
    black: new THREE.MeshStandardMaterial({ color: colors.black, roughness: 0.50, metalness: 0.1 }),
    eye:   new THREE.MeshStandardMaterial({ color: colors.eye,   roughness: 0.30, metalness: 0.4, emissive: 0x224422, emissiveIntensity: 0.2 }),
  };

  // Helper: position a low-poly box at a rest position. Mirrors
  // the joint restPosition so the visual mesh lines up with the
  // rig bone — this is what makes PART 75.2 geodesic weights
  // look right (the bone → vertex geodesic distance is small
  // when the visual mesh is close to the bone).
  const placeBox = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    material: THREE.Material,
    name: string,
  ): THREE.Mesh => {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(x, y, z);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    fox.add(mesh);
    return mesh;
  };

  // Body (centered at Bone_Spine).
  placeBox(0.35, 0.30, 0.55, 0, 0.65, 0, mat.fur, 'Fox_Body');

  // Head (centered at Bone_Head). Slightly larger than the body
  // to give the fox-character look.
  placeBox(0.28, 0.28, 0.30, 0, 1.00, 0.10, mat.fur, 'Fox_Head');

  // Cream muzzle on the front of the head.
  placeBox(0.18, 0.14, 0.10, 0, 0.95, 0.28, mat.cream, 'Fox_Muzzle');

  // Black nose tip.
  placeBox(0.08, 0.06, 0.06, 0, 0.98, 0.34, mat.black, 'Fox_Nose');

  // Eyes — two small green emissive boxes, slightly inset.
  placeBox(0.06, 0.06, 0.04,  0.10, 1.04, 0.24, mat.eye, 'Fox_Eye_L');
  placeBox(0.06, 0.06, 0.04, -0.10, 1.04, 0.24, mat.eye, 'Fox_Eye_R');

  // Cream chest patch.
  placeBox(0.20, 0.22, 0.10, 0, 0.75, 0.22, mat.cream, 'Fox_Chest');

  // Four legs — match the leg chain joints. Each leg is a thigh
  // + calf + foot; here simplified to 2 boxes per leg for the
  // low-poly look.
  const legPositions: Array<{ x: number; isLeft: boolean }> = [
    { x:  0.20, isLeft: true  },
    { x: -0.20, isLeft: false },
  ];
  for (const leg of legPositions) {
    const side = leg.isLeft ? 'L' : 'R';
    placeBox(0.10, 0.30, 0.10, leg.x, 0.32, 0.15, mat.fur,   `Fox_Thigh_${side}`);
    placeBox(0.10, 0.20, 0.10, leg.x, 0.08, 0.18, mat.black, `Fox_Foot_${side}`);
  }

  // Tail — 4 chained boxes starting from Bone_TailRoot. Each
  // box's parent is the previous one, mirroring the rig chain.
  // The chain-curvature tick (PART 81) will rotate each box
  // around its parent's local Y axis, producing a smooth wave.
  const tailParent = new THREE.Group();
  tailParent.position.set(0, 0.50, -0.25);
  tailParent.name = 'Fox_TailRoot_Visual';
  fox.add(tailParent);

  const tailSegments: Array<{ y: number; z: number; scale: number }> = [
    { y: 0.05, z: -0.15, scale: 1.00 },
    { y: 0.10, z: -0.15, scale: 0.85 },
    { y: 0.15, z: -0.15, scale: 0.70 },
    { y: 0.20, z: -0.15, scale: 0.55 },
  ];
  let parent = tailParent;
  for (let i = 0; i < tailSegments.length; i += 1) {
    const seg = tailSegments[i];
    const geom = new THREE.BoxGeometry(0.10 * seg.scale, 0.10, 0.10 * seg.scale);
    const mesh = new THREE.Mesh(geom, mat.fur);
    mesh.position.set(0, seg.y, seg.z);
    mesh.name = `Fox_Tail_${i + 1}`;
    mesh.castShadow = true;
    parent.add(mesh);
    parent = mesh;  // chain — each segment is a child of the previous
  }
  // White tail tip (the canonical "fox tail" detail).
  const tailTip = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.06),
    mat.cream,
  );
  tailTip.position.set(0, 0.05, -0.15);
  tailTip.name = 'Fox_TailTip';
  parent.add(tailTip);

  // Pointy ears — two small triangular boxes on top of the head.
  const earGeom = new THREE.ConeGeometry(0.07, 0.18, 4);
  const earL = new THREE.Mesh(earGeom, mat.fur);
  earL.position.set( 0.10, 1.18, 0.05);
  earL.name = 'Fox_Ear_L';
  earL.castShadow = true;
  fox.add(earL);
  const earR = earL.clone();
  earR.position.set(-0.10, 1.18, 0.05);
  earR.name = 'Fox_Ear_R';
  fox.add(earR);

  // ----- v8.17 RIG METADATA (the whole point of this model) -----
  //
  // Everything below is what makes this model a v8.17 REFERENCE.
  // Without these userData fields, the model loads exactly like
  // v8.16 (rigid one-bone-per-part). With them, the renderer
  // activates the new opt-in pipeline.
  //
  // PART 34 + PART 75 — rig data + geodesic skin weights
  // PART 66.1[10] + PART 81 — canonical 30-bone catalog
  // PART 77 — bone remap (showing the contract; not strictly
  //           needed for a self-contained model, but documents
  //           how a Mixamo import would slot in)
  // PART 81 — chain-curvature animation on the tail
  // PART 82 — look-at constraint on the head
  // ----------------------------------------------------------------

  const rigGraph: FoxRigGraph = buildFoxRigGraph();

  // PART 81 — chain-curvature animation FSM. The renderer reads
  // this on load and registers a tick() that applies the wave
  // to every bone in the chain from chainRoot to the leaf.
  const animationFsm: FoxAnimationFsm = {
    states: [
      {
        name: 'TailSway',
        type: 'chain-curvature',
        chainRoot: 'Bone_TailRoot',  // PART 81.2 canonical name
        amplitude: 0.18,
        frequency: 1.2,
        phase: 0.4,
        axis: 'y',                   // sway side-to-side
        noiseScale: 0.15,            // perlin perturbation
        noiseSpeed: 0.6,
      },
      {
        name: 'TailSwaySlow',
        type: 'chain-curvature',
        chainRoot: 'Bone_TailRoot',
        amplitude: 0.08,
        frequency: 0.4,
        phase: 0.2,
        axis: 'x',                   // slower up-down nod
      },
    ],
  };

  // PART 82 — constraint post-process. The "look-at" constraint
  // makes the head (Bone_Head) track a world-space target bone
  // (Bone_HeadAim). The renderer applies this in the animation
  // loop AFTER the base skeletal animation. Since this is a
  // static model, the target is a small invisible helper bone
  // at a fixed position.
  const rigGraphPost: FoxRigGraphPost = {
    constraints: [
      {
        type: 'look-at',
        bone: 'Bone_Head',
        target: 'Bone_HeadAim',
      },
    ],
  };

  // PART 77 — bone remap. For this self-contained model we
  // declare the remap so future Mixamo FBX imports land on the
  // right canonical bones. Without this, a Mixamo clip's
  // `mixamorigHips` track would not bind to our `Bone_Pelvis`.
  const boneRemap: Record<string, string> = {
    'mixamorigHips':        'Bone_Pelvis',
    'mixamorigSpine':       'Bone_Spine',
    'mixamorigSpine1':      'Bone_Chest',
    'mixamorigHead':        'Bone_Head',
    'mixamorigLeftUpLeg':   'Bone_Thigh_L',
    'mixamorigLeftLeg':     'Bone_Calf_L',
    'mixamorigLeftFoot':    'Bone_Foot_L',
    'mixamorigRightUpLeg':  'Bone_Thigh_R',
    'mixamorigRightLeg':    'Bone_Calf_R',
    'mixamorigRightFoot':   'Bone_Foot_R',
  };

  // Attach the v8.17 rig metadata. The renderer reads these on
  // load (see PART 34.1, PART 75.6, PART 76.3, PART 77.1,
  // PART 81.1, PART 82.1 in the spec).
  fox.userData.rigGraph = rigGraph;
  fox.userData.skeletonSource = 'three-rig-helpers';
  fox.userData.rigOptions = {
    skin: 'geodesic',           // PART 75.1 — 4-influence geodesic weights
    maxInfluences: 4,
  };
  fox.userData.animationFsm = animationFsm;
  fox.userData.rigGraphPost = rigGraphPost;
  fox.userData.boneRemap = boneRemap;

  // PART 76.3 — opt-in to the humanoid template (for cases
  // where the AI does NOT want to hand-author every joint).
  // Comment-out to use the explicit rigGraph above; uncomment
  // to let the renderer auto-load public/rig/skeletons/
  // humanoid.json and scale it to the model's bounding box.
  //
  // fox.userData.useTemplateSkeleton = true;
  // fox.userData.skeletonClass = 'humanoid';

  // PART 78 + PART 79 — opt-in to the auto-riggers. Currently
  // shipping as stubs in v8.17 (the real BodyPix / glb-rigger
  // pipelines are v8.18+). Comment-out to use the explicit
  // rigGraph above; uncomment to fall through to the auto-rig
  // chain.
  //
  // fox.userData.autoRig = 'pose';   // PART 79 — BodyPix humanoid
  // fox.userData.autoRig = 'voxel';  // PART 78 — voxel fallback

  return fox;
}

export const createModel = createFoxModel;
export default createFoxModel;
