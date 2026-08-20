# 04 — Project Card System (real repos)

Each card is a glass slab with a **repo-specific visual motif** so the WORK section feels authored, not templated. Motifs are lightweight (canvas 2D or CSS/SVG; only `GS-Field-Engine` reuses the WebGL field on hover).

## Card anatomy
```
┌───────────────────────────────────────────────┐
│ [ motif animation ]              ● Kotlin  ·4d │  ← lang chip + recency (mono)
│                                                 │
│ CPRecap                                   ↗    │  ← display title + link
│ Competitive-programming recap & stats tooling.  │  ← honest one-liner
│                                                 │
│ #kotlin  #cli  #parsing                         │  ← mono tags
│ ⌐                                           ⌐  │  ← schematic corner brackets on hover
└───────────────────────────────────────────────┘
```

## The five projects

### 1. CPRecap — Kotlin · updated 4d · **large/featured**
- **Blurb:** "Recaps competitive-programming sessions — parses submissions, aggregates verdicts & timing into a clean summary."
- **Motif:** animated **verdict grid** — cells flip AC(cyan)/WA(dim) like a submission heatmap.
- **Tags:** `kotlin` `cli` `parsing` `data`
- **Lang chip:** Kotlin `#A97BFF`

### 2. grabmakan_review — TypeScript · updated 2w
- **Blurb:** "Review/rating tool for food spots — typed data models and a tidy UI over real-world messy data."
- **Motif:** stacked **rating cards** that shuffle; star row fills.
- **Tags:** `typescript` `web` `data-modeling`
- **Lang chip:** TypeScript `#3178C6`

### 3. Tkinter-Graph-Pathfinding — Python · MIT · updated 2w
- **Blurb:** "Interactive pathfinding visualizer (A*/Dijkstra/BFS) on a grid, built with Tkinter."
- **Motif:** live **A\* search** on a mini grid — frontier expands, path traces cyan. (Best motif on the page.)
- **Tags:** `python` `algorithms` `a*` `tkinter`
- **License chip:** `MIT` · **Lang chip:** Python `#3572A5`

### 4. AutoRedeem-RF — JavaScript · updated 2w
- **Blurb:** "Automation script that redeems codes for RF — headless flow, retries, and logging."
- **Motif:** a **loop/pipeline** animation — tokens travel a circuit, tick ✓ per step.
- **Tags:** `javascript` `automation` `scripting`
- **Lang chip:** JavaScript `#F1E05A`

### 5. GS-Field-Engine — Python · **private** · updated Jan 29
- **Blurb:** "A field/simulation engine experiment — vector fields, integration, and rendering."
- **Motif:** **reuses the hero particle field** in miniature on hover (thematic payoff).
- **Tags:** `python` `simulation` `math` `engine`
- **Private handling:** shows `🔒 private` chip + tooltip "code private — happy to walk through it", no dead link. ★ marked as the identity project.
- **Lang chip:** Python `#3572A5`

## Data shape
```ts
type Project = {
  slug: string;
  name: string;
  language: 'Kotlin'|'TypeScript'|'Python'|'JavaScript';
  langColor: string;
  license?: string;      // 'MIT'
  private?: boolean;
  updated: string;       // '4d' | '2w' | 'Jan 29'
  blurb: string;
  tags: string[];
  repo?: string;         // omitted if private
  motif: 'verdictGrid'|'ratingCards'|'astar'|'pipeline'|'field';
  featured?: boolean;
};
```
Store as `content/projects.ts` so copy stays honest and editable in one place.

## Interaction
- Rest: motif idles slowly (or paused until in view).
- Hover: 3D tilt (transform-style preserve-3d, ≤6°), cyan border glow, corner brackets fade in, motif accelerates, `↗` slides.
- Featured card spans 2 cols; grid intentionally uneven (see `02`).
- Keyboard: card is a focusable link; focus ring = cyan; motif also triggers on focus.
