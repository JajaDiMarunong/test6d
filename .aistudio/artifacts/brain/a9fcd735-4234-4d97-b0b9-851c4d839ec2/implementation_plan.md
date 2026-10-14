# WebAR 6DoF Real-to-Virtual Walking Explorer Template

A mobile-first WebAR 3D template where physical walking in the real world is tracked via 6DoF WebXR and an intelligent sensor-fusion pedometer, moving your avatar seamlessly through a procedurally generated low-poly floating island world.

## User Review & Critical Decisions

> [!IMPORTANT]
> The tracking and environmental architecture has been tailored based on your confirmed preferences:

- **Tracking Architecture (Confirmed)**: Dual-layer tracking system featuring native WebXR `immersive-ar` / `local-floor` 6DoF positional tracking for supported devices (such as Android Chrome with Google Play Services for AR), backed by an intelligent sensor-fusion pedometer engine (DeviceMotion accelerometer peak detection + DeviceOrientation yaw gyro dead-reckoning + optional camera feature flow) for universal iOS Safari & Android mobile browser compatibility.
- **Virtual Environment Theme (Confirmed)**: Low-poly floating island nature trail featuring animated foliage, mossy stones, floating crystal beacons, gentle atmospheric fog, elevation bridges, and glowing collectible orbs that react as you walk up to them.
- **View Mode (Confirmed)**: Full virtual world driven purely by physical walking, with an optional Picture-in-Picture (PiP) safety camera overlay so you can safely glance at your real-world path while walking outdoors or indoors.
- **Testing & Deployment Ergonomics**: Includes an interactive touch on-screen joystick and keyboard WASD simulator mode for instant testing in desktop dev environments, plus zero external asset dependencies so the project builds cleanly and can be deployed directly to GitHub Pages or any static host.

---

## 1. Overview & Core Concept

- **What It Does**: The user opens the web app on their smartphone (via HTTPS / GitHub Pages / local network), grants motion sensor/camera permissions, and begins physically walking in real life. Each physical step, forward stride, and turning rotation is mapped 1:1 into forward motion in a lush 3D floating island environment.
- **Target Audience & Persona**: Mobile web developers, WebXR/AR creators, fitness app builders, and digital world hobbyists seeking a clean, battery-efficient template for room-scale and outdoor walking synchronization without specialized VR headsets.
- **Key Value**: Bridges the gap between WebXR 6DoF (which is usually restricted to specific hardware) and universal mobile browsers (which lack native 6DoF SLAM) by providing a robust fallback pipeline that works on any smartphone straight out of the box.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Launch & Diagnostics Screen**: Displays a modern, clean permissions & sensor onboarding card. Checks WebXR availability, motion sensor permissions (iOS permission prompt compliant), and camera access.
2. **Calibration & Zeroing**: Prompts user to hold phone comfortably at chest/waist level, zeroes heading to 0° forward, and establishes the step threshold.
3. **Immersive Walk**: The 3D viewport takes over full screen. As the user walks physically:
   - Cadence & step count increment in real time.
   - Virtual camera glides along the island path with subtle, pleasant head-bobbing.
   - Collectible relics/gems disperse glowing particles and chime with procedural Web Audio when the user physically reaches them.
   - Distance walked (meters/km), active pace, calories, and compass heading update in a floating tactical HUD.
4. **Safety & Reality Glance**: A discreet tap on the Safety Eye button activates an edge-anchored camera PiP window or a wireframe pass-through grid, ensuring real-world walking safety.
5. **Session Summary & Settings Sheet**: Users can view their walking session stats (distance, steps, trajectory map), adjust stride length calibration (e.g. 0.65m to 0.85m), sensitivity, and toggle audio or simulation mode.

### Visual Identity & Theme
- **Aesthetic Direction**: Nature-forward stylized low-poly fantasy meets tactical outdoor telemetry. Crisp geometric shapes, pastel greens, sun-drenched stone, and luminous azure waters.
- **Color Palette**:
  - Sky & Atmosphere: Dawn gradient (`#87CEEB` to `#E0F2FE`) with soft exponential fog (`#B0E0E6`).
  - Terrain & Nature: Low-poly emerald greens (`#2D6A4F`, `#52B788`), warm terra cotta trail paths (`#DDA15E`), weathered granite stones (`#6C757D`).
  - Collectibles & Magic: Radiant cyan (`#06B6D4`) and amber sunlight (`#F59E0B`).
  - HUD & Telemetry: Obsidian glass panels (`rgba(15, 23, 42, 0.75)` with `backdrop-blur-md`), crisp high-contrast typography, and vibrant mint accent status dots.
- **Typography**: Clean modern sans-serif (`Inter` / system UI) with tabular monospace numbers (`font-mono`) for real-time odometer, heading, and step metrics.
- **Touch Ergonomics**: Minimum 44px tap targets, thumb-zone friendly bottom navigation bar for quick recalibration, PiP toggle, audio mute, and stride tuning.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Layer Motion Engine (WebXR + Sensor Fusion)**:
  - *Chosen Approach*: If `navigator.xr.isSessionSupported('immersive-ar')` is true and requested, start a native 6DoF session with a `local-floor` or `unbounded` reference space for centimeter-accurate hardware SLAM. If not supported (or rejected/on iOS), seamlessly activate the inertial pedometer engine with high-pass filtered acceleration step detection and DeviceOrientation yaw integration.
  - *Why*: Guarantees that the app works immediately on any phone (iPhone Safari, Android Chrome, Samsung Internet) without showing a dead-end error message.
- **Decision 2: Procedural Assets & Zero 404s**:
  - *Chosen Approach*: Construct the low-poly floating islands, trees, trail stones, bridges, and glowing runes purely using Three.js procedural geometries (`BufferGeometry`, `DodecahedronGeometry`, `CylinderGeometry`, `ExtrudeGeometry`) and Web Audio API synthesized audio tones.
  - *Why*: Eliminates slow 3D model downloads, missing external asset links, CORS problems on GitHub Pages, and keeps bundle size under 200KB for instantaneous mobile loading.
- **Decision 3: Stride Dynamic Dead-Reckoning**:
  - *Chosen Approach*: Uses a frequency-adaptive step-peak algorithm. Step frequency dictates walking speed (idle, casual stroll, brisk walk, jog) with a calibrated stride multiplier (default 0.74m per step), smoothly interpolated with damping to prevent jarring teleportation.
- **Decision 4: Real-World Safety Features**:
  - *Chosen Approach*: Because users will be walking in physical space with their eyes on the phone, include an active step boundary alert, high-contrast HUD warnings, and a toggleable live rear-camera feed PiP overlay.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Mobile Browser DOM                            │
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐ │
│  │   Camera Feed (PiP)   │  │             React UI Layer             │ │
│  │   <video autoPlay>    │  │  • Tactical HUD (Odometer, Steps)      │ │
│  └───────────┬───────────┘  │  • Calibration & Sensitivity Modal     │ │
│              │              │  • Safety Mode & Recalibrate Bar       │ │
│              │              │  • Virtual Joystick (Sim Fallback)     │ │
│              │              └───────────────────┬────────────────────┘ │
└──────────────┼──────────────────────────────────┼──────────────────────┘
               │                                  │
┌──────────────▼──────────────────────────────────▼──────────────────────┐
│                    Walking 6DoF Motion Pipeline                        │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │       Native WebXR API       │    │   Inertial Pedometer Fallback│  │
│  │ • 'immersive-ar' Session     │ OR │ • DeviceMotionEvent (Acc)    │  │
│  │ • local-floor 6DoF Pose      │    │ • DeviceOrientation (Yaw)    │  │
│  │ • Hardware SLAM Translation  │    │ • Dynamic Stride Dead-Reckon │  │
│  └──────────────┬───────────────┘    └──────────────┬───────────────┘  │
│                 │                                   │                  │
│                 └─────────────────┬─────────────────┘                  │
│                                   ▼                                    │
│                     Unified Player Transform State                     │
│                (Position: x, y, z | Orientation: yaw)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Three.js 3D Virtual Engine                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Scene Manager:                                                   │  │
│  │  • Floating Island Path Terrain (Procedural Heightmap & Stones)  │  │
│  │  • Dynamic Low-poly Foliage & Swaying Grass Instances            │  │
│  │  • Interactive Collectible Crystals (Collision detection)        │  │
│  │  • Atmospheric Sun, RoomEnvironment & Distance Fog               │  │
│  │  • First-Person Walking Camera with Damped Head-Bobbing          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Audio Synthesizer (Web Audio API): Footsteps, Chimes, Ambient    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### State Store Structure
- `trackingMode`: `'webxr'` | `'sensors'` | `'simulator'`
- `isTracking`: `boolean`
- `heading`: `number` (degrees, 0–360)
- `stepCount`: `number`
- `distanceMeters`: `number`
- `currentSpeed`: `number` (m/s)
- `strideLength`: `number` (meters, user-adjustable)
- `collectiblesFound`: `number` (out of total generated in island)
- `cameraPipActive`: `boolean`
- `audioEnabled`: `boolean`

---

## 5. Implementation Steps (Planned Post-Approval)

1. **Install Dependencies**: Install `three` and `@types/three`.
2. **Core 6DoF & Pedometer Engine (`src/engine/MotionTracker.ts`)**:
   - WebXR session requester and frame updater.
   - High-pass filtered accelerometer step detector with threshold peak detection and cooldown.
   - DeviceOrientation handler with alpha/beta/gamma conversion to yaw compass heading.
   - Virtual on-screen touch joystick emulator for desktop/browser preview.
3. **Procedural Low-Poly Island World (`src/world/IslandWorld.ts`)**:
   - Island terrain geometry with winding pathway and height variations.
   - Instanced low-poly pine trees, glowing mushrooms, floating boulders, and waterfalls.
   - Interactive rotating floating relics with distance collision triggers.
   - Web Audio procedural chime & ambient sound synthesizer.
4. **HUD & Mobile Control UI (`src/components/WalkHUD.tsx` & `src/App.tsx`)**:
   - Floating glassmorphism status bar with Steps, Distance, Heading, and Battery/Signal icon.
   - Safety PiP camera video stream viewport.
   - Calibration bottom drawer with stride slider, step sensitivity, and WebXR status.
   - First-time permissions overlay for iOS motion sensor access and camera feed.
5. **Validation & Verification**:
   - Run compilation checks (`compile_applet`) and ensure 60fps mobile responsiveness.
