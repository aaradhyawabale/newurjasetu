# Architecture & Implementation Decisions — UrjaSetu

## 1. Project Scaffolding & Framework Choice
- **Decision**: Next.js 14+ (App Router) with TypeScript (strict), Tailwind CSS, Lucide icons, and `@turf/turf`.
- **Rationale**: Meets specification in Section 5. App Router provides native Route Handlers (`src/server`) and client components for interactive MapLibre GL JS integration.

## 2. Database & Persistence Layer
- **Decision**: Prisma ORM with SQLite database for local development, reproducible sandboxed execution, and automated testing, with clean migration scripts compatible with PostgreSQL (Neon / Supabase) for production.
- **Rationale**: Local macOS sandbox environments isolate network and external Unix sockets by default. A file-based SQLite database requires zero external daemon setup, guarantees reproducible automated tests in CI/sandbox without port collisions, and Prisma provides type-safe queries, foreign keys, and JSON fields matching the PostgreSQL schema specifications.

## 3. Map Engine & GIS Geometry
- **Decision**: `maplibre-gl` for rendering and `@turf/turf` for geodesic and Euclidean geometry calculations (area, distance, bounding box, oriented rectangle footprint generation, and polygon intersection).
- **Rationale**: MapLibre GL JS is open-source, fast, and does not require proprietary access tokens. Calculations use WGS84 coordinates with geodesic turf functions to guarantee accurate metric measurements anywhere on Earth.

## 4. PDF Generation
- **Decision**: `pdf-lib` for fast, dependency-free server-side PDF generation embedding the client-captured MapLibre PNG canvas, criterion scorecard, supporting factors, risks, data gaps, and methodology.
- **Rationale**: `pdf-lib` has zero native system bindings (no Chrome/Puppeteer or Cairo dependencies), produces compact PDFs reliably, and executes identically on all operating systems.

## 5. Authentication Architecture
- **Decision**: Secure session cookies with salted bcrypt password hashing and HTTP-only cookie tokens, backed by the `User` database table. All Route Handlers verify sessions and enforce user ownership (`user_id`).
- **Rationale**: Self-contained, secure, independent of external third-party auth services during local development and testing, while completely satisfying the user requirement that users only see their own scenarios, placements, and reports.

## 6. Geospatial Data Providers & Resilience
- **Decision**: Define a unified `DataProvider` interface with implementations:
  1. `OverpassProvider`: OpenStreetMap Overpass API for infrastructure, building footprints, waterways, and railways. Includes query timeout, bounded radius queries, and a DB-backed 24-hour cache.
  2. `NominatimProvider`: OpenStreetMap Nominatim for geocoding and reverse geocoding with 1-second throttling and DB cache.
  3. `OpenMeteoProvider`: Open-Meteo Elevation API (elevation & 3x3 slope calculation) and historical precipitation API.
  4. `NasaPowerProvider`: NASA POWER Agroclimatology API for solar irradiance (GHI / direct normal).
- **Fallback & Resilience**: If external providers are offline, rate-limited, or unreachable, the system returns clear error feedback or test fixtures if explicitly requested in test mode. It never manufactures fake data in production mode.
