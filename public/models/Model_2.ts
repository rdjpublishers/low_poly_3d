import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function createTrainModel(options: any = {}): THREE.Group {
    const train = new THREE.Group();

    // High-fidelity toy color palette based on the reference image
    const colors = {
        red: 0xdf3e23,      // Vibrant but soft matte red
        darkGray: 0x36383a, // Main chassis, roof, wheels
        black: 0x181818,    // Inner windows, deep recesses
        orange: 0xf28b18,   // Boiler stripes
        smoke: 0xbabfce     // Soft, volumetric gray smoke
    };

    // Premium "Designer Toy" Materials using MeshPhysicalMaterial
    // This gives a beautiful, soft, waxy/plastic look typical of high-end 3D renders
    const baseMatOpts = { roughness: 0.65, metalness: 0.05, clearcoat: 0.15, clearcoatRoughness: 0.6 };
    const materials = {
        red: new THREE.MeshPhysicalMaterial({ color: colors.red, ...baseMatOpts }),
        darkGray: new THREE.MeshPhysicalMaterial({ color: colors.darkGray, ...baseMatOpts }),
        black: new THREE.MeshPhysicalMaterial({ color: colors.black, roughness: 0.8, metalness: 0.1 }),
        orange: new THREE.MeshPhysicalMaterial({ color: colors.orange, ...baseMatOpts }),
        smoke: new THREE.MeshPhysicalMaterial({ color: colors.smoke, roughness: 0.9, metalness: 0.0, clearcoat: 0.0 }) // Pure matte smoke
    };

    // Helper to add meshes and apply shadows cleanly
    const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    };

    // ==========================================
    // 1. BASE & CHASSIS
    // ==========================================
    
    // Red Platform Base (High segment count for perfectly smooth rounded edges)
    const platformGeo = new RoundedBoxGeometry(6.8, 0.4, 3.2, 16, 0.15);
    const platform = addMesh(platformGeo, materials.red, train);
    platform.position.set(0, 1.4, 0);

    // Dark Gray Undercarriage
    const chassisGeo = new RoundedBoxGeometry(6.4, 0.8, 2.6, 16, 0.15);
    const chassis = addMesh(chassisGeo, materials.darkGray, train);
    chassis.position.set(0, 0.8, 0);

    // ==========================================
    // 2. CABIN & ROOF
    // ==========================================
    
    const cabinGeo = new RoundedBoxGeometry(2.4, 2.8, 2.9, 16, 0.2);
    const cabin = addMesh(cabinGeo, materials.red, train);
    cabin.position.set(1.8, 3.0, 0);

    // The roof has a slight overhang
    const roofGeo = new RoundedBoxGeometry(2.8, 0.45, 3.3, 16, 0.15);
    const roof = addMesh(roofGeo, materials.darkGray, train);
    roof.position.set(1.8, 4.6, 0);

    // High-fidelity Inset Windows (Frames + Dark Glass)
    const sideWindowGeo = new RoundedBoxGeometry(1.2, 1.3, 0.3, 16, 0.1);
    const sideGlassGeo = new RoundedBoxGeometry(0.9, 1.0, 0.35, 16, 0.08);

    // Left Window
    const winFrameL = addMesh(sideWindowGeo, materials.darkGray, train);
    winFrameL.position.set(1.8, 3.2, 1.4);
    const winGlassL = addMesh(sideGlassGeo, materials.black, train);
    winGlassL.position.set(1.8, 3.2, 1.4);

    // Right Window
    const winFrameR = addMesh(sideWindowGeo, materials.darkGray, train);
    winFrameR.position.set(1.8, 3.2, -1.4);
    const winGlassR = addMesh(sideGlassGeo, materials.black, train);
    winGlassR.position.set(1.8, 3.2, -1.4);
    
    // Back Window
    const backWindowGeo = new RoundedBoxGeometry(0.3, 1.2, 1.6, 16, 0.1);
    const backGlassGeo = new RoundedBoxGeometry(0.35, 0.9, 1.2, 16, 0.08);
    const winFrameB = addMesh(backWindowGeo, materials.darkGray, train);
    winFrameB.position.set(2.95, 3.2, 0);
    const winGlassB = addMesh(backGlassGeo, materials.black, train);
    winGlassB.position.set(2.95, 3.2, 0);

    // ==========================================
    // 3. BOILER & DETAILS
    // ==========================================
    
    // Main Boiler Cylinder (High radial segments)
    const boilerGeo = new THREE.CylinderGeometry(1.15, 1.15, 3.8, 64);
    const boiler = addMesh(boilerGeo, materials.red, train);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(-1.3, 2.75, 0);

    // Boiler Orange Stripes (Slightly larger cylinder to wrap seamlessly)
    const stripeGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.25, 64);
    const stripe1 = addMesh(stripeGeo, materials.orange, train);
    stripe1.rotation.z = Math.PI / 2;
    stripe1.position.set(-0.5, 2.75, 0);

    const stripe2 = addMesh(stripeGeo, materials.orange, train);
    stripe2.rotation.z = Math.PI / 2;
    stripe2.position.set(-2.1, 2.75, 0);

    // Boiler Front Cap (Dark Gray)
    const capGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 64);
    const cap = addMesh(capGeo, materials.darkGray, train);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(-3.35, 2.75, 0);

    // Boiler Front Center Button (Darker)
    const buttonGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.2, 64);
    const button = addMesh(buttonGeo, materials.black, train);
    button.rotation.z = Math.PI / 2;
    button.position.set(-3.5, 2.75, 0);

    // ==========================================
    // 4. CHIMNEY & DOME
    // ==========================================
    
    // Dome (Pill shape constructed from cylinder + sphere)
    const domeCylGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 32);
    const domeCyl = addMesh(domeCylGeo, materials.darkGray, train);
    domeCyl.position.set(-1.2, 4.1, 0);
    const domeTopGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const domeTop = addMesh(domeTopGeo, materials.darkGray, train);
    domeTop.position.set(-1.2, 4.35, 0);

    // Chimney (Base, Flared Top, and Inner Hole)
    const chimneyBaseGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 32);
    const chimneyBase = addMesh(chimneyBaseGeo, materials.darkGray, train);
    chimneyBase.position.set(-2.8, 4.2, 0);

    const chimneyFlareGeo = new THREE.CylinderGeometry(0.55, 0.35, 0.6, 64);
    const chimneyFlare = addMesh(chimneyFlareGeo, materials.darkGray, train);
    chimneyFlare.position.set(-2.8, 4.9, 0);

    const chimneyHoleGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.61, 32);
    const chimneyHole = addMesh(chimneyHoleGeo, materials.black, train);
    chimneyHole.position.set(-2.8, 4.9, 0);

    // ==========================================
    // 5. COWCATCHER (Front Grille)
    // ==========================================
    
    // We create the wedge by angling a rounded box and intersecting it with the ground/chassis
    const cowcatcherBaseGeo = new RoundedBoxGeometry(1.2, 1.4, 2.8, 16, 0.1);
    const cowcatcherBase = addMesh(cowcatcherBaseGeo, materials.darkGray, train);
    cowcatcherBase.position.set(-3.5, 0.8, 0);
    cowcatcherBase.rotation.z = -Math.PI / 5.5; // Angled forward

    // Vertical Slats embedded in the cowcatcher
    const slatGeo = new RoundedBoxGeometry(0.2, 1.3, 0.25, 8, 0.08);
    for (let i = -1.5; i <= 1.5; i += 1.5) {
        const slat = new THREE.Mesh(slatGeo, materials.black);
        slat.position.set(-0.55, 0, i * 0.55);
        slat.castShadow = true;
        slat.receiveShadow = true;
        cowcatcherBase.add(slat);
    }

    // ==========================================
    // 6. WHEELS & CONNECTING RODS
    // ==========================================
    
    // Create a highly detailed lathe profile for the wheels (Scaled down to prevent overlap)
    const wheelScale = 0.8; // Reduce wheel size to fit nicely
    const wheelPoints = [];
    wheelPoints.push(new THREE.Vector2(0, 0.18));       // Center Hub
    wheelPoints.push(new THREE.Vector2(0.18, 0.18));
    wheelPoints.push(new THREE.Vector2(0.22 * wheelScale, 0.12));    // Hub bevel
    wheelPoints.push(new THREE.Vector2(0.22 * wheelScale, 0.05));    // Inner Recess
    wheelPoints.push(new THREE.Vector2(0.65 * wheelScale, 0.05));    // Recess span
    wheelPoints.push(new THREE.Vector2(0.65 * wheelScale, 0.22));    // Rim inner edge
    wheelPoints.push(new THREE.Vector2(0.72 * wheelScale, 0.26));    // Rim bevel
    wheelPoints.push(new THREE.Vector2(0.85 * wheelScale, 0.26));    // Rim outer edge
    wheelPoints.push(new THREE.Vector2(0.9 * wheelScale, 0.22));     // Tire curve
    wheelPoints.push(new THREE.Vector2(0.9 * wheelScale, -0.22));    // Backside
    wheelPoints.push(new THREE.Vector2(0.85 * wheelScale, -0.26));
    wheelPoints.push(new THREE.Vector2(0.72 * wheelScale, -0.26));
    wheelPoints.push(new THREE.Vector2(0.65 * wheelScale, -0.22));
    wheelPoints.push(new THREE.Vector2(0.65 * wheelScale, -0.05));
    wheelPoints.push(new THREE.Vector2(0.22 * wheelScale, -0.05));
    wheelPoints.push(new THREE.Vector2(0.22 * wheelScale, -0.12));
    wheelPoints.push(new THREE.Vector2(0.18, -0.18));
    wheelPoints.push(new THREE.Vector2(0, -0.18));

    const wheelGeo = new THREE.LatheGeometry(wheelPoints, 64);

    const wheelPositions = [
        [-2.0, 0.72, 1.4], [0, 0.72, 1.4], [2.0, 0.72, 1.4], // lowered height to account for smaller radius
        [-2.0, 0.72, -1.4], [0, 0.72, -1.4], [2.0, 0.72, -1.4]
    ];

    wheelPositions.forEach((pos, index) => {
        const isRightSide = index >= 3;
        const wheel = addMesh(wheelGeo, materials.darkGray, train);
        wheel.position.set(pos[0], pos[1], pos[2]);
        // Rotate so the detailed side faces outward
        wheel.rotation.x = isRightSide ? -Math.PI / 2 : Math.PI / 2;
    });

    // Connecting Rods (Long bar spanning the wheels)
    const rodGeo = new RoundedBoxGeometry(4.4, 0.18, 0.1, 8, 0.04);
    const rodL = addMesh(rodGeo, materials.black, train);
    rodL.position.set(0, 0.72, 1.75);
    
    const rodR = addMesh(rodGeo, materials.black, train);
    rodR.position.set(0, 0.72, -1.75);

    // Rod connection pins
    const pinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 32);
    pinGeo.rotateX(Math.PI / 2);
    wheelPositions.forEach((pos, index) => {
        const isRightSide = index >= 3;
        const pin = addMesh(pinGeo, materials.darkGray, train);
        pin.position.set(pos[0], pos[1], isRightSide ? -1.75 : 1.75);
    });

    // ==========================================
    // 7. VOLUMETRIC SMOKE CLOUDS
    // ==========================================
    
    // Group of highly segmented spheres merging into a cloud
    const smokeGroup = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    
    const smokeBlobs = [
        { scale: 0.35, pos: [-2.8, 5.5, 0] },
        { scale: 0.50, pos: [-2.7, 6.1, 0.15] },
        { scale: 0.65, pos: [-2.4, 6.7, -0.15] },
        { scale: 0.85, pos: [-1.9, 7.5, 0.2] },
        { scale: 1.05, pos: [-1.1, 8.5, -0.1] },
        { scale: 0.75, pos: [-1.6, 8.0, -0.3] }, // Filler blob for volume
        { scale: 0.60, pos: [-2.0, 7.0, 0.3] }   // Filler blob for volume
    ];

    smokeBlobs.forEach(blob => {
        const smMesh = addMesh(sphereGeo, materials.smoke, smokeGroup);
        smMesh.position.set(blob.pos[0], blob.pos[1], blob.pos[2]);
        smMesh.scale.setScalar(blob.scale);
    });

    train.add(smokeGroup);

    // Optional: Add a subtle overall rotation or adjustment if needed
    // train.scale.setScalar(0.9);

    return train;
}

