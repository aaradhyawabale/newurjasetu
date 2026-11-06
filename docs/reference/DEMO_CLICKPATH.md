# UrjaSetu Demo Recording Script & Video Clickpath (60–90 Seconds)

> **Purpose:** Step-by-step technical script for screen-recording a polished, competition-ready demonstration of UrjaSetu.  
> **Target Recording Duration:** 75 seconds (Acceptable range: 60 to 90 seconds)  
> **Tested & Verified:** Automated headless crawl verified on November 5, 2026 (Zero console errors, sub-50ms knapsack execution).  
> **Recommended Screen Resolution:** 1920 × 1080 at 60 FPS (or 30 FPS), system audio enabled if voiceover is live.  

---

## 1. Preparation & Setup Checklist

1. **Start Next.js Production / Dev Server:**
   ```bash
   npm run build && npm run start -p 3001
   # (Or run `npm run dev -p 3001` if developing)
   ```
2. **Browser Setup:**
   * Open Google Chrome at `http://localhost:3001/`.
   * Set window viewport to 1920 × 1080 (100% zoom).
   * Open DevTools once to ensure no console errors; then close DevTools.
   * Clear any browser tour/coachmark dismissals by running `localStorage.clear()` so tooltips show cleanly, or dismiss coachmarks before starting.

---

## 2. Best Visual Configuration for Recording

* **Default Budget:** **25.0 hectares** (City-wide).
  * *Why:* Packs **24.69 ha** across **11 distinct priority zones** covering **14,489 citizens**, delivering an average **-13.28°C** cooling impact. The 11 cells form visually striking cyan clusters across East and South Pune (Nagar Road and Kondhwa-wanawdi).
* **Alternative Single-Ward Demo:** **Nagar Road** with a **10.0 hectare** budget.
  * *Why:* Zooms the map automatically to 4 high-density hotspot cells in East Pune, allocating **8.97 ha** with an average **-16.16°C** cooling impact.

---

## 3. Step-by-Step Recording Script

```
Timeline:
[00:00 - 00:12] Act 1: The Civic Front Door (Landing Page)
[00:12 - 00:32] Act 2: Flagship Budget Optimization (/heat-planner)
[00:32 - 00:48] Act 3: Auditing a Zone & Exporting PDF Dossier
[00:48 - 01:02] Act 4: Scenario B Comparison & Climate Copilot
[01:02 - 01:15] Act 5: Green Loss Watch & Scientific Quality Gate
```

---

### Act 1: The Civic Front Door (0:00 – 0:12) · 12 Seconds

* **Exact URL:** `http://localhost:3001/`
* **Visual Action:**
  1. Start recording with the cursor positioned near the hero headline: *"Where should Pune cool first?"*.
  2. Briefly hover over the three verified pipeline chips:
     * `Landsat + Sentinel-2 satellite data` [Measured]
     * `AI ensemble of 30 models` [Modelled]
     * `Measured / Modelled / Assumed labels` [Assumed]
  3. Scroll down slightly to show the interactive 8,303-cell MapLibre heat preview.
  4. Click the emerald primary button: **"Start Planning Now"** (or click "Heat Planner" in top nav).
* **Voiceover / Spoken Script:**
  > *"Every summer, Pune's urban heat islands drive surface temperatures past 44°C, but municipal greening budgets are limited. UrjaSetu is an open civic platform that uses 30-meter Landsat-9 and 10-meter Sentinel-2 satellite data to solve one question: where should Pune cool first?"*
* **What Appears:** Instant client transition to `/heat-planner`.

---

### Act 2: Flagship Budget Optimization (0:12 – 0:32) · 20 Seconds

* **Exact URL:** `http://localhost:3001/heat-planner`
* **Visual Action:**
  1. The page loads with the default **25.0 hectare** budget automatically optimized.
  2. Pan the cursor across the center map showing the 11 highlighted priority cells glowing over the dark-slate thermal raster.
  3. Point the cursor to the bottom portfolio summary strip:
     * Zones: `11`
     * Allocated: `24.69 ha` (strictly $\le 25.0$ ha)
     * Citizens Protected: `14,489` [Assumed]
     * Mean Cooling: `-13.28°C` (P10–P90 spread: `-13.03°C to -13.55°C`) [Modelled]
     * Robustness: `100%` selection stability
  4. In the left Scenario Panel, click the **"Ward (10 ha)"** preset chip or adjust the slider to `10 ha`.
  5. Click the primary button: **"Run Optimization"**.
* **Voiceover / Spoken Script:**
  > *"Planners don't work with arbitrary weighted scores; they work with real hectares. With a 25-hectare municipal budget, our vectorised knapsack optimizer runs in under 50 milliseconds, allocating 11 priority cells across 24.69 unbuilt hectares, protecting over 14,000 citizens with an average modeled cooling of 13.3 degrees."*
* **What Appears:** In under 50ms, the map and bottom strip re-rank to reflect the 10 ha allocation with a toast notification: *"Plan updated: 4 zones allocated covering 5,740 citizens."*

---

### Act 3: Auditing a Zone & Exporting PDF Dossier (0:32 – 0:48) · 16 Seconds

* **Exact URL:** `http://localhost:3001/heat-planner`
* **Visual Action:**
  1. Click directly on the top candidate zone on the map: `cell_250m_2313` in Kondhwa-wanawdi (or `cell_250m_8020` in Nagar Road).
  2. The **Zone Evidence Drawer** slides out smoothly from the right side.
  3. Highlight the transparent epistemic tags:
     * Surface Temperature: `42.6°C` [Measured] (Landsat-9 TIRS-2)
     * Vegetation Index: `0.18` [Measured] (Sentinel-2B)
     * Predicted Cooling: `-16.70°C` [Modelled] (P10: -16.48°C, P90: -16.92°C)
     * Nearest Ward: `Kondhwa-wanawdi` [Modelled - centroid]
  4. Click the button: **"Download PDF Dossier"**.
* **Voiceover / Spoken Script:**
  > *"Every single cell is explainable. Clicking a zone opens its evidence dossier—showing direct sensor observations, spatial-block uncertainty bounds, and exact satellite overpass dates. Planners can export a signed, two-page statutory PDF dossier directly for municipal committee review."*
* **What Appears:** The browser instantly triggers a file download: `urjasetu-zone-cell_250m_2313-dossier.pdf`.

---

### Act 4: Scenario B Comparison & Climate Copilot (0:48 – 1:02) · 14 Seconds

* **Exact URL:** `http://localhost:3001/heat-planner`
* **Visual Action:**
  1. Close the drawer or click Step 4 in the top stepper: **"Compare scenarios"**.
  2. In the Scenario Panel, toggle on **"Compare with Scenario B"** (Budget: `40 ha`).
  3. The **Scenario Comparison Modal** opens, showing Scenario A (25 ha) vs Scenario B (40 ha) side-by-side with marginal cooling return curves.
  4. Close modal and click the floating **Climate Copilot** button (`Bot` icon in bottom-right).
  5. Type or click starter prompt: *"Why was Nagar Road prioritized?"*.
* **Voiceover / Spoken Script:**
  > *"Planners can simulate budget trade-offs side-by-side to justify expanding greening funds. And our AI Climate Copilot, grounded with Google Gemini and real GIS tool calling, answers policy queries while strictly citing model card facts without hallucinations."*
* **What Appears:** Copilot replies citing authentic cell cooling, population density, and unbuilt surface metrics.

---

### Act 5: Green Loss Watch & Scientific Quality Gate (1:02 – 1:15) · 13 Seconds

* **Exact URL:** Click "Climate Tools" $\to$ `Green Loss Watch` (`http://localhost:3001/green-loss`), then click `Method` (`http://localhost:3001/method`).
* **Visual Action:**
  1. On `/green-loss`, show the red-flagged parcels: 2,449 cells where Sentinel-2 canopy dropped between 2019 and 2026. Point to the honest tag: *"Not yet validated against high-res cadastre"*.
  2. Click **"Method & Quality Gate"** in the top navigation bar.
  3. Show the **Unconstrained Diagnostic Gate**: `PASSED_PHYSICAL_CONSISTENCY (95.9% negative response rate)`.
  4. Point to the Gandikota SCADA solar derating card ($\gamma = -0.533\%/^\circ\text{C}$).
* **Voiceover / Spoken Script:**
  > *"UrjaSetu also tracks historical green loss, flagging over 6,900 hectares of canopy decline since 2019. On our Method page, we disclose everything: an unconstrained diagnostic gate passing at 95.9%, utility solar derating, and explicit scientific limitations. Transparent, grounded, and ready for Pune."*
* **What Appears:** Clean, professional ending on the Method & Quality Gate page.

---

## 4. Test Run Timing & Glitch Notes

Verified through automated headless execution and manual browser crawl:

| Step / Milestone | Cumulative Elapsed Time | Observed Behavior | Glitch Assessment & Mitigation |
| :--- | :---: | :--- | :--- |
| **1. Landing Page Load** | **T + 2.1s** | MapLibre initializes smoothly; 8,303 cells render in ~400ms. | Clean. No layout shifts. |
| **2. Heat Planner Load** | **T + 4.9s** | Knapsack optimizer executes immediately on load; bottom bar populated. | Clean. Knapsack allocated 24.69 ha (zero lag). |
| **3. Zone Selection Drawer** | **T + 6.4s** | Drawer slides open smoothly; cell metrics and satellite dates visible. | Clean. PDF generation triggers in under 200ms via `pdf-lib`. |
| **4. Scenario B Comparison** | **T + 7.4s** | Side-by-side comparison modal renders immediately. | Clean. Z-index layer modal stays properly above map canvas. |
| **5. Copilot Expansion** | **T + 8.4s** | Chat dock expands; starter prompts visible. | Clean. Local GIS engine responds in ~50ms if external API key is absent. |
| **6. Green Loss Watch** | **T + 10.6s** | 2,449 loss parcel cells hatched in red/amber over satellite imagery. | Clean. Ward summary ranking table loads instantaneously. |
| **7. Method Page** | **T + 12.6s** | Primary model card and Gandikota solar cards render cleanly. | Clean. Zero font sizes under 11px; WCAG AA high-contrast slate theme. |

### Technical Tips for the Presenter:
* **Map Zooming:** Double-clicking on map zoom works, but using the left Ward dropdown (e.g. selecting "Nagar Road") executes a cinematic `map.fitBounds` animation that looks significantly more polished in video recordings.
* **Network Independence:** To record offline without external internet dependence, UrjaSetu's local caching and deterministic fallback engines ensure that all 8 routes, optimizer calculations, and zone dossiers function 100% offline.
