# UrjaSetu — Urban Infrastructure Siting & Impact Analysis System (Phase 1)

UrjaSetu is a modern, map-based urban infrastructure siting and impact-analysis decision support tool. A planner selects an infrastructure type (Hospital, School, Park, Road, Bridge, Water Canal, Building, Transit Station, Drainage, or Solar Farm), places a pin anywhere on the interactive map, customizes dimensions and type-specific parameters, validates the footprint against mapped OpenStreetMap features, and executes multi-criteria suitability analysis backed by transparent open geospatial data.

> **DECISION SUPPORT NOTICE**: UrjaSetu is an indicative screening system. It never approves projects, never presents indicative heuristic scores as statutory clearance, and never substitutes for licensed geotechnical or civil engineering field investigations.

---

## 1. Prerequisites
- **Node.js**: v18.18+ or v20+ (tested on Node v22)
- **npm**: v9+ or v10+
- **Operating System**: macOS, Linux, or Windows

---

## 2. Installation & Quickstart

```bash
# 1. Clone repository
git clone <repository-url>
cd newesturjasetu

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

## 3. Environment Configuration (`.env`)

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

## 4. Running Tests & Quality Verification

```bash
# Run unit and integration tests with Vitest
npm test

# Run TypeScript strict type verification
npm run typecheck

# Run production build
npm run build
```

---

## 5. Production Deployment (Vercel + Managed PostgreSQL)

1. **Database Setup**:
   - Provision a PostgreSQL database on Neon, Supabase, or AWS RDS.
   - In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
   - Update `DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"`.
   - Run `npx prisma db push`.
2. **Deploy to Vercel**:
   - Connect the repository to Vercel.
   - Set environment variables (`DATABASE_URL`, `SESSION_SECRET`, `GEO_USER_AGENT`, `NEXT_PUBLIC_MAP_STYLE`).
   - The build command is `npm run build` which runs `prisma generate && next build`.

---

## 6. Project Architecture & Directory Layout

```
newesturjasetu/
├── docs/
│   ├── ANALYSIS_METHOD.md     # Formulas, piecewise thresholds, and Manning equation
│   ├── DATA_SOURCES.md        # OpenStreetMap, Open-Meteo, NASA POWER, rate limits, CRS
│   ├── DECISIONS.md           # Architecture checkpoints and rationale
│   ├── KNOWN_GAPS.md          # P2 boundaries, external provider notes
│   └── EXTENDING.md           # Adding new infrastructure types and data providers
├── prisma/
│   └── schema.prisma          # Database schema (User, Scenario, Placement, Analysis, ProviderCache)
├── src/
│   ├── app/                   # Next.js App Router (pages and /api route handlers)
│   ├── components/
│   │   ├── layout/            # AppShell, TopBar, ToolSidebar
│   │   ├── map/               # MapView (MapLibre GL JS with canvas export)
│   │   ├── panels/            # PlacementPanel (dimensions, coordinates, params)
│   │   ├── reports/           # ReportDrawer (verdict, scorecard, evidence)
│   │   ├── history/           # HistoryDrawer (stored reports)
│   │   └── ui/                # StatusBadge, ScoreBar, NumberField, ConfirmDialog, Toast
│   ├── config/
│   │   └── infra-types.ts     # Complete registry for all 10 infrastructure types
│   ├── lib/
│   │   └── geojson-export.ts  # GeoJSON feature collection export
│   └── server/
│       ├── auth/              # JWT session management & bcrypt hashing
│       ├── db/                # Prisma singleton client
│       ├── gis/               # Turf.js geodesic geometry & footprint generation
│       ├── pdf/               # Server-side PDF report generator (pdf-lib)
│       ├── providers/         # Overpass, Nominatim, Open-Meteo, NASA POWER with DB cache
│       └── analysis-engine/   # Multi-criteria scoring engine & validation
└── tests/
    ├── unit/                  # Vitest geometry, scoring, engine, and pdf tests
    └── integration/           # Vitest API auth, isolation, and cascade deletion tests
```

---

## 7. Troubleshooting

- **Overpass API Rate Limit (HTTP 429)**: UrjaSetu caches successful Overpass responses in the database for 24 hours. If an un-cached area query hits rate limits, the engine retries against the configured backup mirror.
- **Map Tiles in Production**: Do not query public `tile.openstreetmap.org` for high-volume commercial production per OSM tile usage policy. Configure a vector style endpoint in `NEXT_PUBLIC_MAP_STYLE`.
