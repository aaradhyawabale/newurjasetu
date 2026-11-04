import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('UrjaSetu Priority Engine Dataset Pipeline Script', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'pipeline', 'build_dataset.py');
  const testOutputDir = path.join(process.cwd(), 'data', 'pipeline_test_output');

  it('verifies build_dataset.py exists and is executable', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const stat = fs.statSync(scriptPath);
    // Check user execute bit
    expect((stat.mode & 0o111) !== 0).toBe(true);
  });

  it('runs build_dataset.py --help cleanly', () => {
    const output = execSync(`python3 "${scriptPath}" --help`, { encoding: 'utf-8' });
    expect(output).toContain('UrjaSetu Priority Engine Dataset Pipeline');
    expect(output).toContain('--bbox');
    expect(output).toContain('--start-year');
    expect(output).toContain('--end-year');
    expect(output).toContain('--pop-source');
    expect(output).toContain('--pop-license');
    expect(output).toContain('--output-dir');
  });

  it('executes pipeline and generates 100m training table, 250m aggregates, and dataset_manifest.json', () => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }

    const cmd = `python3 "${scriptPath}" --offline --output-dir "${testOutputDir}" --pop-source "worldpop_2022_100m" --pop-year 2022 --pop-license "CC-BY 4.0"`;
    const execResult = execSync(cmd, { encoding: 'utf-8' });
    expect(execResult).toContain('PIPELINE COMPLETED SUCCESSFULLY');

    // 1. Verify 100m training table
    const trainCsv = path.join(testOutputDir, 'training_table_100m.csv');
    expect(fs.existsSync(trainCsv)).toBe(true);
    const trainLines = fs.readFileSync(trainCsv, 'utf-8').trim().split('\n');
    expect(trainLines.length).toBeGreaterThan(10);
    const trainHeader = trainLines[0].split(',');
    expect(trainHeader).toContain('cell_id');
    expect(trainHeader).toContain('lng');
    expect(trainHeader).toContain('lat');
    expect(trainHeader).toContain('lst_median');
    expect(trainHeader).toContain('lst_std');
    expect(trainHeader).toContain('n_obs');
    expect(trainHeader).toContain('ndvi');
    expect(trainHeader).toContain('ndbi');
    expect(trainHeader).toContain('ndwi');
    expect(trainHeader).toContain('elevation');
    expect(trainHeader).toContain('slope');
    expect(trainHeader).toContain('building_density');
    expect(trainHeader).toContain('distance_to_water_m');
    expect(trainHeader).toContain('population');

    // 2. Verify 250m aggregates
    const aggJson = path.join(testOutputDir, 'aggregates_250m.json');
    const aggCsv = path.join(testOutputDir, 'aggregates_250m.csv');
    expect(fs.existsSync(aggJson)).toBe(true);
    expect(fs.existsSync(aggCsv)).toBe(true);

    const aggData = JSON.parse(fs.readFileSync(aggJson, 'utf-8'));
    expect(Array.isArray(aggData)).toBe(true);
    expect(aggData.length).toBeGreaterThan(0);
    const firstCell = aggData[0];
    expect(firstCell).toHaveProperty('id');
    expect(firstCell).toHaveProperty('centroid');
    expect(firstCell).toHaveProperty('ward');
    expect(firstCell).toHaveProperty('population');
    expect(firstCell).toHaveProperty('lst_mean');
    expect(firstCell).toHaveProperty('lst_std');
    expect(firstCell).toHaveProperty('n_obs');
    expect(firstCell).toHaveProperty('ndvi');
    expect(firstCell).toHaveProperty('built_frac');
    expect(firstCell).toHaveProperty('greenable_ha');
    expect(firstCell).toHaveProperty('burden');
    expect(firstCell).toHaveProperty('cooling_mean');
    expect(firstCell).toHaveProperty('cooling_p10');
    expect(firstCell).toHaveProperty('cooling_p90');

    // 3. Verify dataset_manifest.json
    const manifestPath = path.join(testOutputDir, 'dataset_manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.manifest_version).toBe('1.0.0');
    expect(manifest.temporal_parameters.months).toEqual([3, 4, 5]);

    // Check all required sources logged
    expect(manifest.sources.landsat_c2_l2).toBeDefined();
    expect(manifest.sources.landsat_c2_l2.bands).toContain('ST_B10');
    expect(manifest.sources.sentinel_2_l2a).toBeDefined();
    expect(manifest.sources.sentinel_2_l2a.indices).toHaveProperty('NDVI');
    expect(manifest.sources.sentinel_2_l2a.indices).toHaveProperty('NDBI');
    expect(manifest.sources.sentinel_2_l2a.indices).toHaveProperty('NDWI');
    expect(manifest.sources.copernicus_dem).toBeDefined();
    expect(manifest.sources.osm_infrastructure).toBeDefined();
    expect(manifest.sources.population_grid).toBeDefined();
    expect(manifest.sources.population_grid.license).toBe('CC-BY 4.0');
    expect(manifest.sources.population_grid.reference_year).toBe(2022);

    // Check scientific governance disclaimers
    const disclaimers = manifest.scientific_governance_disclaimers.join(' ');
    expect(disclaimers).toContain('NOT 2m ambient air temperature');
    expect(disclaimers).toContain('NOT 3D tree canopy cover');
    expect(disclaimers).toContain('No arbitrary weighted composite scores');

    // Cleanup test output
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });
});
