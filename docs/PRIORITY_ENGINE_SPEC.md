# UrjaSetu Priority Engine Specification

**Document Version:** 1.0.0  
**Status:** Approved Engineering Specification  
**Artifact Directory:** `public/data/priority/`  
**Server Loader Module:** `src/server/priority/loader.ts`  
**Feature Flag:** `NEXT_PUBLIC_PRIORITY_MODE`  
**Spatial Reference System:** EPSG:32643 (UTM Zone 43N) / WGS84 (EPSG:4326)

---

## 1. Executive Summary & Purpose

The UrjaSetu Priority Engine delivers high-resolution, empirical spatial prioritization for urban greening, cool surfaces, and thermal mitigation across the Pune metropolitan region. The core spatial unit is a regular **250 m × 250 m grid cell** (area: 6.25 hectares / 0.0625 km²), providing town planners and municipal authorities with evidence-based cooling predictions and vulnerability assessments.

### Scientific Governance & Integrity Mandates

1. **Surface Temperature is Not Air Temperature:**  
   Radiometric Land Surface Temperature ($LST$, derived from Landsat 9 TIRS-2 Band 10) measures the radiant skin temperature of ground surfaces, building roofs, and pavements. It does **not** represent 2-meter ambient air temperature ($T_{\text{air}}$) or human physiological heat stress (e.g., UTCI, WBGT).
2. **NDVI is Not Tree Canopy Cover:**  
   The Normalized Difference Vegetation Index ($NDVI$, derived from Sentinel-2 MSI Bands B04 & B08) is a unitless spectral reflectance ratio $(NIR - \text{Red}) / (NIR + \text{Red})$ indicating active chlorophyll absorption. It does **not** measure 3D canopy architecture, leaf area density, or physical tree shade.
3. **No Arbitrary Weighted Composite Scores:**  
   The system strictly avoids arbitrary linear score combinations (such as $0.4 \times LST + 0.3 \times NDVI + \dots$). Every displayed and reported metric is either a direct physical measurement or a transparent thermodynamic / spatial model with explicit uncertainty bounds.
4. **Data Integrity & Null Preservation:**  
   Values must never be fabricated, imputed with synthetic zeros, or silently substituted. Unknown or unmeasured metrics must remain `null` and render explicitly as `"Not available"`.
5. **Universal Provenance Tagging:**  
   All reported parameters are classified under three strict categories:
   - `[Measured]`: Directly captured by calibrated physical instruments or statutory registries.
   - `[Modelled]`: Deterministically computed through validated physical, astronomical, or spatial models.
   - `[Assumed]`: Indicative planning defaults, screening thresholds, or scenarios requiring field validation.

---

## 2. Artifact File Specifications (`public/data/priority/`)

The Priority Engine relies on three coordinated data artifacts stored in `public/data/priority/`:

| File | Format | Description |
| :--- | :--- | :--- |
| [`cells.json`](file:///Users/aaradhya/Downloads/newesturjasetu/public/data/priority/cells.json) | JSON | Per-cell geospatial, thermal, ecological, demographic, and cooling metrics for all 250m cells |
| [`ensemble_effects.bin`](file:///Users/aaradhya/Downloads/newesturjasetu/public/data/priority/ensemble_effects.bin) | Flat Binary (Float32) | 30-member Monte Carlo ensemble of predicted cooling effects per cell |
| [`model_card.json`](file:///Users/aaradhya/Downloads/newesturjasetu/public/data/priority/model_card.json) | JSON | Machine-readable scientific governance, dataset provenance, metrics, and limitations |

---

### 2.1 `cells.json` — 250 m Spatial Cell Schema

Each entry in `cells.json` represents a regular 250m grid cell within the Pune Municipal Corporation (PMC) boundary.

```json
[
  {
    "id": "cell_250m_0001",
    "centroid": [73.85445, 18.52085],
    "ward": "Kasba Vishrambaugwada",
    "population": 2940,
    "lst_mean": 42.15,
    "lst_std": 1.45,
    "n_obs": 64,
    "ndvi": 0.118,
    "built_frac": 0.89,
    "greenable_ha": 0.42,
    "burden": 18.65,
    "cooling_mean": 1.25,
    "cooling_p10": 0.78,
    "cooling_p90": 1.72
  }
]
```

#### Detailed Attribute Table

| Field | Type | Units | Provenance | Description & Scientific Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | — | `[Assumed]` | Unique spatial cell identifier formatted as `cell_250m_XXXX`. |
| `centroid` | `[number, number]` | Degrees | `[Modelled]` | Geographic centroid in WGS84 coordinate reference system `[longitude, latitude]`. |
| `ward` | `string` | — | `[Measured]` | Official Pune Municipal Corporation (PMC) administrative ward name. |
| `population` | `number \| null` | Persons | `[Modelled]` | Estimated ambient resident population residing within the cell boundary (null if unassessed). |
| `lst_mean` | `number \| null` | °C | `[Measured]` | Mean Land Surface Temperature derived from USGS Landsat 9 TIRS-2 Band 10 clear-sky overpass. |
| `lst_std` | `number \| null` | °C | `[Modelled]` | Spatial standard deviation of 30m LST subpixels within the 250m cell window. |
| `n_obs` | `number` | Count | `[Measured]` | Count of valid clear-sky 30m thermal observations within cell (nominal full coverage = 64). |
| `ndvi` | `number \| null` | Ratio `[-1, 1]` | `[Measured]` | Mean Normalized Difference Vegetation Index from Copernicus Sentinel-2 MSI level-2A bands. |
| `built_frac` | `number \| null` | Fraction `[0, 1]` | `[Modelled]` | Ratio of impervious built footprint to total cell area derived from cadastral/OSM vectors. |
| `greenable_ha` | `number \| null` | Hectares | `[Modelled]` | Estimated plantable or permeable surface area available for intervention (maximum cell area: 6.25 ha). |
| `burden` | `number \| null` | Index | `[Modelled]` | Empirical thermal-exposure burden: $\max(0, \text{LST} - 35.0) \times \text{built\_frac} \times (\text{pop} / 2000)$. Null if metrics missing. |
| `cooling_mean` | `number \| null` | °C | `[Modelled]` | Predicted ensemble mean surface cooling effect resulting from mature greening/albedo intervention. |
| `cooling_p10` | `number \| null` | °C | `[Modelled]` | 10th percentile conservative cooling effect across 30 Monte Carlo physical model ensemble members. |
| `cooling_p90` | `number \| null` | °C | `[Modelled]` | 90th percentile optimistic cooling effect across 30 Monte Carlo physical model ensemble members. |

---

### 2.2 `ensemble_effects.bin` — Binary Ensemble Buffer

To preserve full predictive uncertainty without bloating JSON payloads, predicted intervention cooling distributions are stored in a contiguous binary buffer.

#### Binary Layout & Characteristics
- **Data Type:** IEEE 754 single-precision 32-bit floating point (`Float32`), Little-Endian.
- **Ensemble Members per Cell:** Exactly **30 members** representing parameter uncertainty (vegetation transpiration rates, crown maturity, local air advection, and soil water availability).
- **Buffer Dimensions:** $N_{\text{cells}} \times 30 \times 4\text{ bytes}$.
- **Indexing Formula:**
  $$\text{Byte Offset}(i, m) = (i \times 30 + m) \times 4$$
  where $i$ is the 0-indexed cell row in `cells.json` ($0 \le i < N_{\text{cells}}$) and $m$ is the ensemble member index ($0 \le m < 30$).
- **Missing / Unsimulated Cells:** Stored as 30 consecutive `NaN` (`0x7FC00000`) values. The loader detects this and returns `null` or flags unassessed cells.

---

### 2.3 `model_card.json` — Model Governance & Provenance

`model_card.json` contains full metadata tracing the scientific origins, training/evaluation metrics, and documented limitations of the Priority Engine.

#### Required Sections

1. **Model Identification:**
   - `model_name`: `"UrjaSetu Urban Cooling & Heat Burden Priority Engine"`
   - `version`: Semantic versioning string (e.g. `"1.0.0"`).
   - `task`: Spatial grid intervention prioritization and thermal cooling ensemble prediction.
   - `created_at` / `updated_at`: ISO 8601 UTC timestamps.
2. **Spatial Resolution:**
   - `cell_size_meters`: 250 m.
   - `cell_area_hectares`: 6.25 ha.
   - `crs`: `EPSG:32643` (UTM Zone 43N).
   - `display_crs`: `EPSG:4326` (WGS84).
3. **Validation Metrics:**
   - `rmse_celsius`: Root Mean Square Error of predicted surface cooling vs. empirical field calibrations.
   - `mae_celsius`: Mean Absolute Error.
   - `r2_score`: Coefficient of determination ($R^2$).
   - `spatial_cv_folds`: K-fold spatial block cross-validation count.
   - `ensemble_members`: Count of members per cell (30).
4. **Satellite Dates & Climatology:**
   - `landsat9_overpass`: ISO timestamp of source thermal scene (`LC09_L2SP_147047_20230422_02_T1`).
   - `sentinel2b_overpass`: ISO timestamp of source optical scene (`S2B_MSIL2A_20230424`).
   - `baseline_climatology_period`: Multi-year reference baseline.
5. **Data Sources:**
   - USGS Landsat 9 Collection 2 Level-2 Surface Temperature (TIRS-2).
   - Copernicus Sentinel-2 MSI Level-2A BOA Reflectance.
   - PMC Administrative Ward Registers & Cadastral Boundaries.
   - OpenStreetMap Building and Road Vector Geometries.
   - WorldPop / Census of India 2011 demographic projections.
6. **Scientific Limitations:**
   - Explicit disclaimers regarding LST vs. air temperature, NDVI vs. 3D canopy cover, and statutory non-binding status.

---

## 3. Server Loader Architecture (`src/server/priority/loader.ts`)

The loader provides high-performance, strongly-typed access to all priority artifacts, featuring in-memory caching and zero-copy binary buffer slicing.

### Key Exported Functions

```typescript
import {
  isPriorityModeEnabled,
  isPriorityDataAvailable,
  getPriorityCellsSync,
  loadPriorityCells,
  getPriorityModelCardSync,
  loadPriorityModelCard,
  getEnsembleEffectsSync,
  loadEnsembleEffects,
  getCellEnsemble,
  getCellEnsembleStats,
  getPriorityCellById,
  getPriorityCellsByWard,
  clearPriorityCache
} from '@/server/priority/loader';
```

- `isPriorityModeEnabled(): boolean`  
  Evaluates the `NEXT_PUBLIC_PRIORITY_MODE` environment variable.
- `isPriorityDataAvailable(): boolean`  
  Validates that `cells.json`, `ensemble_effects.bin`, and `model_card.json` all exist on disk.
- `getPriorityCellsSync(): PriorityCell[]`  
  Synchronously returns parsed, validated 250m cell records with cached memory persistence.
- `getCellEnsemble(cellIndex: number): Float32Array | null`  
  Extracts the 30-member `Float32Array` slice for the given cell index without copying underlying memory.
- `getCellEnsembleStats(cellIndex: number): EnsembleStats | null`  
  Computes mean, 10th percentile, 90th percentile, spread ($p90 - p10$), min, and max for the cell's ensemble distribution.

---

## 4. Feature Flag Configuration (`NEXT_PUBLIC_PRIORITY_MODE`)

The Priority Engine is protected behind the `NEXT_PUBLIC_PRIORITY_MODE` feature flag, allowing safe activation across environments:

- In `.env`:
  ```bash
  NEXT_PUBLIC_PRIORITY_MODE="true"
  ```
- In `.env.example`:
  ```bash
  # Priority Engine Mode (Feature Flag: enables 250m cell priority grid, ensemble effects, and model card)
  NEXT_PUBLIC_PRIORITY_MODE="true"
  ```

Because of the `NEXT_PUBLIC_` prefix, this flag is accessible across both server-side loaders and client-side UI components without requiring dedicated API round-trips.
