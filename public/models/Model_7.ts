/**
 * 3D Robot Character Model
 * High-Poly, High-Fidelity Stylized Model with True Bone Rigging & Vertex Skin Weights,
 * SkinnedMesh Architecture, PBR Materials, and 7 Canonical Animation Clips.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RobotModelOptions, ModelMetrics } from '../types';

// =============================================================================
// COLOR PALETTE CONSTANTS (Sampled from reference image)
// =============================================================================
export const ROBOT_PALETTE = {
  primaryYellow: 0xf59e0b,      // Warm golden amber lacquer
  primaryYellowHighlight: 0xfbbf24,
  screenBlack: 0x0c0f14,        // Glossy obsidian screen display
  eyeGlowCyan: 0xe0f7fa,        // Luminous cyan-white eye emissive
  darkGunmetal: 0x20242c,       // Matte dark charcoal joint rings, cuff & dials
  silverChrome: 0xc8cad0,       // Polished mechanical limb cylinders
  clawPincerSteel: 0x949ba6,    // Satin finish high-strength tool steel
  accentWarmGlow: 0xffb703,
};

// =============================================================================
// BONE INDEX CONSTANTS
// =============================================================================
export const BONE_INDICES = {
  ROOT: 0,
  TORSO: 1,
  NECK: 2,
  HEAD: 3,
  ANTENNA: 4,
  EYE_L: 5,
  EYE_R: 6,
  SHOULDER_L: 7,
  UPPERARM_L: 8,
  ELBOW_L: 9,
  FOREARM_L: 10,
  WRIST_L: 11,
  CLAW_A_L: 12,
  CLAW_B_L: 13,
  SHOULDER_R: 14,
  UPPERARM_R: 15,
  ELBOW_R: 16,
  FOREARM_R: 17,
  WRIST_R: 18,
  CLAW_A_R: 19,
  CLAW_B_R: 20,
} as const;

// =============================================================================
// MATH & ROTATION HELPERS
// =============================================================================
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

function pushQuatKeyframe(xRad: number, yRad: number, zRad: number, arr: number[]): void {
  _euler.set(xRad, yRad, zRad, 'XYZ');
  _quat.setFromEuler(_euler).normalize();
  arr.push(_quat.x, _quat.y, _quat.z, _quat.w);
}

/**
 * Creates a curved mechanical pincer claw shape using smooth quadratic curves
 */
function createClawProngGeometry(isUpper: boolean): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const sign = isUpper ? 1 : -1;

  // Base mount near knuckle
  shape.moveTo(0, -0.03 * sign);
  // Outer crescent curve sweeps forward (+Z) and curves inward
  shape.quadraticCurveTo(0.12, 0.04 * sign, 0.16, 0.18 * sign);
  // Tapered rounded pincer beak
  shape.quadraticCurveTo(0.14, 0.22 * sign, 0.09, 0.20 * sign);
  // Inner concave bite jaw
  shape.quadraticCurveTo(0.06, 0.08 * sign, 0.0, 0.02 * sign);
  shape.lineTo(0, -0.03 * sign);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 0.034,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelOffset: 0,
    bevelSegments: 4,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  // Rotate so the claw points forward (+Z) with curvature in Y and X
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Procedural micro-roughness texture to enhance specular sheen
 */
function createMicroRoughnessTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n1 = Math.sin(x * 0.25) * Math.cos(y * 0.25);
      const n2 = Math.sin(x * 0.8 + 1.2) * Math.cos(y * 0.7 + 0.8);
      const val = Math.floor(220 + (n1 * 0.5 + n2 * 0.5) * 25);
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a cylinder geometry oriented along a 3D vector from pointA to pointB
 */
function createConnectingCylinder(
  pA: THREE.Vector3,
  pB: THREE.Vector3,
  radiusTop: number,
  radiusBottom: number,
  segments = 24
): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(pB, pA);
  const length = dir.length();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments);
  
  // Orient cylinder along dir
  const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, dir.clone().normalize());
  
  geo.applyQuaternion(quat);
  geo.translate(mid.x, mid.y, mid.z);
  geo.computeVertexNormals();
  return geo;
}

// =============================================================================
// MAIN 3D CHARACTER MODEL FACTORY (SkinnedMesh + True Skeleton Rigging)
// =============================================================================
export function createRobotCharacterModel(options: RobotModelOptions = {}): THREE.Group {
  const scale = options.scale ?? 1;
  const shadows = options.shadows ?? true;
  const wireframe = options.wireframe ?? false;
  const primaryColor = options.primaryColor ?? ROBOT_PALETTE.primaryYellow;
  const eyeGlowColor = options.eyeGlowColor ?? ROBOT_PALETTE.eyeGlowCyan;
  const metalColor = options.metalColor ?? ROBOT_PALETTE.silverChrome;
  const microRoughness = options.microRoughness !== false;

  const root = new THREE.Group();
  root.name = 'RobotCharacter';

  const microRoughnessTex = microRoughness ? createMicroRoughnessTexture() : null;

  // ---------------------------------------------------------------------------
  // PBR MATERIALS
  // ---------------------------------------------------------------------------
  const materials = {
    yellowLacquer: new THREE.MeshPhysicalMaterial({
      color: primaryColor,
      roughness: 0.18,
      metalness: 0.03,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      reflectivity: 0.65,
      roughnessMap: microRoughnessTex,
      wireframe,
    }),

    screenGlass: new THREE.MeshPhysicalMaterial({
      color: ROBOT_PALETTE.screenBlack,
      roughness: 0.07,
      metalness: 0.25,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.9,
      wireframe,
    }),

    screenBezel: new THREE.MeshStandardMaterial({
      color: ROBOT_PALETTE.darkGunmetal,
      roughness: 0.35,
      metalness: 0.85,
      wireframe,
    }),

    eyeGlow: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: eyeGlowColor,
      emissiveIntensity: 3.8,
      roughness: 0.1,
      metalness: 0.1,
      wireframe,
    }),

    eyeHalo: new THREE.MeshBasicMaterial({
      color: eyeGlowColor,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),

    chromeMetal: new THREE.MeshStandardMaterial({
      color: metalColor,
      roughness: 0.20,
      metalness: 0.94,
      roughnessMap: microRoughnessTex,
      wireframe,
    }),

    darkGunmetal: new THREE.MeshStandardMaterial({
      color: ROBOT_PALETTE.darkGunmetal,
      roughness: 0.38,
      metalness: 0.88,
      wireframe,
    }),

    clawSteel: new THREE.MeshStandardMaterial({
      color: ROBOT_PALETTE.clawPincerSteel,
      roughness: 0.25,
      metalness: 0.90,
      wireframe,
    }),

    thrusterGlow: new THREE.MeshStandardMaterial({
      color: 0xffa000,
      emissive: ROBOT_PALETTE.accentWarmGlow,
      emissiveIntensity: 2.5,
      roughness: 0.3,
    }),
  };

  // ---------------------------------------------------------------------------
  // SKELETON BONE DEFINITIONS (Real THREE.Bone hierarchy)
  // ---------------------------------------------------------------------------
  const rootBone = new THREE.Bone();
  rootBone.name = 'Root';
  rootBone.position.set(0, 0, 0);
  root.add(rootBone);

  const torsoBone = new THREE.Bone();
  torsoBone.name = 'Torso';
  torsoBone.position.set(0, 0, 0);
  rootBone.add(torsoBone);

  const neckBone = new THREE.Bone();
  neckBone.name = 'Neck';
  neckBone.position.set(0, 0.44, 0);
  torsoBone.add(neckBone);

  const headBone = new THREE.Bone();
  headBone.name = 'Head';
  headBone.position.set(0, 0.18, 0.04);
  neckBone.add(headBone);

  const antennaBone = new THREE.Bone();
  antennaBone.name = 'Antenna';
  antennaBone.position.set(0, 0.52, 0.0);
  headBone.add(antennaBone);

  const eyeLeftBone = new THREE.Bone();
  eyeLeftBone.name = 'EyeLeft';
  eyeLeftBone.position.set(-0.22, 0.03, 0.44);
  headBone.add(eyeLeftBone);

  const eyeRightBone = new THREE.Bone();
  eyeRightBone.name = 'EyeRight';
  eyeRightBone.position.set(0.22, 0.03, 0.44);
  headBone.add(eyeRightBone);

  // Left Arm Bone Chain
  const shoulderLBone = new THREE.Bone();
  shoulderLBone.name = 'ShoulderLeft';
  shoulderLBone.position.set(-0.38, 0.12, 0.04);
  torsoBone.add(shoulderLBone);

  const upperArmLBone = new THREE.Bone();
  upperArmLBone.name = 'UpperArmLeft';
  upperArmLBone.position.set(0, 0, 0);
  shoulderLBone.add(upperArmLBone);

  const elbowLBone = new THREE.Bone();
  elbowLBone.name = 'ElbowLeft';
  elbowLBone.position.set(-0.16, -0.18, 0.08);
  upperArmLBone.add(elbowLBone);

  const forearmLBone = new THREE.Bone();
  forearmLBone.name = 'ForearmLeft';
  forearmLBone.position.set(0, 0, 0);
  elbowLBone.add(forearmLBone);

  const wristLBone = new THREE.Bone();
  wristLBone.name = 'WristLeft';
  // Bends forward and inward toward center front!
  wristLBone.position.set(0.12, -0.12, 0.20);
  forearmLBone.add(wristLBone);

  const clawALBone = new THREE.Bone();
  clawALBone.name = 'ClawALeft';
  clawALBone.position.set(0.02, 0.03, 0.06);
  wristLBone.add(clawALBone);

  const clawBLBone = new THREE.Bone();
  clawBLBone.name = 'ClawBLeft';
  clawBLBone.position.set(-0.02, -0.03, 0.06);
  wristLBone.add(clawBLBone);

  // Right Arm Bone Chain (exact symmetric counterpart)
  const shoulderRBone = new THREE.Bone();
  shoulderRBone.name = 'ShoulderRight';
  shoulderRBone.position.set(0.38, 0.12, 0.04);
  torsoBone.add(shoulderRBone);

  const upperArmRBone = new THREE.Bone();
  upperArmRBone.name = 'UpperArmRight';
  upperArmRBone.position.set(0, 0, 0);
  shoulderRBone.add(upperArmRBone);

  const elbowRBone = new THREE.Bone();
  elbowRBone.name = 'ElbowRight';
  elbowRBone.position.set(0.16, -0.18, 0.08);
  upperArmRBone.add(elbowRBone);

  const forearmRBone = new THREE.Bone();
  forearmRBone.name = 'ForearmRight';
  forearmRBone.position.set(0, 0, 0);
  elbowRBone.add(forearmRBone);

  const wristRBone = new THREE.Bone();
  wristRBone.name = 'WristRight';
  // Bends forward and inward toward center front!
  wristRBone.position.set(-0.12, -0.12, 0.20);
  forearmRBone.add(wristRBone);

  const clawARBone = new THREE.Bone();
  clawARBone.name = 'ClawARight';
  clawARBone.position.set(-0.02, 0.03, 0.06);
  wristRBone.add(clawARBone);

  const clawBRBone = new THREE.Bone();
  clawBRBone.name = 'ClawBRight';
  clawBRBone.position.set(0.02, -0.03, 0.06);
  wristRBone.add(clawBRBone);

  // Register all 21 bones in sequence
  const bones: THREE.Bone[] = [
    rootBone,       // 0: Root
    torsoBone,      // 1: Torso
    neckBone,       // 2: Neck
    headBone,       // 3: Head
    antennaBone,    // 4: Antenna
    eyeLeftBone,    // 5: EyeLeft
    eyeRightBone,   // 6: EyeRight
    shoulderLBone,  // 7: ShoulderLeft
    upperArmLBone,  // 8: UpperArmLeft
    elbowLBone,     // 9: ElbowLeft
    forearmLBone,   // 10: ForearmLeft
    wristLBone,     // 11: WristLeft
    clawALBone,     // 12: ClawALeft
    clawBLBone,     // 13: ClawBLeft
    shoulderRBone,  // 14: ShoulderRight
    upperArmRBone,  // 15: UpperArmRight
    elbowRBone,     // 16: ElbowRight
    forearmRBone,   // 17: ForearmRight
    wristRBone,     // 18: WristRight
    clawARBone,     // 19: ClawARight
    clawBRBone,     // 20: ClawBRight
  ];

  // Update matrix world before skeleton binding
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  // ---------------------------------------------------------------------------
  // HELPER: BUILD SKINNED MESH WITH VERTEX WEIGHTS
  // ---------------------------------------------------------------------------
  function createRiggedMesh(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    boneIndex: number,
    name: string
  ): THREE.SkinnedMesh {
    const count = geo.attributes.position.count;
    const skinIndices: number[] = new Array(count * 4);
    const skinWeights: number[] = new Array(count * 4);

    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      skinIndices[idx] = boneIndex;
      skinIndices[idx + 1] = 0;
      skinIndices[idx + 2] = 0;
      skinIndices[idx + 3] = 0;

      skinWeights[idx] = 1.0;
      skinWeights[idx + 1] = 0.0;
      skinWeights[idx + 2] = 0.0;
      skinWeights[idx + 3] = 0.0;
    }

    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.name = name;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.userData.isPickable = true;
    mesh.userData.partName = name;
    mesh.userData.boneIndex = boneIndex;

    root.add(mesh);
    mesh.bind(skeleton);
    return mesh;
  }

  // ---------------------------------------------------------------------------
  // 1. TORSO & THRUSTER
  // ---------------------------------------------------------------------------
  // Main yellow lacquer body capsule
  const torsoGeo = new RoundedBoxGeometry(0.72, 0.82, 0.58, 14, 0.25);
  torsoGeo.translate(0, 0.06, 0);
  createRiggedMesh(torsoGeo, materials.yellowLacquer, BONE_INDICES.TORSO, 'Torso Body');

  // Thruster Collar
  const thrusterCollarGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.09, 32);
  thrusterCollarGeo.translate(0, -0.38, 0);
  createRiggedMesh(thrusterCollarGeo, materials.darkGunmetal, BONE_INDICES.TORSO, 'Thruster Collar');

  // Thruster Warm Glow Disc
  const thrusterGlowGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 32);
  thrusterGlowGeo.translate(0, -0.42, 0);
  createRiggedMesh(thrusterGlowGeo, materials.thrusterGlow, BONE_INDICES.TORSO, 'Thruster Glow');

  // Chest Emblem Trim
  const chestTrimGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 32);
  chestTrimGeo.rotateX(Math.PI / 2);
  chestTrimGeo.translate(0, 0.10, 0.29);
  createRiggedMesh(chestTrimGeo, materials.darkGunmetal, BONE_INDICES.TORSO, 'Chest Emblem');

  // ---------------------------------------------------------------------------
  // 2. NECK
  // ---------------------------------------------------------------------------
  const neckGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.14, 32);
  neckGeo.translate(0, 0.44, 0);
  createRiggedMesh(neckGeo, materials.darkGunmetal, BONE_INDICES.NECK, 'Neck Joint Ring');

  // ---------------------------------------------------------------------------
  // 3. HEAD CASING, SCREEN & EAR DIALS
  // ---------------------------------------------------------------------------
  // Rounded TV monitor head casing
  const headGeo = new RoundedBoxGeometry(1.26, 0.96, 0.82, 16, 0.30);
  headGeo.translate(0, 0.62, 0.04);
  createRiggedMesh(headGeo, materials.yellowLacquer, BONE_INDICES.HEAD, 'Head Casing');

  // Recessed Screen Bezel
  const bezelGeo = new RoundedBoxGeometry(1.02, 0.74, 0.08, 12, 0.20);
  bezelGeo.translate(0, 0.63, 0.42);
  createRiggedMesh(bezelGeo, materials.screenBezel, BONE_INDICES.HEAD, 'Screen Bezel');

  // Glossy Obsidian Display Glass
  const screenGeo = new RoundedBoxGeometry(0.92, 0.65, 0.06, 12, 0.18);
  screenGeo.translate(0, 0.63, 0.45);
  createRiggedMesh(screenGeo, materials.screenGlass, BONE_INDICES.HEAD, 'Screen Display');

  // Side Ear Dials (Left & Right)
  const earLCollarGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.09, 32);
  earLCollarGeo.rotateZ(Math.PI / 2);
  earLCollarGeo.translate(-0.66, 0.62, 0.04);
  createRiggedMesh(earLCollarGeo, materials.darkGunmetal, BONE_INDICES.HEAD, 'Ear Dial Left');

  const earLCapGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32);
  earLCapGeo.rotateZ(Math.PI / 2);
  earLCapGeo.translate(-0.71, 0.62, 0.04);
  createRiggedMesh(earLCapGeo, materials.chromeMetal, BONE_INDICES.HEAD, 'Ear Cap Left');

  const earRCollarGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.09, 32);
  earRCollarGeo.rotateZ(Math.PI / 2);
  earRCollarGeo.translate(0.66, 0.62, 0.04);
  createRiggedMesh(earRCollarGeo, materials.darkGunmetal, BONE_INDICES.HEAD, 'Ear Dial Right');

  const earRCapGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32);
  earRCapGeo.rotateZ(Math.PI / 2);
  earRCapGeo.translate(0.71, 0.62, 0.04);
  createRiggedMesh(earRCapGeo, materials.chromeMetal, BONE_INDICES.HEAD, 'Ear Cap Right');

  // Antenna Base Collar (Head Mounted)
  const antBaseGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.06, 32);
  antBaseGeo.translate(0, 1.12, 0.04);
  createRiggedMesh(antBaseGeo, materials.darkGunmetal, BONE_INDICES.HEAD, 'Antenna Base');

  // ---------------------------------------------------------------------------
  // 4. ANTENNA STALK & GLOWING BALL
  // ---------------------------------------------------------------------------
  const antStalkGeo = new THREE.CylinderGeometry(0.028, 0.034, 0.28, 24);
  antStalkGeo.translate(0, 1.28, 0.04);
  createRiggedMesh(antStalkGeo, materials.darkGunmetal, BONE_INDICES.ANTENNA, 'Antenna Stalk');

  const antBallGeo = new THREE.SphereGeometry(0.115, 32, 24);
  antBallGeo.translate(0, 1.44, 0.04);
  createRiggedMesh(antBallGeo, materials.yellowLacquer, BONE_INDICES.ANTENNA, 'Antenna Ball');

  // ---------------------------------------------------------------------------
  // 5. LUMINOUS DIGITAL EYES
  // ---------------------------------------------------------------------------
  // Left Eye Disc
  const eyeLGeo = new THREE.CircleGeometry(0.115, 32);
  eyeLGeo.translate(-0.22, 0.65, 0.485);
  createRiggedMesh(eyeLGeo, materials.eyeGlow, BONE_INDICES.EYE_L, 'Eye Left');

  const eyeLHaloGeo = new THREE.CircleGeometry(0.165, 32);
  eyeLHaloGeo.translate(-0.22, 0.65, 0.484);
  createRiggedMesh(eyeLHaloGeo, materials.eyeHalo, BONE_INDICES.EYE_L, 'Eye Left Halo');

  // Right Eye Disc
  const eyeRGeo = new THREE.CircleGeometry(0.115, 32);
  eyeRGeo.translate(0.22, 0.65, 0.485);
  createRiggedMesh(eyeRGeo, materials.eyeGlow, BONE_INDICES.EYE_R, 'Eye Right');

  const eyeRHaloGeo = new THREE.CircleGeometry(0.165, 32);
  eyeRHaloGeo.translate(0.22, 0.65, 0.484);
  createRiggedMesh(eyeRHaloGeo, materials.eyeHalo, BONE_INDICES.EYE_R, 'Eye Right Halo');

  // ---------------------------------------------------------------------------
  // 6. ARMS & HANDS (FORWARD-FACING FRIENDLY STANCE)
  // ---------------------------------------------------------------------------
  // Joint coordinates in world/root rest-pose space
  const S_L = new THREE.Vector3(-0.38, 0.12, 0.04);
  const E_L = new THREE.Vector3(-0.54, -0.06, 0.12);
  const W_L = new THREE.Vector3(-0.42, -0.18, 0.32);

  const S_R = new THREE.Vector3(0.38, 0.12, 0.04);
  const E_R = new THREE.Vector3(0.54, -0.06, 0.12);
  const W_R = new THREE.Vector3(0.42, -0.18, 0.32);

  // --- LEFT ARM MESHES ---
  // Left Shoulder Socket
  const shoulderLGeo = new THREE.SphereGeometry(0.088, 24, 24);
  shoulderLGeo.translate(S_L.x, S_L.y, S_L.z);
  createRiggedMesh(shoulderLGeo, materials.darkGunmetal, BONE_INDICES.SHOULDER_L, 'Shoulder Joint Left');

  // Left Upper Arm Cylinder (Shoulder -> Elbow)
  const upperArmLGeo = createConnectingCylinder(S_L, E_L, 0.064, 0.068, 24);
  createRiggedMesh(upperArmLGeo, materials.chromeMetal, BONE_INDICES.UPPERARM_L, 'Upper Arm Left');

  // Left Elbow Joint Ring
  const elbowLGeo = new THREE.SphereGeometry(0.076, 24, 24);
  elbowLGeo.translate(E_L.x, E_L.y, E_L.z);
  createRiggedMesh(elbowLGeo, materials.darkGunmetal, BONE_INDICES.ELBOW_L, 'Elbow Joint Left');

  // Left Forearm Cylinder (Elbow -> Wrist, aiming forward-inward)
  const forearmLGeo = createConnectingCylinder(E_L, W_L, 0.058, 0.062, 24);
  createRiggedMesh(forearmLGeo, materials.chromeMetal, BONE_INDICES.FOREARM_L, 'Forearm Left');

  // Left Wrist Cuff Collar
  const wristDirL = new THREE.Vector3().subVectors(W_L, E_L).normalize();
  const wristCuffLGeo = new THREE.CylinderGeometry(0.086, 0.080, 0.09, 24);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const wristQuatL = new THREE.Quaternion().setFromUnitVectors(yAxis, wristDirL);
  wristCuffLGeo.applyQuaternion(wristQuatL);
  wristCuffLGeo.translate(W_L.x, W_L.y, W_L.z);
  createRiggedMesh(wristCuffLGeo, materials.darkGunmetal, BONE_INDICES.WRIST_L, 'Wrist Cuff Left');

  // Left Hand Golden Knuckle Ball
  const palmLPos = W_L.clone().add(wristDirL.clone().multiplyScalar(0.045));
  const palmLGeo = new THREE.SphereGeometry(0.076, 24, 24);
  palmLGeo.translate(palmLPos.x, palmLPos.y, palmLPos.z);
  createRiggedMesh(palmLGeo, materials.yellowLacquer, BONE_INDICES.WRIST_L, 'Palm Ball Left');

  // Left Caliper Claw Prongs (Pincers opening forward-inward)
  const clawALGeo = createClawProngGeometry(true);
  clawALGeo.rotateZ(0.26);
  clawALGeo.translate(palmLPos.x + 0.02, palmLPos.y + 0.03, palmLPos.z + 0.06);
  createRiggedMesh(clawALGeo, materials.clawSteel, BONE_INDICES.CLAW_A_L, 'Claw Prong A Left');

  const clawBLGeo = createClawProngGeometry(false);
  clawBLGeo.rotateZ(-0.26);
  clawBLGeo.translate(palmLPos.x - 0.02, palmLPos.y - 0.03, palmLPos.z + 0.06);
  createRiggedMesh(clawBLGeo, materials.clawSteel, BONE_INDICES.CLAW_B_L, 'Claw Prong B Left');

  // --- RIGHT ARM MESHES ---
  // Right Shoulder Socket
  const shoulderRGeo = new THREE.SphereGeometry(0.088, 24, 24);
  shoulderRGeo.translate(S_R.x, S_R.y, S_R.z);
  createRiggedMesh(shoulderRGeo, materials.darkGunmetal, BONE_INDICES.SHOULDER_R, 'Shoulder Joint Right');

  // Right Upper Arm Cylinder (Shoulder -> Elbow)
  const upperArmRGeo = createConnectingCylinder(S_R, E_R, 0.064, 0.068, 24);
  createRiggedMesh(upperArmRGeo, materials.chromeMetal, BONE_INDICES.UPPERARM_R, 'Upper Arm Right');

  // Right Elbow Joint Ring
  const elbowRGeo = new THREE.SphereGeometry(0.076, 24, 24);
  elbowRGeo.translate(E_R.x, E_R.y, E_R.z);
  createRiggedMesh(elbowRGeo, materials.darkGunmetal, BONE_INDICES.ELBOW_R, 'Elbow Joint Right');

  // Right Forearm Cylinder (Elbow -> Wrist, aiming forward-inward)
  const forearmRGeo = createConnectingCylinder(E_R, W_R, 0.058, 0.062, 24);
  createRiggedMesh(forearmRGeo, materials.chromeMetal, BONE_INDICES.FOREARM_R, 'Forearm Right');

  // Right Wrist Cuff Collar
  const wristDirR = new THREE.Vector3().subVectors(W_R, E_R).normalize();
  const wristCuffRGeo = new THREE.CylinderGeometry(0.086, 0.080, 0.09, 24);
  const wristQuatR = new THREE.Quaternion().setFromUnitVectors(yAxis, wristDirR);
  wristCuffRGeo.applyQuaternion(wristQuatR);
  wristCuffRGeo.translate(W_R.x, W_R.y, W_R.z);
  createRiggedMesh(wristCuffRGeo, materials.darkGunmetal, BONE_INDICES.WRIST_R, 'Wrist Cuff Right');

  // Right Hand Golden Knuckle Ball
  const palmRPos = W_R.clone().add(wristDirR.clone().multiplyScalar(0.045));
  const palmRGeo = new THREE.SphereGeometry(0.076, 24, 24);
  palmRGeo.translate(palmRPos.x, palmRPos.y, palmRPos.z);
  createRiggedMesh(palmRGeo, materials.yellowLacquer, BONE_INDICES.WRIST_R, 'Palm Ball Right');

  // Right Caliper Claw Prongs (Pincers opening forward-inward)
  const clawARGeo = createClawProngGeometry(true);
  clawARGeo.rotateZ(-0.26);
  clawARGeo.translate(palmRPos.x - 0.02, palmRPos.y + 0.03, palmRPos.z + 0.06);
  createRiggedMesh(clawARGeo, materials.clawSteel, BONE_INDICES.CLAW_A_R, 'Claw Prong A Right');

  const clawBRGeo = createClawProngGeometry(false);
  clawBRGeo.rotateZ(0.26);
  clawBRGeo.translate(palmRPos.x + 0.02, palmRPos.y - 0.03, palmRPos.z + 0.06);
  createRiggedMesh(clawBRGeo, materials.clawSteel, BONE_INDICES.CLAW_B_R, 'Claw Prong B Right');

  // ---------------------------------------------------------------------------
  // 7. SCRIPTED ANIMATION CLIPS (Directly Animating Rigged Bones)
  // ---------------------------------------------------------------------------
  const clips: THREE.AnimationClip[] = [];

  // CLIP 1: IDLE HOVER (2.4s seamless loop with gentle floating bob, breathing, spring lag)
  {
    const times = [0, 0.6, 1.2, 1.8, 2.4];

    // Torso floating position Y bob
    const torsoPosValues = [
      0, 0.0, 0,
      0, 0.055, 0,
      0, 0.0, 0,
      0, -0.045, 0,
      0, 0.0, 0,
    ];
    const torsoPosTrack = new THREE.VectorKeyframeTrack('Torso.position', times, torsoPosValues);

    // Torso subtle breathing pitch
    const torsoQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, torsoQuat);
    pushQuatKeyframe(0.03, 0, 0.015, torsoQuat);
    pushQuatKeyframe(0, 0, 0, torsoQuat);
    pushQuatKeyframe(-0.025, 0, -0.015, torsoQuat);
    pushQuatKeyframe(0, 0, 0, torsoQuat);
    const torsoRotTrack = new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, torsoQuat);

    // Head gentle alive gaze tilt
    const headQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, headQuat);
    pushQuatKeyframe(-0.03, 0.04, 0.02, headQuat);
    pushQuatKeyframe(0, 0, 0, headQuat);
    pushQuatKeyframe(0.025, -0.03, -0.015, headQuat);
    pushQuatKeyframe(0, 0, 0, headQuat);
    const headRotTrack = new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headQuat);

    // Antenna inertial sway lag
    const antQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, antQuat);
    pushQuatKeyframe(-0.10, 0, -0.06, antQuat);
    pushQuatKeyframe(0, 0, 0, antQuat);
    pushQuatKeyframe(0.08, 0, 0.05, antQuat);
    pushQuatKeyframe(0, 0, 0, antQuat);
    const antRotTrack = new THREE.QuaternionKeyframeTrack('Antenna.quaternion', times, antQuat);

    // Left Arm floating counterbalance (retaining forward stance)
    const armLQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(-0.05, 0.03, 0.06, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(0.04, -0.02, -0.05, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    const armLTrack = new THREE.QuaternionKeyframeTrack('UpperArmLeft.quaternion', times, armLQuat);

    // Right Arm floating counterbalance (retaining forward stance)
    const armRQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(0.04, -0.02, -0.05, armRQuat);
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(-0.05, 0.03, 0.06, armRQuat);
    pushQuatKeyframe(0, 0, 0, armRQuat);
    const armRTrack = new THREE.QuaternionKeyframeTrack('UpperArmRight.quaternion', times, armRQuat);

    // Eye scaling (subtle digital blink)
    const eyeScaleTimes = [0, 1.15, 1.22, 1.29, 2.4];
    const eyeScaleVals = [
      1, 1, 1,
      1, 1, 1,
      1.05, 0.20, 1, // blink compression
      1, 1, 1,
      1, 1, 1,
    ];
    const eyeLScaleTrack = new THREE.VectorKeyframeTrack('EyeLeft.scale', eyeScaleTimes, eyeScaleVals);
    const eyeRScaleTrack = new THREE.VectorKeyframeTrack('EyeRight.scale', eyeScaleTimes, eyeScaleVals);

    clips.push(new THREE.AnimationClip('idle_hover', 2.4, [
      torsoPosTrack,
      torsoRotTrack,
      headRotTrack,
      antRotTrack,
      armLTrack,
      armRTrack,
      eyeLScaleTrack,
      eyeRScaleTrack,
    ]));
  }

  // CLIP 2: WALK GLIDE (2.0s propulsion gliding loop with aerodynamic forward tilt & sway)
  {
    const times = [0, 0.5, 1.0, 1.5, 2.0];

    const torsoPosVals = [
      0, 0.02, 0,
      0, -0.03, 0.05,
      0, 0.02, 0,
      0, -0.03, 0.05,
      0, 0.02, 0,
    ];
    const torsoPosTrack = new THREE.VectorKeyframeTrack('Torso.position', times, torsoPosVals);

    const torsoQuat: number[] = [];
    pushQuatKeyframe(0.12, 0, 0, torsoQuat);
    pushQuatKeyframe(0.14, 0.08, 0.06, torsoQuat);
    pushQuatKeyframe(0.12, 0, 0, torsoQuat);
    pushQuatKeyframe(0.14, -0.08, -0.06, torsoQuat);
    pushQuatKeyframe(0.12, 0, 0, torsoQuat);
    const torsoRotTrack = new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, torsoQuat);

    const antQuat: number[] = [];
    pushQuatKeyframe(-0.18, 0, 0, antQuat);
    pushQuatKeyframe(-0.24, 0.05, 0.04, antQuat);
    pushQuatKeyframe(-0.18, 0, 0, antQuat);
    pushQuatKeyframe(-0.24, -0.05, -0.04, antQuat);
    pushQuatKeyframe(-0.18, 0, 0, antQuat);
    const antRotTrack = new THREE.QuaternionKeyframeTrack('Antenna.quaternion', times, antQuat);

    // Arms glide in rhythmic counterbalance in front
    const armLQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(0.18, 0.05, 0.08, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(-0.15, -0.04, -0.06, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    const armLTrack = new THREE.QuaternionKeyframeTrack('UpperArmLeft.quaternion', times, armLQuat);

    const armRQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(-0.15, -0.04, -0.06, armRQuat);
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(0.18, 0.05, 0.08, armRQuat);
    pushQuatKeyframe(0, 0, 0, armRQuat);
    const armRTrack = new THREE.QuaternionKeyframeTrack('UpperArmRight.quaternion', times, armRQuat);

    clips.push(new THREE.AnimationClip('walk_glide', 2.0, [
      torsoPosTrack,
      torsoRotTrack,
      antRotTrack,
      armLTrack,
      armRTrack,
    ]));
  }

  // CLIP 3: PINCER ATTACK (1.8s energetic coil-up, forward lunge, rapid claw snap & clamp)
  {
    const times = [0, 0.35, 0.70, 0.85, 1.20, 1.80];

    const torsoPosVals = [
      0, 0, 0,
      0, -0.08, -0.12, // coil back
      0, 0.05, 0.18,   // lunging forward thrust
      0, 0.04, 0.15,
      0, 0.01, 0.04,
      0, 0, 0,
    ];
    const torsoPosTrack = new THREE.VectorKeyframeTrack('Torso.position', times, torsoPosVals);

    // Torso pitch: tilt back, then snap forward
    const torsoQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, torsoQuat);
    pushQuatKeyframe(-0.18, 0, 0, torsoQuat); // coil
    pushQuatKeyframe(0.24, 0, 0, torsoQuat);  // forward strike
    pushQuatKeyframe(0.20, 0, 0, torsoQuat);
    pushQuatKeyframe(0.06, 0, 0, torsoQuat);
    pushQuatKeyframe(0, 0, 0, torsoQuat);
    const torsoRotTrack = new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, torsoQuat);

    // Claws open wide, then snap shut tightly!
    const clawSpreadQuatOpen: number[] = [];
    pushQuatKeyframe(0, 0, 0.38, clawSpreadQuatOpen);
    const clawSpreadQuatShut: number[] = [];
    pushQuatKeyframe(0, 0, -0.15, clawSpreadQuatShut);
    const clawSpreadQuatRest: number[] = [];
    pushQuatKeyframe(0, 0, 0, clawSpreadQuatRest);

    const clawLTimes = [0, 0.35, 0.70, 0.80, 1.20, 1.80];
    const clawALVals: number[] = [];
    pushQuatKeyframe(0, 0, 0, clawALVals);
    pushQuatKeyframe(0, 0, 0.42, clawALVals);  // open wide
    pushQuatKeyframe(0, 0, -0.18, clawALVals); // SNAP shut
    pushQuatKeyframe(0, 0, -0.18, clawALVals);
    pushQuatKeyframe(0, 0, 0.05, clawALVals);
    pushQuatKeyframe(0, 0, 0, clawALVals);
    const clawALTrack = new THREE.QuaternionKeyframeTrack('ClawALeft.quaternion', clawLTimes, clawALVals);

    const clawBLVals: number[] = [];
    pushQuatKeyframe(0, 0, 0, clawBLVals);
    pushQuatKeyframe(0, 0, -0.42, clawBLVals); // open wide
    pushQuatKeyframe(0, 0, 0.18, clawBLVals);  // SNAP shut
    pushQuatKeyframe(0, 0, 0.18, clawBLVals);
    pushQuatKeyframe(0, 0, -0.05, clawBLVals);
    pushQuatKeyframe(0, 0, 0, clawBLVals);
    const clawBLTrack = new THREE.QuaternionKeyframeTrack('ClawBLeft.quaternion', clawLTimes, clawBLVals);

    const clawARTimes = [0, 0.35, 0.70, 0.80, 1.20, 1.80];
    const clawARVals: number[] = [];
    pushQuatKeyframe(0, 0, 0, clawARVals);
    pushQuatKeyframe(0, 0, -0.42, clawARVals); // open wide
    pushQuatKeyframe(0, 0, 0.18, clawARVals);  // SNAP shut
    pushQuatKeyframe(0, 0, 0.18, clawARVals);
    pushQuatKeyframe(0, 0, -0.05, clawARVals);
    pushQuatKeyframe(0, 0, 0, clawARVals);
    const clawARTrack = new THREE.QuaternionKeyframeTrack('ClawARight.quaternion', clawARTimes, clawARVals);

    const clawBRVals: number[] = [];
    pushQuatKeyframe(0, 0, 0, clawBRVals);
    pushQuatKeyframe(0, 0, 0.42, clawBRVals);  // open wide
    pushQuatKeyframe(0, 0, -0.18, clawBRVals); // SNAP shut
    pushQuatKeyframe(0, 0, -0.18, clawBRVals);
    pushQuatKeyframe(0, 0, 0.05, clawBRVals);
    pushQuatKeyframe(0, 0, 0, clawBRVals);
    const clawBRTrack = new THREE.QuaternionKeyframeTrack('ClawBRight.quaternion', clawARTimes, clawBRVals);

    // Arms forward thrust
    const armLQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(-0.25, 0, -0.15, armLQuat); // pull back
    pushQuatKeyframe(0.40, 0, 0.15, armLQuat);   // thrust forward
    pushQuatKeyframe(0.35, 0, 0.12, armLQuat);
    pushQuatKeyframe(0.10, 0, 0.04, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    const armLTrack = new THREE.QuaternionKeyframeTrack('UpperArmLeft.quaternion', times, armLQuat);

    const armRQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(-0.25, 0, 0.15, armRQuat);  // pull back
    pushQuatKeyframe(0.40, 0, -0.15, armRQuat);  // thrust forward
    pushQuatKeyframe(0.35, 0, -0.12, armRQuat);
    pushQuatKeyframe(0.10, 0, -0.04, armRQuat);
    pushQuatKeyframe(0, 0, 0, armRQuat);
    const armRTrack = new THREE.QuaternionKeyframeTrack('UpperArmRight.quaternion', times, armRQuat);

    clips.push(new THREE.AnimationClip('pincer_attack', 1.80, [
      torsoPosTrack,
      torsoRotTrack,
      clawALTrack,
      clawBLTrack,
      clawARTrack,
      clawBRTrack,
      armLTrack,
      armRTrack,
    ]));
  }

  // CLIP 4: CURIOUS SCAN (2.2s interactive head cock, eye shifts, arm curious gesture)
  {
    const times = [0, 0.45, 0.95, 1.45, 1.85, 2.20];

    const headQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, headQuat);
    pushQuatKeyframe(0.08, 0.42, 0.22, headQuat);   // tilt left & examine
    pushQuatKeyframe(0.06, 0.38, 0.20, headQuat);
    pushQuatKeyframe(0.08, -0.42, -0.22, headQuat); // swing right & examine
    pushQuatKeyframe(0.06, -0.38, -0.20, headQuat);
    pushQuatKeyframe(0, 0, 0, headQuat);            // return center
    const headRotTrack = new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headQuat);

    const antQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, antQuat);
    pushQuatKeyframe(0.15, 0.10, 0.30, antQuat);
    pushQuatKeyframe(0.12, 0.08, 0.26, antQuat);
    pushQuatKeyframe(0.15, -0.10, -0.30, antQuat);
    pushQuatKeyframe(0.12, -0.08, -0.26, antQuat);
    pushQuatKeyframe(0, 0, 0, antQuat);
    const antRotTrack = new THREE.QuaternionKeyframeTrack('Antenna.quaternion', times, antQuat);

    // Arms express curiosity: right arm lifts slightly forward with claws inquisitive, left arm steadies
    const armRQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(0.22, -0.15, -0.18, armRQuat); // lift toward scan target
    pushQuatKeyframe(0.20, -0.12, -0.16, armRQuat);
    pushQuatKeyframe(-0.10, 0.10, 0.08, armRQuat);
    pushQuatKeyframe(-0.08, 0.08, 0.06, armRQuat);
    pushQuatKeyframe(0, 0, 0, armRQuat);
    const armRTrack = new THREE.QuaternionKeyframeTrack('UpperArmRight.quaternion', times, armRQuat);

    const armLQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(-0.10, -0.08, 0.06, armLQuat);
    pushQuatKeyframe(-0.08, -0.06, 0.05, armLQuat);
    pushQuatKeyframe(0.22, 0.15, 0.18, armLQuat);   // lift toward scan target
    pushQuatKeyframe(0.20, 0.12, 0.16, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    const armLTrack = new THREE.QuaternionKeyframeTrack('UpperArmLeft.quaternion', times, armLQuat);

    // Eye shift tracking
    const eyeShiftTimes = [0, 0.45, 0.95, 1.45, 2.20];
    const eyeLPosVals = [
      -0.22, 0.03, 0.44,
      -0.26, 0.05, 0.44, // look left
      -0.26, 0.05, 0.44,
      -0.18, 0.05, 0.44, // look right
      -0.22, 0.03, 0.44,
    ];
    const eyeLPosTrack = new THREE.VectorKeyframeTrack('EyeLeft.position', eyeShiftTimes, eyeLPosVals);

    const eyeRPosVals = [
      0.22, 0.03, 0.44,
      0.18, 0.05, 0.44,  // look left
      0.18, 0.05, 0.44,
      0.26, 0.05, 0.44,  // look right
      0.22, 0.03, 0.44,
    ];
    const eyeRPosTrack = new THREE.VectorKeyframeTrack('EyeRight.position', eyeShiftTimes, eyeRPosVals);

    clips.push(new THREE.AnimationClip('curious_scan', 2.20, [
      headRotTrack,
      antRotTrack,
      armRTrack,
      armLTrack,
      eyeLPosTrack,
      eyeRPosTrack,
    ]));
  }

  // CLIP 5: WAVE HELLO (2.0s cheerful greeting, right arm waves, cheerful head bob)
  {
    const times = [0, 0.35, 0.65, 0.95, 1.25, 1.55, 2.00];

    // Right arm raises high and waves side-to-side
    const armRQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(1.35, -0.30, -0.45, armRQuat); // raise arm high
    pushQuatKeyframe(1.40, -0.15, -0.75, armRQuat); // wave right
    pushQuatKeyframe(1.40, -0.40, -0.20, armRQuat); // wave left
    pushQuatKeyframe(1.40, -0.15, -0.75, armRQuat); // wave right
    pushQuatKeyframe(1.40, -0.40, -0.20, armRQuat); // wave left
    pushQuatKeyframe(0, 0, 0, armRQuat);            // return to front rest
    const armRTrack = new THREE.QuaternionKeyframeTrack('UpperArmRight.quaternion', times, armRQuat);

    // Left arm balances calmly in front
    const armLQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(-0.06, 0.04, 0.05, armLQuat);
    pushQuatKeyframe(-0.08, 0.05, 0.06, armLQuat);
    pushQuatKeyframe(-0.06, 0.04, 0.05, armLQuat);
    pushQuatKeyframe(-0.08, 0.05, 0.06, armLQuat);
    pushQuatKeyframe(-0.06, 0.04, 0.05, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    const armLTrack = new THREE.QuaternionKeyframeTrack('UpperArmLeft.quaternion', times, armLQuat);

    // Happy head tilt toward wave
    const headQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, headQuat);
    pushQuatKeyframe(0.06, 0.15, 0.12, headQuat);
    pushQuatKeyframe(0.08, 0.12, 0.10, headQuat);
    pushQuatKeyframe(0.06, 0.15, 0.12, headQuat);
    pushQuatKeyframe(0.08, 0.12, 0.10, headQuat);
    pushQuatKeyframe(0.06, 0.14, 0.11, headQuat);
    pushQuatKeyframe(0, 0, 0, headQuat);
    const headRotTrack = new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headQuat);

    // Cheerful antenna wiggle
    const antQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, antQuat);
    pushQuatKeyframe(0, 0, 0.25, antQuat);
    pushQuatKeyframe(0, 0, -0.22, antQuat);
    pushQuatKeyframe(0, 0, 0.25, antQuat);
    pushQuatKeyframe(0, 0, -0.22, antQuat);
    pushQuatKeyframe(0, 0, 0.10, antQuat);
    pushQuatKeyframe(0, 0, 0, antQuat);
    const antRotTrack = new THREE.QuaternionKeyframeTrack('Antenna.quaternion', times, antQuat);

    clips.push(new THREE.AnimationClip('wave_hello', 2.00, [
      armRTrack,
      armLTrack,
      headRotTrack,
      antRotTrack,
    ]));
  }

  // CLIP 6: POWER DOWN (2.4s standby descent, forward droop, eyes narrow)
  {
    const times = [0, 0.8, 1.6, 2.4];

    const torsoPosVals = [
      0, 0, 0,
      0, -0.12, 0,
      0, -0.24, 0,
      0, -0.28, 0, // rested down
    ];
    const torsoPosTrack = new THREE.VectorKeyframeTrack('Torso.position', times, torsoPosVals);

    const headQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, headQuat);
    pushQuatKeyframe(0.15, 0, 0, headQuat);
    pushQuatKeyframe(0.32, 0, 0, headQuat);
    pushQuatKeyframe(0.38, 0, 0, headQuat); // forward relaxed droop
    const headRotTrack = new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headQuat);

    const antQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, antQuat);
    pushQuatKeyframe(0.20, 0, 0.10, antQuat);
    pushQuatKeyframe(0.45, 0, 0.22, antQuat);
    pushQuatKeyframe(0.55, 0, 0.25, antQuat); // limp droop
    const antRotTrack = new THREE.QuaternionKeyframeTrack('Antenna.quaternion', times, antQuat);

    const armLQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(-0.10, 0, -0.05, armLQuat);
    pushQuatKeyframe(-0.20, 0, -0.10, armLQuat);
    pushQuatKeyframe(-0.24, 0, -0.12, armLQuat);
    const armLTrack = new THREE.QuaternionKeyframeTrack('UpperArmLeft.quaternion', times, armLQuat);

    const armRQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(-0.10, 0, 0.05, armRQuat);
    pushQuatKeyframe(-0.20, 0, 0.10, armRQuat);
    pushQuatKeyframe(-0.24, 0, 0.12, armRQuat);
    const armRTrack = new THREE.QuaternionKeyframeTrack('UpperArmRight.quaternion', times, armRQuat);

    const eyeScaleVals = [
      1, 1, 1,
      0.8, 0.4, 1,
      0.4, 0.08, 1,
      0.2, 0.02, 1, // sleep slit
    ];
    const eyeLScaleTrack = new THREE.VectorKeyframeTrack('EyeLeft.scale', times, eyeScaleVals);
    const eyeRScaleTrack = new THREE.VectorKeyframeTrack('EyeRight.scale', times, eyeScaleVals);

    clips.push(new THREE.AnimationClip('power_down', 2.4, [
      torsoPosTrack,
      headRotTrack,
      antRotTrack,
      armLTrack,
      armRTrack,
      eyeLScaleTrack,
      eyeRScaleTrack,
    ]));
  }

  // CLIP 7: HAPPY BOUNCE (1.6s joyful double hop, excited arm pumps, claw snaps)
  {
    const times = [0, 0.25, 0.50, 0.80, 1.05, 1.35, 1.60];

    const torsoPosVals = [
      0, 0, 0,
      0, -0.06, 0,   // dip
      0, 0.18, 0.04, // high jump!
      0, 0.02, 0,    // land
      0, 0.14, 0.02, // secondary bounce!
      0, -0.02, 0,
      0, 0, 0,
    ];
    const torsoPosTrack = new THREE.VectorKeyframeTrack('Torso.position', times, torsoPosVals);

    const headQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, headQuat);
    pushQuatKeyframe(-0.12, 0, 0, headQuat);
    pushQuatKeyframe(0.18, 0, 0, headQuat);
    pushQuatKeyframe(-0.06, 0, 0, headQuat);
    pushQuatKeyframe(0.12, 0, 0, headQuat);
    pushQuatKeyframe(-0.04, 0, 0, headQuat);
    pushQuatKeyframe(0, 0, 0, headQuat);
    const headRotTrack = new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headQuat);

    const antQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, antQuat);
    pushQuatKeyframe(0.30, 0, 0.20, antQuat);
    pushQuatKeyframe(-0.35, 0, -0.25, antQuat);
    pushQuatKeyframe(0.25, 0, 0.15, antQuat);
    pushQuatKeyframe(-0.25, 0, -0.15, antQuat);
    pushQuatKeyframe(0.10, 0, 0.05, antQuat);
    pushQuatKeyframe(0, 0, 0, antQuat);
    const antRotTrack = new THREE.QuaternionKeyframeTrack('Antenna.quaternion', times, antQuat);

    // Arms pump happily up and down
    const armLQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armLQuat);
    pushQuatKeyframe(-0.20, 0, -0.10, armLQuat);
    pushQuatKeyframe(0.35, 0, 0.20, armLQuat);
    pushQuatKeyframe(-0.15, 0, -0.08, armLQuat);
    pushQuatKeyframe(0.30, 0, 0.15, armLQuat);
    pushQuatKeyframe(-0.10, 0, -0.05, armLQuat);
    pushQuatKeyframe(0, 0, 0, armLQuat);
    const armLTrack = new THREE.QuaternionKeyframeTrack('UpperArmLeft.quaternion', times, armLQuat);

    const armRQuat: number[] = [];
    pushQuatKeyframe(0, 0, 0, armRQuat);
    pushQuatKeyframe(-0.20, 0, 0.10, armRQuat);
    pushQuatKeyframe(0.35, 0, -0.20, armRQuat);
    pushQuatKeyframe(-0.15, 0, 0.08, armRQuat);
    pushQuatKeyframe(0.30, 0, -0.15, armRQuat);
    pushQuatKeyframe(-0.10, 0, 0.05, armRQuat);
    pushQuatKeyframe(0, 0, 0, armRQuat);
    const armRTrack = new THREE.QuaternionKeyframeTrack('UpperArmRight.quaternion', times, armRQuat);

    // Claws snap joyfully
    const clawTimes = [0, 0.25, 0.50, 0.80, 1.05, 1.35, 1.60];
    const clawALVals: number[] = [];
    pushQuatKeyframe(0, 0, 0, clawALVals);
    pushQuatKeyframe(0, 0, 0.28, clawALVals);
    pushQuatKeyframe(0, 0, -0.12, clawALVals);
    pushQuatKeyframe(0, 0, 0.25, clawALVals);
    pushQuatKeyframe(0, 0, -0.10, clawALVals);
    pushQuatKeyframe(0, 0, 0.10, clawALVals);
    pushQuatKeyframe(0, 0, 0, clawALVals);
    const clawALTrack = new THREE.QuaternionKeyframeTrack('ClawALeft.quaternion', clawTimes, clawALVals);

    clips.push(new THREE.AnimationClip('happy_bounce', 1.60, [
      torsoPosTrack,
      headRotTrack,
      antRotTrack,
      armLTrack,
      armRTrack,
      clawALTrack,
    ]));
  }

  // Attach animations to root
  root.animations = clips;

  // Setup AnimationMixer and Actions
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, THREE.AnimationAction>();
  clips.forEach((clip) => {
    const action = mixer.clipAction(clip);
    actions.set(clip.name, action);
  });

  // Scale entire model
  if (scale !== 1) {
    root.scale.setScalar(scale);
  }

  // ---------------------------------------------------------------------------
  // RUNTIME CONTROLLER BINDINGS (Exposed on root.userData for live posing & UI)
  // ---------------------------------------------------------------------------
  const boneNodes: Record<string, THREE.Bone> = {
    root: rootBone,
    torso: torsoBone,
    neck: neckBone,
    head: headBone,
    antenna: antennaBone,
    eyeLeft: eyeLeftBone,
    eyeRight: eyeRightBone,
    shoulderLeft: shoulderLBone,
    upperArmLeft: upperArmLBone,
    elbowLeft: elbowLBone,
    forearmLeft: forearmLBone,
    wristLeft: wristLBone,
    clawALeft: clawALBone,
    clawBLeft: clawBLBone,
    shoulderRight: shoulderRBone,
    upperArmRight: upperArmRBone,
    elbowRight: elbowRBone,
    forearmRight: forearmRBone,
    wristRight: wristRBone,
    clawARight: clawARBone,
    clawBRight: clawBRBone,
  };

  root.userData.skeleton = skeleton;
  root.userData.rootBone = rootBone;
  root.userData.bones = bones;
  root.userData.sculptRuntime = {
    materials,
    animations: {
      mixer,
      actions,
      clips,
    },
    nodes: boneNodes,
    skeleton,
  };

  root.userData.tick = (delta: number) => {
    mixer.update(delta);
  };

  return root;
}

// =============================================================================
// STUDIO LIGHTING SETUP (Cinematic LookDev)
// =============================================================================
export function createRobotCharacterLookDevLights(
  preset: 'studio_warm' | 'soft_daylight' | 'cyberpunk' | 'dramatic_grazing' = 'studio_warm'
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = 'LookDevLights';

  if (preset === 'studio_warm') {
    // Warm Key Light (matches warm beige reference environment)
    const key = new THREE.DirectionalLight(0xfff5e6, 2.6);
    key.position.set(2.8, 3.8, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.bias = -0.0001;
    lights.add(key);

    // Soft Cyan/Sky Fill Light
    const fill = new THREE.DirectionalLight(0xdbeafe, 1.2);
    fill.position.set(-3.2, 1.5, 2.0);
    lights.add(fill);

    // Golden Rim/Hair Light
    const rim = new THREE.DirectionalLight(0xfef08a, 2.2);
    rim.position.set(0.2, 3.0, -3.2);
    lights.add(rim);

    // Soft Ambient Light
    const amb = new THREE.AmbientLight(0xfff7ed, 0.65);
    lights.add(amb);
  } else if (preset === 'soft_daylight') {
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.0, 4.0, 3.0);
    key.castShadow = true;
    lights.add(key);

    const fill = new THREE.DirectionalLight(0xe0f2fe, 1.4);
    fill.position.set(-3.0, 2.0, 2.0);
    lights.add(fill);

    const amb = new THREE.AmbientLight(0xf8fafc, 0.75);
    lights.add(amb);
  } else if (preset === 'cyberpunk') {
    const key = new THREE.DirectionalLight(0x06b6d4, 3.2);
    key.position.set(3.0, 2.5, 2.5);
    lights.add(key);

    const fill = new THREE.DirectionalLight(0xf43f5e, 2.8);
    fill.position.set(-3.0, 2.0, -1.0);
    lights.add(fill);

    const amb = new THREE.AmbientLight(0x1e1b4b, 0.4);
    lights.add(amb);
  } else {
    // dramatic grazing
    const key = new THREE.DirectionalLight(0xffedd5, 3.5);
    key.position.set(4.0, 1.2, 1.5);
    key.castShadow = true;
    lights.add(key);

    const rim = new THREE.DirectionalLight(0x67e8f9, 2.0);
    rim.position.set(-3.5, 2.5, -2.5);
    lights.add(rim);

    const amb = new THREE.AmbientLight(0x18181b, 0.35);
    lights.add(amb);
  }

  return lights;
}

// =============================================================================
// METRICS INSPECTOR
// =============================================================================
export function inspectModelMetrics(root: THREE.Object3D): ModelMetrics {
  let triangles = 0;
  let vertices = 0;
  let meshes = 0;
  const materials = new Set<THREE.Material>();
  const bones = new Set<THREE.Object3D>();

  root.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.isMesh) {
      meshes++;
      const g = m.geometry;
      if (g) {
        if (g.index) {
          triangles += g.index.count / 3;
        } else if (g.attributes.position) {
          triangles += g.attributes.position.count / 3;
        }
        if (g.attributes.position) {
          vertices += g.attributes.position.count;
        }
      }
      if (Array.isArray(m.material)) {
        m.material.forEach((mat) => materials.add(mat));
      } else if (m.material) {
        materials.add(m.material);
      }
    }
    if (child.type === 'Bone' || (child as THREE.Bone).isBone) {
      bones.add(child);
    }
  });

  return {
    triangles: Math.round(triangles),
    vertices,
    meshes,
    bones: bones.size,
    materials: materials.size,
    drawCalls: meshes,
  };
}

// =============================================================================
// EXPORT GLB WITH REAL SKELTON RIG & VERTEX WEIGHTS (glTF skins)
// =============================================================================
export function exportRiggedModelToGlb(
  rootGroup: THREE.Group,
  filename = 'cute_3d_robot_character_rigged.glb'
): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const clips = rootGroup.animations || [];

  // Clean root userData during export to avoid circular serialization warnings
  const originalUserData = rootGroup.userData;
  const exportUserData: Record<string, unknown> = {
    character: 'Cute Stylized 3D Robot',
    rigType: 'True_Skeleton_21_Bones',
    meshType: 'THREE.SkinnedMesh',
    weights: 'Normalized_Vertex_Weights',
    animations: clips.map((c) => c.name),
  };
  rootGroup.userData = exportUserData;

  return new Promise((resolve, reject) => {
    exporter.parse(
      rootGroup,
      (gltf) => {
        rootGroup.userData = originalUserData;
        const buffer = gltf as ArrayBuffer;
        if (typeof document !== 'undefined') {
          const blob = new Blob([buffer], { type: 'model/gltf-binary' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          link.click();
          URL.revokeObjectURL(link.href);
        }
        resolve(buffer);
      },
      (err) => {
        rootGroup.userData = originalUserData;
        reject(err);
      },
      {
        binary: true,
        animations: clips,
      }
    );
  });
}
