import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 6.1 Forensic Data Verification Audit', () => {
  const officialDir = path.join(process.cwd(), 'src', 'data', 'official');

  it('audits PMC Gardens dataset (pmc_gardens.json) against original municipal register', () => {
    const raw = fs.readFileSync(path.join(officialDir, 'pmc_gardens.json'), 'utf8');
    const data = JSON.parse(raw);

    expect(data.datasetId).toBe('pmc-official-gardens-2022');
    expect(data.featureCount).toBe(81);
    expect(data.features.length).toBe(81);
    expect(data.provenanceType).toBe('VERIFIED_OFFICIAL');
    expect(data.geometryType).toBe('Point');
    expect(data.operationalStatus).toBe('OPERATIONAL_STATUTORY_DISCLOSURE');

    data.features.forEach((f: any) => {
      expect(f.id).toMatch(/^PMC-GARDEN-/);
      expect(typeof f.lat).toBe('number');
      expect(typeof f.lng).toBe('number');
      // Must fall strictly within Pune municipal bounding box [18.40, 73.70] to [18.65, 74.05]
      expect(f.lat).toBeGreaterThanOrEqual(18.40);
      expect(f.lat).toBeLessThanOrEqual(18.65);
      expect(f.lng).toBeGreaterThanOrEqual(73.70);
      expect(f.lng).toBeLessThanOrEqual(74.05);
      expect(f.provenanceType).toBe('VERIFIED_OFFICIAL');
      expect(f.geometryType).toBe('Point');
      expect(f.name).toBeTruthy();
    });
  });

  it('audits PMC Hospitals dataset (pmc_hospitals.json) against health department register', () => {
    const raw = fs.readFileSync(path.join(officialDir, 'pmc_hospitals.json'), 'utf8');
    const data = JSON.parse(raw);

    expect(data.datasetId).toBe('pmc-official-hospitals-2021');
    expect(data.featureCount).toBe(50);
    expect(data.features.length).toBe(50);
    expect(data.provenanceType).toBe('VERIFIED_OFFICIAL');
    expect(data.geometryType).toBe('Point');
    expect(data.operationalStatus).toBe('OPERATIONAL_STATUTORY_DISCLOSURE');

    data.features.forEach((f: any) => {
      expect(f.id).toMatch(/^PMC-HOSP-/);
      expect(typeof f.lat).toBe('number');
      expect(typeof f.lng).toBe('number');
      expect(f.lat).toBeGreaterThanOrEqual(18.40);
      expect(f.lat).toBeLessThanOrEqual(18.65);
      expect(f.lng).toBeGreaterThanOrEqual(73.70);
      expect(f.lng).toBeLessThanOrEqual(74.05);
      expect(f.facilityType).toBe('Government hospital(PMC)');
      expect(f.provenanceType).toBe('VERIFIED_OFFICIAL');
      expect(f.geometryType).toBe('Point');
    });
  });

  it('audits MSEDCL Substations (pmc_substations.json) and verifies nameplate vs headroom distinction', () => {
    const raw = fs.readFileSync(path.join(officialDir, 'pmc_substations.json'), 'utf8');
    const data = JSON.parse(raw);

    expect(data.datasetId).toBe('msedcl-pune-substations');
    expect(data.featureCount).toBe(6);
    expect(data.features.length).toBe(6);
    expect(data.provenanceType).toBe('VERIFIED_PUBLIC_DISCLOSURE');
    expect(data.geometryType).toBe('Point');

    data.features.forEach((f: any) => {
      expect(f.id).toMatch(/^SUB_PUNE_/);
      expect(typeof f.capacityMva).toBe('number');
      expect(f.capacityMva).toBeGreaterThan(0);
      expect(f.nameplateCapacityMva).toBe(f.capacityMva);
      // Headroom must NOT be claimed as available without MSEDCL sanction
      expect(f.availableHeadroomMva).toBeNull();
      expect(f.headroomStatus).toBe('UNVERIFIED_REQUIRES_MSEDCL_SANCTION');
      expect(f.operationalStatus).toBe('OPERATIONAL_STATUTORY_DISCLOSURE');
    });
  });

  it('audits EV Stations (pmc_ev_stations.json) and verifies absence of injected default placeholders', () => {
    const raw = fs.readFileSync(path.join(officialDir, 'pmc_ev_stations.json'), 'utf8');
    const data = JSON.parse(raw);

    expect(data.datasetId).toBe('osm-pune-ev-stations');
    expect(data.featureCount).toBe(13);
    expect(data.features.length).toBe(13);

    data.features.forEach((f: any) => {
      expect(f.operationalStatus).toBe('MAPPED_IN_OSM');
      expect(f.telemetryVerified).toBe(false);
      expect(f.provenanceType).toBe('VERIFIED_OPENSTREETMAP');
      expect(f.geometryType).toBe('Point');
    });

    // Node 10844985580 must NOT have default-injected placeholder attributes
    const vimanNode = data.features.find((f: any) => f.id === 'OSM-EV-10844985580');
    expect(vimanNode).toBeDefined();
    expect(vimanNode.operator).toBeNull();
    expect(vimanNode.brand).toBeNull();
    expect(vimanNode.capacity).toBeNull();
    expect(vimanNode.socketType).toBeNull();

    // Node 763446417 must NOT have placeholder operator
    const cumminsNode = data.features.find((f: any) => f.id === 'OSM-EV-763446417');
    expect(cumminsNode).toBeDefined();
    expect(cumminsNode.operator).toBeNull();
    expect(cumminsNode.brand).toBeNull();
  });

  it('audits Road Corridors (pmc_road_corridors.json) and confirms MANUALLY_CURATED forensic reclassification', () => {
    const raw = fs.readFileSync(path.join(officialDir, 'pmc_road_corridors.json'), 'utf8');
    const data = JSON.parse(raw);

    expect(data.datasetId).toBe('osm-pune-arterial-corridors');
    expect(data.featureCount).toBe(10);
    expect(data.provenanceType).toBe('MANUALLY_CURATED');
    expect(data.geometryType).toBe('Point');

    data.features.forEach((f: any) => {
      expect(f.provenanceType).toBe('MANUALLY_CURATED');
      expect(f.sourceStatus).toBe('UNVERIFIED_SYNTHETIC_OSM_ID');
      expect(f.geometryType).toBe('Point');
      expect(f.carriagewaySource).toBe('ESTIMATED_PLANNING_ASSUMPTION');
      expect(f.lengthSource).toBe('ESTIMATED_CORRIDOR_EXTENT');
      expect(typeof f.lat).toBe('number');
      expect(typeof f.lng).toBe('number');
      expect(typeof f.carriagewayM).toBe('number');
    });
  });
});
