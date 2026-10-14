# WebAR 6DoF Real-to-Virtual Walking Explorer Template

A mobile-first web app template where walking in physical reality is tracked in real-time and mapped directly into 6DoF locomotion inside a stylized 3D low-poly floating island archipelago.

Built with **React 19**, **Three.js**, **Vite**, **Tailwind CSS**, and the **Web Audio API**. Zero external model dependencies (all 3D biomes, particle effects, and soundscapes are generated procedurally).

---

## 🚀 Key Features

1. **Dual-Layer Real-World Walking Synchronization**:
   - **Native WebXR 6DoF SLAM**: Uses hardware computer vision tracking (`immersive-ar` / `local-floor`) on supported Android devices with Google Play Services for AR.
   - **Universal Sensor Fusion Pedometer**: Automatic fallback for iOS Safari and all smartphones using `DeviceMotionEvent` (high-pass accelerometer peak detection) and `DeviceOrientationEvent` (compass yaw dead-reckoning).
   - **Desktop Simulator**: Immediate preview in dev environments using keyboard (`W`/`A`/`S`/`D` or Arrow keys) and an on-screen touch joystick.
2. **Procedural Low-Poly Floating Island World**:
   - Winding cobblestone trail, pine trees, terraced cliff drops, stone monolith gateway arches, and drifting clouds.
   - Interactive collectible relics scattered along the trail with explosive particle effects and Web Audio chime arpeggios when reached.
   - First-person walking camera with natural physical head-bobbing harmonic oscillation synced to walking cadence.
3. **Safety First**:
   - **Safety Glance Camera PiP**: On-screen live rear-camera feed so you can keep an eye on real-world obstacles and terrain while walking.
4. **Tactical Walking HUD**:
   - Real-time step counter, distance odometer (meters/km), walking speed (m/s), cadence (steps/min), estimated energy burned (kcal), and 360° compass tape.
   - Calibration drawer with stride length slider (0.50m - 1.10m), pedometer sensitivity tuning, and one-tap compass zeroing.

---

## 📱 How to Run & Deploy to GitHub

### 1. Push to your GitHub Repository

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "feat: WebAR 6DoF real-to-virtual walking explorer template"

# Create a repo on GitHub and push
gh repo create my-webar-walking --public --source=. --remote=origin --push
# Or manually add your GitHub remote:
# git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
# git push -u origin main
```

### 2. Deploy to GitHub Pages (or Vercel / Netlify / Cloud Run)

> ⚠️ **Important**: Both iOS Safari and Android Chrome strictly require **HTTPS** to grant permissions for device motion sensors, camera, and WebXR. GitHub Pages provides HTTPS automatically!

#### Deploying with GitHub Pages:
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment**, set the source to **GitHub Actions**.
3. Use the standard Vite static deployment workflow or run:
   ```bash
   npm run build
   ```
4. Point GitHub Pages to the `dist` directory.

---

## 🚶 How to Walk on Your Phone

1. Open your deployed HTTPS URL on your smartphone (iPhone Safari or Android Chrome).
2. Tap **"Enable Sensors & Start Physical Walk"** on the welcome screen.
   *(On iOS, this triggers the mandatory system motion permission prompt).*
3. Hold your phone upright at chest/waist level and take normal steps forward.
4. Turn your body 360° to steer in the virtual world!
5. Tap the **Camera icon** at the top right to open the real-world safety window whenever you want to check your physical surroundings.
6. Tap the **Compass** to recalibrate your forward direction at any time.

---

## 🛠️ Project Structure

- `src/engine/MotionTracker.ts`: Handles WebXR 6DoF sessions, accelerometer filtering, peak detection, compass unwrapping, camera stream, and keyboard/joystick input.
- `src/world/IslandWorld.ts`: Three.js procedural low-poly floating islands, winding trail, lighting, clouds, particle emitters, and collectible collision detection.
- `src/audio/SoundEffects.ts`: Web Audio API procedural synthesizer for footstep thuds and crystal chimes.
- `src/components/WalkHUD.tsx`: Floating tactical HUD with metrics, compass, and controls.
- `src/components/SafetyCameraPiP.tsx`: Live camera feed safety window with reticle.
- `src/components/CalibrationModal.tsx`: Stride slider, sensitivity adjustment, and deployment docs.
- `src/components/VirtualJoystick.tsx`: Multi-touch virtual thumbstick for manual control.
