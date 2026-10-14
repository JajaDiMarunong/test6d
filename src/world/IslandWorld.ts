import * as THREE from 'three';
import { Collectible, MotionState } from '../types';
import { MotionTracker } from '../engine/MotionTracker';
import { sound } from '../audio/SoundEffects';

export class IslandWorld {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  // Visual assets & entities
  private islandGroup: THREE.Group = new THREE.Group();
  private collectibleMeshes: Map<string, { group: THREE.Group; light: THREE.PointLight; collected: boolean }> = new Map();
  private animatedElements: Array<{ update: (time: number, delta: number) => void }> = [];
  private particleSystems: Array<{ mesh: THREE.Points; life: number; maxLife: number; velocities: Float32Array }> = [];

  // Walking camera head bobbing & smoothing
  private currentYawRad: number = 0;
  private walkBobTimer: number = 0;
  private isDisposed: boolean = false;

  // Collectibles definition
  public collectibles: Collectible[] = [
    {
      id: 'relic-1',
      name: 'Verdant Core',
      title: 'Heart of the Trail',
      position: [0, 1.8, -8],
      collected: false,
      color: '#10B981',
      glowColor: '#34D399',
      lore: 'An ancient seed pulsing with eternal chlorophyll energy.',
    },
    {
      id: 'relic-2',
      name: 'Sky Azure Shard',
      title: 'Breeze Prism',
      position: [7, 2.2, -18],
      collected: false,
      color: '#06B6D4',
      glowColor: '#67E8F9',
      lore: 'Condenses the high altitude winds into a shimmering crystal.',
    },
    {
      id: 'relic-3',
      name: 'Solar Amber Relic',
      title: 'Dawn Beacon',
      position: [-8, 2.5, -28],
      collected: false,
      color: '#F59E0B',
      glowColor: '#FBBF24',
      lore: 'Forged in the first sunrise over the floating archipelago.',
    },
    {
      id: 'relic-4',
      name: 'Mystic Amethyst',
      title: 'Sanctuary Rune',
      position: [4, 3.0, -42],
      collected: false,
      color: '#8B5CF6',
      glowColor: '#A78BFA',
      lore: 'Emits gentle psychic vibrations that harmonize physical movement.',
    },
    {
      id: 'relic-5',
      name: 'Celestial Nova',
      title: 'Zenith Star',
      position: [-5, 3.6, -58],
      collected: false,
      color: '#EC4899',
      glowColor: '#F472B6',
      lore: 'The apex artifact of the floating world, radiant with starlight.',
    },
  ];

  public onCollectibleFound?: (relic: Collectible) => void;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#93C5FD'); // Dawn Sky Blue
    this.scene.fog = new THREE.FogExp2('#93C5FD', 0.016);

    // 2. Camera & Viewport setup (with robust mobile fallback dimensions)
    const width = container.clientWidth || window.innerWidth || 360;
    const height = container.clientHeight || window.innerHeight || 640;
    const aspect = width / Math.max(1, height);
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);
    this.camera.position.set(0, 1.6, 0);

    // 3. High-performance Mobile Renderer (No heavy shadow maps)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = false;

    container.appendChild(this.renderer.domElement);

    // 4. Lighting & Environment
    this.setupLighting();

    // 5. Build Island Geometry & Nature Trail
    this.buildWorld();

    // 6. Spawn Collectibles
    this.spawnCollectibles();

    // Resize listener
    window.addEventListener('resize', this.handleResize);
  }

  private setupLighting() {
    // Warm Sun Directional Light
    const sunLight = new THREE.DirectionalLight('#FFF7ED', 2.2);
    sunLight.position.set(30, 50, 20);
    this.scene.add(sunLight);

    // Soft Sky Fill Light
    const hemiLight = new THREE.HemisphereLight('#BAE6FD', '#334155', 1.4);
    this.scene.add(hemiLight);

    // Gentle Ambient light
    const ambLight = new THREE.AmbientLight('#FFFFFF', 0.4);
    this.scene.add(ambLight);
  }

  private buildWorld() {
    this.scene.add(this.islandGroup);

    // --- Main Floating Island (Terraced Low-Poly) ---
    this.createFloatingIsland([0, -2, -30], 45, 12, '#2D6A4F', '#4A3525');

    // --- Secondary Sanctuary Grove Island ---
    this.createFloatingIsland([-8, 0, -65], 26, 10, '#1E4E38', '#38281D');

    // --- Third Distant Satellite Island ---
    this.createFloatingIsland([30, -5, -45], 20, 8, '#2D6A4F', '#4A3525');

    // --- Cobblestone Winding Walking Path ---
    this.createWalkingPath();

    // --- Low-Poly Pine & Broadleaf Trees ---
    this.populateTrees();

    // --- Ancient Stone Monoliths & Gateway Arch ---
    this.createStoneMonoliths();

    // --- Animated Low-Poly Clouds ---
    this.createFloatingClouds();

    // --- Animated Swaying Meadow Flowers ---
    this.createMeadowFlowers();
  }

  private createFloatingIsland(pos: [number, number, number], radius: number, depth: number, topColor: string, rockColor: string) {
    const group = new THREE.Group();
    group.position.set(...pos);

    // Low-poly Top Grass Cap
    const topGeom = new THREE.CylinderGeometry(radius, radius * 0.85, 3.5, 9, 1);
    topGeom.rotateY(Math.PI / 8);
    const topMat = new THREE.MeshStandardMaterial({
      color: topColor,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
    const topMesh = new THREE.Mesh(topGeom, topMat);
    topMesh.receiveShadow = true;
    topMesh.castShadow = true;
    group.add(topMesh);

    // Inverted Rocky Cone for floating island underside
    const underGeom = new THREE.ConeGeometry(radius * 0.85, depth, 8, 2);
    underGeom.rotateX(Math.PI);
    underGeom.translate(0, -depth * 0.5 - 1.5, 0);
    const underMat = new THREE.MeshStandardMaterial({
      color: rockColor,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    const underMesh = new THREE.Mesh(underGeom, underMat);
    underMesh.castShadow = true;
    group.add(underMesh);

    this.islandGroup.add(group);
  }

  private createWalkingPath() {
    // Path points from starting spawn to the summit
    const pathNodes = [
      new THREE.Vector3(0, 0.02, 3),
      new THREE.Vector3(0, 0.02, -8),
      new THREE.Vector3(6, 0.2, -18),
      new THREE.Vector3(-6, 0.5, -28),
      new THREE.Vector3(3, 0.9, -42),
      new THREE.Vector3(-4, 1.2, -56),
    ];

    const curve = new THREE.CatmullRomCurve3(pathNodes);
    const points = curve.getPoints(80);

    const stoneGeom = new THREE.CylinderGeometry(0.7, 0.8, 0.1, 6);
    stoneGeom.rotateX(Math.PI / 2);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#DDA15E', // Sandstone trail
      roughness: 0.95,
      flatShading: true,
    });

    const pathGroup = new THREE.Group();
    points.forEach((pt, i) => {
      if (i % 2 === 0) {
        const stone = new THREE.Mesh(stoneGeom, stoneMat);
        stone.position.copy(pt);
        stone.position.y += 0.02;
        stone.rotation.z = Math.random() * 0.5;
        stone.rotation.x = Math.PI / 2;
        const scale = 0.8 + Math.random() * 0.5;
        stone.scale.set(scale, scale, 1);
        stone.receiveShadow = true;
        pathGroup.add(stone);
      }
    });

    this.islandGroup.add(pathGroup);
  }

  private populateTrees() {
    const treeGroup = new THREE.Group();

    // Procedural Tree Prototype
    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.35, 1.8, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5C4033', roughness: 0.9, flatShading: true });

    const foliageGeom1 = new THREE.ConeGeometry(1.5, 2.2, 6);
    const foliageGeom2 = new THREE.ConeGeometry(1.1, 1.8, 6);
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#2D6A4F', roughness: 0.8, flatShading: true });
    const foliageMatLight = new THREE.MeshStandardMaterial({ color: '#52B788', roughness: 0.8, flatShading: true });

    // Scatter trees along path sides
    const treePositions = [
      [-4, 0, -4], [4.5, 0, -5],
      [-5.5, 0, -12], [6, 0, -10],
      [9.5, 0.2, -16], [2.5, 0.2, -22],
      [-10, 0.5, -24], [-4, 0.5, -32],
      [8, 0.9, -38], [-2, 0.9, -45],
      [-8, 1.2, -52], [2, 1.2, -60],
      [-12, 1.2, -63], [0, 1.2, -68],
      [18, -3, -38], [22, -3, -48]
    ];

    treePositions.forEach(([x, y, z], i) => {
      const tree = new THREE.Group();
      tree.position.set(x, y, z);

      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const f1 = new THREE.Mesh(foliageGeom1, i % 2 === 0 ? foliageMat : foliageMatLight);
      f1.position.y = 2.4;
      f1.castShadow = true;
      tree.add(f1);

      const f2 = new THREE.Mesh(foliageGeom2, i % 2 === 0 ? foliageMatLight : foliageMat);
      f2.position.y = 3.6;
      f2.castShadow = true;
      tree.add(f2);

      const s = 0.8 + Math.random() * 0.5;
      tree.scale.set(s, s, s);
      tree.rotation.y = Math.random() * Math.PI;

      treeGroup.add(tree);
    });

    this.islandGroup.add(treeGroup);
  }

  private createStoneMonoliths() {
    const monolithGeom = new THREE.BoxGeometry(1.2, 4.5, 0.9);
    const monolithMat = new THREE.MeshStandardMaterial({
      color: '#64748B',
      roughness: 0.95,
      flatShading: true,
    });

    // Gateway Arch at milestone waypoint
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 0, -23);

    const pillarLeft = new THREE.Mesh(monolithGeom, monolithMat);
    pillarLeft.position.set(-3.2, 2.2, 0);
    pillarLeft.rotation.z = -0.06;
    pillarLeft.castShadow = true;
    archGroup.add(pillarLeft);

    const pillarRight = new THREE.Mesh(monolithGeom, monolithMat);
    pillarRight.position.set(3.2, 2.2, 0);
    pillarRight.rotation.z = 0.06;
    pillarRight.castShadow = true;
    archGroup.add(pillarRight);

    const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.9, 1.2), monolithMat);
    crossbeam.position.set(0, 4.5, 0);
    crossbeam.castShadow = true;
    archGroup.add(crossbeam);

    this.islandGroup.add(archGroup);
  }

  private createFloatingClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 1.0,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
    });

    const cloudGroup = new THREE.Group();
    for (let c = 0; c < 9; c++) {
      const singleCloud = new THREE.Group();
      const numPuffs = 5 + Math.floor(Math.random() * 4);
      for (let p = 0; p < numPuffs; p++) {
        const puff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(2.5 + Math.random() * 2, 0),
          cloudMat
        );
        puff.position.set((p - numPuffs / 2) * 2.2, Math.random() * 1.2, Math.random() * 2);
        singleCloud.add(puff);
      }
      singleCloud.position.set(
        (Math.random() - 0.5) * 140,
        15 + Math.random() * 25,
        -20 - Math.random() * 100
      );
      cloudGroup.add(singleCloud);
    }

    this.scene.add(cloudGroup);

    this.animatedElements.push({
      update: (_t, delta) => {
        cloudGroup.children.forEach((cloud) => {
          cloud.position.x += delta * 1.2;
          if (cloud.position.x > 80) cloud.position.x = -80;
        });
      },
    });
  }

  private createMeadowFlowers() {
    const flowerGroup = new THREE.Group();
    const flowerGeom = new THREE.DodecahedronGeometry(0.18, 0);
    const materials = [
      new THREE.MeshStandardMaterial({ color: '#F43F5E', roughness: 0.7, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#EAB308', roughness: 0.7, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: '#06B6D4', roughness: 0.7, flatShading: true }),
    ];

    for (let i = 0; i < 60; i++) {
      const mesh = new THREE.Mesh(flowerGeom, materials[i % 3]);
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 25;
      mesh.position.set(Math.cos(angle) * dist, 0.15, -Math.sin(angle) * dist - 25);
      mesh.scale.set(1, 1.8, 1);
      flowerGroup.add(mesh);
    }

    this.islandGroup.add(flowerGroup);
  }

  private spawnCollectibles() {
    this.collectibles.forEach((relic) => {
      const group = new THREE.Group();
      group.position.set(...relic.position);

      // Core Crystal
      const crystalGeom = new THREE.OctahedronGeometry(0.7, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: relic.color,
        emissive: relic.glowColor,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.8,
        flatShading: true,
      });
      const crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
      crystalMesh.castShadow = true;
      group.add(crystalMesh);

      // Orbiting Rune Rings
      const ringGeom = new THREE.TorusGeometry(1.1, 0.04, 6, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: relic.glowColor, wireframe: true });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 3;
      group.add(ringMesh);

      // Point Light
      const pointLight = new THREE.PointLight(relic.glowColor, 2.5, 8);
      pointLight.position.set(0, 0, 0);
      group.add(pointLight);

      this.scene.add(group);
      this.collectibleMeshes.set(relic.id, { group, light: pointLight, collected: false });

      // Add rotation & float animation
      this.animatedElements.push({
        update: (time) => {
          if (!this.collectibleMeshes.get(relic.id)?.collected) {
            crystalMesh.rotation.y = time * 1.5;
            crystalMesh.rotation.x = Math.sin(time) * 0.4;
            ringMesh.rotation.z = time * 0.8;
            group.position.y = relic.position[1] + Math.sin(time * 2 + relic.position[0]) * 0.25;
          }
        },
      });
    });
  }

  /**
   * Spawns an explosive particle burst when a relic is collected
   */
  private triggerCollectParticles(pos: THREE.Vector3, color: string) {
    const particleCount = 45;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 1.8 + Math.random() * 3.5;

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.cos(phi) * speed + 1.2;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 0.25,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    const pSystem = new THREE.Points(geometry, material);
    this.scene.add(pSystem);

    this.particleSystems.push({
      mesh: pSystem,
      life: 0,
      maxLife: 1.4,
      velocities,
    });
  }

  /**
   * Updates player position, camera orientation, head bobbing, and collision checks
   */
  public update(motion: MotionState, tracker: MotionTracker, deltaSec: number, elapsedSec: number) {
    if (this.isDisposed) return;

    // 1. 3D Camera Orientation (Quaternion slerp: ZERO gimbal lock or glitching when looking up/down)
    if (tracker && tracker.hasOrientation) {
      const yawOffsetRad = THREE.MathUtils.degToRad(-tracker.getHeadingOffset() + tracker.getManualYawOffset());
      const yawOffsetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawOffsetRad);
      const targetQuat = yawOffsetQuat.multiply(tracker.deviceOrientationQuat);
      this.camera.quaternion.slerp(targetQuat, Math.min(1, deltaSec * 18));
    } else {
      // Desktop simulator fallback
      const targetYaw = -(motion.heading * Math.PI) / 180;
      let diff = (targetYaw - this.currentYawRad) % (Math.PI * 2);
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;
      this.currentYawRad += diff * Math.min(1, deltaSec * 12);

      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.currentYawRad;
      this.camera.rotation.x = 0;
    }

    // 2. Physical walking head-bobbing oscillator
    if (motion.isMoving) {
      this.walkBobTimer += deltaSec * (motion.cadence > 0 ? (motion.cadence / 60) * Math.PI * 2 : 7.0);
    }
    const bobOffset = motion.isMoving ? Math.sin(this.walkBobTimer) * 0.05 : 0;
    const swayOffset = motion.isMoving ? Math.cos(this.walkBobTimer * 0.5) * 0.03 : 0;

    // 3. Smooth camera position tracking
    this.camera.position.x = motion.position.x + swayOffset;
    this.camera.position.y = motion.position.y + bobOffset;
    this.camera.position.z = motion.position.z;

    // 4. Update animations (clouds, relics, swaying elements)
    this.animatedElements.forEach((el) => el.update(elapsedSec, deltaSec));

    // 5. Update particle systems
    for (let i = this.particleSystems.length - 1; i >= 0; i--) {
      const ps = this.particleSystems[i];
      ps.life += deltaSec;
      if (ps.life >= ps.maxLife) {
        this.scene.remove(ps.mesh);
        ps.mesh.geometry.dispose();
        (ps.mesh.material as THREE.Material).dispose();
        this.particleSystems.splice(i, 1);
        continue;
      }

      const posAttr = ps.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;
      const count = posArray.length / 3;

      for (let p = 0; p < count; p++) {
        posArray[p * 3] += ps.velocities[p * 3] * deltaSec;
        posArray[p * 3 + 1] += ps.velocities[p * 3 + 1] * deltaSec - 2.5 * deltaSec; // gravity
        posArray[p * 3 + 2] += ps.velocities[p * 3 + 2] * deltaSec;
      }
      posAttr.needsUpdate = true;
      (ps.mesh.material as THREE.PointsMaterial).opacity = 1.0 - ps.life / ps.maxLife;
    }

    // 6. Proximity / Collision detection with Collectibles
    const playerPos = this.camera.position;
    this.collectibles.forEach((relic) => {
      if (relic.collected) return;
      const meshItem = this.collectibleMeshes.get(relic.id);
      if (!meshItem) return;

      const relicPos = new THREE.Vector3(...relic.position);
      const distance = playerPos.distanceTo(relicPos);

      // Trigger radius: 2.2 meters
      if (distance < 2.2) {
        relic.collected = true;
        meshItem.collected = true;

        // Disperse particles
        this.triggerCollectParticles(relicPos, relic.glowColor);

        // Disappear animation
        meshItem.group.visible = false;
        meshItem.light.intensity = 0;

        sound.playChime();
        if (this.onCollectibleFound) {
          this.onCollectibleFound(relic);
        }
      }
    });

    // 7. Render frame
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth || window.innerWidth || 360;
    const height = this.container.clientHeight || window.innerHeight || 640;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public dispose() {
    this.isDisposed = true;
    window.removeEventListener('resize', this.handleResize);

    this.particleSystems.forEach((ps) => {
      this.scene.remove(ps.mesh);
      ps.mesh.geometry.dispose();
      (ps.mesh.material as THREE.Material).dispose();
    });

    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
