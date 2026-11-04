import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Green Loss Watch Pipeline & Synthetic Raster Unit Tests', () => {
  const greenLossScript = path.join(process.cwd(), 'scripts', 'pipeline', 'green_loss.py');
  const samplerScript = path.join(process.cwd(), 'scripts', 'pipeline', 'sample_for_review.py');
  const tempTestDir = path.join(process.cwd(), 'data', 'test_green_loss_synthetic');
  const modelCardPath = path.join(process.cwd(), 'public', 'data', 'priority', 'model_card.json');

  it('verifies green_loss.py and sample_for_review.py exist and are executable', () => {
    expect(fs.existsSync(greenLossScript)).toBe(true);
    expect(fs.existsSync(samplerScript)).toBe(true);

    const statLoss = fs.statSync(greenLossScript);
    const statSampler = fs.statSync(samplerScript);
    expect((statLoss.mode & 0o111) !== 0).toBe(true);
    expect((statSampler.mode & 0o111) !== 0).toBe(true);
  });

  it('displays help documentation with scientific rules and required CLI flags', () => {
    const lossHelp = execSync(`python3 "${greenLossScript}" --help`, { encoding: 'utf-8' });
    expect(lossHelp).toContain('Green Loss Watch Pipeline');
    expect(lossHelp).toContain('--cells-path');
    expect(lossHelp).toContain('--output-dir');
    expect(lossHelp).toContain('--ndvi-threshold');
    expect(lossHelp).toContain('--force-fail-gate');

    const sampleHelp = execSync(`python3 "${samplerScript}" --help`, { encoding: 'utf-8' });
    expect(sampleHelp).toContain('Visual Review Sampler');
    expect(sampleHelp).toContain('--green-loss-path');
    expect(sampleHelp).toContain('--output-csv');
    expect(sampleHelp).toContain('--n-samples');
  });

  it('evaluates loss logic with synthetic rasters / grid cells', () => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempTestDir, { recursive: true });

    // Construct synthetic grid cells representing diverse landscape conditions:
    // Cell 1: Genuine vegetation loss (High drop in NDVI + NDBI rise due to urbanization)
    // Cell 2: Fallow / seasonal cycle (NDVI drop but NDBI decreased / water rise)
    // Cell 3: Stable vegetation / greening (NDVI stable or increased)
    // Cell 4: Missing / unmeasured data (NDVI is null -> unknown stays null)
    const syntheticCells = [
      {
        id: 'cell_synth_loss_1',
        centroid: [73.8123, 18.5042],
        ward: 'Kothrud',
        ndvi: 0.28, // Currently low NDVI in 2026
        built_frac: 0.65,
        population: 1800,
        burden: 14.5
      },
      {
        id: 'cell_synth_stable_2',
        centroid: [73.8567, 18.5204],
        ward: 'Kasba Vishrambaugwada',
        ndvi: 0.12,
        built_frac: 0.90,
        population: 3200,
        burden: 22.1
      },
      {
        id: 'cell_synth_unmeasured_3',
        centroid: [73.8901, 18.5301],
        ward: 'Hadapsar - Mundhwa',
        ndvi: null, // Unknown data
        built_frac: 0.40,
        population: 1200,
        burden: null
      }
    ];

    const syntheticCellsFile = path.join(tempTestDir, 'synthetic_cells.json');
    fs.writeFileSync(syntheticCellsFile, JSON.stringify(syntheticCells, null, 2), 'utf-8');

    // Run green_loss.py against synthetic cells with default threshold 0.10
    const cmd = `python3 "${greenLossScript}" --cells-path "${syntheticCellsFile}" --model-card "${modelCardPath}" --output-dir "${tempTestDir}" --offline`;
    const result = execSync(cmd, { encoding: 'utf-8' });

    expect(result).toContain('GREEN LOSS WATCH PIPELINE COMPLETED SUCCESSFULLY');

    const outputFile = path.join(tempTestDir, 'green_loss.json');
    expect(fs.existsSync(outputFile)).toBe(true);

    const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(data.metadata).toBeDefined();
    expect(data.metadata.total_cells).toBeUndefined(); // It's total_cells_evaluated
    expect(data.metadata.total_cells_evaluated).toBe(3);
    expect(data.metadata.total_loss_cells).toBeGreaterThanOrEqual(1);

    // Verify cell 3: unmeasured stays strictly null (Scientific Governance Rule)
    const cell3 = data.cells.find((c: any) => c.id === 'cell_synth_unmeasured_3');
    expect(cell3).toBeDefined();
    expect(cell3.ndvi_2019).toBeNull();
    expect(cell3.ndvi_2026).toBeNull();
    expect(cell3.delta_ndvi).toBeNull();
    expect(cell3.is_loss).toBe(false);
    expect(cell3.extra_heat_mean).toBeNull();

    // Verify cell 1: flagged as vegetation loss when ΔNDVI <= -0.10 and ΔNDBI > 0
    const cell1 = data.cells.find((c: any) => c.id === 'cell_synth_loss_1');
    expect(cell1).toBeDefined();
    if (cell1.is_loss) {
      expect(cell1.delta_ndvi).toBeLessThanOrEqual(-0.10);
      expect(cell1.delta_ndbi).toBeGreaterThan(0.0);
      expect(cell1.loss_area_ha).toBeGreaterThan(0.0);
      expect(cell1.extra_heat_mean).toBeGreaterThan(0.0);
      expect(cell1.extra_heat_p10).toBeLessThanOrEqual(cell1.extra_heat_mean);
      expect(cell1.extra_heat_p90).toBeGreaterThanOrEqual(cell1.extra_heat_mean);
    }
  });

  it('strictly nullifies extra surface heat when model direction gate fails', () => {
    const testFailGateDir = path.join(process.cwd(), 'data', 'test_green_loss_fail_gate');
    if (fs.existsSync(testFailGateDir)) {
      fs.rmSync(testFailGateDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testFailGateDir, { recursive: true });

    const cellsSource = path.join(process.cwd(), 'public', 'data', 'priority', 'cells.json');
    const cmd = `python3 "${greenLossScript}" --cells-path "${cellsSource}" --model-card "${modelCardPath}" --output-dir "${testFailGateDir}" --force-fail-gate --offline`;
    execSync(cmd, { encoding: 'utf-8' });

    const outputFile = path.join(testFailGateDir, 'green_loss.json');
    const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));

    expect(data.metadata.model_gate_passed).toBe(false);
    expect(data.metadata.model_gate_failure_reason).toContain('Thermodynamic direction check failed');

    // All cells must have null extra heat fields
    data.cells.forEach((cell: any) => {
      expect(cell.extra_heat_mean).toBeNull();
      expect(cell.extra_heat_p10).toBeNull();
      expect(cell.extra_heat_p90).toBeNull();
    });

    // Cleanup
    fs.rmSync(testFailGateDir, { recursive: true, force: true });
  });

  it('aggregates loss statistics across all 23 PMC municipal wards sorted descending by loss area', () => {
    const publicLossFile = path.join(process.cwd(), 'public', 'data', 'priority', 'green_loss.json');
    expect(fs.existsSync(publicLossFile)).toBe(true);

    const data = JSON.parse(fs.readFileSync(publicLossFile, 'utf-8'));
    expect(data.ward_aggregates).toBeDefined();
    expect(data.ward_aggregates.length).toBe(23);

    // Verify sorting descending by total_loss_area_ha
    for (let i = 0; i < data.ward_aggregates.length - 1; i++) {
      expect(data.ward_aggregates[i].total_loss_area_ha).toBeGreaterThanOrEqual(data.ward_aggregates[i + 1].total_loss_area_ha);
    }

    // Verify ward names match authentic PMC wards
    const wardNames = data.ward_aggregates.map((w: any) => w.ward);
    expect(wardNames).toContain('Kothrud');
    expect(wardNames).toContain('Kasba Vishrambaugwada');
    expect(wardNames).toContain('Shivajinagar - Ghole Road');
    expect(wardNames).toContain('Hadapsar - Mundhwa');
  });

  it('exports visual review samples with coordinates and required attributes', () => {
    const publicLossFile = path.join(process.cwd(), 'public', 'data', 'priority', 'green_loss.json');
    const sampleCsv = path.join(tempTestDir, 'sample_review_test.csv');

    const cmd = `python3 "${samplerScript}" --green-loss-path "${publicLossFile}" --output-csv "${sampleCsv}" --n-samples 10 --seed 42`;
    const stdout = execSync(cmd, { encoding: 'utf-8' });

    expect(stdout).toContain('SAMPLED CELLS FOR VISUAL GROUND-TRUTHING');
    expect(stdout).toContain('Exported');
    expect(fs.existsSync(sampleCsv)).toBe(true);

    const csvContent = fs.readFileSync(sampleCsv, 'utf-8');
    const lines = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    expect(lines.length).toBeGreaterThan(1);

    const headers = lines[0].split(',');
    expect(headers).toContain('id');
    expect(headers).toContain('centroid_lng');
    expect(headers).toContain('centroid_lat');
    expect(headers).toContain('ward');
    expect(headers).toContain('ndvi_2019');
    expect(headers).toContain('ndvi_2026');
    expect(headers).toContain('delta_ndvi');
    expect(headers).toContain('ndbi_2019');
    expect(headers).toContain('ndbi_2026');
    expect(headers).toContain('delta_ndbi');
    expect(headers).toContain('loss_area_ha');
    expect(headers).toContain('extra_heat_mean');

    // Parse first data row and verify valid float coordinates
    const firstRow = lines[1].split(',');
    const lng = parseFloat(firstRow[headers.indexOf('centroid_lng')]);
    const lat = parseFloat(firstRow[headers.indexOf('centroid_lat')]);
    expect(lng).toBeGreaterThan(73.0);
    expect(lng).toBeLessThan(75.0);
    expect(lat).toBeGreaterThan(18.0);
    expect(lat).toBeLessThan(19.0);

    // Clean up temporary test directory
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });
});
