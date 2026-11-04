import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { 
  isSolarModelCardAvailable, 
  getSolarModelCardSync, 
  getPriorityCellsSync,
  clearPriorityCache
} from '@/server/priority/loader';

describe('Solar Heat Penalty Module: Time-Based Split & Null Handling Tests', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'pipeline', 'solar_temp_model.py');
  const tempTestDir = path.join(process.cwd(), 'data', 'test_solar_pipeline_synthetic');
  const solarModelCardPath = path.join(process.cwd(), 'public', 'data', 'priority', 'solar_model_card.json');

  it('verifies solar_temp_model.py exists and is executable', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const stat = fs.statSync(scriptPath);
    expect((stat.mode & 0o111) !== 0).toBe(true);
  });

  it('displays help documentation with time-based holdout and governance disclaimers', () => {
    const helpOut = execSync(`python3 "${scriptPath}" --help`, { encoding: 'utf-8' });
    expect(helpOut).toContain('Solar Heat Penalty');
    expect(helpOut).toContain('--solar-dir');
    expect(helpOut).toContain('--cells-path');
    expect(helpOut).toContain('--output-dir');
    expect(helpOut).toContain('--n-bootstrap');
  });

  it('verifies strict time-based split: holds out whole days with zero leakage', () => {
    // Run Python verification of split_by_whole_days function
    const pySplitCheck = `
import sys
from scripts.pipeline.solar_temp_model import split_by_whole_days

records = []
dates = [f"2020-05-{d:02d}" for d in range(15, 32)] + [f"2020-06-{d:02d}" for d in range(1, 18)]

for d in dates:
    for h in range(8, 17):
        records.append({
            "date": d,
            "datetime": f"{d} {h:02d}:00:00",
            "irradiation": 0.75,
            "module_temperature": 50.0,
            "ac_power": 700.0
        })

train, test, train_days, test_days = split_by_whole_days(records, holdout_fraction=0.20, seed=42)

# Check 1: Day sets are strictly disjoint
overlap = set(train_days) & set(test_days)
assert len(overlap) == 0, f"Leakage detected: {overlap}"

# Check 2: No records in train have a test date
train_leaked = [r for r in train if r["date"] in set(test_days)]
assert len(train_leaked) == 0, "Train records contain test day data!"

# Check 3: All records for test days are in test set
test_missing = [r for r in records if r["date"] in set(test_days) and r not in test]
assert len(test_missing) == 0, "Not all records from test days placed in test set!"

print(f"SPLIT_OK: total_days={len(dates)}, train_days={len(train_days)}, test_days={len(test_days)}")
`;

    const result = execSync(`python3 -c '${pySplitCheck}'`, { encoding: 'utf-8' });
    expect(result).toContain('SPLIT_OK');
    expect(result).toContain('total_days=34');
    expect(result).toContain('test_days=7');
    expect(result).toContain('train_days=27');
  });

  it('verifies strict null handling: unmeasured inputs stay null and are never fabricated', () => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempTestDir, { recursive: true });

    // Test Python data loader null handling with missing irradiation and module temperature
    const pyNullCheck = `
import os, csv
from scripts.pipeline.solar_temp_model import load_and_merge_plant_data, apply_solar_heat_penalty_to_cells

test_dir = "${tempTestDir}"
weather_file = os.path.join(test_dir, "Plant_1_Weather_Sensor_Data.csv")
gen_file = os.path.join(test_dir, "Plant_1_Generation_Data.csv")

# Create weather file with some null/invalid entries
with open(weather_file, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["DATE_TIME", "PLANT_ID", "SOURCE_KEY", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE", "IRRADIATION"])
    writer.writeheader()
    # Row 1: Valid
    writer.writerow({"DATE_TIME": "2020-05-15 12:00:00", "PLANT_ID": 4135001, "SOURCE_KEY": "S1", "AMBIENT_TEMPERATURE": "32.0", "MODULE_TEMPERATURE": "52.0", "IRRADIATION": "0.85"})
    # Row 2: Missing irradiation (null)
    writer.writerow({"DATE_TIME": "2020-05-15 12:15:00", "PLANT_ID": 4135001, "SOURCE_KEY": "S1", "AMBIENT_TEMPERATURE": "32.0", "MODULE_TEMPERATURE": "52.0", "IRRADIATION": ""})
    # Row 3: Missing module temp (null)
    writer.writerow({"DATE_TIME": "2020-05-15 12:30:00", "PLANT_ID": 4135001, "SOURCE_KEY": "S1", "AMBIENT_TEMPERATURE": "32.0", "MODULE_TEMPERATURE": "null", "IRRADIATION": "0.85"})

# Create matching generation file
with open(gen_file, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["DATE_TIME", "PLANT_ID", "SOURCE_KEY", "DC_POWER", "AC_POWER", "DAILY_YIELD", "TOTAL_YIELD"])
    writer.writeheader()
    writer.writerow({"DATE_TIME": "15-05-2020 12:00", "PLANT_ID": 4135001, "SOURCE_KEY": "INV1", "DC_POWER": "800", "AC_POWER": "780", "DAILY_YIELD": "100", "TOTAL_YIELD": "1000"})
    writer.writerow({"DATE_TIME": "15-05-2020 12:15", "PLANT_ID": 4135001, "SOURCE_KEY": "INV1", "DC_POWER": "800", "AC_POWER": "780", "DAILY_YIELD": "100", "TOTAL_YIELD": "1000"})
    writer.writerow({"DATE_TIME": "15-05-2020 12:30", "PLANT_ID": 4135001, "SOURCE_KEY": "INV1", "DC_POWER": "800", "AC_POWER": "780", "DAILY_YIELD": "100", "TOTAL_YIELD": "1000"})

merged = load_and_merge_plant_data(test_dir, 1)
# Only Row 1 should be included; Rows 2 & 3 must be excluded due to nulls!
assert len(merged) == 1, f"Expected 1 merged row, got {len(merged)}"
assert merged[0]["datetime"] == "2020-05-15 12:00:00"
print("LOADER_NULL_HANDLING_OK")
`;

    const nullResult = execSync(`python3 -c '${pyNullCheck}'`, { encoding: 'utf-8' });
    expect(nullResult).toContain('LOADER_NULL_HANDLING_OK');

    // Test cell null handling: cell with null LST must have null solar penalty
    const pyCellNullCheck = `
import json
from scripts.pipeline.solar_temp_model import apply_solar_heat_penalty_to_cells

test_cells = [
    {"id": "cell_baseline", "centroid": [73.84, 18.51], "lst_mean": 32.0},
    {"id": "cell_valid", "centroid": [73.85, 18.52], "lst_mean": 42.0},
    {"id": "cell_null_lst", "centroid": [73.86, 18.53], "lst_mean": None}
]

cells_file = "${tempTestDir}/test_cells.json"
with open(cells_file, "w") as f:
    json.dump(test_cells, f)

stats = {
    "penalty_per_celsius_mean": -0.42,
    "percent_change_per_10c_p10": -5.1,
    "percent_change_per_10c_p90": -3.4
}

apply_solar_heat_penalty_to_cells(cells_file, stats, cells_file)

with open(cells_file) as f:
    updated = json.load(f)

c_null = next(c for c in updated if c["id"] == "cell_null_lst")
assert c_null["solar_penalty_mean"] is None, "Null LST cell must have null solar_penalty_mean"
assert c_null["solar_penalty_p10"] is None, "Null LST cell must have null solar_penalty_p10"
assert c_null["solar_penalty_p90"] is None, "Null LST cell must have null solar_penalty_p90"
assert c_null["heat_excess_celsius"] is None, "Null LST cell must have null heat_excess_celsius"

c_valid = next(c for c in updated if c["id"] == "cell_valid")
assert c_valid["solar_penalty_mean"] is not None
assert c_valid["solar_penalty_mean"] < 0.0, "Valid hot cell must have negative penalty"
print("CELL_NULL_HANDLING_OK")
`;

    const cellNullResult = execSync(`python3 -c '${pyCellNullCheck}'`, { encoding: 'utf-8' });
    expect(cellNullResult).toContain('CELL_NULL_HANDLING_OK');

    // Clean up temporary test directory
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  it('validates solar_model_card.json contents, dates, and mandatory limitations', () => {
    expect(fs.existsSync(solarModelCardPath)).toBe(true);
    expect(isSolarModelCardAvailable()).toBe(true);

    const card = getSolarModelCardSync();
    expect(card).not.toBeNull();
    if (!card) return;

    // 1. Training dates and duration (34 days)
    expect(card.training_dates.total_days).toBe(34);
    expect(card.training_dates.start_date).toBe('2020-05-15');
    expect(card.training_dates.end_date).toBe('2020-06-17');

    // 2. Two plants reported individually with RMSE and R²
    expect(card.dataset_plants.length).toBe(2);
    card.dataset_plants.forEach((plant) => {
      expect(plant.rmse_kw).toBeGreaterThan(0);
      expect(plant.r2_score).toBeGreaterThan(0.90);
      expect(plant.train_days).toBe(27);
      expect(plant.test_days).toBe(7);
      expect(plant.train_days + plant.test_days).toBe(34);
    });

    // 3. Temperature penalty: percent change per +10°C is negative and bootstrap range is consistent
    const tp = card.temperature_penalty;
    expect(tp.percent_change_per_10c_mean).toBeLessThan(0);
    expect(tp.percent_change_per_10c_p10).toBeLessThanOrEqual(tp.percent_change_per_10c_mean);
    expect(tp.percent_change_per_10c_p90).toBeGreaterThanOrEqual(tp.percent_change_per_10c_mean);
    expect(tp.bootstrap_samples).toBe(30);

    // 4. Required limitations
    const limitationsText = card.limitations.join(' ');
    expect(limitationsText).toContain('34 days');
    expect(limitationsText).toContain('two utility-scale');
    expect(limitationsText).toContain('Not Pune-specific');
    expect(limitationsText).toContain('Relative output loss only');

    // 5. Governance disclaimers
    const disclaimersText = card.governance.disclaimers.join(' ');
    expect(disclaimersText).toContain('Surface temperature (LST) is radiometric skin temperature');
    expect(disclaimersText).toContain('NOT 2m air temperature');
    expect(disclaimersText).toContain('Do NOT present absolute kWh for Pune');
    expect(card.governance.provenance_tag).toBe('Modelled');
  });

  it('verifies all Pune 250m priority cells have relative solar penalty without absolute kWh', () => {
    // Clear cache to read freshly updated cells.json
    clearPriorityCache();
    const cells = getPriorityCellsSync();
    expect(cells.length).toBeGreaterThan(0);

    cells.forEach((cell) => {
      // Must NOT contain any absolute kWh generation property
      expect((cell as any).kwh).toBeUndefined();
      expect((cell as any).solar_kwh).toBeUndefined();
      expect((cell as any).annual_kwh).toBeUndefined();

      if (cell.lst_mean === null) {
        expect(cell.solar_penalty_mean).toBeNull();
        expect(cell.solar_penalty_p10).toBeNull();
        expect(cell.solar_penalty_p90).toBeNull();
        expect(cell.heat_excess_celsius).toBeNull();
      } else {
        expect(typeof cell.solar_penalty_mean).toBe('number');
        expect(cell.solar_penalty_mean).toBeLessThanOrEqual(0.0);
        expect(cell.heat_excess_celsius).toBeGreaterThanOrEqual(0.0);
      }
    });
  });
});
