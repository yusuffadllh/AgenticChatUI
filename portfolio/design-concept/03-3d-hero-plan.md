# 03 — Interactive 3D Hero Plan (Three.js / React Three Fiber)

## Concept: "The Field"

An **interactive particle vector field** — thousands of GPU-driven points arranged on a grid, displaced by curl/simplex noise, that **bend and flow toward the cursor** like a gravitational well. This directly nods to `GS-Field-Engine` (field simulation) and `Tkinter-Graph-Pathfinding` (nodes/flow), and firmly avoids the generic floating-sphere/blob cliché.

Fallback identity if too heavy: same field rendered as **thin flow-lines** (particle trails), which reads as "algorithm visualization".

---

## Tech Stack
```
next (app router)      – site framework
@react-three/fiber     – React renderer for Three.js
@react-three/drei      – helpers (OrthographicCamera, AdaptiveDpr, PerformanceMonitor)
three                  – core
leva (dev only)        – live-tune params, removed in prod
custom GLSL            – vertex/fragment shaders for the field
maath / simplex-noise  – noise utilities (CPU seeds; noise mainly in shader)
```

---

## Scene Composition
```
<Canvas> (orthographic-ish, dpr [1, 2], antialias off, alpha true)
  <AdaptiveDpr /> <PerformanceMonitor />
  <color attach="background" args={['#07080B']} />  (or transparent for CSS bg)
  <ParticleField
     count = 24000            // desktop; scaled by tier
     grid  = 200 x 120
     pointSize = 2.2
  />
  <fog />  (subtle depth fade toward edges)
  <PostFX>  bloom (threshold high, intensity low), vignette, film-grain pass
```
No orbit controls — camera is fixed; interaction is the field itself.

---

## The Particle Field — how it works

### Data
- Positions baked once into a `Float32Array` on a grid; stored in `BufferGeometry`.
- Each particle also carries an `aRandom` attribute (seeded jitter) so motion isn't uniform.

### Vertex shader (core idea)
```glsl
uniform float uTime;
uniform vec2  uMouse;      // world-space cursor
uniform float uMouseForce; // eases in on move
attribute float aRandom;
varying float vGlow;

// curl noise displacement (pseudo)
vec3 pos = position;
float n  = curlNoise(pos.xy * 0.15 + uTime * 0.05);
pos.z   += n * 6.0;                                // wavy field
pos.xy  += curl2(pos.xy * 0.1 + uTime*0.03) * 3.0; // drift

// cursor attraction (gravity well)
vec2  toMouse = uMouse - pos.xy;
float d       = length(toMouse);
float pull     = uMouseForce / (d*d + 1.0);
pos.xy       += normalize(toMouse) * pull * 4.0;

vGlow = clamp(pull * 2.0 + n, 0.0, 1.0); // hotter near cursor & crests
```

### Fragment shader
```glsl
varying float vGlow;
// palette lerp: cyan (#4DE0C8) -> violet (#8B7CFF) by velocity/glow
vec3 cold = vec3(0.302,0.878,0.784);
vec3 hot  = vec3(0.545,0.486,1.0);
vec3 col  = mix(cold, hot, vGlow);
float a   = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); // round soft point
gl_FragColor = vec4(col, a * (0.25 + vGlow*0.75));
```

Result: a dark grid of dim points that **glows cyan→violet where the cursor passes** and undulates slowly on its own — calm at rest, alive on interaction.

---

## Interaction Design
| Input | Response | Feel |
|-------|----------|------|
| Mouse move | `uMouse` lerps toward pointer; `uMouseForce` eases 0→1 then decays | magnetic, springy |
| Idle | field breathes via `uTime` noise only | ambient, never static |
| Scroll into next section | field parallaxes up & fades to 30% opacity, `pointSize` shrinks | recedes gracefully |
| Click (hero) | brief radial "pulse" ripple through the field | tactile reward |
| Touch (mobile) | `uMouseForce` lower, count reduced | perf-safe |

Pointer → world conversion via raycast onto an invisible plane at z=0, then lerped each frame (`useFrame`) — no jitter.

---

## Performance Strategy (critical to not feel "AI-generated heavy")
1. **Single draw call** — one `Points` mesh, all motion in the vertex shader. No per-particle JS.
2. **Device tiers** via `PerformanceMonitor` + `navigator.hardwareConcurrency`:
   - High: 24k pts, dpr 2, bloom on
   - Mid: 12k pts, dpr 1.5, bloom on
   - Low/mobile: 5k pts, dpr 1, bloom off, flow-line fallback
3. `AdaptiveDpr` drops resolution under load.
4. **Pause `requestAnimationFrame` when tab hidden / hero off-screen** (IntersectionObserver → `frameloop="demand"`).
5. `prefers-reduced-motion`: render one static frame, disable `uTime`/`uMouse` updates.
6. Lazy-load the Canvas (dynamic import, `ssr:false`) behind a lightweight CSS-gradient poster so first paint isn't blocked.

---

## Component Skeleton
```
components/three/
  HeroField.tsx        // <Canvas> wrapper + poster fallback + reduced-motion guard
  ParticleField.tsx    // geometry + ShaderMaterial + useFrame uniforms
  usePointerWorld.ts   // pointer → world coords (lerped)
  useDeviceTier.ts     // returns 'high'|'mid'|'low'
  shaders/
    field.vert.glsl
    field.frag.glsl
  post/PostFX.tsx      // bloom + vignette + grain
```

### HeroField outline (TSX pseudo)
```tsx
const HeroField = () => {
  const reduced = usePrefersReducedMotion();
  const tier = useDeviceTier();
  if (reduced) return <HeroPoster />;      // static image, no WebGL
  return (
    <Canvas frameloop="demand" dpr={[1, tier==='high'?2:1.5]}
            gl={{ antialias:false, alpha:true, powerPreference:'high-performance' }}>
      <AdaptiveDpr pixelated />
      <PerformanceMonitor onDecline={()=>downgrade()} />
      <ParticleField tier={tier} />
      <PostFX enabled={tier!=='low'} />
    </Canvas>
  );
};
```

---

## Secondary 3D touches (small, optional, off on mobile)
- **Project card motifs:** tiny `<Canvas>` per card OR pre-rendered animated canvases (cheaper) themed to each repo (graph, path, field, loop, data).
- **Stack orbit cluster:** slow-rotating instanced tag sprites in a sphere (drei `<Billboard>` + instancing).

Keep total WebGL contexts ≤ 2 (hero + one lazy card at a time) to protect memory.
