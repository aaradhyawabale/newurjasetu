# Known Gaps, External Dependencies & Phase Limitations — UrjaSetu

## 1. Phase 1 Deliberate Exclusions (P2 Scope)
In accordance with project scope specifications, the following features are intentionally omitted from Phase 1 to preserve simplicity and avoid fabricated data:
1. **Government Document Ingestion**: No parsing of municipal Master Plan PDFs, cadastral revenue village maps, or municipal boundary records.
2. **AI Document Search**: No retrieval-augmented generation (RAG) over unverified planning literature.
3. **Real-Time Sensor Feeds**: No live telemetry from IoT rainfall stations, river discharge gauges, or grid SCADA monitors.
4. **Project Construction Progress**: No post-clearance Gantt charts, billing, or milestone tracking.
5. **Multi-Tenant Enterprise Organizations**: Each user has an isolated account workspace with strictly partitioned scenarios. Multi-organization team roles are deferred to future enterprise phases.
6. **Commercial Payment Gateways**: The application operates without subscription paywalls in Phase 1.

---

## 2. External Provider Dependencies & Network Resiliency
1. **Public Overpass API Latency**:
   - Overpass API instances may occasionally experience high load or query throttling (HTTP 429).
   - *Mitigation implemented*: UrjaSetu maintains an automatic fallback to a secondary mirror (`overpass.kumi.systems`), enforces bounded 25-second query timeouts, caches responses in the local database for 24 hours, and surfaces graceful UI error banners if all public mirrors fail.
2. **Volunteered Geographic Data Coverage**:
   - In rural, emerging peri-urban, or developing regions, OpenStreetMap road networks, building footprints, and water bodies may be partially incomplete.
   - *Mitigation implemented*: The analysis engine computes a quantitative OSM feature density metric and flags coverage warnings when density drops below 3.0 features/km².
3. **Digital Elevation Model (DEM) Resolution**:
   - Open-Meteo elevation is derived from Copernicus DEM (90m and 30m resolution). Small micro-topographic ditches (< 30m) or micro-grading will not appear in satellite radar elevation grids.
   - *Mitigation implemented*: Reports clearly specify the data source and state that site-level cut-and-fill balances require on-site total-station land surveys.

---

## 3. Sandboxed Local Development Notes
- Local automated tests use Prisma with SQLite for deterministic, self-contained execution without external database daemon requirements.
- Production deployments can switch to PostgreSQL (Neon, Supabase, AWS RDS) by providing the standard `DATABASE_URL` connection string.
