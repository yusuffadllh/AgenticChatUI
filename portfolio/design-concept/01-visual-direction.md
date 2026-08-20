# 01 — Visual Direction

> Codename: **"Terminal Nebula"** — an engineering-minded, dark, glass-and-grid portfolio that reads like a piece of well-crafted software, not a template.

## 0. Design Thesis (Anti-AI-Slop Manifesto)

The projects reveal a builder with an **algorithmic / systems brain**:

| Repo | Signal |
|------|--------|
| `CPRecap` (Kotlin) | Competitive programming → precision, data, structure |
| `grabmakan_review` (TS) | Product/data thinking, real-world tooling |
| `Tkinter-Graph-Pathfinding` (Python) | Graphs, nodes, visual algorithms |
| `AutoRedeem-RF` (JS) | Automation, scripting, pragmatism |
| `GS-Field-Engine` (Python, private) | Simulation / engine work → 3D math, fields |

**The concept leans into the field/graph/engine identity** rather than the generic "purple-gradient dev portfolio". The signature visual is an interactive **vector field of particles** (a nod to `GS-Field-Engine` + pathfinding) instead of the overused floating spheres/blobs.

### The 7 Anti-Slop Rules
1. **No default gradient blobs.** The hero is a deterministic particle *field*, not soft mesh gradients.
2. **No stock "Lorem ipsum energy".** Copy references real algorithms, real repos, real trade-offs.
3. **No perfectly symmetric hero-center layouts.** Use an asymmetric editorial grid.
4. **No generic sans everywhere.** Pair a mono (for data/code) with a distinctive display face.
5. **No emoji-driven section headers.** Use numbered index labels (`01 / ABOUT`) like a technical doc.
6. **No fake glassmorphism (blur + white 10% and done).** Glass gets fine 1px borders, inner light, grain, and noise to feel physical.
7. **Motion has physics & purpose** — spring-based, reacts to cursor/scroll, never decorative auto-loops.

---

## 1. Theme — Dark, Physical Glass

Base is **near-black with a cool cast**, not pure `#000`. Glass panels float above a subtle animated grid + noise so surfaces feel layered and tactile.

- **Mood:** control room / observatory / IDE at 2 AM.
- **Light model:** one implied top-left key light; glass catches a faint highlight on its top edge.
- **Texture:** always-on 3–4% film grain overlay (fights the "flat AI render" look).

---

## 2. Color Palette

Restrained. One dominant accent (signal-cyan) + one warm counter-accent for CTAs. Everything else is neutral graphite.

### Core Neutrals (backgrounds & surfaces)
| Token | Hex | Use |
|-------|-----|-----|
| `--bg-void` | `#07080B` | Page background (bottom of z) |
| `--bg-base` | `#0B0D12` | Main content bg |
| `--bg-raised`| `#11141B` | Cards baseline |
| `--glass-fill` | `rgba(22,26,34,0.55)` | Glass panel fill |
| `--glass-border`| `rgba(140,160,190,0.14)` | 1px glass border |
| `--hairline` | `rgba(140,160,190,0.08)` | Grid lines / dividers |

### Text
| Token | Hex | Use |
|-------|-----|-----|
| `--text-hi` | `#E8ECF4` | Headings |
| `--text-mid`| `#A7B0C0` | Body |
| `--text-lo` | `#5B647A` | Captions, index labels |

### Accents (used <10% of surface)
| Token | Hex | Use |
|-------|-----|-----|
| `--acc-cyan` | `#4DE0C8` | Primary signal — links, particle glow, active |
| `--acc-cyan-deep`| `#1B9E92` | Cyan pressed/shadow |
| `--acc-amber`| `#FFB454` | Secondary — primary CTA, warm highlight |
| `--acc-violet`| `#8B7CFF` | Rare 3rd accent for tags/skill dots |

### Semantic glow
- Particle field: cyan → violet along velocity gradient.
- CTA button: amber fill, cyan focus ring.

> **Contrast note:** `--acc-cyan` on `--bg-base` passes AA for large text/UI. Body copy stays on `--text-mid`/`--text-hi` only.

---

## 3. Typography

Three-voice system: **Display**, **Body**, **Mono**. This pairing is deliberately un-generic.

| Role | Font | Rationale |
|------|------|-----------|
| Display (hero, section titles) | **Clash Display** (or *Space Grotesk* fallback) | Slightly quirky geometric — distinctive, not Inter |
| Body / UI | **Inter** (tight tracking) | Neutral, legible, workhorse |
| Mono (data, code, index labels, tags) | **JetBrains Mono** | Reinforces the engineer identity |

### Type Scale (fluid, clamp-based)
```
--fs-hero     : clamp(3.5rem, 9vw, 8.5rem)   // Clash Display, weight 600, tracking -0.03em
--fs-h1       : clamp(2.25rem, 5vw, 3.75rem)
--fs-h2       : clamp(1.75rem, 3.5vw, 2.5rem)
--fs-h3       : 1.375rem
--fs-body     : 1.0625rem / line-height 1.65
--fs-small    : 0.875rem
--fs-mono-lbl : 0.75rem / letter-spacing 0.18em / uppercase
```

### Treatment
- Section headers use a **mono index + display title**:
  `01 —— ABOUT` (mono, `--text-lo`) above `Systems & Structure` (display, `--text-hi`).
- Numbers/metrics always in **JetBrains Mono** with tabular figures.
- Body max line length: **62ch**.

---

## 4. Spacing, Grid & Radius

- **Grid:** 12-col, `max-width 1240px`, gutter `clamp(16px, 4vw, 40px)`. Content deliberately breaks the grid in hero & projects for editorial asymmetry.
- **Vertical rhythm:** section padding `clamp(96px, 14vh, 180px)`.
- **Radius:** `--r-sm 8px`, `--r-md 16px`, `--r-lg 24px`. Glass cards use `--r-lg`.
- **Border:** always `1px solid --glass-border` + inset top highlight `inset 0 1px 0 rgba(255,255,255,0.06)`.

### Glass recipe (the real one)
```css
.glass {
  background: var(--glass-fill);
  backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),   /* top edge light */
    0 20px 50px -20px rgba(0,0,0,0.7);       /* cast shadow */
  position: relative;
}
.glass::after {           /* grain, fights flatness */
  content:""; position:absolute; inset:0; border-radius:inherit;
  background: url(/noise.png); opacity:.035; mix-blend-mode:overlay;
  pointer-events:none;
}
```

---

## 5. Iconography & Illustration
- **No emoji.** Use a thin (1.5px) line icon set (Lucide) tinted `--text-lo`, cyan on hover.
- Decorative marks: crosshair `+` ticks at grid intersections, corner brackets `⌐ ⌐` on focused cards — reads like a technical schematic.
- Repo cards show the real language color chip + a tiny mono commit-recency label.

---

## 6. Motion Language
See `03-3d-hero-plan.md` and `05-motion-and-tech.md`. In short: **spring physics, cursor-reactive, scroll-driven** — every animation earns its place.
