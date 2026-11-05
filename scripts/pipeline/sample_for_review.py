#!/usr/bin/env python3
"""
UrjaSetu Priority Engine: Visual Review Sampler (scripts/pipeline/sample_for_review.py)

Exports 30 random flagged vegetation loss cells as a CSV with coordinates
for visual ground-truthing and human-in-the-loop inspection:
- id, centroid_lng, centroid_lat, ward
- ndvi_2019, ndvi_2026, delta_ndvi
- ndbi_2019, ndbi_2026, delta_ndbi
- extra_heat_mean, extra_heat_p10, extra_heat_p90, loss_area_ha

Scientific Governance Rules:
- Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature.
- NDVI is a spectral vegetation reflectance index, NOT 3D canopy cover or shading.
- No arbitrary weighted composite scores.
- Unknown values stay null and show "Not available".
- Every parameter tagged as Measured, Modelled, or Assumed.
"""

import os
import sys
import csv
import json
import random
import argparse
from typing import Dict, List, Any, Optional


def sample_loss_cells(
    green_loss_path: str,
    output_csv_path: str,
    n_samples: int = 30,
    n_control: int = 15,
    seed: Optional[int] = 42
) -> List[Dict[str, Any]]:
    """Loads green loss dataset and samples flagged loss cells plus control cells for visual review."""
    if not os.path.exists(green_loss_path):
        raise FileNotFoundError(f"Green loss dataset file not found at: {green_loss_path}")

    with open(green_loss_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_cells = data.get("cells", [])
    flagged_cells = [c for c in all_cells if c.get("is_loss")]
    control_candidates = [c for c in all_cells if not c.get("is_loss") and c.get("ndvi_2026") is not None]

    if not flagged_cells:
        print("[Review Sampler] Notice: No cells met vegetation loss criteria in the provided dataset.")
        return []

    # Sampling
    if seed is not None:
        random.seed(seed)

    if len(flagged_cells) <= n_samples:
        sampled_flagged = list(flagged_cells)
    else:
        sampled_flagged = random.sample(flagged_cells, n_samples)

    if len(control_candidates) <= n_control:
        sampled_control = list(control_candidates)
    else:
        sampled_control = random.sample(control_candidates, n_control)

    for c in sampled_flagged:
        c["is_flagged"] = True
    for c in sampled_control:
        c["is_flagged"] = False

    sampled = sampled_flagged + sampled_control

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_csv_path)), exist_ok=True)

    fieldnames = [
        "id",
        "centroid_lng",
        "centroid_lat",
        "ward",
        "is_flagged",
        "ndvi_2019",
        "ndvi_2026",
        "delta_ndvi",
        "ndbi_2019",
        "ndbi_2026",
        "delta_ndbi",
        "extra_heat_mean",
        "extra_heat_p10",
        "extra_heat_p90",
        "loss_area_ha",
        "google_earth_url",
        "visual_label"
    ]

    with open(output_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for c in sampled:
            lng, lat = c.get("centroid", [0.0, 0.0])
            ge_url = f"https://earth.google.com/web/@{lat:.6f},{lng:.6f},600a,1000d,35y,0h,0t,0r"
            writer.writerow({
                "id": c.get("id"),
                "centroid_lng": lng,
                "centroid_lat": lat,
                "ward": c.get("ward"),
                "is_flagged": c.get("is_flagged", False),
                "ndvi_2019": c.get("ndvi_2019"),
                "ndvi_2026": c.get("ndvi_2026"),
                "delta_ndvi": c.get("delta_ndvi"),
                "ndbi_2019": c.get("ndbi_2019"),
                "ndbi_2026": c.get("ndbi_2026"),
                "delta_ndbi": c.get("delta_ndbi"),
                "extra_heat_mean": c.get("extra_heat_mean"),
                "extra_heat_p10": c.get("extra_heat_p10"),
                "extra_heat_p90": c.get("extra_heat_p90"),
                "loss_area_ha": c.get("loss_area_ha", 0.0),
                "google_earth_url": ge_url,
                "visual_label": ""
            })

    # Also write to data/review/review_sample.csv if needed
    review_dir_path = os.path.join(os.getcwd(), "data", "review", "review_sample.csv")
    if os.path.abspath(output_csv_path) != os.path.abspath(review_dir_path):
        os.makedirs(os.path.dirname(review_dir_path), exist_ok=True)
        try:
            with open(review_dir_path, "w", newline="", encoding="utf-8") as rf:
                writer = csv.DictWriter(rf, fieldnames=fieldnames)
                writer.writeheader()
                for c in sampled:
                    lng, lat = c.get("centroid", [0.0, 0.0])
                    ge_url = f"https://earth.google.com/web/@{lat:.6f},{lng:.6f},600a,1000d,35y,0h,0t,0r"
                    writer.writerow({
                        "id": c.get("id"),
                        "centroid_lng": lng,
                        "centroid_lat": lat,
                        "ward": c.get("ward"),
                        "is_flagged": c.get("is_flagged", False),
                        "ndvi_2019": c.get("ndvi_2019"),
                        "ndvi_2026": c.get("ndvi_2026"),
                        "delta_ndvi": c.get("delta_ndvi"),
                        "ndbi_2019": c.get("ndbi_2019"),
                        "ndbi_2026": c.get("ndbi_2026"),
                        "delta_ndbi": c.get("delta_ndbi"),
                        "extra_heat_mean": c.get("extra_heat_mean"),
                        "extra_heat_p10": c.get("extra_heat_p10"),
                        "extra_heat_p90": c.get("extra_heat_p90"),
                        "loss_area_ha": c.get("loss_area_ha", 0.0),
                        "google_earth_url": ge_url,
                        "visual_label": ""
                    })
        except Exception:
            pass

    return sampled


def print_review_table(sampled: List[Dict[str, Any]], output_csv_path: str):
    """Prints a clear inspection table to console for rapid verification."""
    print("================================================================================================================")
    print("   URJASETU GREEN LOSS WATCH: SAMPLED CELLS FOR VISUAL GROUND-TRUTHING (EYE REVIEW)")
    print("================================================================================================================")
    print(f"Exported {len(sampled)} flagged cells to: {output_csv_path}")
    print("----------------------------------------------------------------------------------------------------------------")
    print(f"{'Cell ID':<16} | {'Ward':<24} | {'Centroid (Lng, Lat)':<22} | {'ΔNDVI':<8} | {'ΔNDBI':<8} | {'Extra Heat':<12} | {'Loss (ha)':<9}")
    print("----------------------------------------------------------------------------------------------------------------")

    for c in sampled:
        cid = c.get("id", "")
        ward = c.get("ward", "")[:24]
        lng, lat = c.get("centroid", [0.0, 0.0])
        coords = f"({lng:.4f}, {lat:.4f})"
        d_ndvi = f"{c.get('delta_ndvi', 0.0):+.3f}"
        d_ndbi = f"{c.get('delta_ndbi', 0.0):+.3f}"
        heat_val = c.get("extra_heat_mean")
        heat_str = f"+{heat_val:.2f}°C" if heat_val is not None else "Not available"
        loss_ha = f"{c.get('loss_area_ha', 0.0):.2f}"

        print(f"{cid:<16} | {ward:<24} | {coords:<22} | {d_ndvi:<8} | {d_ndbi:<8} | {heat_str:<12} | {loss_ha:<9}")

    print("----------------------------------------------------------------------------------------------------------------")
    print("Provenance: Coordinates [Measured], ΔNDVI [Measured], ΔNDBI [Measured], Extra Heat [Modelled].")
    print("================================================================================================================")


def main():
    parser = argparse.ArgumentParser(
        description="UrjaSetu Visual Review Sampler: Export Flagged Green Loss Cells with Coordinates"
    )
    parser.add_argument("--green-loss-path", type=str, default="public/data/priority/green_loss.json",
                        help="Path to green_loss.json dataset")
    parser.add_argument("--output-csv", type=str, default="data/pipeline_output/sample_review_30.csv",
                        help="Path to output CSV file")
    parser.add_argument("--n-samples", type=int, default=30,
                        help="Number of flagged loss cells to sample (default: 30)")
    parser.add_argument("--n-control", type=int, default=15,
                        help="Number of control (unflagged) cells to sample (default: 15)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for deterministic sampling (default: 42)")

    args = parser.parse_args()

    sampled = sample_loss_cells(
        green_loss_path=args.green_loss_path,
        output_csv_path=args.output_csv,
        n_samples=args.n_samples,
        n_control=args.n_control,
        seed=args.seed
    )

    if sampled:
        print_review_table(sampled, args.output_csv)


if __name__ == "__main__":
    main()
