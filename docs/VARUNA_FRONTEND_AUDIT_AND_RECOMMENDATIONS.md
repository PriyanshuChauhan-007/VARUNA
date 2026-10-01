# VARUNA Frontend Architecture & UX Comprehensive Audit
**Repository:** `varuna-frontend` · **Branch:** `integration/real-science-ui` · **Commit:** `33753e8`  
**Evaluation Scope:** Complete Frontend Suite, Scientific Integrity, Information Architecture, and Motion System  
**Audit Status:** Review & Recommendation Phase (Strict Read-Only Mode — Zero Code Modifications)

---

## 1. Executive Diagnosis

### What is Currently Strong
1. **Authoritative Scientific Core:** The consolidation of the expert Python backend (`varuna-backend/`) provides a genuine, defensible machine-learning architecture. The XGBoost meta-model predicting contextual error $|\hat{y}_m - y|$, the Hamilton-Hare largest-remainder normalization, and the held-out test benchmark ($0.7803\text{ }^\circ\text{C}$ RMSE, $N=4,512$) give VARUNA authentic scientific authority that generic hackathon dashboards lack.
2. **Deep Technical Breadth:** Unlike superficial meteorological demos, VARUNA includes specialized operational views: a geospatial situational map (`CommandCentre.jsx`), multi-horizon member comparison (`Forecast.jsx`), dynamical-core model benchmarking (`Models.jsx`), empirical verification curves (`Skill.jsx`), IMD-calibrated hazard thresholds (`Extremes.jsx`), SHAP/feature attribution (`Explainability.jsx`), and live ingestion telemetry (`SystemHealth.jsx`).
3. **Robust Engineering Plumbing:** The project features a resilient tripartite data mode architecture (`LIVE`, `CACHED`, `REPLAY`), active MapLibre GL mapping with India-centric projections, a reactive Zustand state store, and 126 automated tests across backend pytest, verification harnesses, and frontend scientific audit suites.

### What Genuinely Needs Improvement
1. **Visual Language Borrowing & Remnants:** Comments and visual styling across the codebase explicitly reference *"matching THERMOS"* (e.g., [`CommandCentre.jsx:148`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/CommandCentre.jsx#L148), [`Extremes.jsx:77`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Extremes.jsx#L77), [`ForecastDetailDrawer.jsx:32`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/shared/ForecastDetailDrawer.jsx#L32), [`Sidebar.jsx:89`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/layout/Sidebar.jsx#L89)). The warm cream/yellow palette (`#F5C518`), pill styles, and layout dimensions are largely inherited from the wildfire/thermal disaster tool (THERMOS) rather than expressing an atmospheric fluid dynamics identity.
2. **Disconnected Static Data Islands:** While `Forecast.jsx` was successfully wired to `/api/forecast`, other core pages (`Skill.jsx`, `Models.jsx`, `Explainability.jsx`, and `Extremes.jsx`) still read from static mock files ([`verified_science_data.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/verified_science_data.js) and [`mockData.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js)) containing outdated pre-integration metrics ($0.8674\text{ }^\circ\text{C}$ instead of $0.7803\text{ }^\circ\text{C}$; $1.0613\text{ }^\circ\text{C}$ instead of $1.195\text{ }^\circ\text{C}$).
3. **Information Density Without Visual Rhythm:** Certain operational pages (notably `CommandCentre` and `Forecast`) suffer from vertical crowding and repetitive data tables without smooth progressive disclosure. Dense tabular metrics often compete with graphical trends rather than supporting them.
4. **Motion Deficit:** Despite having `framer-motion` installed, the user experience is largely static. Page transitions are restricted to a subtle 4px fade, section transitions lack scroll-linked entrance telemetry, and model weight distributions appear instantaneously rather than animating smoothly to illustrate convergence.

---

## 2. Current VARUNA Information Inventory

| Route / Page | File | Primary Information Communicated | Data Source |
| :--- | :--- | :--- | :--- |
| **Landing** (`/`) | [`Landing.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Landing.jsx) | 10-section narrative: 4-member ensemble intro, NWP limitation explanation, end-to-end pipeline, interactive Hamilton-Hare weight simulator, held-out verification table, 12 regional monitoring grids, operational data modes, platform tour, scientific boundaries. | In-memory verified constants + client-side Hamilton-Hare engine |
| **Command Centre** (`/command-centre`) | [`CommandCentre.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/CommandCentre.jsx) | Geospatial situational map of India with regional marker bubbles, lead time selector (24h–120h), alert level classification, operational watchlist sidebar, category filters (Severe, Rainfall, Heat, Coastal). | [`useStore.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/store/useStore.js) $\rightarrow$ [`mockData.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js) (`getDeterministicForecast`) |
| **Forecast Workspace** (`/forecast`) | [`Forecast.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Forecast.jsx) | Multi-model member comparison (IFS, AIFS, GFS, ICON vs. VARUNA Blend), 168h forecast timeseries chart, adaptive vs. equal-weight allocation, why-this-blend rationale, fallback/live status banner. | **Live API:** `/api/forecast` via [`fetchForecast`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/services/api.js#L99) (with deterministic fallback) |
| **Models Benchmark** (`/models`) | [`Models.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Models.jsx) | Technical profiles of the 4 ensemble members + VARUNA Blend: resolution, dynamical core, update cycle, empirical RMSE/MAE/Bias/Correlation table, regional regime skill bar charts. | [`mockData.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js) + [`scientific_reports.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/scientific_reports.js) |
| **Verification Skill** (`/skill`) | [`Skill.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Skill.jsx) | Statistical verification against ERA5 reanalysis: headline RMSE reduction, lead-time error degradation curves (24h–120h), 4-season skill matrices, 6 synoptic zone comparisons. | [`scientific_reports.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/scientific_reports.js) $\rightarrow$ [`verified_science_data.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/verified_science_data.js) (Stale pre-integration data) |
| **Extremes Watch** (`/extremes`) | [`Extremes.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Extremes.jsx) | Operational hazard triage queue sorted by IMD alert criteria: Heavy Rainfall ($\ge 64.5\text{ mm}$), Severe Heatwave ($\ge 43\text{ }^\circ\text{C}$), Coastal Squalls ($\ge 55\text{ km/h}$). Severity and category filters. | Static [`EXTREMES_DATA`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js#L418) in `mockData.js` |
| **Explainability** (`/explainability`) | [`Explainability.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Explainability.jsx) | Decision attribution for adaptive weights: regional regime context, atmospheric instability metrics, feature contribution bars, inverse-variance weight conversion explanation. | Static `whyThisBlend` object in [`mockData.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js#L351) |
| **System Health** (`/system`) | [`SystemHealth.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/SystemHealth.jsx) | Ingestion pipeline diagnostics: Open-Meteo gateway probes, SQLite cache integrity, provider cycle timestamps, active ensemble member table, data mode switcher (`LIVE`, `REPLAY`, `DEMO`). | Live `/api/providers/status` in LIVE mode + static feed catalog fallback |

---

## 3. `/priority` Reference Site Analysis

**Inspected URL:** `https://sih-2026-nu-ten.vercel.app/priority`  
**Bundle Inspected:** `priority_bundle.js` (`index-CHBF6iL3.js`, 2.1 MB) · Route component: `kCe`

### Information Architecture & Communication
* **Hero/Header:** Minimal operational header displaying total active triage events (`u.length` logged) with immediate high-level triage reset controls.
* **Information Structure:** Split-view layout featuring a 280px left filter rail (`aside`) and a scrollable incident queue (`flex-1`) grouped hierarchically by operational risk tiers: **Critical**, **High**, **Moderate**, and **Low**.
* **Visual vs. Textual Balance:** Information is presented via compact badge chips, colored status indicators (Critical: `#DC2626`, High: `#EA580C`, Moderate: `#D97706`), risk score meters, and short two-line operational tags rather than narrative paragraphs.
* **Deferred Information:** Technical satellite telemetry (sensor overpass times, FRP milliwatts, pixel coordinates) is tucked inside expandable event cards or secondary drawer overlays, preventing initial cognitive overload.

### Design Patterns Observed
* **Tight Spatial Discipline:** Form controls use 8px spacing scales (`gap-2.5`, `py-1.5`, `px-3`), compact typography (`text-scale-xs`), and tabular numeric figures (`font-data tabular-nums`).
* **Active State Clarity:** Selected filters use solid yellow/black high-contrast fills (`bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs`), while unselected filters use subtle muted borders (`border-[var(--color-border)]`).
* **Instant Visual Grouping:** Incidents are categorized by risk level, giving an emergency operator an immediate sense of urgency.

### Design Principles Worth Borrowing for VARUNA
1. **Operational Triage Hierarchy:** Grouping complex regional weather outputs by meteorological urgency (e.g., Extreme Alert $\rightarrow$ High Advisory $\rightarrow$ Nominal Monitored) makes dense data instantly scannable for operational decision-makers.
2. **Compact Rail Filtering:** A dedicated 260px–280px filter sidebar with smooth range sliders, instant pill toggles, and live item counters provides seamless interaction without pushing primary data below the fold.

### What VARUNA Must Deliberately Do Differently
* **Do NOT Copy Fire/Disaster Semantics:** `/priority` is designed for discrete point-source disaster events (thermal hotspots, fire radiative power). Weather forecasting involves continuous spatio-temporal fields, fluid multi-lead degradation curves, and ensemble disagreement bands.
* **Do NOT Clone the Visual Palette:** `/priority` uses THERMOS's trademark `#F5C518` yellow accent and `#E8E2D4` warm cream borders. VARUNA must establish an atmospheric meteorological aesthetic.

---

## 4. THERMOS Reference Analysis

**Inspected Assets:** `references/Screenshot 2026-09-26 113834.png` through `113926.png`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ THERMOS SCREENSHOT AUDIT (Visual Rhythm & Information Density)              │
├────────────────────────────────┬────────────────────────────────────────────┤
│ Screenshot 1: Landing Hero     │ Huge bold display typography ("From signal │
│                                │ to decisive action"), 3D orbital globe,    │
│                                │ floating tactical incident card.           │
├────────────────────────────────┼────────────────────────────────────────────┤
│ Screenshot 2: Multi-Sensor     │ 3-column metric cards with giant figures   │
│ Ingestion                      │ (375m, 5 Sensors, <60s) and minimal text.  │
├────────────────────────────────┼────────────────────────────────────────────┤
│ Screenshot 3: Explainability   │ Headline ("A heat pixel is not an answer"), │
│ Evidence                       │ interactive pill tabs, progress bars.      │
├────────────────────────────────┼────────────────────────────────────────────┤
│ Screenshot 4: Dashboard Map    │ Satellite GIS map, timeline scrubber (24H/ │
│                                │ 7D/30D), priority sidebar, coordinate HUD. │
├────────────────────────────────┼────────────────────────────────────────────┤
│ Screenshot 5 & 6: Analytics    │ Diurnal cycle line charts, persistence bar  │
│                                │ charts, multi-category rate comparisons.   │
├────────────────────────────────┼────────────────────────────────────────────┤
│ Screenshot 7: Intelligence     │ Sensor constellation tabular feed with     │
│                                │ live pulse dots and cluster vulnerability. │
└────────────────────────────────┴────────────────────────────────────────────┘
```

### Key Principles Observed
1. **Bold Technical Storytelling:** The landing page opens with a high-conviction problem statement rather than a feature list.
2. **Data-Card Framing:** Complex data is broken into scannable cards featuring monospace headers, uppercase micro-labels, and high-contrast numerical readouts.
3. **Structured Telemetry Strips:** Operational metadata (satellites active, ground resolution, latency) is displayed in a compact, three-to-four item horizontal strip directly below primary callouts.

### What VARUNA Must Avoid Copying
* **No Direct Copying of Layout Structure:** The current VARUNA repository previously borrowed THERMOS card arrangements directly (e.g., the 3-column metric card layout and exact floating card positioning).
* **No Artificial Satellite Mechanics:** THERMOS focuses on low-Earth orbit passes, infrared sensors, and orbital tracks. VARUNA's domain is atmospheric thermodynamics, numerical weather prediction grids, and machine learning error attenuation.
* **No Re-use of THERMOS Taglines or Tone:** Headlines like *"A heat pixel is not an answer"* or *"From signal to decisive action"* belong to THERMOS. VARUNA's language must center on atmospheric uncertainty: *"From competing forecasts to one adaptive forecast"* and *"Taming model disagreement across tropical regimes"*.

---

## 5. Direct VARUNA vs. References Comparison

| Dimension | Current VARUNA Implementation | `/priority` Reference Site | THERMOS Reference System | VARUNA Strategic Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Section** | Text-heavy 10-section page; 4 member cards; clear facts, but lacks dynamic visual convergence. | Compact header; instant triage count; no marketing landing page. | Bold headline; 3D orbital globe graphic; floating tactical card. | **Atmospheric Fluid Convergence Hero:** Dynamic SVG/CSS particle stream showing 4 model vectors uniting into a single calibrated trajectory. |
| **Information Density** | High, but occasionally cluttered; duplicate tables and unformatted JSON objects. | High operational density; compact 8px padding; strictly grouped lists. | High density balanced by generous section breathing room (80px–120px padding). | **Structured Scientific Hierarchy:** High-density data tables preserved in expandable/tabbed drawers; uncluttered primary dashboards. |
| **Storytelling** | Highly detailed written technical prose; can feel like reading documentation. | Minimal text; strictly functional action-oriented triage workflow. | Progressive narrative: Signal $\rightarrow$ Detection $\rightarrow$ Classification $\rightarrow$ Action. | **Visual Pipeline Storytelling:** Interactive flow diagrams with real-time state changes illustrating the error prediction mechanism. |
| **Technical Depth** | High (XGBoost meta-model, Hamilton-Hare normalization, ERA5 benchmark). | Focused on ML classification confidence and spatial buffer calculations. | Deep multi-sensor orbital physics and spatial GIS vector intersections. | **Auditable Mathematical Transparency:** Emphasize the mathematical proof of error-weighted consensus and held-out empirical verification. |
| **Visual Hierarchy** | Sometimes flat; cards and background blend together; borders can feel heavy. | Clear two-pane hierarchy: Left filter rail $\rightarrow$ Right prioritized feed. | Distinct tiered depth: Deep surface $\rightarrow$ White panels $\rightarrow$ Floating overlays. | **Layered Atmospheric Elevation:** Deep navy/slate panels with crisp borders (`#1E293B` to `#334155`), glassmorphic overlays, and gold accenting. |
| **Data Visualization** | Standard Recharts lines and bars; static curves on several pages. | Bar charts, line timelines, GIS markers, horizontal risk score meters. | Clean custom SVG charts, diurnal solar curves, multi-category step lines. | **Multi-Model Disagreement Bands:** Shaded spread ribbons between IFS, AIFS, GFS, and ICON showing ensemble uncertainty narrowing into VARUNA Blend. |
| **Typography** | Inter + JetBrains Mono; good modular scale, but inconsistent font weights. | Inter + JetBrains Mono; heavily utilizes tabular figures (`font-data`). | Inter headings + monospace metadata tags and coordinates. | **Scientific Monospace Integration:** JetBrains Mono for all physical units, coordinates, and error values; bold clean grotesque sans-serif for headings. |
| **Color System** | Warm cream light theme (`#FAFAF8`), warm yellow accent (`#F5C518`), grey borders. | Yellow/Black high-contrast triage theme (`#F5C518`, `#1A1A17`). | Warm industrial amber/yellow accent with crisp clean white panels. | **Barometric Deep Slate & Electric Amber:** Midnight slate background (`#0B111E`), deep cobalt secondary, electric amber/gold accent (`#F59E0B`), and model-specific signature hues. |
| **Cards & Panels** | Heavy borders (`#E8E5DE`); occasional hardcoded height limits. | Bordered white cards with colored left-tier accent stripes. | Rounded cards (`rounded-2xl`) with subtle soft drop-shadows. | **Framed Instrument Modules:** Subtle border glows, inset telemetry headers, and clean micro-status pills. |
| **Navigation** | Sticky top bar on Landing; 72px left icon rail on internal application pages. | 280px left filter sidebar + compact top utility bar. | Compact top bar with live status pill + left desktop navigation rail. | **Unified Scientific Command Bar:** Preserve left icon rail on internal pages; add breadcrumb context and quick-lead switcher. |
| **Animations** | Minor 4px route transitions in `AppLayout`; static page scrolling. | Fast micro-interactions on hover and filter toggle. | Smooth entrance reveals, rotating globe, animated pulse markers. | **Scroll-Triggered Model Telemetry:** Framer Motion staggered reveals, converging pipeline vectors, and live weight bar transitions. |
| **Responsive UX** | Basic mobile view toggle on CommandCentre; horizontal table overflow on small screens. | Collapsible mobile filter drawer (`max-h-[60vh]`) with toggle button. | Responsive stacking; hides non-essential satellite telemetry on mobile. | **Mobile Drawer Hierarchy:** Map-first mobile view with swipeable bottom sheets for regional watchlist cards. |

---

## 6. Distinct VARUNA Visual Identity System

To permanently detach VARUNA from the wildfire-detection aesthetic of THERMOS and the generic blue tones of standard weather apps, the visual identity must reflect **atmospheric fluid dynamics, barometric pressure fields, and high-altitude computational forecasting**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ VARUNA DESIGN TOKEN SYSTEM                                                      │
├───────────────────────┬─────────────────────────────────────────────────────────┤
│ Atmospheric Slate     │ #0B111E (Surface Deep) · #111C2E (Surface Panel)        │
│ Barometric Gradient   │ linear-gradient(135deg, #0B111E 0%, #162238 100%)       │
│ Electric Amber Accent │ #F59E0B (Accent Primary) · #D97706 (Accent Hover)       │
│ Model Identity Hues   │ IFS: #3B82F6 (Blue)   · AIFS: #8B5CF6 (Purple)          │
│                       │ GFS: #10B981 (Emerald)· ICON: #F59E0B (Amber)           │
│                       │ VARUNA Blend: #EC4899 (Rose) / Gold Consensus           │
│ Metric Typography     │ 'JetBrains Mono', monospace (tabular figures)           │
│ Display Typography    │ 'Inter', -apple-system, sans-serif (800 weight)         │
└───────────────────────┴─────────────────────────────────────────────────────────┘
```

### Color Architecture
* **Canvas / Background:** Deep Atmospheric Navy (`#0B111E` in dark mode, `#F8FAFC` in light mode). Represents tropospheric depth.
* **Surface Panels:** Stratified Slate (`#111C2E` dark, `#FFFFFF` light) with subtle 1px border contrast (`#1E293B` dark, `#E2E8F0` light).
* **Primary Accent:** Solar Ion Amber (`#F59E0B`), symbolizing calibrated predictive clarity amid storm darkness.
* **Ensemble Member Signatures (Fixed across all charts and chips):**
  * **ECMWF IFS:** Cobalt Blue (`#3B82F6` / `#2563EB`) — Represents classical hydrostatic physics.
  * **ECMWF AIFS:** Neural Violet (`#8B5CF6` / `#7C3AED`) — Represents deep learning spherical transformers.
  * **NOAA GFS:** Terrestrial Emerald (`#10B981` / `#059669`) — Represents operational FV3 dynamical cores.
  * **DWD ICON:** Warm Ochre (`#F59E0B` / `#D97706`) — Represents icosahedral triangular terrain modeling.
  * **VARUNA Blend:** Radiant Multi-Spectral Gold (`#EAB308` with subtle glow) — The calibrated consensus.

### Typography
* **Display / Headings:** `Inter` (Font weights: 700, 800) with tight tracking (`-0.025em`) and compact line heights (`1.15`).
* **Body Text:** `Inter` (Font weights: 400, 500) with relaxed readability (`1.55` line height).
* **Telemetry, Metrics & Coordinates:** `JetBrains Mono` with tabular numeral settings (`font-variant-numeric: tabular-nums`). All errors, weights, coordinates, and timestamps must use this typeface.

### Component Design Guidelines
* **Model Identification Chips:** Compact pill badges containing model shortcode, spatial resolution, and member color dot (e.g., `● IFS · 9km`).
* **Ensemble Spread Bars:** Horizontal progress bars showing relative member weights, with animated width transitions and Hamilton-Hare integer tags.
* **Data Cards:** Technical borders with 12px corner radii (`rounded-xl`), inset monospace subheaders, and zero decorative drop-shadow clutter.

---

## 7. Homepage Structure & Storytelling Plan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RECOMMENDED HOMEPAGE INFORMATION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Hero: Core Thesis & Convergence Visualization                            │
│    "From competing forecasts to one adaptive forecast."                     │
│    Visual: Animated 4-model vector convergence into unified blend.          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. The Meteorological Dilemma (The Problem)                                 │
│    Why single NWP models fail in complex tropical regimes.                  │
│    Visual: Disagreement ribbon showing GFS warm bias vs IFS rain phase lag. │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. The 6-Stage Scientific Engine (How VARUNA Works)                         │
│    Ingestion → Spatiotemporal Alignment → Context → XGBoost →               │
│    Hamilton-Hare → Verification.                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Adaptive Weighting Simulator (Interactive Demonstration)                 │
│    Live interactive slider showing: Lower Predicted Error → Higher Weight.  │
│    Mathematical proof of zero remainder drift via Hamilton-Hare.           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. Empirical Verification Evidence (Held-Out Benchmark)                     │
│    Headline: 0.7803 °C Held-Out RMSE (N=4,512, ERA5 Reanalysis Reference). │
│    Comparative accuracy table (IFS, AIFS, GFS, ICON, Equal, VARUNA).        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. Geographic Scope & 12 Regional Grids                                     │
│    Visual distinction: 6 Benchmarked Zones vs 6 Active Regional Grids.      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. Operational Provenance & Modes                                           │
│    Transparent distinction between LIVE, CACHED, and REPLAY modes.          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 8. Platform Capabilities & Workspace Tour                                   │
│    Direct operational links into Command Centre, Forecast, Models, Skill.   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 9. Scientific Boundaries & Professional Disclosures                         │
│    Transparent disclosures: Temperature-only ML, 168h cap, IMD AWS pending.│
├─────────────────────────────────────────────────────────────────────────────┤
│ 10. Operational Summary & Call to Action                                    │
│    "Four forecast systems. One adaptive synthesis."                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Homepage Content Mapping

```
CURRENT CONTENT ELEMENT           ACTION     TARGET SECTION / RATIONALE
───────────────────────────────────────────────────────────────────────────────────────
Hero Headline & Subtitle          KEEP       Section 1: Retain current strong thesis statement.
4 Member Model Profile Cards      REWORK     Section 1: Redesign from plain text cards into
                                             compact technical telemetry chips with model badges.
Stale Latency & Confidence Tags   REMOVE     Section 1: Eliminate hardcoded "14.2ms" and "95%".
Problem Statement (Simple Mean)   KEEP       Section 2: Preserves essential explanation of why
                                             unweighted averaging propagates systematic error.
6-Step Architectural Pipeline     KEEP       Section 3: Keep 6 stages; upgrade visual flow with
                                             staggered Framer Motion connection lines.
Interactive Weight Simulator      KEEP       Section 4: High-value interactive element demonstrating
                                             live Hamilton-Hare largest-remainder normalization.
Held-Out Benchmark Table          KEEP       Section 5: Retain authentic held-out RMSE (0.7803 °C),
                                             MAE, Bias, and Pearson r from blend_test_results.csv.
12 Regional Monitoring Grid       KEEP       Section 6: Preserves 6 benchmarked vs 6 active regional
                                             grid honesty with filter tabs.
Operational Data Modes Card       KEEP       Section 7: Transparently documents LIVE, CACHED, REPLAY.
7 Dashboard Module Cards          REWORK     Section 8: Condense from verbose cards into crisp,
                                             scannable workspace links with live micro-previews.
Scientific Boundary Disclosures   KEEP       Section 9: Mandatory scientific honesty block.
Final Call to Action Buttons      KEEP       Section 10: Retain direct routes to /command-centre.
```

---

## 9. Homepage Information Density: Above, Middle, Below the Fold

```
VIEWPORT LEVEL         TARGET AUDIENCE & TIME    CONTENT TO DISPLAY (ZERO MARKETING FLUFF)
───────────────────────────────────────────────────────────────────────────────────────
ABOVE THE FOLD         First-Time Evaluator      • Primary thesis statement (Under 20 words)
(0px – 800px)          (0 to 20 seconds)         • 4 Ensemble Member identities (IFS, AIFS, GFS, ICON)
                                                 • Headline held-out metric: 0.7803 °C RMSE (vs ERA5)
                                                 • Primary CTA to Command Centre & Pipeline anchor
                                                 • Visual: Multi-model convergence telemetry visual

MIDDLE OF THE PAGE     Meteorologist / Judge     • The Problem: Model disagreement in Indian regimes
(800px – 2400px)       (20 to 60 seconds)        • 6-Stage Data Pipeline (Ingestion to Consensus)
                                                 • Interactive Weighting Simulator (Hamilton-Hare)
                                                 • Real-time error adjustment demonstrating adaptivity

LOWER SECTIONS         Technical Reviewer        • Full Held-Out Verification Table (N=4,512)
(2400px – 4200px)      (In-Depth Verification)   • 12 Regional Grids (6 Benchmarked vs 6 Operational)
                                                 • Data Modes Provenance (LIVE / CACHED / REPLAY)
                                                 • Workspace Tour linking to 7 application screens
                                                 • Scientific Boundaries & Disclosures Block
```

---

## 10. Concrete Visual Asset Plan

```
ASSET CODE   ASSET CONCEPT & DESCRIPTION                   LOCATION / PLACEMENT     FORMAT & IMPLEMENTATION   MOTION & BEHAVIOR
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
ASSET-A      Multi-Model Convergence Graphic:             Hero Section             SVG + Framer Motion       4 colored streams enter from
             4 distinct colored lines (IFS blue, AIFS     (Right side of headline) (Client-side, fast)       left, fluctuate with phase lag,
             purple, GFS green, ICON amber) converging                                                       and merge into a single golden
             into a tight golden VARUNA blend line.                                                          calibrated forecast beam.

ASSET-B      Atmospheric Regime Cross-Section:            The Problem Section      Animated SVG + CSS        Air mass moving over Western
             Diagram illustrating orographic lift over                             (Client-side vector)      Ghats escarpment showing where
             coastal escarpment, showing where GFS                                                           individual models diverge.
             over-precipitates vs AIFS terrain tracking.

ASSET-C      Pipeline Dataflow Telemetry Ribbon:          How VARUNA Works         Framer Motion SVG Path    Pulsing light packet travels
             A horizontal/vertical connective bus linking                          (Lightweight vector)      through the 6 stages as user
             the 6 processing cards.                                                                         scrolls past the section.

ASSET-D      Hamilton-Hare Normalization Visualizer:      Adaptive Weighting       Interactive React + CSS   Live bar graph dynamically
             Real-time re-allocating progress bars        Simulator Section        (Already coded in JS)     rebalancing integer weights to
             showing quota floors and remainder ranking.                                                     guarantee exactly 100% sum.

ASSET-E      Ensemble Spread vs. Error Ribbon:            Verification Section     Recharts AreaChart / SVG  Historical error distribution
             Shaded disagreement band around ensemble                              (Client-side render)      ribbon comparing raw member
             mean showing how VARUNA blend narrows spread.                                                   spread against VARUNA blend.

ASSET-F      12-Zone Regional Radar Grid:                 Regional Coverage        Interactive SVG Map Tile  India regional map highlighting
             Geographic plot of the 12 monitoring zones                            (Vector MapLibre/SVG)     the 6 benchmarked centroids
             with status pulses (green = validated).                                                         vs 6 active regional nodes.

ASSET-G      Operational Mode State Machine:              Data Modes Section       CSS Grid + Pulse SVGs     Active path illuminates green
             Interactive state diagram illustrating                                                          for LIVE gateway, amber for
             LIVE gateway $\rightarrow$ SQLite Cache $\rightarrow$ REPLAY.                                    TTL CACHED, blue for REPLAY.
```

*SIH Feasibility Note:* Assets A, C, D, F, and G can be built directly in code using existing SVG and Framer Motion primitives without waiting for external design renders or large video assets.

---

## 11. Scroll & Animation System

### Existing Architecture & Dependency Selection
* **Library to Use:** `framer-motion` (already installed at `^13.4.4` in [`package.json`](file:///c:/Users/prakh/Desktop/varuna-frontend/package.json#L15)).  
* **Rule:** Do NOT install GSAP, Locomotive Scroll, or Three.js. Framer Motion is fully integrated into `AppLayout.jsx` and provides native scroll hooks (`useScroll`, `useTransform`, `useInView`).

### Motion Specifications
* **Section Entrances:** Subtle vertical slide and opacity reveal (`initial={{ opacity: 0, y: 16 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, margin: "-80px" }}`, `transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}`).
* **Staggered Cards:** Stagger child components by `0.06s` to produce a crisp, telemetry-like loading rhythm.
* **Metric Counter Rolls:** Smooth numeric counters for held-out RMSE ($0.7803$) and sample count ($4,512$) upon first scroll into view.
* **Reduced Motion Compliance:** Respect user preferences via `useReducedMotion()`. If reduced motion is requested, instantly render final states with zero positional offset.

---

## 12. Full Site Page-by-Page Audit

### 1. Landing Page (`Landing.jsx`)
* **Status:** `IMPROVE`
* **Evidence:** CODE + LIVE UI
* **Source:** [`src/pages/Landing.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Landing.jsx)
* **Observed:** 10 sections successfully communicate truthful architecture and benchmark numbers, but the page is visually static and lacks fluid entry animations.
* **Keep:** The 10-section structure, Hamilton-Hare interactive simulator, and empirical verification table.
* **Improve:** Replace static text cards with compact model chips; integrate Asset-A convergence vector animation in the hero; add Framer Motion staggered reveals.
* **Fix:** Ensure mobile navigation menu closes cleanly on anchor click.
* **Optional:** Add smooth scroll-spy active state highlighting in the top navbar.

### 2. Command Centre (`CommandCentre.jsx`)
* **Status:** `IMPROVE`
* **Evidence:** CODE + LIVE UI
* **Source:** [`src/pages/CommandCentre.jsx:148`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/CommandCentre.jsx#L148)
* **Observed:** Layout directly mirrors THERMOS with hardcoded references (`matching THERMOS`). Right-hand operational watchlist computes fallback reduction averages (`-24.8%`) from static mock data.
* **Keep:** MapLibre GIS integration, regional marker bubbles, lead-time pills (24h–120h), and risk-tier sorting.
* **Improve:** Give the operational watchlist a clean meteorological identity; group regional cards by agro-climatic zones rather than generic hazard pills.
* **Fix:** Update hardcoded model reduction formula ([`CommandCentre.jsx:64`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/CommandCentre.jsx#L64)) to reflect verified benchmark performance.
* **Optional:** Add mini weather radar precipitation layer toggle.

### 3. Forecast Workspace (`Forecast.jsx`)
* **Status:** `IMPROVE`
* **Evidence:** CODE + BACKEND
* **Source:** [`src/pages/Forecast.jsx`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Forecast.jsx)
* **Observed:** Successfully wired to `/api/forecast` with truthful variable-specific semantics (temperature adaptive vs. non-temperature equal blend). However, the page is very long (622 lines) and charts can feel crowded on smaller screens.
* **Keep:** Live `/api/forecast` integration, 4-member weight comparison, 168h forecast timeseries, and fallback notice banner.
* **Improve:** Implement tabbed sub-views: `Consensus Overview` | `Ensemble Member Disagreement` | `7-Day Detailed Timeline`.
* **Fix:** Correct horizon selector so clicking `7d` cleanly scrolls to or highlights the full 168h timeline.
* **Optional:** Add an ensemble spread area band behind the individual member lines.

### 4. Models Benchmark (`Models.jsx`)
* **Status:** `FIX`
* **Evidence:** CODE + DATA
* **Source:** [`src/pages/Models.jsx:28-89`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Models.jsx#L28-L89), [`src/data/mockData.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js)
* **Observed:** Table displays model statistics computed from static mock data rather than fetching real model skill benchmarks from `/api/skill`.
* **Keep:** Comprehensive 5-member comparison (IFS, AIFS, GFS, ICON, VARUNA Blend) and dynamical-core specification cards.
* **Improve:** Show real empirical verification breakdown across different synoptic regimes.
* **Fix:** Connect table to `/api/skill` or authoritative `blend_test_results.csv` data so RMSE reads $1.195$ (IFS), $1.105$ (AIFS), $2.320$ (GFS), $1.131$ (ICON), and $0.780$ (VARUNA).
* **Optional:** Add visual grid resolution schematics (9km vs 13km vs 28km).

### 5. Verification Skill (`Skill.jsx`)
* **Status:** `FIX`
* **Evidence:** CODE + BACKEND
* **Source:** [`src/pages/Skill.jsx:40`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Skill.jsx#L40), [`src/data/scientific_reports.js`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/scientific_reports.js)
* **Observed:** Reads static `verified_science_data.js` displaying outdated pre-integration numbers ($0.8674\text{ }^\circ\text{C}$ RMSE, $1.0613\text{ }^\circ\text{C}$ IFS, $18.3\%$ reduction) instead of current consolidated results ($0.7803\text{ }^\circ\text{C}$, $1.195\text{ }^\circ\text{C}$, $34.7\%$ reduction).
* **Keep:** Full multi-dimensional verification view: By Lead Time, By Season, By Region, and all existing Recharts graphs.
* **Improve:** Make sample sizes ($N$) visually prominent on every sub-chart.
* **Fix:** Wire component to `/api/skill` (with offline fallback to updated report constants matching `blend_test_results.csv`).
* **Optional:** Add interactive lead-time degradation curve comparison toggle.

### 6. Extremes Watch (`Extremes.jsx`)
* **Status:** `FIX`
* **Evidence:** CODE + DATA
* **Source:** [`src/pages/Extremes.jsx:3`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Extremes.jsx#L3), [`src/data/mockData.js:418`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js#L418)
* **Observed:** Hardcoded `EXTREMES_DATA` array contains stale demo claims ("95% confidence", "94.2 mm alert"). Backend `/api/extremes` endpoint exists but is not consumed.
* **Keep:** Triage sidebar filtering by severity and category; IMD meteorological threshold criteria.
* **Improve:** Replace static cards with live region alert evaluations derived from `/api/extremes` or current regional forecasts.
* **Fix:** Eliminate fabricated confidence percentages (95%, 96%, 91%) and replace with actual model agreement metrics.
* **Optional:** Add geographical link to zoom directly to the alerted region on the Command Centre map.

### 7. Explainability (`Explainability.jsx`)
* **Status:** `FIX`
* **Evidence:** CODE + BACKEND
* **Source:** [`src/pages/Explainability.jsx:12`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Explainability.jsx#L12), [`varuna-backend/app/api/routes_explain.py`](file:///c:/Users/prakh/Desktop/varuna-frontend/varuna-backend/app/api/routes_explain.py)
* **Observed:** Uses deterministic mock data to generate explanation factors while the backend provides a dedicated `/api/explain` route returning genuine XGBoost feature importances and metadata.
* **Keep:** Rationale callout box, regional regime context, and factor contribution bars.
* **Improve:** Render real XGBoost feature importance shares (e.g., `lead_time_hours`, `diurnal_sin`, `regime_index`, `ens_spread`).
* **Fix:** Connect to `/api/explain` to fetch live model metadata and trained feature importances.
* **Optional:** Add SHAP summary plot visualization.

### 8. System Status & Health (`SystemHealth.jsx`)
* **Status:** `FIX`
* **Evidence:** CODE + LIVE UI
* **Source:** [`src/pages/SystemHealth.jsx:308-336`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/SystemHealth.jsx#L308-L336)
* **Observed:** Successfully wired to `/api/providers/status` in live mode, but fallback cards contain hardcoded stale numbers ($0.8674\text{ }^\circ\text{C}$ RMSE, $18.3\%$ over IFS) and comments referencing THERMOS clusters.
* **Keep:** Live gateway probing status, SQLite cache diagnostics, active ensemble table, and mode switcher.
* **Improve:** Display real Open-Meteo gateway latency measurements returned by backend.
* **Fix:** Update hardcoded fallback metrics to $0.7803\text{ }^\circ\text{C}$ RMSE ($34.7\%$ over IFS). Remove THERMOS layout references.
* **Optional:** Add database cache inspection table showing cached forecast keys and expiration times.

---

## 13. Scientific Accuracy Audit & Remediation Log

```
LOCATION                   STALE / PROBLEMATIC CLAIM                SCIENTIFIC TRUTH & CAUSE                RECOMMENDED FRONTEND REMEDIATION
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
SystemHealth.jsx:308       "Held-Out Test RMSE: 0.8674 °C           Current consolidated held-out RMSE     Update displayed metric to 0.7803 °C
                           (18.3% over IFS)"                        is 0.7803 °C (34.7% error reduction    and 34.7% improvement.
                                                                    over IFS 1.195 °C, N=4,512).

SystemHealth.jsx:312       "Held-Out Test MAE: 0.6539 °C            Current held-out MAE is 0.612 °C       Update displayed metric to 0.612 °C
                           (r = 0.9837)"                            and Pearson r is 0.984.                and r = 0.984.

verified_science_data.js:6 "rmse": 1.0613 (IFS)                     Stale pre-integration benchmark        Update static data file to match
verified_science_data.js:60"rmse": 0.8674 (VARUNA)                  data file from earlier branch run.     blend_test_results.csv (IFS: 1.195,
                                                                                                           AIFS: 1.105, GFS: 2.320, ICON: 1.131,
                                                                                                           VARUNA: 0.7803).

scientific_reports.js:80   bestNwpRmse: ifsRow?.rmse ?? 1.0613      Stale fallback constants in data       Update default fallbacks to:
scientific_reports.js:81   blendRmse: varunaRow?.rmse ?? 0.8674     connector utility.                     bestNwpRmse = 1.195,
                                                                                                           blendRmse = 0.7803.

TopBar.jsx:88              "IFS · AIFS · GFS"                       Omits DWD ICON from active ensemble    Update text to:
                                                                    member list in header.                 "IFS · AIFS · GFS · ICON".

mockData.js:430, 462, 494  confidence: '95%', '96%', '91%'          Arbitrary fixed confidence tags        Replace fixed percentages with
                                                                    unsupported by backend science.        meteorological alert severity
                                                                                                           ("Critical", "High", "Advisory").

mockData.js:423            value: '94.2 mm' (Western Ghats Alert)   Fabricated example alert data          Derive alerts dynamically from
                                                                    hardcoded in demo array.               current regional forecast thresholds.

CommandCentre.jsx:64       : '24.8' (avg reduction fallback)        Unverified reduction placeholder.      Update fallback to 22.4% (vs equal)
                                                                                                           or 34.7% (vs IFS).

ForecastLayer.jsx:42-45    if (layer === 'ifs') ...                 Missing layer switch support for       Add DWD ICON branch:
                           (Missing DWD ICON layer)                 DWD ICON on map markers.               if (layer === 'icon') displayVal = icon.
```

---

## 14. What Must NOT Be Downgraded

The following core assets and functionalities have verified scientific and product value and **must not be removed or diluted**:

1. **The 7 Dedicated Operational Workspaces:** The application must remain an operational multi-page tool. Do not compress `CommandCentre`, `Forecast`, `Models`, `Skill`, `Extremes`, `Explainability`, and `System` into a single landing page.
2. **Interactive Lead Time Controls (24h, 48h, 72h, 120h):** These are core meteorological horizons; do not replace them with simple static daily cards.
3. **MapLibre GL Geospatial Architecture:** Retain the interactive vector/raster map with Indian regional centroids and zoom/pan capabilities.
4. **Authoritative Held-Out Verification Statistics:** The verified test results ($N=4,512$, $0.7803\text{ }^\circ\text{C}$ RMSE, Post-Monsoon window, ERA5 reference) must remain visible across the platform.
5. **Interactive Hamilton-Hare Weighting Simulator:** The live client-side translation of `weighting.py` on the Landing page is a primary technical differentiator and must be preserved.
6. **Multi-Model Timeseries Graphs:** The Recharts line and bar graphs showing IFS, AIFS, GFS, ICON, and VARUNA Blend over time provide essential analytical depth.
7. **Tripartite Operational Data Modes (`LIVE`, `CACHED`, `REPLAY`):** The ability to inspect live Open-Meteo responses, review cached runs, and inspect offline replay data ensures demo resilience.
8. **Scientific Disclosures & Boundary Blocks:** Transparent statements regarding temperature-only ML adaptivity, 7-day forecast horizon caps, and pending IMD AWS telemetry must remain intact.

---

## 15. Implementation Priority Matrix

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ PRIORITY ROADMAP                                                                      │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ P0: MANDATORY SCIENTIFIC INTEGRITY & BROKEN PATHS                                     │
│ • P0-1: Update stale verification constants across verified_science_data.js.          │
│ • P0-2: Connect Skill.jsx to /api/skill with clean report fallback.                  │
│ • P0-3: Connect Models.jsx table to authoritative benchmark results.                  │
│ • P0-4: Fix TopBar.jsx ensemble member string to include DWD ICON.                    │
│ • P0-5: Add DWD ICON layer support to ForecastLayer.jsx map markers.                  │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ P1: HIGH-VALUE UX, VISUAL IDENTITY & STORYTELLING                                     │
│ • P1-1: Implement Asset-A multi-model convergence graphic in Landing hero.            │
│ • P1-2: Add Framer Motion staggered scroll reveals across Landing page sections.     │
│ • P1-3: Connect Explainability.jsx to /api/explain to show real XGBoost importances.  │
│ • P1-4: Connect Extremes.jsx to /api/extremes and eliminate fake confidence values.   │
│ • P1-5: Remove THERMOS layout references and establish distinct VARUNA styling.       │
│ • P1-6: Improve Forecast.jsx visual hierarchy with clean tabbed sub-sections.         │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ P2: POLISH & DEMO ENHANCEMENTS                                                        │
│ • P2-1: Add smooth scroll-spy active highlighting in Landing navbar.                  │
│ • P2-2: Add ensemble disagreement shaded uncertainty ribbon in forecast timeseries.  │
│ • P2-3: Add SQLite cache telemetry inspector in SystemHealth.jsx.                     │
│ • P2-4: Micro-interactions: haptic-style button states and smooth tooltip damping.   │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Recommended Implementation Sequence

To minimize risk and maintain a working build throughout, changes should be executed in three isolated, verifiable phases:

```
PHASE 1: Data Truth & Scientific Integrity (P0)
└── 1. Patch static verified_science_data.js to match blend_test_results.csv.
└── 2. Wire Skill.jsx and Models.jsx to live /api/skill endpoint.
└── 3. Add DWD ICON to TopBar.jsx and ForecastLayer.jsx.
└── 4. Verify: npm run lint && npm run build && npm test.

PHASE 2: Backend Wiring & Eliminating Stale Mock Islands (P1)
└── 1. Wire Explainability.jsx to /api/explain (real XGBoost importances).
└── 2. Wire Extremes.jsx to /api/extremes (remove fake 95% confidence numbers).
└── 3. Update SystemHealth.jsx fallback numbers to 0.7803 °C.
└── 4. Verify: pytest backend && npm test && npm run build.

PHASE 3: Visual Polish, Identity Separation & Motion Storytelling (P1 / P2)
└── 1. Refactor colors and tokens in index.css to Barometric Deep Slate & Electric Amber.
└── 2. Implement Asset-A SVG convergence graphic in Landing.jsx hero.
└── 3. Add Framer Motion staggered viewport reveals across Landing sections.
└── 4. Optimize mobile responsive layout and drawer interactions.
└── 5. Verify: Full cross-browser checks, build validation, and final commit.
```

---

## 17. Compact Findings (Major Architecture Items)

### Finding: Static Science Data Contains Stale Pre-Integration Numbers
**Status:** `FIX`  
**Evidence:** CODE + BACKEND  
**Source:** [`src/data/verified_science_data.js:6-60`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/verified_science_data.js#L6-L60), `varuna-backend/reports/blend_test_results.csv`  
**Observed:** `verified_science_data.js` records VARUNA RMSE as $0.8674\text{ }^\circ\text{C}$ and IFS RMSE as $1.0613\text{ }^\circ\text{C}$, whereas the current backend consolidation established held-out RMSE of $0.7803\text{ }^\circ\text{C}$ ($1.195\text{ }^\circ\text{C}$ IFS).  
**Problem:** Pages importing this static file (`Skill.jsx`, `Models.jsx`) display outdated benchmark figures that contradict the backend API and the newly updated Landing page.  
**Recommendation:** Synchronize `verified_science_data.js` and `scientific_reports.js` with the authoritative outputs of `blend_test_results.csv`.  
**Impact:** HIGH · **Complexity:** LOW · **Risk:** LOW  
**Preserve:** Existing schema structure and test-split mappings.

### Finding: TopBar Header Omits DWD ICON From Active Ensemble List
**Status:** `FIX`  
**Evidence:** CODE  
**Source:** [`src/components/layout/TopBar.jsx:88`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/layout/TopBar.jsx#L88)  
**Observed:** TopBar text reads `"IFS · AIFS · GFS"`, omitting the fourth operational member (DWD ICON).  
**Problem:** Misrepresents the ensemble size as 3 members rather than 4 on every internal application page.  
**Recommendation:** Update string to `"IFS · AIFS · GFS · ICON"`.  
**Impact:** MEDIUM · **Complexity:** LOW · **Risk:** LOW  
**Preserve:** Existing layout and alignment.

### Finding: Map Forecast Layer Lacks DWD ICON Model Selector Branch
**Status:** `FIX`  
**Evidence:** CODE  
**Source:** [`src/components/map/ForecastLayer.jsx:42-45`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/map/ForecastLayer.jsx#L42-L45)  
**Observed:** When `selectedModelLayer` is toggled to `'icon'`, the marker value computation falls back to the default blend value rather than showing ICON's individual prediction.  
**Problem:** Users inspecting the map cannot isolate DWD ICON forecast markers.  
**Recommendation:** Add `if (selectedModelLayer === 'icon') displayVal = forecast.models.icon.value;`.  
**Impact:** MEDIUM · **Complexity:** LOW · **Risk:** LOW  
**Preserve:** Marker styling, animations, and click handlers.

### Finding: Explainability Page Uses Hardcoded Factors Instead of `/api/explain`
**Status:** `IMPROVE`  
**Evidence:** CODE + BACKEND  
**Source:** [`src/pages/Explainability.jsx:12`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Explainability.jsx#L12), [`varuna-backend/app/api/routes_explain.py`](file:///c:/Users/prakh/Desktop/varuna-frontend/varuna-backend/app/api/routes_explain.py)  
**Observed:** `Explainability.jsx` generates feature attribution bars from client-side mock logic, while `/api/explain` returns genuine XGBoost feature importances and model metadata.  
**Problem:** The platform claims machine-learning explainability but renders static mock factors.  
**Recommendation:** Wire `Explainability.jsx` to `/api/explain` via `api.js`, retaining the current layout while displaying genuine model importance shares.  
**Impact:** HIGH · **Complexity:** MEDIUM · **Risk:** LOW  
**Preserve:** Existing layout, regime context callouts, and explanatory copy.

### Finding: Extremes Page Uses Fabricated Fixed Confidence Figures
**Status:** `FIX`  
**Evidence:** CODE + DATA  
**Source:** [`src/pages/Extremes.jsx:29`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Extremes.jsx#L29), [`src/data/mockData.js:430`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js#L430)  
**Observed:** The hazard triage queue displays hardcoded confidence numbers (`95%`, `96%`, `91%`) and a filter slider set to $85\%$.  
**Problem:** Fabricated confidence percentages violate scientific integrity.  
**Recommendation:** Replace arbitrary confidence tags with operational IMD warning categories (Severe Warning, Warning, Watch) and model consensus percentages.  
**Impact:** HIGH · **Complexity:** MEDIUM · **Risk:** LOW  
**Preserve:** Triage sidebar filtering and IMD threshold criteria.

---

## 18. Evidence Log

| Item / Finding | Evidence Type | Source Reference | Confidence |
| :--- | :--- | :--- | :--- |
| Stale held-out RMSE ($0.8674\text{ }^\circ\text{C}$ vs $0.7803\text{ }^\circ\text{C}$) | CODE + BACKEND | [`SystemHealth.jsx:308`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/SystemHealth.jsx#L308), [`verified_science_data.js:60`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/verified_science_data.js#L60), `blend_test_results.csv` | **High** |
| TopBar missing DWD ICON | CODE | [`src/components/layout/TopBar.jsx:88`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/layout/TopBar.jsx#L88) | **High** |
| ForecastLayer missing ICON layer switch | CODE | [`src/components/map/ForecastLayer.jsx:42-45`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/map/ForecastLayer.jsx#L42-L45) | **High** |
| Skill page not consuming `/api/skill` | CODE + BACKEND | [`src/pages/Skill.jsx:40`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Skill.jsx#L40), [`varuna-backend/app/api/routes_skill.py`](file:///c:/Users/prakh/Desktop/varuna-frontend/varuna-backend/app/api/routes_skill.py) | **High** |
| Explainability not consuming `/api/explain` | CODE + BACKEND | [`src/pages/Explainability.jsx:12`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Explainability.jsx#L12), [`varuna-backend/app/api/routes_explain.py`](file:///c:/Users/prakh/Desktop/varuna-frontend/varuna-backend/app/api/routes_explain.py) | **High** |
| Extremes page hardcoded 95% confidence | CODE + DATA | [`src/data/mockData.js:430`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/data/mockData.js#L430), [`src/pages/Extremes.jsx:29`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Extremes.jsx#L29) | **High** |
| Explicit THERMOS comment references | CODE | [`CommandCentre.jsx:148`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/CommandCentre.jsx#L148), [`Sidebar.jsx:89`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/layout/Sidebar.jsx#L89), [`Extremes.jsx:77`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/pages/Extremes.jsx#L77) | **High** |
| `/priority` reference architecture | REFERENCE SITE | `https://sih-2026-nu-ten.vercel.app/priority` (`priority_bundle.js`) | **High** |
| THERMOS visual design & screenshots | REFERENCE ASSET | `references/Screenshot 2026-09-26 113834.png` to `113926.png` | **High** |
| Framer Motion installed & available | CODE | [`package.json:15`](file:///c:/Users/prakh/Desktop/varuna-frontend/package.json#L15), [`src/components/layout/AppLayout.jsx:2`](file:///c:/Users/prakh/Desktop/varuna-frontend/src/components/layout/AppLayout.jsx#L2) | **High** |
| Verified held-out RMSE $0.7803\text{ }^\circ\text{C}$ ($N=4,512$) | BACKEND / REPORT | `varuna-backend/reports/blend_test_results.csv`, `provenance.json` | **High** |
| Total aligned rows = 21,042 across 6 zones | BACKEND / PROV | `varuna-backend/data/provenance.json`, `/api/providers/status` | **High** |

---

### Audit Status & Next Steps
This audit provides a comprehensive diagnostic of the current VARUNA frontend repository. No code has been altered and no commits have been created. Upon your review and approval of these findings and recommendations, implementation can proceed safely following the phased roadmap outlined above.