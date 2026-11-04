import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('UrjaSetu Priority Engine Model Training Pipeline Script', () => {
  const trainScriptPath = path.join(process.cwd(), 'scripts', 'pipeline', 'train_model.py');
  const dataPath = path.join(process.cwd(), 'data', 'pipeline_output', 'training_table_100m.csv');
  const testOutputDir = path.join(process.cwd(), 'data', 'train_model_test_output');
  const testFailDir = path.join(process.cwd(), 'data', 'train_model_fail_test');

  it('verifies train_model.py exists and is executable', () => {
    expect(fs.existsSync(trainScriptPath)).toBe(true);
    const stat = fs.statSync(trainScriptPath);
    expect((stat.mode & 0o111) !== 0).toBe(true);
  });

  it('runs train_model.py --help cleanly with all options', () => {
    const output = execSync(`python3 "${trainScriptPath}" --help`, { encoding: 'utf-8' });
    expect(output).toContain('UrjaSetu Priority Engine: Model Training');
    expect(output).toContain('--data-path');
    expect(output).toContain('--aggregates-path');
    expect(output).toContain('--output-dir');
    expect(output).toContain('--target-ndvi');
    expect(output).toContain('--n-ensemble');
    expect(output).toContain('--block-size-km');
    expect(output).toContain('--force-fail-direction-check');
  });

  it('trains model with spatial-block CV, 30-member bootstrap ensemble, and successful direction check', () => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testOutputDir, { recursive: true });

    // Copy current cells.json to test output directory
    const cellsSrc = path.join(process.cwd(), 'public', 'data', 'priority', 'cells.json');
    const cellsDst = path.join(testOutputDir, 'cells.json');
    fs.copyFileSync(cellsSrc, cellsDst);

    const cmd = `python3 "${trainScriptPath}" --data-path "${dataPath}" --aggregates-path "${cellsDst}" --output-dir "${testOutputDir}" --target-ndvi 0.65 --n-ensemble 30 --block-size-km 2.0`;
    const execResult = execSync(cmd, { encoding: 'utf-8' });
    expect(execResult).toContain('MODEL TRAINING & INFERENCE COMPLETED SUCCESSFULLY');
    expect(execResult).toContain('Spatial CV RMSE:');
    expect(execResult).toContain('Spatial CV R²:');
    expect(execResult).toContain('NDVI-LST Direction Check: PASSED_PHYSICAL_CONSISTENCY');

    // 1. Check updated model_card.json
    const cardPath = path.join(testOutputDir, 'model_card.json');
    expect(fs.existsSync(cardPath)).toBe(true);
    const card = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
    expect(card.metrics.rmse_celsius).toBeGreaterThan(0);
    expect(card.metrics.r2_score).toBeGreaterThan(0.5);
    expect(card.metrics.ensemble_members).toBe(30);
    expect(card.metrics.spatial_block_size_km).toBe(2.0);
    expect(card.direction_check.passed).toBe(true);
    expect(card.direction_check.status).toBe('PASSED_PHYSICAL_CONSISTENCY');
    expect(card.direction_check.violations_count).toBe(0);

    // 2. Check updated cells.json
    const updatedCells = JSON.parse(fs.readFileSync(cellsDst, 'utf-8'));
    expect(Array.isArray(updatedCells)).toBe(true);
    const validCell = updatedCells.find((c: any) => c.ndvi !== null && c.greenable_ha !== null);
    expect(validCell).toBeDefined();
    expect(validCell.cooling_mean).toBeGreaterThan(0);
    expect(validCell.cooling_p10).toBeLessThanOrEqual(validCell.cooling_p90);

    // 3. Check ensemble_effects.bin
    const binPath = path.join(testOutputDir, 'ensemble_effects.bin');
    expect(fs.existsSync(binPath)).toBe(true);
    const binBuffer = fs.readFileSync(binPath);
    expect(binBuffer.length).toBe(updatedCells.length * 30 * 4);

    // Cleanup
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  it('sets cooling fields to null and logs explanation when direction check fails', () => {
    if (fs.existsSync(testFailDir)) {
      fs.rmSync(testFailDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testFailDir, { recursive: true });

    const cellsSrc = path.join(process.cwd(), 'public', 'data', 'priority', 'cells.json');
    const cellsDst = path.join(testFailDir, 'cells.json');
    fs.copyFileSync(cellsSrc, cellsDst);

    const cmd = `python3 "${trainScriptPath}" --data-path "${dataPath}" --aggregates-path "${cellsDst}" --output-dir "${testFailDir}" --force-fail-direction-check`;
    const execResult = execSync(cmd, { encoding: 'utf-8' });
    expect(execResult).toContain('NDVI-LST Direction Check: FAILED_THERMODYNAMIC_DIRECTION');

    // 1. Verify model_card.json records failure and explains why
    const cardPath = path.join(testFailDir, 'model_card.json');
    const card = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
    expect(card.direction_check.passed).toBe(false);
    expect(card.direction_check.status).toBe('FAILED_THERMODYNAMIC_DIRECTION');
    expect(card.direction_check.reason).toContain('FAILED DIRECTION CHECK');
    expect(card.limitations.some((l: string) => l.includes('FAILED DIRECTION CHECK'))).toBe(true);

    // 2. Verify all cells have null cooling metrics
    const failedCells = JSON.parse(fs.readFileSync(cellsDst, 'utf-8'));
    failedCells.forEach((cell: any) => {
      expect(cell.cooling_mean).toBeNull();
      expect(cell.cooling_p10).toBeNull();
      expect(cell.cooling_p90).toBeNull();
    });

    // Cleanup
    fs.rmSync(testFailDir, { recursive: true, force: true });
  });
});
