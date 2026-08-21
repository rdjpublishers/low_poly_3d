/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * img2threejs Specification & Procedural 3D Supercar Generator
 * Model: "Apex Horizon - Low-Poly Concept Supercar"
 * Architecture: img2threejs 
 * Features: Faceted styling, 5-star chrome wheels, kinematics, 
 *           AND an internal self-contained animation loop!
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
  version: '2.1.0',
  animations: ['drive', 'idle_rev', 'drift', 'parked']
};

/* =========================================================================
 * 2. PROCEDURAL GEOMETRY GENERATORS
 * ========================================================================= */

/**
 * Creates a blocky, low-poly kitbash piece by scaling the top vertices.
 * This perfectly recreates the angular, faceted look of the reference car.
 */
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

/**
 * Builds the distinctive 5-star geometric spoke rim with deep dish lip
 */
export function buildLowPolyWheel(
  radius: number, 
  width: number, 
  materials: SupercarMaterials,
  isRight: boolean
): THREE.Group {
  const wheelGroup = new THREE.Group();
  
  // 1. Tire (Dark rubber cylinder)
  const tireGeom = new THREE.CylinderGeometry(radius, radius, width, 16);
  tireGeom.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeom, materials.tireRubber);
  tire.castShadow = true;
  wheelGroup.add(tire);

  // 2. Chrome Lip
  const rimRadius = radius * 0.82;
  const lipGeom = new THREE.TorusGeometry(rimRadius, 0.035, 4, 16);
  lipGeom.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeom, materials.chromeRim);
  
  // 3. Inner Dark Barrel
  const barrelGeom = new THREE.CylinderGeometry(rimRadius * 0.95, rimRadius * 0.95, width * 0.9, 16);
  barrelGeom.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, materials.trimDark);
  wheelGroup.add(barrel);

  // 4. 5-Star Faceted Spoke Assembly
  const spokeGroup = new THREE.Group();
  const spokeGeom = new THREE.BoxGeometry(0.06, rimRadius * 0.95, 0.05);
  // Shift pivot to bottom center
  spokeGeom.translate(0, rimRadius * 0.475, 0);
  
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeom, materials.chromeRim);
    spoke.rotation.x = (Math.PI * 2 / 5) * i;
    spoke.castShadow = true;
    spokeGroup.add(spoke);
  }

  // Center Hub
  const hubGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8);
  hubGeom.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeom, materials.chromeRim);
  spokeGroup.add(hub);

  // Offset the rim components to the outside face of the tire
  const dir = isRight ? 1 : -1;
  lip.position.x = (width / 2) * dir;
  spokeGroup.position.x = (width / 2 - 0.01) * dir;
  
  wheelGroup.add(lip);
  wheelGroup.add(spokeGroup);

  return wheelGroup;
}

/**
 * Procedurally sculpts the primary faceted Supercar Body
 * Perfectly matches the low-poly aesthetic of the reference image.
 */
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
  // Highly angular trapezoidal block for the windshield and side windows
  addPart(1.1, 0.4, 1.8, materials.glassTint, 0.7, 0.4, 0, -0.2, 0, 0.5, 0.0);

  // 4. Roof Panel (Orange)
  addPart(0.85, 0.05, 0.9, materials.bodyPrimary, 0.95, 0.8, 0, 0, 0, 0.725, -0.15);

  // 5. Front Nose Wedge (Orange)
  // Slopes down dramatically to the front
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
  // Pylons (Orange)
  addPart(0.08, 0.25, 0.3, materials.bodyPrimary, 0.6, 0.8, 0, -0.1, -0.8, 0.65, -1.8);
  addPart(0.08, 0.25, 0.3, materials.bodyPrimary, 0.6, 0.8, 0, -0.1, 0.8, 0.65, -1.8);
  // Main Wing Board (Dark Trim)
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

  // 17. Glowing Headlights (Embedded Warm LED Blocks)
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
 * 4. MAIN FACTORY FUNCTION
 * ========================================================================= */

export function createSupercar(options: SupercarOptions = {}): SupercarInstance {
  const opt = {
    bodyColor: options.bodyColor ?? '#EB7E4E',
    trimColor: options.trimColor ?? '#323642',
    glowHeadlights: options.glowHeadlights ?? true
  };

  const carRoot = new THREE.Group() as SupercarInstance;
  carRoot.name = 'Supercar_ApexHorizon';

  // MATERIALS SETUP (Flat Shaded for crisp low-poly reflections)
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
      emissive: '#FFDD44', // Warm yellowish glow from image
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

  // SKELETON & HIERARCHY
  const chassis = new THREE.Group();
  chassis.position.y = 0.38; 
  carRoot.add(chassis);

  const body = buildSupercarBody(materials);
  chassis.add(body);

  // Wheels & Steering Pivots
  const wheelPivotFL = new THREE.Group();
  wheelPivotFL.position.set(-0.9, 0.0, 1.4);
  chassis.add(wheelPivotFL);
  const wheelFL = buildLowPolyWheel(0.36, 0.26, materials, false);
  wheelPivotFL.add(wheelFL);

  const wheelPivotFR = new THREE.Group();
  wheelPivotFR.position.set(0.9, 0.0, 1.4);
  chassis.add(wheelPivotFR);
  const wheelFR = buildLowPolyWheel(0.36, 0.26, materials, true);
  wheelPivotFR.add(wheelFR);

  const wheelRL = buildLowPolyWheel(0.40, 0.30, materials, false);
  wheelRL.position.set(-0.95, 0.02, -1.35);
  chassis.add(wheelRL);

  const wheelRR = buildLowPolyWheel(0.40, 0.30, materials, true);
  wheelRR.position.set(0.95, 0.02, -1.35);
  chassis.add(wheelRR);

  // KINEMATICS & ANIMATION LOGIC
  let currentAnim = 'drive';
  const wheelRotSpeed = 8.0;

  function tick(dt: number, time: number) {
    const clampedDt = Math.min(dt, 0.1);

    switch (currentAnim) {
      case 'drive': {
        const spin = clampedDt * wheelRotSpeed * 2.5;
        // Move wheels (+X rotation rolls forward)
        wheelFL.rotation.x += spin;
        wheelFR.rotation.x += spin;
        wheelRL.rotation.x += spin;
        wheelRR.rotation.x += spin;

        // Suspension road bounce
        const roadBounce = Math.sin(time * 12.0) * 0.005;
        chassis.position.y = 0.38 + roadBounce;

        // Auto slalom steering
        const autoSteer = Math.sin(time * 1.5) * 0.2;
        wheelPivotFL.rotation.y = autoSteer;
        wheelPivotFR.rotation.y = autoSteer;
        
        chassis.rotation.z = Math.sin(time * 1.5) * 0.01;
        chassis.rotation.x = Math.sin(time * 2.5) * 0.005;
        break;
      }
      case 'idle_rev': {
        const revPulse = Math.sin(time * 35.0) * 0.004;
        chassis.position.y = 0.38 + revPulse;
        chassis.rotation.x = Math.sin(time * 15.0) * 0.006;
        materials.lightRed.emissiveIntensity = 1.0 + Math.sin(time * 8.0) * 0.5;
        wheelPivotFL.rotation.y = 0;
        wheelPivotFR.rotation.y = 0;
        break;
      }
      case 'drift': {
        const fastSpin = clampedDt * wheelRotSpeed * 4.5;
        wheelFL.rotation.x += fastSpin;
        wheelFR.rotation.x += fastSpin;
        wheelRL.rotation.x += fastSpin * 1.3;
        wheelRR.rotation.x += fastSpin * 1.3;

        wheelPivotFL.rotation.y = -0.45;
        wheelPivotFR.rotation.y = -0.45;

        chassis.rotation.z = -0.06;
        chassis.rotation.y = 0.25;
        chassis.position.y = 0.36 + Math.sin(time * 18.0) * 0.006;
        break;
      }
      case 'parked': {
        chassis.position.y = 0.38;
        chassis.rotation.set(0, 0, 0);
        wheelPivotFL.rotation.y = 0;
        wheelPivotFR.rotation.y = 0;
        break;
      }
    }
  }

  // SELF-CONTAINED INTERNAL ANIMATION LOOP
  let isPlaying = false;
  let internalAnimId: number | null = null;
  const clock = new THREE.Clock();

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
  }

  // PUBLIC APIs
  function setAnimation(animName: string) {
    if (SUPERCAR_SPEC.animations.includes(animName)) {
      currentAnim = animName;
    }
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
