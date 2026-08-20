# 02 — Layout & Section Sketches

Asymmetric, editorial, technical-doc feel. ASCII wireframes below (desktop first; mobile notes after each). Every section header uses `NN —— TITLE` mono index labels.

Global chrome:
- **Fixed top nav** (glass, thin): left = wordmark `◇ nrl` (monogram), right = `WORK · STACK · CONTACT` + a live mono clock/`STATUS: ONLINE`.
- **Left rail (desktop ≥1200px):** vertical section progress dots + current section index `01/05`.
- **Persistent noise + grid** behind everything.
- **Custom cursor:** small ring that grows and reads `VIEW` / `DRAG` contextually.

---

## HERO — "The Field"

```
┌──────────────────────────────────────────────────────────────┐
│ ◇ nrl                              WORK  STACK  CONTACT  ●LIVE │
│                                                                │
│   ·  ·  ·  ·  ·  ·  [ INTERACTIVE PARTICLE VECTOR FIELD ]  · · │
│  ·  ·  ·  ·  ·  · · · · flows/curls toward cursor · · · · · ·  │
│                                                                │
│   FULLSTACK ENGINEER —— ALGORITHMS · SYSTEMS · TOOLS          │  ← mono kicker
│                                                                │
│   Building   ┐                                                 │
│   determinis-│   ██  <- Clash Display, huge, left-aligned      │
│   tic things │   ██     breaks the 12-col grid                 │
│   from graphs┘                                                 │
│   & fields.                                                     │
│                                                                │
│   [ VIEW WORK → ]   [ resume.pdf ]        scroll ⌄  (01/05)    │
└──────────────────────────────────────────────────────────────┘
```
- **NOT centered.** Headline hugs the left; 3D field owns the full canvas behind + spills right.
- Kicker (mono) + two amber/ghost CTAs.
- Bottom-right: mono scroll hint + section counter.
- **Mobile:** field becomes lighter (fewer particles), headline stacks, CTAs full-width.

---

## 01 — ABOUT — "Systems & Structure"

Two-column asymmetric (5/7 split). Left = short bio + a "now" line; right = a glass "spec sheet" card listing facts like a datasheet.

```
┌──────────────────────────────────────────────────────────────┐
│ 01 —— ABOUT                                                    │
│                                                                │
│  Systems & Structure          ┌─ glass "spec sheet" ───────┐  │
│                               │ LOCATION   ██████           │  │
│  I like problems that have    │ FOCUS      Fullstack · CP   │  │
│  a right answer and messy     │ LANGUAGES  Kotlin·TS·Py·JS  │  │
│  ones that don't. From        │ CURRENTLY  GS-Field-Engine  │  │
│  competitive-programming      │ OPEN TO    freelance/intern │  │
│  recaps to a physics-y        └─────────────────────────────┘  │
│  field engine…                                                 │
│                                                                │
│  ▸ now: <one honest sentence, updated manually>               │
└──────────────────────────────────────────────────────────────┘
```
- Spec-sheet card uses mono labels + tabular values — reinforces engineer identity.
- **Mobile:** stacks; spec sheet below bio.

---

## 02 — WORK — "Selected Builds"

The centerpiece. **Not** a uniform 3-card grid. A **staggered, varied-height list** where each project is a wide glass slab with a mini 3D/canvas motif themed to the repo. Hover parallax-tilts the slab.

```
┌──────────────────────────────────────────────────────────────┐
│ 02 —— WORK                          filter: ALL·KT·TS·PY·JS    │
│                                                                │
│  ┌───────────────────────────────────────────── large ─────┐  │
│  │ [motif: graph nodes]   CPRecap            Kotlin  ·4d    │  │
│  │  Competitive-programming session recap & stats tooling.  │  │
│  │  → tags: Kotlin, CLI, parsing        [ repo ↗ ]          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────┐ ┌───────────────────────────┐   │
│  │ grabmakan_review  TS ·2w │ │ Tkinter-Graph  Py·MIT ·2w │   │
│  │ [motif: cards/data]      │ │ [motif: A* path anim]     │   │
│  └──────────────────────────┘ └───────────────────────────┘   │
│  ┌──────────────────────────┐ ┌───────────────────────────┐   │
│  │ AutoRedeem-RF   JS ·2w   │ │ GS-Field-Engine  Py·priv  │   │
│  │ [motif: automation loop] │ │ [motif: vector field]★    │   │
│  └──────────────────────────┘ └───────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```
Per-card contents:
- Real repo name, **language color chip**, updated-recency in mono (`·4d`).
- One-line honest description + 2–3 tech tags.
- `repo ↗` link (private repo shows a lock + "private" chip, no dead link).
- Themed motif per repo (see `04-project-cards.md`).
- **Hover:** 3D tilt (max 6°), motif animates, cyan border glow.
- **Mobile:** single column, motif shrinks to a header strip.

---

## 03 — STACK — "Toolchain"

Not a wall of logos. A **categorized, honest** stack with proficiency shown as thin mono bars, plus a small orbiting-tags 3D cluster on the side (optional).

```
┌──────────────────────────────────────────────────────────────┐
│ 03 —— STACK                                                    │
│  Toolchain                                                     │
│                                                                │
│  LANGUAGES        FRONTEND        BACKEND / TOOLS              │
│  Kotlin  ███████  React ██████    Node ██████                 │
│  TypeScript █████ Three.js ████   Python ███████              │
│  Python  ███████  Tailwind █████  Git/CI ██████               │
│  JavaScript ████                  SQLite ████                 │
│                                                                │
│         ( optional: slow-orbiting tag cluster in 3D )         │
└──────────────────────────────────────────────────────────────┘
```
- Bars are honest (no all-100% slop). Mono % optional.
- Category headers in mono `--text-lo`.
- **Mobile:** categories stack; drop the 3D cluster.

---

## 04 — CONTACT — "Open a Connection"

Terminal-flavored, warm. Big display line + a fake-but-functional prompt line and social links.

```
┌──────────────────────────────────────────────────────────────┐
│ 04 —— CONTACT                                                  │
│                                                                │
│   Let's build              ┌ glass terminal card ───────────┐ │
│   something                │ $ mail --to nrl                 │ │
│   deterministic. ██        │ > [ your@email ]                │ │
│                            │ > [ message…            ]       │ │
│   (amber accent)           │   [ SEND ▸ ]     status: idle   │ │
│                            └─────────────────────────────────┘ │
│                                                                │
│   GitHub ↗   ·   Email ↗   ·   LinkedIn ↗                     │
│  ── footer: © nrl · built with R3F + Next · view source ↗ ── │
└──────────────────────────────────────────────────────────────┘
```
- Form styled like a shell; success prints `> message queued ✓` in cyan.
- Footer is mono, quiet, honest ("built with…"), links to repo of the site itself.
- **Mobile:** stacks, terminal card full-width.

---

## Responsive Summary
| Breakpoint | Behavior |
|-----------|----------|
| `≥1200px` | Full: left rail, full particle field, tilt cards, 3D clusters |
| `768–1199px` | Drop left rail, reduce particle count ~40%, keep tilt |
| `<768px` | Static/low particle field, single-column, no tilt, no orbit cluster |
| `prefers-reduced-motion` | Field freezes to a still frame; springs → instant |
