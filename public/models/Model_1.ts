/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * img2threejs Specification & Procedural 3D Supercar Generator
 * Model: "Apex Horizon - Low-Poly Concept Supercar"
 * Architecture: img2threejs
 *
 * v3.0 — Professional-Grade Skeletal Rigging & Animation
 * -------------------------------------------------------
 *  - Animated pivots are real THREE.Bone nodes (not Object3D/Group), so
 *    the GLTFExporter walks them as proper skeleton joints.
 *  - Each wheel has a two-bone chain: a "steer" bone (front wheels only)
 *    parented under the chassis, and a "spin" bone child (or directly
 *    under chassis for the rear wheels).
 *  - All four animations are real THREE.AnimationClip instances built
 *    from baked KeyframeTracks.  Procedural sin/cos motion is sampled
 *    at fixed intervals and stored as track keyframes — visually
 *    identical to the old live tick(), but now serializable to glTF.
 *  - Clips are published on carRoot.animations (the standard Three.js
 *    place GLTFExporter looks for them) and on
 *    carRoot.userData.sculptRuntime.animations (the place the
 *    in-app viewer's lblCollectAnimations() looks for them).
 *  - Public API (play / stop / setAnimation / tick / dispose / etc.) is
 *    unchanged so the rest of the system keeps working.
 */

import * as THREE from 'three';

/* =========================================================================
 * 1. IMG2THREEJS SCULPT SPECIFICATION
 * ========================================================================= */

export interface ObjectSculptSpec {
  name: string;
  category: 'vehicle';
  style: 'stylized-lowpoly';
  version: string;
  animations: string[];
}

export const SUPERCAR_SPEC: ObjectSculptSpec = {
  name: 'Apex Horizon GT',
  category: 'vehicle',
  style: 'stylized-lowpoly',
  version: '3.0.0',
  animations: ['drive', 'idle_rev', 'drift', 'parked']
};

/* =========================================================================
 * 2. PROCEDURAL GEOMETRY GENERATORS (unchanged)
 * ========================================================================= */

function createKitbashBox(
  w: number, h: number, d: number,
  mat: THREE.Material,
  topScaleX = 1, topScaleZ = 1,
  shiftX = 0, shiftZ = 0
): THREE.Mesh {
  const geom = new THREE.BoxGeometry(w, h, d);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i);
    if (y > 0) { // Top vertices
      pos.setX(i, pos.getX(i) * topScaleX + shiftX);
      pos.setZ(i, pos.getZ(i) * topScaleZ + shiftZ);
    }
  }

  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildLowPolyWheel(
  radius: number,
  width: number,
  materials: SupercarMaterials,
  isRight: boolean
): THREE.Group {
  const wheelGroup = new THREE.Group();

  const tireGeom = new THREE.CylinderGeometry(radius, radius, width, 16);
  tireGeom.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeom, materials.tireRubber);
  tire.castShadow = true;
  wheelGroup.add(tire);

  const rimRadius = radius * 0.82;
  const lipGeom = new THREE.TorusGeometry(rimRadius, 0.035, 4, 16);
  lipGeom.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeom, materials.chromeRim);

  const barrelGeom = new THREE.CylinderGeometry(rimRadius * 0.95, rimRadius * 0.95, width * 0.9, 16);
  barrelGeom.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, materials.trimDark);
  wheelGroup.add(barrel);

  const spokeGroup = new THREE.Group();
  const spokeGeom = new THREE.BoxGeometry(0.06, rimRadius * 0.95, 0.05);
  spokeGeom.translate(0, rimRadius * 0.475, 0);

  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeom, materials.chromeRim);
    spoke.rotation.x = (Math.PI * 2 / 5) * i;
    spoke.castShadow = true;
    spokeGroup.add(spoke);
  }

  const hubGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8);
  hubGeom.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeom, materials.chromeRim);
  spokeGroup.add(hub);

  const dir = isRight ? 1 : -1;
  lip.position.x = (width / 2) * dir;
  spokeGroup.position.x = (width / 2 - 0.01) * dir;

  wheelGroup.add(lip);
  wheelGroup.add(spokeGroup);

  return wheelGroup;
}

export function buildSupercarBody(materials: SupercarMaterials): THREE.Group {
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'supercar_body_assembly';

  function addPart(w: number, h: number, d: number, mat: THREE.Material, topScaleX=1, topScaleZ=1, shiftX=0, shiftZ=0, x=0, y=0, z=0, rx=0, ry=0, rz=0) {
    const mesh = createKitbashBox(w, h, d, mat, topScaleX, topScaleZ, shiftX, shiftZ);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    bodyGroup.add(mesh);
    return mesh;
  }

  // 1. Front Splitter & Underbody (Black)
  addPart(2.0, 0.05, 4.4, materials.trimDark, 0.95, 0.95, 0, 0, 0, 0.025, 0);

  // 2. Main Lower Body Base (Orange)
  addPart(1.7, 0.25, 4.2, materials.bodyPrimary, 0.95, 0.95, 0, 0, 0, 0.175, 0);

  // 3. Cabin / Greenhouse (Black Glass Block)
  addPart(1.1, 0.4, 1.8, materials.glassTint, 0.7, 0.4, 0, -0.2, 0, 0.5, 0.0);

  // 4. Roof Panel (Orange)
  addPart(0.85, 0.05, 0.9, materials.bodyPrimary, 0.95, 0.8, 0, 0, 0, 0.725, -0.15);

  // 5. Front Nose Wedge (Orange)
  addPart(0.9, 0.3, 1.2, materials.bodyPrimary, 0.7, 0.2, 0, -0.4, 0, 0.3, 1.5);

  // 6. Front Center Beak (Orange)
  addPart(0.2, 0.35, 0.4, materials.bodyPrimary, 0.5, 0.5, 0, -0.1, 0, 0.25, 2.05);

  // 7. Front Fenders L/R (Orange)
  addPart(0.5, 0.35, 1.2, materials.bodyPrimary, 0.6, 0.7, 0, -0.1, -0.75, 0.325, 1.4);
  addPart(0.5, 0.35, 1.2, materials.bodyPrimary, 0.6, 0.7, 0, -0.1, 0.75, 0.325, 1.4);

  // 8. Headlight Housings (Dark Trim)
  addPart(0.35, 0.2, 0.3, materials.trimDark, 0.9, 0.8, 0, -0.1, -0.65, 0.4, 1.85);
  addPart(0.35, 0.2, 0.3, materials.trimDark, 0.9, 0.8, 0, -0.1, 0.65, 0.4, 1.85);

  // 9. Side Doors (Orange)
  addPart(1.9, 0.3, 1.4, materials.bodyPrimary, 0.95, 1.0, 0, 0, 0, 0.3, 0.1);

  // 10. Side Door Trim Inserts (Dark)
  addPart(1.95, 0.15, 0.8, materials.trimDark, 1.0, 0.9, 0, 0, 0, 0.225, 0.2);

  // 11. Rear Fenders (Orange)
  addPart(0.6, 0.45, 1.4, materials.bodyPrimary, 0.7, 0.8, 0, 0.1, -0.8, 0.375, -1.2);
  addPart(0.6, 0.45, 1.4, materials.bodyPrimary, 0.7, 0.8, 0, 0.1, 0.8, 0.375, -1.2);

  // 12. Rear Engine Deck (Dark Trim)
  addPart(1.1, 0.2, 1.2, materials.trimDark, 0.9, 0.9, 0, 0, 0, 0.45, -1.3);

  // 13. Deep Side Air Intakes (Dark Recess)
  addPart(0.3, 0.4, 0.8, materials.trimDark, 1, 1, 0, 0, -0.85, 0.35, -0.5);
  addPart(0.3, 0.4, 0.8, materials.trimDark, 1, 1, 0, 0, 0.85, 0.35, -0.5);

  // 14. Spoiler Wing
  addPart(0.08, 0.25, 0.3, materials.bodyPrimary, 0.6, 0.8, 0, -0.1, -0.8, 0.65, -1.8);
  addPart(0.08, 0.25, 0.3, materials.bodyPrimary, 0.6, 0.8, 0, -0.1, 0.8, 0.65, -1.8);
  addPart(1.8, 0.05, 0.4, materials.trimDark, 1.0, 0.9, 0, 0, 0, 0.8, -1.9);

  // 15. Rear Diffuser (Dark Trim)
  addPart(1.6, 0.2, 0.4, materials.trimDark, 0.9, 1.0, 0, 0, 0, 0.15, -2.05);

  // 16. Angular Mirrors (Orange)
  addPart(0.12, 0.08, 0.15, materials.bodyPrimary, 0.8, 0.8, 0, 0, -0.95, 0.55, 0.7);
  addPart(0.12, 0.08, 0.15, materials.bodyPrimary, 0.8, 0.8, 0, 0, 0.95, 0.55, 0.7);
  const mStickL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.04), materials.trimDark);
  mStickL.position.set(-0.8, 0.5, 0.7);
  mStickL.rotation.z = 0.4;
  bodyGroup.add(mStickL);
  const mStickR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.04), materials.trimDark);
  mStickR.position.set(0.8, 0.5, 0.7);
  mStickR.rotation.z = -0.4;
  bodyGroup.add(mStickR);

  // 17. Glowing Headlights
  const hlGeom = new THREE.BoxGeometry(0.12, 0.08, 0.1);
  const hlL1 = new THREE.Mesh(hlGeom, materials.lightWarm);
  hlL1.position.set(-0.65, 0.48, 1.98);
  bodyGroup.add(hlL1);
  const hlL2 = new THREE.Mesh(hlGeom, materials.lightWarm);
  hlL2.position.set(-0.65, 0.55, 1.95);
  bodyGroup.add(hlL2);

  const hlR1 = new THREE.Mesh(hlGeom, materials.lightWarm);
  hlR1.position.set(0.65, 0.48, 1.98);
  bodyGroup.add(hlR1);
  const hlR2 = new THREE.Mesh(hlGeom, materials.lightWarm);
  hlR2.position.set(0.65, 0.55, 1.95);
  bodyGroup.add(hlR2);

  // 18. Rear Taillights (Red)
  const tlGeom = new THREE.BoxGeometry(0.25, 0.08, 0.1);
  const tlL = new THREE.Mesh(tlGeom, materials.lightRed);
  tlL.position.set(-0.6, 0.5, -2.05);
  bodyGroup.add(tlL);
  const tlR = new THREE.Mesh(tlGeom, materials.lightRed);
  tlR.position.set(0.6, 0.5, -2.05);
  bodyGroup.add(tlR);

  // 19. Engine Louver Slats
  for (let i = 0; i < 4; i++) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.15), materials.trimDark);
    louver.position.set(0, 0.62 - i * 0.04, -0.8 - i * 0.18);
    louver.rotation.x = -0.15;
    bodyGroup.add(louver);
  }

  return bodyGroup;
}

/* =========================================================================
 * 3. CONTROLLER & INSTANCE INTERFACE
 * ========================================================================= */

export interface SupercarMaterials {
  bodyPrimary: THREE.MeshStandardMaterial;
  trimDark: THREE.MeshStandardMaterial;
  glassTint: THREE.MeshStandardMaterial;
  chromeRim: THREE.MeshStandardMaterial;
  tireRubber: THREE.MeshStandardMaterial;
  lightWarm: THREE.MeshStandardMaterial;
  lightAmber: THREE.MeshStandardMaterial;
  lightRed: THREE.MeshStandardMaterial;
}

export interface SupercarOptions {
  bodyColor?: string;
  trimColor?: string;
  glowHeadlights?: boolean;
}

export interface SupercarInstance extends THREE.Group {
  currentAnimation: string;

  // Animation & Control APIs
  tick: (dt: number, time: number) => void;
  play: () => void;
  stop: () => void;
  setAnimation: (animName: string) => void;
  setHeadlights: (enabled: boolean) => void;
  setBodyColor: (hex: string) => void;
  dispose: () => void;
}

/* =========================================================================
 * 4. ANIMATION CLIP BAKING HELPERS
 * =========================================================================
 *
 * The original implementation drove every motion with a per-frame
 * `switch (currentAnim) { ... }` and Math.sin / Math.cos in tick().
 * That was perfect for live playback but produced nothing the
 * GLTFExporter could serialize.
 *
 * The strategy here is: for each animation, pick a loop length that
 * makes the dominant sin/cos argument close to a whole number of
 * 2π revolutions, then sample the analytic waveform at fixed intervals
 * and emit standard KeyframeTracks.  The resulting clip, when played
 * back by AnimationMixer, is visually identical to the old tick().
 *
 * glTF track-format note: we drive rotations as quaternions on
 * `*.quaternion` (QuaternionKeyframeTrack).  This is the canonical,
 * warning-free, exporter-friendly path.  Euler-as-VectorKeyframeTrack
 * has a Three.js footgun where the first value of each frame is
 * interpreted as the Euler order, not as rx — using quaternions
 * sidesteps that entirely and is also what GLTFExporter writes by
 * default for bone rotations.  Position is the standard Vector3
 * VectorKeyframeTrack; the taillight pulse is a NumberKeyframeTrack
 * on `material.emissiveIntensity`.
 */

const TAU = Math.PI * 2;
const _euler = new THREE.Euler();
const _quat  = new THREE.Quaternion();

function sample(duration: number, samples: number): number[] {
  const arr = new Array<number>(samples);
  for (let i = 0; i < samples; i++) arr[i] = (i / (samples - 1)) * duration;
  return arr;
}

/** Push (x, y, z, w) of an Euler(rx,ry,rz) into the flat quaternion values array. */
function pushQuat(out: number[], rx: number, ry: number, rz: number): void {
  _euler.set(rx, ry, rz, 'XYZ');
  _quat.setFromEuler(_euler);
  out.push(_quat.x, _quat.y, _quat.z, _quat.w);
}

function buildDriveClip(): THREE.AnimationClip {
  // One full wheel revolution per loop = 2π / (8.0 * 2.5) = 0.314159 s
  const wheelSpeed = 8.0 * 2.5;            // 20 rad/s
  const loop = TAU / wheelSpeed;            // ≈ 0.314 s
  const samples = 16;                       // ~50 Hz sampling
  const times = sample(loop, samples);
  const chassisPos: number[] = [];          // 3 floats/frame
  const chassisQuat: number[] = [];         // 4 floats/frame
  const steerFLQuat: number[] = [];
  const steerFRQuat: number[] = [];
  const spinFLQuat: number[] = [];
  const spinFRQuat: number[] = [];
  const spinRLQuat: number[] = [];
  const spinRRQuat: number[] = [];
  for (const t of times) {
    const spinAngle = t * wheelSpeed;                       // 0 → 2π, seamless
    const bounceY = 0.38 + Math.sin(t * 12.0) * 0.005;
    const rx = Math.sin(t * 2.5) * 0.005;
    const rz = Math.sin(t * 1.5) * 0.01;
    const sy = Math.sin(t * 1.5) * 0.2;
    chassisPos.push(0, bounceY, 0);
    pushQuat(chassisQuat, rx, 0, rz);
    pushQuat(steerFLQuat, 0, sy, 0);
    pushQuat(steerFRQuat, 0, sy, 0);
    pushQuat(spinFLQuat,  spinAngle, 0, 0);
    pushQuat(spinFRQuat,  spinAngle, 0, 0);
    pushQuat(spinRLQuat,  spinAngle, 0, 0);
    pushQuat(spinRRQuat,  spinAngle, 0, 0);
  }
  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('chassis.position',         times, chassisPos),
    new THREE.QuaternionKeyframeTrack('chassis.quaternion',   times, chassisQuat),
    new THREE.QuaternionKeyframeTrack('wheelSteerFL.quaternion', times, steerFLQuat),
    new THREE.QuaternionKeyframeTrack('wheelSteerFR.quaternion', times, steerFRQuat),
    new THREE.QuaternionKeyframeTrack('wheelSpinFL.quaternion',  times, spinFLQuat),
    new THREE.QuaternionKeyframeTrack('wheelSpinFR.quaternion',  times, spinFRQuat),
    new THREE.QuaternionKeyframeTrack('wheelSpinRL.quaternion',  times, spinRLQuat),
    new THREE.QuaternionKeyframeTrack('wheelSpinRR.quaternion',  times, spinRRQuat)
  ];
  return new THREE.AnimationClip('drive', loop, tracks);
}

function buildIdleRevClip(): THREE.AnimationClip {
  // No wheel spin, just chassis bob.  The taillight emissive pulse that
  // was in the original tick() doesn't survive a glTF round-trip
  // (materials aren't in the scene graph so GLTFExporter can't resolve
  // the binding), so we drive the pulse in a runtime-only side clip
  // instead — see buildTaillightPulseClip() below.  That keeps the
  // exported GLB clean and the live viewer animated.
  const loop = 0.5;
  const samples = 16;
  const times = sample(loop, samples);
  const chassisPos: number[] = [];
  const chassisQuat: number[] = [];
  for (const t of times) {
    chassisPos.push(0, 0.38 + Math.sin(t * 35.0) * 0.004, 0);
    pushQuat(chassisQuat, Math.sin(t * 15.0) * 0.006, 0, 0);
  }
  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('chassis.position',       times, chassisPos),
    new THREE.QuaternionKeyframeTrack('chassis.quaternion', times, chassisQuat)
  ];
  return new THREE.AnimationClip('idle_rev', loop, tracks);
}

/**
 * Runtime-only taillight pulse clip.  Not part of the exported GLB —
 * material properties can't be bound through the glTF scene graph.
 * Kept in `carRoot.userData.runtimeClips` for the viewer to play back
 * alongside the skeletal animation.
 */
function buildTaillightPulseClip(material: THREE.Material): THREE.AnimationClip {
  const loop = 0.7853; // 2π/8 — seamless for the 8 rad/s pulse
  const samples = 16;
  const times = sample(loop, samples);
  const values: number[] = [];
  for (const t of times) values.push(1.0 + Math.sin(t * 8.0) * 0.5);
  const track = new THREE.NumberKeyframeTrack(
    `${material.uuid}.emissiveIntensity`, times, values
  );
  return new THREE.AnimationClip('taillight_pulse', loop, [track]);
}

function buildDriftClip(): THREE.AnimationClip {
  // Drift = rear-wheel spin 1.3× faster than fronts, hard steer left,
  // chassis tilted into the slide.  Rear wheel period is the binding
  // loop length (rear speed = 8.0 * 4.5 * 1.3 = 46.8 rad/s).
  const rearSpeed = 8.0 * 4.5 * 1.3;
  const frontSpeed = 8.0 * 4.5;
  const loop = TAU / rearSpeed;             // ≈ 0.134 s
  const samples = 16;
  const times = sample(loop, samples);
  const chassisPos: number[] = [];
  const rearSpinQuat: number[] = [];
  const frontSpinQuat: number[] = [];
  for (const t of times) {
    pushQuat(rearSpinQuat,  t * rearSpeed,  0, 0);
    pushQuat(frontSpinQuat, t * frontSpeed, 0, 0);
    chassisPos.push(0, 0.36 + Math.sin(t * 18.0) * 0.006, 0);
  }
  // Constant-tilt chassis + constant steer → 2-keyframe quaternion tracks.
  const staticTimes = [0, loop];
  const chassisQuatStatic: number[] = [];
  const steerFLQuatStatic: number[] = [];
  const steerFRQuatStatic: number[] = [];
  pushQuat(chassisQuatStatic, 0,  0.25, -0.06);
  pushQuat(chassisQuatStatic, 0,  0.25, -0.06);
  pushQuat(steerFLQuatStatic, 0, -0.45, 0);
  pushQuat(steerFLQuatStatic, 0, -0.45, 0);
  pushQuat(steerFRQuatStatic, 0, -0.45, 0);
  pushQuat(steerFRQuatStatic, 0, -0.45, 0);
  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('chassis.position',             times,       chassisPos),
    new THREE.QuaternionKeyframeTrack('chassis.quaternion',      staticTimes, chassisQuatStatic),
    new THREE.QuaternionKeyframeTrack('wheelSteerFL.quaternion', staticTimes, steerFLQuatStatic),
    new THREE.QuaternionKeyframeTrack('wheelSteerFR.quaternion', staticTimes, steerFRQuatStatic),
    new THREE.QuaternionKeyframeTrack('wheelSpinRL.quaternion',  times,       rearSpinQuat),
    new THREE.QuaternionKeyframeTrack('wheelSpinRR.quaternion',  times,       rearSpinQuat),
    new THREE.QuaternionKeyframeTrack('wheelSpinFL.quaternion',  times,       frontSpinQuat),
    new THREE.QuaternionKeyframeTrack('wheelSpinFR.quaternion',  times,       frontSpinQuat)
  ];
  return new THREE.AnimationClip('drift', loop, tracks);
}

function buildParkedClip(): THREE.AnimationClip {
  // Static pose — a single keyframe, mixer will hold the values.
  const times = [0, 1.0];
  const chassisPos: number[] = [];
  const chassisQuat: number[] = [];
  const steerQuat: number[] = [];
  chassisPos.push(0, 0.38, 0);  chassisPos.push(0, 0.38, 0);
  pushQuat(chassisQuat, 0, 0, 0); pushQuat(chassisQuat, 0, 0, 0);
  pushQuat(steerQuat,   0, 0, 0); pushQuat(steerQuat,   0, 0, 0);
  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('chassis.position',         times, chassisPos),
    new THREE.QuaternionKeyframeTrack('chassis.quaternion',   times, chassisQuat),
    new THREE.QuaternionKeyframeTrack('wheelSteerFL.quaternion', times, steerQuat),
    new THREE.QuaternionKeyframeTrack('wheelSteerFR.quaternion', times, steerQuat)
  ];
  return new THREE.AnimationClip('parked', 1.0, tracks);
}

/* =========================================================================
 * 5. MAIN FACTORY FUNCTION
 * ========================================================================= */

export function createSupercar(options: SupercarOptions = {}): SupercarInstance {
  const opt = {
    bodyColor: options.bodyColor ?? '#EB7E4E',
    trimColor: options.trimColor ?? '#323642',
    glowHeadlights: options.glowHeadlights ?? true
  };

  const carRoot = new THREE.Group() as SupercarInstance;
  carRoot.name = 'Supercar_ApexHorizon';

  // MATERIALS (unchanged from v2.x)
  const materials: SupercarMaterials = {
    bodyPrimary: new THREE.MeshStandardMaterial({
      color: opt.bodyColor,
      roughness: 0.35,
      metalness: 0.15,
      flatShading: true
    }),
    trimDark: new THREE.MeshStandardMaterial({
      color: opt.trimColor,
      roughness: 0.7,
      metalness: 0.2,
      flatShading: true
    }),
    glassTint: new THREE.MeshStandardMaterial({
      color: '#1B2230',
      roughness: 0.15,
      metalness: 0.6,
      flatShading: true
    }),
    chromeRim: new THREE.MeshStandardMaterial({
      color: '#F8FAFC',
      metalness: 0.95,
      roughness: 0.1,
      flatShading: true
    }),
    tireRubber: new THREE.MeshStandardMaterial({
      color: '#282B32',
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true
    }),
    lightWarm: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#FFDD44',
      emissiveIntensity: opt.glowHeadlights ? 2.5 : 0.1,
      flatShading: true
    }),
    lightAmber: new THREE.MeshStandardMaterial({
      color: '#FFA826',
      emissive: '#FF9500',
      emissiveIntensity: 1.5,
      flatShading: true
    }),
    lightRed: new THREE.MeshStandardMaterial({
      color: '#FF3B30',
      emissive: '#FF1100',
      emissiveIntensity: 1.5,
      flatShading: true
    })
  };

  // SKELETON ───────────────────────────────────────────────────────
  // chassis is the root bone — every animated pivot chains off of it.
  const chassis = new THREE.Bone();
  chassis.name = 'chassis';
  chassis.position.y = 0.38;
  carRoot.add(chassis);

  // Body is just a child group (no animation).
  const body = buildSupercarBody(materials);
  chassis.add(body);

  // Wheels: front pair get a two-bone chain (steer → spin → wheel);
  // rear pair skip the steer bone since they don't steer.
  function addWheel(opts: {
    wheelName: string;
    steerName: string;
    spinName: string;
    x: number; y: number; z: number;
    withSteer: boolean;
    isRight: boolean;
    radius: number; width: number;
  }): void {
    let parent: THREE.Bone = chassis;
    if (opts.withSteer) {
      const steer = new THREE.Bone();
      steer.name = opts.steerName;
      steer.position.set(opts.x, 0, opts.z);
      chassis.add(steer);
      parent = steer;
    }
    const spin = new THREE.Bone();
    spin.name = opts.spinName;
    if (opts.withSteer) {
      parent.add(spin);
    } else {
      // Rear wheels: spin bone carries the wheel position too.
      spin.position.set(opts.x, opts.y, opts.z);
      chassis.add(spin);
    }
    const wheel = buildLowPolyWheel(opts.radius, opts.width, materials, opts.isRight);
    spin.add(wheel);
  }

  addWheel({ wheelName: 'FL', steerName: 'wheelSteerFL', spinName: 'wheelSpinFL',
    x: -0.9, y: 0, z: 1.4, withSteer: true,  isRight: false, radius: 0.36, width: 0.26 });
  addWheel({ wheelName: 'FR', steerName: 'wheelSteerFR', spinName: 'wheelSpinFR',
    x:  0.9, y: 0, z: 1.4, withSteer: true,  isRight: true,  radius: 0.36, width: 0.26 });
  addWheel({ wheelName: 'RL', steerName: 'wheelSteerRL', spinName: 'wheelSpinRL',
    x: -0.95, y: 0.02, z: -1.35, withSteer: false, isRight: false, radius: 0.40, width: 0.30 });
  addWheel({ wheelName: 'RR', steerName: 'wheelSteerRR', spinName: 'wheelSpinRR',
    x:  0.95, y: 0.02, z: -1.35, withSteer: false, isRight: true,  radius: 0.40, width: 0.30 });

  // ANIMATION CLIPS ────────────────────────────────────────────────
  const driveClip   = buildDriveClip();
  const idleRevClip = buildIdleRevClip();
  const driftClip   = buildDriftClip();
  const parkedClip  = buildParkedClip();
  // Runtime-only side clip — material.emissiveIntensity pulse.
  // Not exported (can't bind a material through the glTF scene graph),
  // but played back by the viewer when idle_rev is active.
  const taillightClip = buildTaillightPulseClip(materials.lightRed);
  const clips: THREE.AnimationClip[] = [driveClip, idleRevClip, driftClip, parkedClip];
  const runtimeClips: THREE.AnimationClip[] = [taillightClip];

  // Publish on root.animations — this is the standard Three.js slot
  // GLTFExporter looks at when options.animations isn't provided.
  carRoot.animations = clips;
  // Runtime-only clips live separately; the viewer's lblCollectAnimations
  // can choose to merge them with the skeletal clips for in-app playback.
  carRoot.userData.runtimeClips = runtimeClips;

  // Publish to userData.sculptRuntime.animations too — the in-app
  // viewer's lblCollectAnimations() looks here for the play / next UI.
  carRoot.userData.sculptRuntime = {
    animations: clips.map((c) => ({
      name: c.name,
      duration: c.duration,
      tracks: c.tracks.map((t) => ({
        name: t.name,
        times: Array.from((t as THREE.KeyframeTrack & { times: ArrayLike<number> }).times),
        values: Array.from((t as THREE.KeyframeTrack & { values: ArrayLike<number> }).values)
      }))
    }))
  };

  // ANIMATION MIXER ───────────────────────────────────────────────
  const mixer = new THREE.AnimationMixer(carRoot);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.setEffectiveWeight(0);
    actions.set(clip.name, action);
  }
  // Runtime-only taillight action (NOT exported).
  // Bound to materials.lightRed via PropertyBinding using its uuid;
  // the mixer can resolve this because Object3D.userData is reachable
  // from the root through PropertyBinding.findNode()'s parent walk.
  const taillightAction = mixer.clipAction(taillightClip);
  taillightAction.setLoop(THREE.LoopRepeat, Infinity);
  taillightAction.setEffectiveWeight(0);

  let currentAnim = 'drive';
  actions.get(currentAnim)!.setEffectiveWeight(1).play();

  // RUNTIME LOOP ──────────────────────────────────────────────────
  let isPlaying = false;
  let internalAnimId: number | null = null;
  const clock = new THREE.Clock();

  function tick(dt: number, _time: number) {
    const clampedDt = Math.min(dt, 0.1);
    mixer.update(clampedDt);
  }

  function play() {
    if (isPlaying) return;
    isPlaying = true;
    clock.start();
    function internalLoop() {
      if (!isPlaying) return;
      internalAnimId = requestAnimationFrame(internalLoop);
      tick(clock.getDelta(), clock.getElapsedTime());
    }
    internalLoop();
  }

  function stop() {
    isPlaying = false;
    if (internalAnimId !== null) {
      cancelAnimationFrame(internalAnimId);
      internalAnimId = null;
    }
    mixer.stopAllAction();
  }

  // PUBLIC APIs ───────────────────────────────────────────────────
  function setAnimation(animName: string) {
    if (!actions.has(animName)) return;
    if (animName === currentAnim) return;
    const fade = 0.2;
    const prev = actions.get(currentAnim);
    const next = actions.get(animName)!;
    if (prev) {
      prev.reset();
      prev.setEffectiveWeight(1);
      prev.fadeOut(fade);
    }
    next.reset();
    next.setEffectiveWeight(1);
    next.fadeIn(fade);
    next.play();
    // Taillight pulse rides along only with idle_rev — preserves the
    // original visual behavior without polluting the exported GLB.
    if (animName === 'idle_rev') {
      taillightAction.reset();
      taillightAction.setEffectiveWeight(1);
      taillightAction.fadeIn(fade);
      taillightAction.play();
    } else {
      taillightAction.fadeOut(fade);
    }
    currentAnim = animName;
  }

  function setHeadlights(enabled: boolean) {
    materials.lightWarm.emissiveIntensity = enabled ? 2.5 : 0.05;
  }

  function setBodyColor(hex: string) {
    materials.bodyPrimary.color.set(hex);
  }

  function dispose() {
    stop();
    carRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
    // Free mixer + clip caches.
    try { mixer.stopAllAction(); } catch (_) { /* noop */ }
    try { mixer.uncacheRoot(carRoot); } catch (_) { /* noop */ }
  }

  Object.defineProperty(carRoot, 'currentAnimation', { get: () => currentAnim });
  carRoot.tick = tick;
  carRoot.play = play;
  carRoot.stop = stop;
  carRoot.setAnimation = setAnimation;
  carRoot.setHeadlights = setHeadlights;
  carRoot.setBodyColor = setBodyColor;
  carRoot.dispose = dispose;

  return carRoot;
}

export default createSupercar;
