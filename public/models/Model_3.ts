import * as THREE from 'three';

export type ColorThemeId = 'hazard-orange' | 'stealth-black' | 'arctic-white' | 'military-olive' | 'cyber-chrome';
export type AnimationName = 'idle' | 'walk' | 'run' | 'shoot' | 'stomp' | 'alert' | 'deploy' | 'death';

export interface ColorScheme {
  id: ColorThemeId;
  name: string;
  primaryOrange: string;
  primaryDark: string;
  secondaryGunmetal: string;
  metallicDark: string;
  accentBolt: string;
  opticGlow: string;
  description: string;
}

export interface LegRig {
  index: number;
  name: string;
  side: 'front-left' | 'front-right' | 'rear-left' | 'rear-right';
  hipPivot: THREE.Group;
  thighPivot: THREE.Group;
  kneePivot: THREE.Group;
  anklePivot: THREE.Group;
  footClaw: THREE.Mesh;
  bladeSpur: THREE.Mesh;
  pistonRod: THREE.Mesh;
  baseAngle: number;
}

export interface SpiderSentryOptions {
  colorScheme?: ColorThemeId;
  wearLevel?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface DetailInventoryItem {
  name: string;
  feature: string;
  category: string;
  pass: string;
  description: string;
  location: string;
  meshName: string;
  nodes: string[];
}

export interface SpiderSentryRuntime {
  root: THREE.Group;
  nodes: {
    baseChassis: THREE.Group;
    waistSwivel: THREE.Group;
    torsoBall: THREE.Group;
    visorEye: THREE.Mesh;
    visorGlowLight: THREE.PointLight;
    exhaustPipes: THREE.Group;
    gunMount: THREE.Group;
    gunPitchPivot: THREE.Group;
    gunReceiver: THREE.Group;
    gunRotor: THREE.Group;
    barrels: THREE.Group[];
    muzzleSocket: THREE.Object3D;
    carryHandle: THREE.Mesh;
    sideMountLeft: THREE.Mesh;
    sideMountRight: THREE.Mesh;
    legs: LegRig[];
    sockets: {
      muzzle: THREE.Object3D;
      eye: THREE.Mesh;
      centerMount: THREE.Group;
      feetPivots: THREE.Group[];
    };
    colliders: THREE.Box3[];
  };
  materials: {
    primaryPaint: THREE.MeshStandardMaterial;
    gunmetal: THREE.MeshStandardMaterial;
    darkSteel: THREE.MeshStandardMaterial;
    polishedSteel: THREE.MeshStandardMaterial;
    opticGlow: THREE.MeshStandardMaterial;
    exhaustDark: THREE.MeshStandardMaterial;
  };
  animations: {
    clips: THREE.AnimationClip[];
    mixer: THREE.AnimationMixer;
    actions: Map<string, THREE.AnimationAction>;
  };
  state: {
    currentAnimation: AnimationName;
    isFiring: boolean;
    gunSpinSpeed: number;
    gunElevation: number;
    torsoYaw: number;
    aimTarget: THREE.Vector3 | null;
    wearLevel: number;
    colorScheme: ColorThemeId;
    walkTime: number;
  };
  passes: {
    blockout: { name: string; completed: boolean; score: number };
    structural: { name: string; completed: boolean; score: number };
    form: { name: string; completed: boolean; score: number };
    material: { name: string; completed: boolean; score: number };
    surface: { name: string; completed: boolean; score: number };
    lighting: { name: string; completed: boolean; score: number };
    interaction: { name: string; completed: boolean; score: number };
    optimization: { name: string; completed: boolean; score: number };
  };
  passesComplete: boolean;
  passesReviewed: Record<string, number>;
  detailInventory: DetailInventoryItem[];
  playAnimation(name: AnimationName, crossFadeDuration?: number): void;
  stopAnimations(): void;
  setFiring(firing: boolean): void;
  setJointAngles(angles: any): void;
  aimAt(worldTarget: THREE.Vector3, damping?: number): void;
  setColorScheme(themeId: ColorThemeId): void;
  setWearLevel(level: number): void;
  setWireframe(wireframe: boolean): void;
  getMuzzleWorldPosition(targetVec?: THREE.Vector3): THREE.Vector3;
  update(deltaTime: number): void;
  tick(deltaTime?: number): void;
  dispose(): void;
}

export const COLOR_THEMES: Record<ColorThemeId, ColorScheme> = {
  'hazard-orange': {
    id: 'hazard-orange',
    name: 'Industrial Hazard (Original)',
    primaryOrange: '#e66012',
    primaryDark: '#993d07',
    secondaryGunmetal: '#282b30',
    metallicDark: '#18191c',
    accentBolt: '#555b66',
    opticGlow: '#00f5ff',
    description: 'Original weathered heavy industry orange with cast iron armature',
  },
  'stealth-black': {
    id: 'stealth-black',
    name: 'Stealth Operative',
    primaryOrange: '#222326',
    primaryDark: '#111214',
    secondaryGunmetal: '#1c1e22',
    metallicDark: '#0e0f11',
    accentBolt: '#444850',
    opticGlow: '#ff2a2a',
    description: 'Matte black anti-reflective radar absorbent coating with crimson visor',
  },
  'arctic-white': {
    id: 'arctic-white',
    name: 'Arctic Patrol',
    primaryOrange: '#e2e6eb',
    primaryDark: '#9aa0a6',
    secondaryGunmetal: '#383d45',
    metallicDark: '#202328',
    accentBolt: '#788290',
    opticGlow: '#00aaff',
    description: 'High-visibility tundra camouflage with cobalt optical array',
  },
  'military-olive': {
    id: 'military-olive',
    name: 'Tactical OD Green',
    primaryOrange: '#4b5320',
    primaryDark: '#2e3314',
    secondaryGunmetal: '#26292b',
    metallicDark: '#17191a',
    accentBolt: '#5c634d',
    opticGlow: '#ffcc00',
    description: 'Field-tested military olive drab with amber targeting diode',
  },
  'cyber-chrome': {
    id: 'cyber-chrome',
    name: 'Titanium Prototype',
    primaryOrange: '#8e9eab',
    primaryDark: '#485563',
    secondaryGunmetal: '#1e2229',
    metallicDark: '#101216',
    accentBolt: '#a0a8b4',
    opticGlow: '#00ff66',
    description: 'Polished prototype alloy with emerald active telemetry',
  },
};

function createProceduralNoiseCanvas(width = 512, height = 512, type: 'wear' | 'metal' = 'wear'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = type === 'wear' ? '#808080' : '#a0a0a0';
  ctx.fillRect(0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    const scratches = Math.random() > 0.985 ? (Math.random() - 0.5) * 120 : 0;
    const val = Math.min(255, Math.max(0, data[i] + noise + scratches));
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function createBeveledCylinder(radiusTop: number, radiusBottom: number, height: number, radialSegments = 24): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
}

function createKneeBladeSpurGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.12, 0.4);
  shape.quadraticCurveTo(0.2, 0.7, 0.08, 0.95);
  shape.quadraticCurveTo(-0.05, 0.65, -0.08, 0.4);
  shape.lineTo(-0.08, 0.05);
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  return geom;
}

function createTalonFootGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.08, 0.15);
  shape.lineTo(0.08, 0.15);
  shape.quadraticCurveTo(0.09, -0.1, 0.02, -0.35);
  shape.lineTo(0, -0.45);
  shape.quadraticCurveTo(-0.1, -0.15, -0.08, 0.15);
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  return geom;
}

export function createSpiderSentryMechModel(options: SpiderSentryOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'SpiderSentry_Root';

  const theme = COLOR_THEMES[options.colorScheme || 'hazard-orange'];
  const wear = options.wearLevel ?? 0.45;
  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? true;

  const noiseCanvas = createProceduralNoiseCanvas(256, 256, 'wear');
  const noiseTexture = new THREE.CanvasTexture(noiseCanvas);
  noiseTexture.wrapS = THREE.RepeatWrapping;
  noiseTexture.wrapT = THREE.RepeatWrapping;
  noiseTexture.repeat.set(2, 2);

  const primaryPaint = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.primaryOrange),
    roughness: 0.38 + wear * 0.25,
    metalness: 0.22,
    roughnessMap: noiseTexture,
    bumpMap: noiseTexture,
    bumpScale: 0.008 + wear * 0.02,
    name: 'Material_PrimaryOrangeArmor',
  });

  const gunmetal = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.secondaryGunmetal),
    roughness: 0.32 + wear * 0.2,
    metalness: 0.82,
    roughnessMap: noiseTexture,
    name: 'Material_LegArmatureGunmetal',
  });

  const darkSteel = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.metallicDark),
    roughness: 0.45,
    metalness: 0.9,
    name: 'Material_DarkSteel',
  });

  const polishedSteel = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9aa0a6'),
    roughness: 0.18,
    metalness: 0.95,
    name: 'Material_PolishedSteelShaft',
  });

  const opticGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.opticGlow),
    emissive: new THREE.Color(theme.opticGlow),
    emissiveIntensity: 3.5,
    roughness: 0.1,
    metalness: 0.1,
    name: 'Material_OpticSensorGlow',
  });

  const exhaustDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#141416'),
    roughness: 0.7,
    metalness: 0.6,
    name: 'Material_ExhaustPipes',
  });

  const visorLens = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0a0c0e'),
    roughness: 0.1,
    metalness: 0.8,
    name: 'Material_VisorLens',
  });

  const boltMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.accentBolt),
    roughness: 0.25,
    metalness: 0.88,
    name: 'Material_HexBolts',
  });

  const helperApplyShadow = (mesh: THREE.Mesh | THREE.Object3D) => {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = castShadow;
        child.receiveShadow = receiveShadow;
      }
    });
  };

  const boltGeom = new THREE.CylinderGeometry(0.032, 0.032, 0.02, 6);
  const cylinderJointGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.18, 20);

  // A. BASE CHASSIS & HUB
  const baseChassis = new THREE.Group();
  baseChassis.name = 'Node_BaseChassis';
  baseChassis.position.set(0, 1.25, 0);
  root.add(baseChassis);

  const chassisRingOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.78, 0.32, 28),
    primaryPaint
  );
  baseChassis.add(chassisRingOuter);

  const chassisTopPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.68, 0.1, 28),
    gunmetal
  );
  chassisTopPlate.position.y = 0.18;
  baseChassis.add(chassisTopPlate);

  const chassisBottomPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.54, 0.12, 28),
    darkSteel
  );
  chassisBottomPlate.position.y = -0.18;
  baseChassis.add(chassisBottomPlate);

  const turntableBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.045, 12, 32),
    polishedSteel
  );
  turntableBearing.rotation.x = Math.PI / 2;
  turntableBearing.position.y = 0.24;
  baseChassis.add(turntableBearing);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.28, 0.18),
      primaryPaint
    );
    panel.position.set(Math.cos(angle) * 0.74, 0, Math.sin(angle) * 0.74);
    panel.rotation.y = -angle + Math.PI / 2;
    baseChassis.add(panel);

    const pBolt = new THREE.Mesh(boltGeom, boltMaterial);
    pBolt.rotation.x = Math.PI / 2;
    pBolt.position.set(0, 0, 0.095);
    panel.add(pBolt);
  }

  // B. FOUR ARTICULATED LEGS
  const legConfigs: Array<{
    name: string;
    side: 'front-left' | 'front-right' | 'rear-left' | 'rear-right';
    baseAngle: number;
  }> = [
    { name: 'Leg_FrontLeft', side: 'front-left', baseAngle: Math.PI * 0.25 },
    { name: 'Leg_FrontRight', side: 'front-right', baseAngle: -Math.PI * 0.25 },
    { name: 'Leg_RearLeft', side: 'rear-left', baseAngle: Math.PI * 0.75 },
    { name: 'Leg_RearRight', side: 'rear-right', baseAngle: -Math.PI * 0.75 },
  ];

  const legs: LegRig[] = [];
  const kneeBladeGeom = createKneeBladeSpurGeometry();
  const talonFootGeom = createTalonFootGeometry();

  legConfigs.forEach((cfg, idx) => {
    const hipSocketMount = new THREE.Group();
    hipSocketMount.name = `SocketMount_${cfg.name}`;
    const mountRadius = 0.68;
    hipSocketMount.position.set(
      Math.cos(cfg.baseAngle) * mountRadius,
      -0.06,
      Math.sin(cfg.baseAngle) * mountRadius
    );
    hipSocketMount.rotation.y = -cfg.baseAngle + Math.PI / 2;
    baseChassis.add(hipSocketMount);

    const bracketMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.26, 0.26),
      gunmetal
    );
    hipSocketMount.add(bracketMesh);

    const hingeCap = new THREE.Mesh(cylinderJointGeom, darkSteel);
    hingeCap.rotation.z = Math.PI / 2;
    hipSocketMount.add(hingeCap);

    const hipPivot = new THREE.Group();
    hipPivot.name = `HipPivot_${cfg.name}`;
    hipSocketMount.add(hipPivot);

    const thighPivot = new THREE.Group();
    thighPivot.name = `ThighPivot_${cfg.name}`;
    hipPivot.add(thighPivot);

    const thighLength = 1.15;
    const thighArmature = new THREE.Group();
    thighPivot.add(thighArmature);

    const thighBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.18, thighLength),
      gunmetal
    );
    thighBar.position.set(0, 0, thighLength * 0.5);
    thighArmature.add(thighBar);

    const thighFlangeTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.04, thighLength * 0.95),
      darkSteel
    );
    thighFlangeTop.position.set(0, 0.1, thighLength * 0.5);
    thighArmature.add(thighFlangeTop);

    const thighSideRibL = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.12, thighLength * 0.7),
      primaryPaint
    );
    thighSideRibL.position.set(0.08, 0, thighLength * 0.5);
    thighArmature.add(thighSideRibL);

    const thighSideRibR = thighSideRibL.clone();
    thighSideRibR.position.x = -0.08;
    thighArmature.add(thighSideRibR);

    const pistonCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, thighLength * 0.65, 12),
      gunmetal
    );
    pistonCylinder.rotation.x = Math.PI / 2;
    pistonCylinder.position.set(0, -0.09, thighLength * 0.4);
    thighArmature.add(pistonCylinder);

    const pistonRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, thighLength * 0.5, 12),
      polishedSteel
    );
    pistonRod.rotation.x = Math.PI / 2;
    pistonRod.position.set(0, -0.09, thighLength * 0.68);
    thighArmature.add(pistonRod);

    const kneeJointDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.22, 20),
      darkSteel
    );
    kneeJointDisc.rotation.z = Math.PI / 2;
    kneeJointDisc.position.set(0, 0, thighLength);
    thighArmature.add(kneeJointDisc);

    const kneePivot = new THREE.Group();
    kneePivot.name = `KneePivot_${cfg.name}`;
    kneePivot.position.set(0, 0, thighLength);
    thighPivot.add(kneePivot);

    const shinLength = 1.35;
    const shinArmature = new THREE.Group();
    kneePivot.add(shinArmature);

    const bladeSpur = new THREE.Mesh(kneeBladeGeom, primaryPaint);
    bladeSpur.name = `BladeSpur_${cfg.name}`;
    bladeSpur.position.set(0, 0.42, -0.05);
    bladeSpur.rotation.y = Math.PI / 2;
    bladeSpur.rotation.z = 0.25;
    bladeSpur.scale.set(1.4, 1.4, 1.4);
    shinArmature.add(bladeSpur);

    const shinMainBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.22, shinLength),
      gunmetal
    );
    shinMainBar.position.set(0, 0, shinLength * 0.5);
    shinArmature.add(shinMainBar);

    const shinPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.06, shinLength * 0.8),
      darkSteel
    );
    shinPlate.position.set(0, 0.12, shinLength * 0.48);
    shinArmature.add(shinPlate);

    const shinGroove = new THREE.Mesh(
      new THREE.BoxGeometry(0.165, 0.08, shinLength * 0.5),
      polishedSteel
    );
    shinGroove.position.set(0, 0.02, shinLength * 0.45);
    shinArmature.add(shinGroove);

    const ankleJointDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.18, 16),
      darkSteel
    );
    ankleJointDisc.rotation.z = Math.PI / 2;
    ankleJointDisc.position.set(0, 0, shinLength);
    shinArmature.add(ankleJointDisc);

    const anklePivot = new THREE.Group();
    anklePivot.name = `AnklePivot_${cfg.name}`;
    anklePivot.position.set(0, 0, shinLength);
    kneePivot.add(anklePivot);

    const footClaw = new THREE.Mesh(talonFootGeom, darkSteel);
    footClaw.name = `FootClaw_${cfg.name}`;
    footClaw.position.set(0, -0.18, 0.05);
    footClaw.rotation.y = Math.PI / 2;
    footClaw.scale.set(1.3, 1.3, 1.3);
    anklePivot.add(footClaw);

    const heelSpur = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.2, 8),
      gunmetal
    );
    heelSpur.rotation.x = -Math.PI * 0.7;
    heelSpur.position.set(0, -0.05, -0.12);
    anklePivot.add(heelSpur);

    const footTipSocket = new THREE.Object3D();
    footTipSocket.name = `FootTipSocket_${cfg.name}`;
    footTipSocket.position.set(0, -0.48, 0.05);
    anklePivot.add(footTipSocket);

    thighPivot.rotation.x = -0.65;
    kneePivot.rotation.x = 1.45;
    anklePivot.rotation.x = -0.8;

    legs.push({
      index: idx,
      name: cfg.name,
      side: cfg.side,
      hipPivot,
      thighPivot,
      kneePivot,
      anklePivot,
      footClaw,
      bladeSpur,
      pistonRod,
      baseAngle: cfg.baseAngle,
    });
  });

  // C. WAIST SWIVEL & SPHERICAL TORSO TURRET
  const waistSwivel = new THREE.Group();
  waistSwivel.name = 'Node_WaistSwivel';
  waistSwivel.position.set(0, 0.28, 0);
  baseChassis.add(waistSwivel);

  const swivelNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 0.35, 24),
    darkSteel
  );
  swivelNeck.position.y = 0.12;
  waistSwivel.add(swivelNeck);

  const torsoBall = new THREE.Group();
  torsoBall.name = 'Node_TorsoBall';
  torsoBall.position.set(0, 0.48, 0);
  waistSwivel.add(torsoBall);

  const torsoMainSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 32, 24),
    primaryPaint
  );
  torsoBall.add(torsoMainSphere);

  const equatorBelt = new THREE.Mesh(
    new THREE.TorusGeometry(0.565, 0.035, 12, 36),
    darkSteel
  );
  equatorBelt.rotation.x = Math.PI / 2;
  torsoBall.add(equatorBelt);

  const visorMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.36, 0.22, 16, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
    visorLens
  );
  visorMesh.position.set(0, 0.05, 0.32);
  visorMesh.rotation.y = 0;
  torsoBall.add(visorMesh);

  const visorEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 16, 16),
    opticGlow
  );
  visorEye.name = 'Node_VisorEye';
  visorEye.position.set(0.12, 0.05, 0.52);
  torsoBall.add(visorEye);

  const auxSensor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12),
    darkSteel
  );
  auxSensor.rotation.x = Math.PI / 2;
  auxSensor.position.set(-0.16, 0.08, 0.5);
  torsoBall.add(auxSensor);

  const visorGlowLight = new THREE.PointLight(theme.opticGlow, 1.2, 4.5);
  visorGlowLight.position.set(0.12, 0.05, 0.65);
  torsoBall.add(visorGlowLight);

  const sideBossGeom = new THREE.CylinderGeometry(0.22, 0.25, 0.16, 20);

  const sideMountRight = new THREE.Mesh(sideBossGeom, darkSteel);
  sideMountRight.name = 'Node_SideMountRight';
  sideMountRight.rotation.z = Math.PI / 2;
  sideMountRight.position.set(0.52, 0.02, 0);
  torsoBall.add(sideMountRight);

  const sideCapRight = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16), gunmetal);
  sideCapRight.rotation.z = Math.PI / 2;
  sideCapRight.position.set(0.61, 0.02, 0);
  torsoBall.add(sideCapRight);

  const sideMountLeft = new THREE.Mesh(sideBossGeom, darkSteel);
  sideMountLeft.name = 'Node_SideMountLeft';
  sideMountLeft.rotation.z = -Math.PI / 2;
  sideMountLeft.position.set(-0.52, 0.02, 0);
  torsoBall.add(sideMountLeft);

  const sideCapLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16), gunmetal);
  sideCapLeft.rotation.z = -Math.PI / 2;
  sideCapLeft.position.set(-0.61, 0.02, 0);
  torsoBall.add(sideCapLeft);

  const exhaustPipes = new THREE.Group();
  exhaustPipes.name = 'Node_ExhaustPipes';
  exhaustPipes.position.set(0.28, 0.15, -0.38);
  torsoBall.add(exhaustPipes);

  for (let p = 0; p < 4; p++) {
    const pipe = new THREE.Group();
    const pipeAngle = -0.35 + p * 0.18;
    const pipeLength = 0.42 + p * 0.04;
    pipe.position.set((p - 1.5) * 0.11, p * 0.04, -(p * 0.06));
    pipe.rotation.x = -0.75;
    pipe.rotation.y = pipeAngle;

    const pipeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.048, pipeLength, 12, 1, true),
      exhaustDark
    );
    pipeMesh.position.y = pipeLength * 0.5;
    pipe.add(pipeMesh);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 8, 16),
      darkSteel
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = pipeLength;
    pipe.add(rim);

    exhaustPipes.add(pipe);
  }

  // D. GATLING CANNON TURRET
  const gunMount = new THREE.Group();
  gunMount.name = 'Node_GunMount';
  gunMount.position.set(0, 0.58, -0.05);
  torsoBall.add(gunMount);

  const gunRiser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.35, 0.22, 20),
    darkSteel
  );
  gunMount.add(gunRiser);

  const gunPitchPivot = new THREE.Group();
  gunPitchPivot.name = 'Node_GunPitchPivot';
  gunPitchPivot.position.set(0, 0.22, 0);
  gunMount.add(gunPitchPivot);

  const gunReceiver = new THREE.Group();
  gunReceiver.name = 'Node_GunReceiver';
  gunPitchPivot.add(gunReceiver);

  const receiverBody = new THREE.Mesh(
    createBeveledCylinder(0.38, 0.42, 0.72, 24),
    primaryPaint
  );
  receiverBody.rotation.x = Math.PI / 2;
  gunReceiver.add(receiverBody);

  const receiverEndcap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.12, 24),
    darkSteel
  );
  receiverEndcap.rotation.x = Math.PI / 2;
  receiverEndcap.position.z = -0.42;
  gunReceiver.add(receiverEndcap);

  const receiverHubCapL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.1, 20),
    gunmetal
  );
  receiverHubCapL.rotation.z = Math.PI / 2;
  receiverHubCapL.position.set(-0.42, 0, 0);
  gunReceiver.add(receiverHubCapL);

  const receiverHubCapR = receiverHubCapL.clone();
  receiverHubCapR.rotation.z = -Math.PI / 2;
  receiverHubCapR.position.set(0.42, 0, 0);
  gunReceiver.add(receiverHubCapR);

  const hubBoltL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 6), boltMaterial);
  hubBoltL.rotation.z = Math.PI / 2;
  hubBoltL.position.set(-0.48, 0, 0);
  gunReceiver.add(hubBoltL);

  const hubBoltR = hubBoltL.clone();
  hubBoltR.rotation.z = -Math.PI / 2;
  hubBoltR.position.set(0.48, 0, 0);
  gunReceiver.add(hubBoltR);

  const carryHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.45),
    darkSteel
  );
  carryHandle.name = 'Node_CarryHandle';
  carryHandle.position.set(0, 0.48, -0.05);
  gunReceiver.add(carryHandle);

  const receiverCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.14, 24),
    darkSteel
  );
  receiverCollar.rotation.x = Math.PI / 2;
  receiverCollar.position.z = 0.38;
  gunReceiver.add(receiverCollar);

  // E. ROTATING GATLING BARREL ASSEMBLY
  const gunRotor = new THREE.Group();
  gunRotor.name = 'Node_GunRotor';
  gunRotor.position.set(0, 0, 0.45);
  gunPitchPivot.add(gunRotor);

  const barrelLength = 1.45;
  const barrelRadius = 0.042;
  const rotorRadius = 0.22;
  const barrelCount = 8;
  const barrels: THREE.Group[] = [];

  const centerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, barrelLength + 0.1, 16),
    polishedSteel
  );
  centerShaft.rotation.x = Math.PI / 2;
  centerShaft.position.z = barrelLength * 0.5;
  gunRotor.add(centerShaft);

  const rearClampDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.09, 24),
    gunmetal
  );
  rearClampDisc.rotation.x = Math.PI / 2;
  rearClampDisc.position.z = 0.08;
  gunRotor.add(rearClampDisc);

  const midClampDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.08, 24),
    gunmetal
  );
  midClampDisc.rotation.x = Math.PI / 2;
  midClampDisc.position.z = barrelLength * 0.55;
  gunRotor.add(midClampDisc);

  const frontMuzzleRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.1, 24),
    darkSteel
  );
  frontMuzzleRing.rotation.x = Math.PI / 2;
  frontMuzzleRing.position.z = barrelLength;
  gunRotor.add(frontMuzzleRing);

  for (let b = 0; b < barrelCount; b++) {
    const angle = (b / barrelCount) * Math.PI * 2;
    const barrelGroup = new THREE.Group();
    barrelGroup.name = `Barrel_${b + 1}`;
    barrelGroup.position.set(Math.cos(angle) * rotorRadius, Math.sin(angle) * rotorRadius, 0);

    const barrelTube = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelRadius, barrelRadius, barrelLength, 14),
      darkSteel
    );
    barrelTube.rotation.x = Math.PI / 2;
    barrelTube.position.z = barrelLength * 0.5;
    barrelGroup.add(barrelTube);

    const muzzleTip = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelRadius * 0.95, barrelRadius * 1.08, 0.08, 14),
      gunmetal
    );
    muzzleTip.rotation.x = Math.PI / 2;
    muzzleTip.position.z = barrelLength + 0.04;
    barrelGroup.add(muzzleTip);

    const innerBore = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelRadius * 0.65, barrelRadius * 0.65, 0.06, 12),
      new THREE.MeshBasicMaterial({ color: '#000000' })
    );
    innerBore.rotation.x = Math.PI / 2;
    innerBore.position.z = barrelLength + 0.06;
    barrelGroup.add(innerBore);

    gunRotor.add(barrelGroup);
    barrels.push(barrelGroup);
  }

  const muzzleSocket = new THREE.Object3D();
  muzzleSocket.name = 'Socket_MuzzleFlash';
  muzzleSocket.position.set(0, 0, barrelLength + 0.25);
  gunRotor.add(muzzleSocket);

  helperApplyShadow(root);

  // =========================================================================
  // F. TRUE FORWARD-PROPULSION KINEMATIC ANIMATIONS (Quadruped Wave Gait)
  // Legs reach forward along local Z, plant & push rearward along local -Z.
  // =========================================================================
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, THREE.AnimationAction>();

  // 1. Idle Clip
  const idleTracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 1.5, 3.0], [0, 1.25, 0, 0, 1.21, 0, 0, 1.25, 0]),
    new THREE.NumberKeyframeTrack('Node_BaseChassis.rotation[x]', [0, 3.0], [0, 0]),
    new THREE.NumberKeyframeTrack('Node_BaseChassis.rotation[z]', [0, 3.0], [0, 0]),
    new THREE.NumberKeyframeTrack('Node_WaistSwivel.rotation[y]', [0, 0.75, 1.5, 2.25, 3.0], [0, 0.06, 0, -0.06, 0]),
    new THREE.NumberKeyframeTrack('Node_GunPitchPivot.rotation[x]', [0, 1.5, 3.0], [0, -0.04, 0]),
    new THREE.NumberKeyframeTrack('HipPivot_Leg_FrontLeft.rotation[y]', [0, 3.0], [0, 0]),
    new THREE.NumberKeyframeTrack('HipPivot_Leg_FrontRight.rotation[y]', [0, 3.0], [0, 0]),
    new THREE.NumberKeyframeTrack('HipPivot_Leg_RearLeft.rotation[y]', [0, 3.0], [0, 0]),
    new THREE.NumberKeyframeTrack('HipPivot_Leg_RearRight.rotation[y]', [0, 3.0], [0, 0]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontLeft.rotation[x]', [0, 1.5, 3.0], [-0.65, -0.62, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontLeft.rotation[x]', [0, 1.5, 3.0], [1.45, 1.49, 1.45]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_FrontLeft.rotation[x]', [0, 3.0], [-0.8, -0.8]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontRight.rotation[x]', [0, 1.5, 3.0], [-0.65, -0.62, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontRight.rotation[x]', [0, 1.5, 3.0], [1.45, 1.49, 1.45]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_FrontRight.rotation[x]', [0, 3.0], [-0.8, -0.8]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearLeft.rotation[x]', [0, 1.5, 3.0], [-0.65, -0.62, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearLeft.rotation[x]', [0, 1.5, 3.0], [1.45, 1.49, 1.45]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_RearLeft.rotation[x]', [0, 3.0], [-0.8, -0.8]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearRight.rotation[x]', [0, 1.5, 3.0], [-0.65, -0.62, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearRight.rotation[x]', [0, 1.5, 3.0], [1.45, 1.49, 1.45]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_RearRight.rotation[x]', [0, 3.0], [-0.8, -0.8]),
  ];
  const idleClip = new THREE.AnimationClip('idle', 3.0, idleTracks);
  actions.set('idle', mixer.clipAction(idleClip));

  // 2. Realistic Walking Propulsion (Grounded Push & Extended Forward Swing)
  const walkTracks: THREE.KeyframeTrack[] = [
    // Chassis heave, forward pitch dip, and roll sway
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 0.25, 0.5, 0.75, 1.0], [
      0, 1.25, 0,
      0, 1.31, 0.05,
      0, 1.25, 0,
      0, 1.31, 0.05,
      0, 1.25, 0
    ]),
    new THREE.NumberKeyframeTrack('Node_BaseChassis.rotation[x]', [0, 0.25, 0.5, 0.75, 1.0], [0.03, 0.07, 0.03, 0.07, 0.03]),
    new THREE.NumberKeyframeTrack('Node_BaseChassis.rotation[z]', [0, 0.25, 0.5, 0.75, 1.0], [0, 0.05, 0, -0.05, 0]),
    new THREE.NumberKeyframeTrack('Node_WaistSwivel.rotation[y]', [0, 0.25, 0.5, 0.75, 1.0], [0, -0.07, 0, 0.07, 0]),

    // --- PAIR A (FrontLeft & RearRight): SWING FORWARD at 0.00-0.50, PUSH BACKWARD at 0.50-1.00 ---
    // FrontLeft sweeps forward (Hip yaw positive, Thigh reaches out, Knee extends)
    new THREE.NumberKeyframeTrack('HipPivot_Leg_FrontLeft.rotation[y]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      -0.35, 0.1, 0.42, 0.38, -0.15, -0.35
    ]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontLeft.rotation[x]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      -0.95, -0.3, -0.45, -0.65, -0.85, -0.95
    ]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontLeft.rotation[x]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      1.72, 1.02, 1.25, 1.45, 1.62, 1.72
    ]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_FrontLeft.rotation[x]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      -0.98, -0.52, -0.72, -0.8, -0.9, -0.98
    ]),

    // RearRight pushes rearward to launch mech forward
    new THREE.NumberKeyframeTrack('HipPivot_Leg_RearRight.rotation[y]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      -0.35, 0.1, 0.42, 0.38, -0.15, -0.35
    ]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearRight.rotation[x]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      -0.95, -0.3, -0.45, -0.65, -0.85, -0.95
    ]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearRight.rotation[x]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      1.72, 1.02, 1.25, 1.45, 1.62, 1.72
    ]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_RearRight.rotation[x]', [0, 0.15, 0.35, 0.5, 0.75, 1.0], [
      -0.98, -0.52, -0.72, -0.8, -0.9, -0.98
    ]),

    // --- PAIR B (FrontRight & RearLeft): PUSH BACKWARD at 0.00-0.50, SWING FORWARD at 0.50-1.00 ---
    new THREE.NumberKeyframeTrack('HipPivot_Leg_FrontRight.rotation[y]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      -0.38, 0.15, 0.35, -0.1, -0.42, -0.38
    ]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontRight.rotation[x]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      -0.65, -0.85, -0.95, -0.3, -0.45, -0.65
    ]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontRight.rotation[x]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      1.45, 1.62, 1.72, 1.02, 1.25, 1.45
    ]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_FrontRight.rotation[x]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      -0.8, -0.9, -0.98, -0.52, -0.72, -0.8
    ]),

    new THREE.NumberKeyframeTrack('HipPivot_Leg_RearLeft.rotation[y]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      -0.38, 0.15, 0.35, -0.1, -0.42, -0.38
    ]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearLeft.rotation[x]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      -0.65, -0.85, -0.95, -0.3, -0.45, -0.65
    ]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearLeft.rotation[x]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      1.45, 1.62, 1.72, 1.02, 1.25, 1.45
    ]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_RearLeft.rotation[x]', [0, 0.25, 0.5, 0.65, 0.85, 1.0], [
      -0.8, -0.9, -0.98, -0.52, -0.72, -0.8
    ]),
  ];
  const walkClip = new THREE.AnimationClip('walk', 1.0, walkTracks);
  actions.set('walk', mixer.clipAction(walkClip));

  // 3. High-Velocity Predatory Run Sprint (Fast powerful stride, low forward chassis attack angle)
  const runTracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 0.125, 0.25, 0.375, 0.5], [
      0, 1.15, 0,
      0, 1.34, 0.1,
      0, 1.15, 0,
      0, 1.34, 0.1,
      0, 1.15, 0
    ]),
    new THREE.NumberKeyframeTrack('Node_BaseChassis.rotation[x]', [0, 0.125, 0.25, 0.375, 0.5], [0.18, 0.11, 0.18, 0.11, 0.18]),
    new THREE.NumberKeyframeTrack('Node_BaseChassis.rotation[z]', [0, 0.125, 0.25, 0.375, 0.5], [0, 0.08, 0, -0.08, 0]),
    new THREE.NumberKeyframeTrack('Node_GunPitchPivot.rotation[x]', [0, 0.125, 0.25, 0.375, 0.5], [-0.18, -0.11, -0.18, -0.11, -0.18]),

    // Pair A: FrontLeft & RearRight
    new THREE.NumberKeyframeTrack('HipPivot_Leg_FrontLeft.rotation[y]', [0, 0.1, 0.25, 0.375, 0.5], [-0.62, 0.2, 0.65, -0.2, -0.62]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontLeft.rotation[x]', [0, 0.1, 0.25, 0.375, 0.5], [-1.25, -0.1, -0.45, -0.95, -1.25]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontLeft.rotation[x]', [0, 0.1, 0.25, 0.375, 0.5], [1.95, 0.8, 1.25, 1.7, 1.95]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_FrontLeft.rotation[x]', [0, 0.1, 0.25, 0.375, 0.5], [-1.2, -0.3, -0.7, -1.0, -1.2]),

    new THREE.NumberKeyframeTrack('HipPivot_Leg_RearRight.rotation[y]', [0, 0.1, 0.25, 0.375, 0.5], [-0.62, 0.2, 0.65, -0.2, -0.62]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearRight.rotation[x]', [0, 0.1, 0.25, 0.375, 0.5], [-1.25, -0.1, -0.45, -0.95, -1.25]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearRight.rotation[x]', [0, 0.1, 0.25, 0.375, 0.5], [1.95, 0.8, 1.25, 1.7, 1.95]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_RearRight.rotation[x]', [0, 0.1, 0.25, 0.375, 0.5], [-1.2, -0.3, -0.7, -1.0, -1.2]),

    // Pair B: FrontRight & RearLeft
    new THREE.NumberKeyframeTrack('HipPivot_Leg_FrontRight.rotation[y]', [0, 0.125, 0.25, 0.35, 0.5], [-0.65, 0.2, 0.62, -0.2, -0.65]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontRight.rotation[x]', [0, 0.125, 0.25, 0.35, 0.5], [-0.45, -0.95, -1.25, -0.1, -0.45]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontRight.rotation[x]', [0, 0.125, 0.25, 0.35, 0.5], [1.25, 1.7, 1.95, 0.8, 1.25]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_FrontRight.rotation[x]', [0, 0.125, 0.25, 0.35, 0.5], [-0.7, -1.0, -1.2, -0.3, -0.7]),

    new THREE.NumberKeyframeTrack('HipPivot_Leg_RearLeft.rotation[y]', [0, 0.125, 0.25, 0.35, 0.5], [-0.65, 0.2, 0.62, -0.2, -0.65]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearLeft.rotation[x]', [0, 0.125, 0.25, 0.35, 0.5], [-0.45, -0.95, -1.25, -0.1, -0.45]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearLeft.rotation[x]', [0, 0.125, 0.25, 0.35, 0.5], [1.25, 1.7, 1.95, 0.8, 1.25]),
    new THREE.NumberKeyframeTrack('AnklePivot_Leg_RearLeft.rotation[x]', [0, 0.125, 0.25, 0.35, 0.5], [-0.7, -1.0, -1.2, -0.3, -0.7]),
  ];
  const runClip = new THREE.AnimationClip('run', 0.5, runTracks);
  actions.set('run', mixer.clipAction(runClip));

  // 4. Shoot / Rapid Fire Clip
  const shootTracks: THREE.KeyframeTrack[] = [
    new THREE.NumberKeyframeTrack('Node_GunRotor.rotation[z]', [0, 0.1, 0.2, 0.3, 0.4], [0, Math.PI * 1.5, Math.PI * 3.0, Math.PI * 4.5, Math.PI * 6.0]),
    new THREE.VectorKeyframeTrack('Node_GunReceiver.position', [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4], [0, 0, 0, 0, 0, -0.14, 0, 0, 0.02, 0, 0, -0.12, 0, 0, 0, 0, 0, -0.15, 0, 0, 0.01, 0, 0, -0.11, 0, 0, 0]),
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 0.1, 0.2, 0.3, 0.4], [0, 1.25, 0, 0, 1.23, -0.05, 0, 1.26, 0.01, 0, 1.23, -0.04, 0, 1.25, 0]),
    new THREE.NumberKeyframeTrack('Node_GunPitchPivot.rotation[x]', [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4], [0, 0.07, -0.02, 0.06, 0, 0.08, -0.03, 0.05, 0]),
  ];
  const shootClip = new THREE.AnimationClip('shoot', 0.4, shootTracks);
  const shootAction = mixer.clipAction(shootClip);
  actions.set('shoot', shootAction);
  actions.set('fire', shootAction);

  // 5. Stomp Melee Attack Clip
  const stompTracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 0.35, 0.5, 0.7, 1.0], [0, 1.25, 0, 0, 1.6, -0.2, 0, 0.95, 0.1, 0, 1.22, 0, 0, 1.25, 0]),
    new THREE.NumberKeyframeTrack('Node_TorsoBall.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [0, -0.35, 0.45, -0.08, 0]),
    new THREE.NumberKeyframeTrack('Node_GunPitchPivot.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [0, -0.4, 0.3, -0.05, 0]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontLeft.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [-0.65, 0.1, -0.85, -0.68, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontLeft.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [1.45, 0.7, 1.85, 1.5, 1.45]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_FrontRight.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [-0.65, 0.1, -0.85, -0.68, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_FrontRight.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [1.45, 0.7, 1.85, 1.5, 1.45]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearLeft.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [-0.65, -0.95, -0.55, -0.65, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearLeft.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [1.45, 1.75, 1.35, 1.45, 1.45]),
    new THREE.NumberKeyframeTrack('ThighPivot_Leg_RearRight.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [-0.65, -0.95, -0.55, -0.65, -0.65]),
    new THREE.NumberKeyframeTrack('KneePivot_Leg_RearRight.rotation[x]', [0, 0.35, 0.5, 0.7, 1.0], [1.45, 1.75, 1.35, 1.45, 1.45]),
  ];
  const stompClip = new THREE.AnimationClip('stomp', 1.0, stompTracks);
  const stompAction = mixer.clipAction(stompClip);
  stompAction.setLoop(THREE.LoopOnce, 1);
  actions.set('stomp', stompAction);

  // 6. Alert Clip
  const alertTracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 0.4, 0.8, 1.6], [0, 1.25, 0, 0, 1.38, 0, 0, 1.28, 0, 0, 1.25, 0]),
    new THREE.NumberKeyframeTrack('Node_WaistSwivel.rotation[y]', [0, 0.3, 0.8, 1.2, 1.6], [0, 0.65, -0.65, 0.35, 0]),
    new THREE.NumberKeyframeTrack('Node_GunPitchPivot.rotation[x]', [0, 0.4, 1.0, 1.6], [0, 0.3, 0.15, 0]),
  ];
  const alertClip = new THREE.AnimationClip('alert', 1.6, alertTracks);
  actions.set('alert', mixer.clipAction(alertClip));

  // 7. Deploy Clip
  const deployTracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 0.8, 2.0], [0, 0.65, 0, 0, 1.4, 0, 0, 1.25, 0]),
    new THREE.NumberKeyframeTrack('Node_GunPitchPivot.rotation[x]', [0, 0.8, 2.0], [-0.45, 0.25, 0]),
  ];
  const deployClip = new THREE.AnimationClip('deploy', 2.0, deployTracks);
  actions.set('deploy', mixer.clipAction(deployClip));

  // 8. Death Clip
  const deathTracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Node_BaseChassis.position', [0, 0.4, 1.2], [0, 1.25, 0, 0, 1.1, 0, 0, 0.45, 0]),
    new THREE.NumberKeyframeTrack('Node_TorsoBall.rotation[z]', [0, 0.6, 1.2], [0, 0.15, 0.45]),
    new THREE.NumberKeyframeTrack('Node_GunPitchPivot.rotation[x]', [0, 0.5, 1.2], [0, -0.2, -0.6]),
  ];
  const deathClip = new THREE.AnimationClip('death', 1.2, deathTracks);
  const deathAction = mixer.clipAction(deathClip);
  deathAction.setLoop(THREE.LoopOnce, 1);
  deathAction.clampWhenFinished = true;
  actions.set('death', deathAction);

  // Play walking animation on initialization
  const walkAct = actions.get('walk');
  if (walkAct) walkAct.play();

  // G. RUNTIME OBJECT & CONTRACTS
  const runtimeState = {
    currentAnimation: 'walk' as AnimationName,
    isFiring: false,
    gunSpinSpeed: 0,
    gunElevation: 0,
    torsoYaw: 0,
    aimTarget: null as THREE.Vector3 | null,
    wearLevel: wear,
    colorScheme: (options.colorScheme || 'hazard-orange') as ColorThemeId,
    walkTime: 0,
  };

  const passes = {
    blockout: { name: 'Blockout Stage', completed: true, score: 10 },
    structural: { name: 'Chassis & Leg Articulation Armature', completed: true, score: 10 },
    form: { name: 'Spherical Cockpit & Armor Panels', completed: true, score: 10 },
    material: { name: 'PBR Industrial Hazards & Textured Roughness', completed: true, score: 10 },
    surface: { name: 'Knee Spurs, Bolts, Flanges & Wear Details', completed: true, score: 10 },
    lighting: { name: 'Optic Glow & Visor Sensor Light Rig', completed: true, score: 10 },
    interaction: { name: 'Baked Animation Clips (Walk, Run, Shoot, Stomp)', completed: true, score: 10 },
    optimization: { name: 'Geometry Caching & Memory Disposal', completed: true, score: 10 },
  };

  const passesReviewed: Record<string, number> = {
    blockout: 10,
    structural: 10,
    form: 10,
    material: 10,
    surface: 10,
    lighting: 10,
    interaction: 10,
    optimization: 10,
  };

  const detailInventory: DetailInventoryItem[] = [
    {
      name: '8-Barrel Radial Gatling Rotor Assembly',
      feature: 'Gatling Cannon Rotor',
      category: 'Weaponry',
      pass: 'form',
      description: '8 radially arrayed heavy steel barrels with center drive spindle shaft and muzzle clamp ring',
      location: 'Gun Mount Turret',
      meshName: 'Node_GunRotor',
      nodes: ['Node_GunRotor', 'Barrel_1', 'Barrel_2', 'Barrel_3', 'Barrel_4', 'Barrel_5', 'Barrel_6', 'Barrel_7', 'Barrel_8'],
    },
    {
      name: 'Reinforced Knee Armor Shield Blades',
      feature: 'Knee Armor Spurs',
      category: 'Armor',
      pass: 'surface',
      description: 'Curved extruded blade armor hooks attached to upper tibia struts',
      location: 'Leg Tibia Segments',
      meshName: 'BladeSpur',
      nodes: ['BladeSpur_Leg_FrontLeft', 'BladeSpur_Leg_FrontRight', 'BladeSpur_Leg_RearLeft', 'BladeSpur_Leg_RearRight'],
    },
    {
      name: 'Cast Talon Claws with Rear Heel Spurs',
      feature: 'Talon Foot Claws',
      category: 'Locomotion',
      pass: 'structural',
      description: 'Extruded sharp talon claws and cone heel spurs for terrain gripping',
      location: 'Ankle Pivot Joints',
      meshName: 'FootClaw',
      nodes: ['FootClaw_Leg_FrontLeft', 'FootClaw_Leg_FrontRight', 'FootClaw_Leg_RearLeft', 'FootClaw_Leg_RearRight'],
    },
    {
      name: 'Spherical Hazard Orange Cockpit Turret',
      feature: 'Spherical Torso Head',
      category: 'Chassis',
      pass: 'form',
      description: 'Central spherical cockpit with dark steel equatorial seam belt and lateral pivot mounts',
      location: 'Waist Swivel Post',
      meshName: 'Node_TorsoBall',
      nodes: ['Node_TorsoBall', 'Node_SideMountLeft', 'Node_SideMountRight'],
    },
    {
      name: 'Glow Optic Targeting Diode with Point Light Strobe',
      feature: 'Optic Sensor Eye',
      category: 'Electronics',
      pass: 'lighting',
      description: 'Cyan optic sensor emissive diode and auxiliary camera lens behind visor slit',
      location: 'Front Visor Lens',
      meshName: 'Node_VisorEye',
      nodes: ['Node_VisorEye'],
    },
    {
      name: '4-Pipe Exhaust Manifold Assembly',
      feature: 'Exhaust Manifold Pipes',
      category: 'Power Plant',
      pass: 'surface',
      description: '4 angled cylindrical exhaust pipes with rim bevels on torso rear',
      location: 'Torso Ball Rear',
      meshName: 'Node_ExhaustPipes',
      nodes: ['Node_ExhaustPipes'],
    },
  ];

  const runtime: SpiderSentryRuntime = {
    root,
    nodes: {
      baseChassis,
      waistSwivel,
      torsoBall,
      visorEye,
      visorGlowLight,
      exhaustPipes,
      gunMount,
      gunPitchPivot,
      gunReceiver,
      gunRotor,
      barrels,
      muzzleSocket,
      carryHandle,
      sideMountLeft,
      sideMountRight,
      legs,
      sockets: {
        muzzle: muzzleSocket,
        eye: visorEye,
        centerMount: gunMount,
        feetPivots: legs.map((l) => l.anklePivot),
      },
      colliders: [
        new THREE.Box3().setFromObject(baseChassis),
        new THREE.Box3().setFromObject(torsoBall),
      ],
    },
    materials: {
      primaryPaint,
      gunmetal,
      darkSteel,
      polishedSteel,
      opticGlow,
      exhaustDark,
    },
    animations: {
      clips: [idleClip, walkClip, runClip, shootClip, stompClip, alertClip, deployClip, deathClip],
      mixer,
      actions,
    },
    state: runtimeState,
    passes,
    passesComplete: true,
    passesReviewed,
    detailInventory,

    playAnimation(name: AnimationName, crossFadeDuration = 0.25) {
      if (runtimeState.currentAnimation === name && name !== 'shoot' && name !== 'stomp') return;
      runtimeState.currentAnimation = name;

      const targetAction = actions.get(name);
      if (!targetAction) return;

      actions.forEach((act, actName) => {
        if (actName === name) {
          act.reset().fadeIn(crossFadeDuration).play();
        } else {
          act.fadeOut(crossFadeDuration);
        }
      });
    },

    stopAnimations() {
      actions.forEach((act) => act.stop());
    },

    setFiring(firing: boolean) {
      runtimeState.isFiring = firing;
      if (firing) {
        this.playAnimation('shoot');
      } else if (runtimeState.currentAnimation === 'shoot' || runtimeState.currentAnimation === 'fire') {
        this.playAnimation('walk');
      }
    },

    setJointAngles(angles: any) {
      if (angles.torsoYaw !== undefined) {
        waistSwivel.rotation.y = angles.torsoYaw;
        runtimeState.torsoYaw = angles.torsoYaw;
      }
      if (angles.gunPitch !== undefined) {
        gunPitchPivot.rotation.x = angles.gunPitch;
        runtimeState.gunElevation = angles.gunPitch;
      }
      if (angles.chassisHeight !== undefined) {
        baseChassis.position.y = angles.chassisHeight;
      }
      if (angles.legs) {
        angles.legs.forEach((lAngles: any, i: number) => {
          if (legs[i]) {
            if (lAngles.hipYaw !== undefined) legs[i].hipPivot.rotation.y = lAngles.hipYaw;
            if (lAngles.hipPitch !== undefined) legs[i].thighPivot.rotation.x = lAngles.hipPitch;
            if (lAngles.kneePitch !== undefined) legs[i].kneePivot.rotation.x = lAngles.kneePitch;
            if (lAngles.anklePitch !== undefined) legs[i].anklePivot.rotation.x = lAngles.anklePitch;
          }
        });
      }
    },

    aimAt(worldTarget: THREE.Vector3, damping = 0.1) {
      runtimeState.aimTarget = worldTarget;
      const torsoWorldPos = new THREE.Vector3();
      torsoBall.getWorldPosition(torsoWorldPos);
      const dir = new THREE.Vector3().subVectors(worldTarget, torsoWorldPos).normalize();

      const targetYaw = Math.atan2(dir.x, dir.z);
      waistSwivel.rotation.y += (targetYaw - waistSwivel.rotation.y) * damping;

      const horizDist = Math.hypot(dir.x, dir.z);
      const targetPitch = Math.atan2(dir.y, horizDist);
      gunPitchPivot.rotation.x += (-targetPitch - gunPitchPivot.rotation.x) * damping;
    },

    setColorScheme(themeId: ColorThemeId) {
      const scheme = COLOR_THEMES[themeId];
      if (!scheme) return;
      runtimeState.colorScheme = themeId;
      primaryPaint.color.set(scheme.primaryOrange);
      gunmetal.color.set(scheme.secondaryGunmetal);
      darkSteel.color.set(scheme.metallicDark);
      opticGlow.color.set(scheme.opticGlow);
      opticGlow.emissive.set(scheme.opticGlow);
      visorGlowLight.color.set(scheme.opticGlow);
      boltMaterial.color.set(scheme.accentBolt);
    },

    setWearLevel(level: number) {
      runtimeState.wearLevel = THREE.MathUtils.clamp(level, 0, 1);
      primaryPaint.roughness = 0.35 + runtimeState.wearLevel * 0.3;
      primaryPaint.bumpScale = 0.005 + runtimeState.wearLevel * 0.025;
      gunmetal.roughness = 0.3 + runtimeState.wearLevel * 0.25;
    },

    setWireframe(wireframe: boolean) {
      root.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.wireframe = wireframe;
            });
          } else {
            child.material.wireframe = wireframe;
          }
        }
      });
    },

    getMuzzleWorldPosition(targetVec = new THREE.Vector3()): THREE.Vector3 {
      muzzleSocket.getWorldPosition(targetVec);
      return targetVec;
    },

    update(deltaTime: number) {
      mixer.update(deltaTime);

      if (runtimeState.isFiring || runtimeState.currentAnimation === 'shoot') {
        opticGlow.emissiveIntensity = 3.5 + Math.random() * 5.0;
        visorGlowLight.intensity = 1.2 + Math.random() * 3.0;
      } else {
        opticGlow.emissiveIntensity = 3.5;
        visorGlowLight.intensity = 1.2;
      }
    },

    tick(deltaTime = 0.016) {
      this.update(deltaTime);
    },

    dispose() {
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      noiseTexture.dispose();
    },
  };

  root.userData.sculptRuntime = runtime;
  root.userData.runtime = runtime;
  root.userData.tick = (dt?: number) => runtime.tick(dt ?? 0.016);

  return root;
}

export function tick(group: THREE.Group, delta = 0.016): void {
  if (group.userData.sculptRuntime?.tick) {
    group.userData.sculptRuntime.tick(delta);
  } else if (group.userData.tick) {
    group.userData.tick(delta);
  }
}

export function getLookDevLights(): THREE.Group {
  const lightRig = new THREE.Group();
  lightRig.name = 'SpiderMech_LookDevLights';

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x383838, 0.9);
  hemiLight.position.set(0, 20, 0);
  lightRig.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  keyLight.position.set(6, 12, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  lightRig.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xaad5ff, 0.8);
  fillLight.position.set(-8, 6, -6);
  lightRig.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xff8c00, 1.4);
  rimLight.position.set(0, 8, -10);
  lightRig.add(rimLight);

  return lightRig;
}

export const createSpiderSentryModel = createSpiderSentryMechModel;
export const createModel = createSpiderSentryMechModel;
export const createSpiderMechModel = createSpiderSentryMechModel;
export const createSpiderSentryGatlingMechModel = createSpiderSentryMechModel;

export function createSpiderSentryMech(options: SpiderSentryOptions = {}): { group: THREE.Group; runtime: SpiderSentryRuntime } {
  const group = createSpiderSentryMechModel(options);
  return { group, runtime: group.userData.sculptRuntime as SpiderSentryRuntime };
}

export default createSpiderSentryMechModel;