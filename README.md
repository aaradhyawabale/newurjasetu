# UrjaSetu — Urban Infrastructure Siting, Solar Reality & Scenario Simulator

UrjaSetu is an explainable, map-based urban infrastructure siting and impact-analysis decision support platform. A planner selects an infrastructure type (Hospital, School, Park, Road, Bridge, Water Canal, Building, Transit Station, Drainage, or Solar Farm), places a pin anywhere on the interactive map, customizes dimensions and type-specific parameters, validates the footprint against mapped OpenStreetMap features, and executes multi-criteria suitability analysis backed by transparent open geospatial data.

> **DECISION SUPPORT NOTICE**: UrjaSetu is an indicative screening system. It never approves projects, never presents indicative heuristic scores as statutory clearance, and never substitutes for licensed geotechnical, environmental impact, or civil engineering field investigations.

---

## 1. Key Capabilities & Engine Features

### A. Explainable Multi-Criteria Geospatial Siting Engine
- **Transparent Scorecards**: 10 distinct infrastructure profiles evaluated with domain-specific criteria (arterial road access, terrain slope, flood risk, utility proximity, demand density, hydraulic capacity).
- **Mandatory Constraint Enforcement**: Violations of critical spatial exclusions (railway buffers, waterways, protected land use) trigger overriding penalties preventing unsuitable sites from appearing viable.
- **Sensitivity Analysis**: Explores score volatility across 4 transparent weight profiles (Balanced, Accessibility-Prioritized, Environmental/Safety-First, Economic/Feasibility-First).

### B. Shadow-of-the-Future: 3D Solar Shading Simulator
- **Solar Position Algorithm**: NOAA/NREL solar position calculation accounting for latitude, longitude, day of year, and local solar time.
- **3D Ground Shadow Ray Casting**: Projects building footprint shadows onto ground coordinates.
- **Future What-If Scenarios**: Planners can construct hypothetical future towers or planned urban developments to simulate future shading risk before capital commitment.

### C. Solar Reality: Generation & Financial Feasibility
- **Transposition & NOCT Modeling**: Converts horizontal GHI to tilted plane-of-array irradiance using Liu-Jordan transposition, derating cell efficiency using IEC ambient temperature models.
- **Loss Waterfall**: Decomposes soiling, shading, inverter, wiring, and thermal losses.
- **25-Year LCOE & Financial Payback**: Computes levelized cost of electricity and simple payback periods under local grid tariffs.

### D. Infrastructure Impact and Scenario Simulator
- **Multi-Candidate Comparison**: Compares candidate sites side-by-side using identical criteria.
- **Criteria Differential Matrix**: Computes exact delta scores ($\Delta\text{score} = \text{Score}_{\text{leader}} - \text{Score}_{\text{trailing}}$).
- **Spatial Impact & Geodesic Separation**: Calculates true Haversine separation distance between candidates, road access quality, and straight-line service catchment proxies.
- **Executive PDF Export**: Generates multi-page comparison reports summarizing candidate rankings, trade-offs, and data provenance.

---

## 2. Prerequisites
- **Node.js**: v18.18+ or v20+ (tested on Node v20 / v22)
- **npm**: v9+ or v10+
- **Operating System**: macOS, Linux, or Windows

---

## 3. Installation & Quickstart

```bash
# 1. Clone repository
git clone https://github.com/aaradhyawabale/newurjasetu.git
cd newurjasetu

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Initialize Database (Prisma SQLite for local dev & testing)
npx prisma generate
npx prisma db push

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Environment Configuration (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | Database connection string | `file:./dev.db` (SQLite) |
| `SESSION_SECRET` | Secret key for JWT cookie signing | Required string (min 32 chars) |
| `NEXT_PUBLIC_MAP_STYLE` | Custom vector map style JSON URL (optional) | Raster OSM default |
| `OVERPASS_API_URL` | Primary OpenStreetMap Overpass interpreter | `https://overpass-api.de/api/interpreter` |
| `OVERPASS_BACKUP_URL` | Secondary Overpass mirror for failover | `https://overpass.kumi.systems/api/interpreter` |
| `NOMINATIM_API_URL` | OpenStreetMap Nominatim geocoding base URL | `https://nominatim.openstreetmap.org` |
| `OPEN_METEO_ELEVATION_URL` | Open-Meteo digital elevation model API | `https://api.open-meteo.com/v1/elevation` |
| `OPEN_METEO_ARCHIVE_URL` | Open-Meteo ERA5-Land climate archive API | `https://archive-api.open-meteo.com/v1/archive` |
| `NASA_POWER_API_URL` | NASA POWER solar irradiance (GHI) endpoint | `https://power.larc.nasa.gov/api/temporal/climatology/point` |
| `GEO_USER_AGENT` | User-Agent header for OSM API compliance | Required descriptive contact string |

---

## 5. Running Tests & Quality Verification

```bash
# Run all unit and integration tests (95 tests passing)
npm test

# Run ESLint validation
npm run lint

# Run TypeScript strict type verification
npx tsc --noEmit

# Run production build
npm run build
```

---

## 6. Jury & Technical Review Demonstration Script

To reproduce a live technical evaluation using genuine open datasets:

1. **Sign In**: Log in or register an account.
2. **Search Location**: Type `Connaught Place, New Delhi` in the search bar (`Cmd+K`).
3. **Select Tool**: Click **Hospital** in the left sidebar.
4. **Place Pin**: Click on the map to place the candidate footprint (e.g. $100\text{m} \times 80\text{m}$).
5. **Validate Footprint**: Click **Validate Footprint** to screen mapped OSM buildings, waterways, and railway corridors.
6. **Execute Analysis**: Click **Analyze** to poll Overpass, Open-Meteo, and NASA POWER. Inspect the 0–100 scorecard, criteria breakdown, and sensitivity profiles.
7. **Test Solar Reality**: Change infrastructure type to **Solar Farm**. Click **Solar Reality** to inspect the 12-month generation curve, NOCT thermal derating, and loss waterfall.
8. **Test Shadow Simulator**: Click **Shadow Simulator** to view solar azimuth/elevation, project building ground shadows, and add a hypothetical 50m tower to evaluate future shading.
9. **Multi-Candidate Scenario Comparison**:
   - Create a second placement in the same scenario (e.g. Karol Bagh).
   - Click **Analyze** on the second placement.
   - Click **Compare** in the top navigation bar to open the **Scenario Simulator**.
   - Review candidate rankings, criteria differential matrix ($\Delta\text{score}$), spatial separation, and export the comparative PDF report.
10. **Report Export**: Click **PDF** in the top bar to download the complete siting evaluation dossier.

---

## 7. Project Architecture & Directory Layout

```
newurjasetu/
├── docs/
│   ├── ANALYSIS_METHOD.md              # Formulas, piecewise scoring, and benchmarks
│   ├── DATA_SOURCES.md                 # OpenStreetMap, Open-Meteo, NASA POWER, rate limits
│   ├── EXPLAINABILITY_AND_SENSITIVITY.md # Weight profiles & Monte Carlo sensitivity
│   ├── SHADOW_OF_THE_FUTURE.md         # Solar position algorithm & ground ray casting
│   ├── SOLAR_REALITY.md                # Liu-Jordan transposition, NOCT, and LCOE
│   └── SCENARIO_SIMULATOR.md           # Scenario comparator & differential trade-offs
├── prisma/
│   └── schema.prisma                   # Database schema (User, Scenario, Placement, Analysis, ProviderCache)
├── src/
│   ├── app/                            # Next.js App Router (pages and API route handlers)
│   ├── components/
│   │   ├── layout/                     # AppShell, TopBar, ToolSidebar
│   │   ├── map/                        # MapView (MapLibre GL JS with canvas export)
│   │   ├── panels/                     # PlacementPanel (dimensions, coordinates, params)
│   │   ├── reports/                    # ReportDrawer (verdict, scorecard, evidence)
│   │   ├── history/                    # HistoryDrawer (stored reports)
│   │   ├── scenarios/                  # ScenarioComparisonModal (multi-candidate simulator)
│   │   ├── solar/                      # ShadowSimulatorModal & SolarRealityModal
│   │   └── ui/                         # StatusBadge, ScoreBar, Toast, Drawer
│   ├── config/
│   │   └── infra-types.ts              # Complete registry for all 10 infrastructure types
│   └── server/
│       ├── analysis-engine/            # Scoring, validation, sensitivity, weight profiles
│       ├── gis/                        # Turf.js geodesic geometry & spatial separation
│       ├── pdf/                        # PDF generation with pdf-lib (report & scenario comparison)
│       ├── providers/                  # Overpass, Open-Meteo, NASA POWER with DB caching
│       ├── scenarios/                  # Comparison engine & impact trade-off simulator
│       └── solar/                      # NOAA solar position, ray casting, solar reality models
└── tests/
    ├── unit/                           # Engine, scoring, geometry, solar, sensitivity, comparison
    └── integration/                    # API authentication, scenario isolation, PDF exports
```

---

## 8. Data Sources & Limitations

1. **OpenStreetMap**: Features, footprints, and road corridors via Overpass API. Cached locally in SQLite (`ProviderCache`) for 24 hours.
2. **Open-Meteo Elevation & Climate API**: 90m digital elevation model (DEM) and ERA5-Land reanalysis.
3. **NASA POWER**: Multi-year solar climatology (All-Sky Surface Insolation GHI).
4. **Service Catchment Disclaimer**: Proximity calculations use straight-line Euclidean distance proxies (500m radius). They do not substitute for census population micro-data or origin-destination transit routing.
