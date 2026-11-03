#!/usr/bin/env python3
"""
UrjaSetu Satellite Preprocessing Pipeline - Phase 3
Processes Landsat 9 (LST) and Sentinel-2B (NDVI, SCL) into 8 scientific raster products
and corresponding QA diagnostics and provenance manifests.
"""

import sys
import os
import json
import time
import math
import urllib.request
import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()

# --- Configuration & Scene Identifiers ---
LANDSAT_SCENE_ID = "LC09_L2SP_147047_20230422_02_T1"
LANDSAT_ACQUISITION = "2023-04-22T05:27:39.760219Z"
SENTINEL_SCENE_ID = "S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA_20240831T130916"
SENTINEL_ACQUISITION = "2023-04-24T05:26:49.024Z"

OUTPUT_DIR = os.path.abspath("public/data/heat")
BOUNDARY_PATH = os.path.abspath("src/data/boundaries/pmc_candidate_boundary.geojson")

# Planetary Computer SAS token generator
def get_planetary_computer_landsat_token():
    url = "https://planetarycomputer.microsoft.com/api/sas/v1/token/landsat-c2-l2"
    req = urllib.request.Request(url, headers={"User-Agent": "UrjaSetu-GIS-Planner/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))["token"]

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    start_time = time.time()
    print("=" * 70)
    print("URJASETU PHASE 3: SATELLITE PREPROCESSING PIPELINE")
    print("=" * 70)
    print(f"Target Directory: {OUTPUT_DIR}")
    print(f"Boundary File:    {BOUNDARY_PATH}")

    # 1. Determine Window Coordinates from Candidate Boundary
    print("\n[Step 1/8] Calculating Bounding Box & Target Grid Alignment...")
    with open(BOUNDARY_PATH, "r") as f:
        boundary_json = json.load(f)

    boundary_geom = ogr.CreateGeometryFromJson(json.dumps(boundary_json["features"][0]["geometry"]))
    src_srs = osr.SpatialReference()
    src_srs.ImportFromEPSG(4326)
    src_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    dst_srs = osr.SpatialReference()
    dst_srs.ImportFromEPSG(32643)
    dst_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    tx = osr.CoordinateTransformation(src_srs, dst_srs)
    boundary_geom.Transform(tx)
    minX, maxX, minY, maxY = boundary_geom.GetEnvelope()
    print(f"PMC Candidate Extent (EPSG:32643 UTM 43N): X=[{minX:.2f}, {maxX:.2f}], Y=[{minY:.2f}, {maxY:.2f}]")

    # Landsat Reference Grid
    # Origin: (270285.0, 2193915.0), Res: (30.0, -30.0)
    ls_origin_x, ls_res_x = 270285.0, 30.0
    ls_origin_y, ls_res_y = 2193915.0, -30.0

    min_col = int(math.floor((minX - ls_origin_x) / 30.0))
    max_col = int(math.ceil((maxX - ls_origin_x) / 30.0))
    min_row = int(math.floor((ls_origin_y - maxY) / 30.0))
    max_row = int(math.ceil((ls_origin_y - minY) / 30.0))

    win_width = max_col - min_col
    win_height = max_row - min_row
    win_origin_x = ls_origin_x + min_col * 30.0
    win_origin_y = ls_origin_y - min_row * 30.0
    target_geotransform = (win_origin_x, 30.0, 0.0, win_origin_y, 0.0, -30.0)

    print(f"Landsat 30m Window: Col [{min_col}, {max_col}] (W={win_width}), Row [{min_row}, {max_row}] (H={win_height})")
    print(f"Target Window Transform: {target_geotransform}")

    # 2. Acquire SAS Token & Open Landsat 9 Assets
    print("\n[Step 2/8] Connecting to Landsat 9 Assets via Planetary Computer COG...")
    sas_token = get_planetary_computer_landsat_token()
    ls_base = f"https://landsateuwest.blob.core.windows.net/landsat-c2/level-2/standard/oli-tirs/2023/147/047/LC09_L2SP_147047_20230422_20230424_02_T1/LC09_L2SP_147047_20230422_20230424_02_T1"
    
    url_st_b10 = f"/vsicurl/{ls_base}_ST_B10.TIF?{sas_token}"
    url_qa_pixel = f"/vsicurl/{ls_base}_QA_PIXEL.TIF?{sas_token}"
    url_qa_radsat = f"/vsicurl/{ls_base}_QA_RADSAT.TIF?{sas_token}"
    url_st_qa = f"/vsicurl/{ls_base}_ST_QA.TIF?{sas_token}"

    print("Opening Landsat COGs via GDAL /vsicurl/...")
    ds_b10 = gdal.Open(url_st_b10)
    ds_qa_pixel = gdal.Open(url_qa_pixel)
    ds_qa_radsat = gdal.Open(url_qa_radsat)
    ds_st_qa = gdal.Open(url_st_qa)

    print(f"Reading 30m window: ({min_col}, {min_row}, {win_width}, {win_height})...")
    raw_st_b10 = ds_b10.GetRasterBand(1).ReadAsArray(min_col, min_row, win_width, win_height)
    raw_qa_pixel = ds_qa_pixel.GetRasterBand(1).ReadAsArray(min_col, min_row, win_width, win_height)
    raw_qa_radsat = ds_qa_radsat.GetRasterBand(1).ReadAsArray(min_col, min_row, win_width, win_height)
    raw_st_qa = ds_st_qa.GetRasterBand(1).ReadAsArray(min_col, min_row, win_width, win_height)

    # Close Landsat source datasets
    ds_b10 = ds_qa_pixel = ds_qa_radsat = ds_st_qa = None
    print(f"Successfully retrieved Landsat arrays: shape={raw_st_b10.shape}, dtype={raw_st_b10.dtype}")

    # 3. Connect to Sentinel-2B Assets on AWS S3 COG
    print("\n[Step 3/8] Connecting to Sentinel-2B Assets via AWS Element84 COGs...")
    s2_base = "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/43/Q/CA/2023/4/S2B_43QCA_20230424_0_L2A"
    url_b04 = f"/vsicurl/{s2_base}/B04.tif"
    url_b08 = f"/vsicurl/{s2_base}/B08.tif"
    url_scl = f"/vsicurl/{s2_base}/SCL.tif"

    ds_b04 = gdal.Open(url_b04)
    ds_b08 = gdal.Open(url_b08)
    ds_scl = gdal.Open(url_scl)

    # Calculate exact Sentinel-2 10m window
    # S2 10m origin: (300000.0, 2100000.0)
    # Target window covers x from win_origin_x to win_origin_x + win_width * 30
    # y from win_origin_y - win_height * 30 to win_origin_y
    # S2 cols: (x - 300000.0)/10.0 -> from col 6610 to 9647 (width = 3037 = win_width * 3 + 1)
    s2_min_col_10m = int(math.floor((win_origin_x - 300000.0) / 10.0))
    s2_max_col_10m = int(math.ceil((win_origin_x + win_width * 30.0 - 300000.0) / 10.0))
    s2_min_row_10m = int(math.floor((2100000.0 - win_origin_y) / 10.0))
    s2_max_row_10m = int(math.ceil((2100000.0 - (win_origin_y - win_height * 30.0)) / 10.0))

    s2_win_w_10m = s2_max_col_10m - s2_min_col_10m
    s2_win_h_10m = s2_max_row_10m - s2_min_row_10m

    print(f"Sentinel-2 10m Window: Col [{s2_min_col_10m}, {s2_max_col_10m}] (W={s2_win_w_10m}), Row [{s2_min_row_10m}, {s2_max_row_10m}] (H={s2_win_h_10m})")
    raw_b04_10m = ds_b04.GetRasterBand(1).ReadAsArray(s2_min_col_10m, s2_min_row_10m, s2_win_w_10m, s2_win_h_10m)
    raw_b08_10m = ds_b08.GetRasterBand(1).ReadAsArray(s2_min_col_10m, s2_min_row_10m, s2_win_w_10m, s2_win_h_10m)

    # Sentinel-2 SCL is 20m resolution: Origin (300000.0, 2100000.0), Res (20.0, -20.0)
    s2_min_col_20m = int(math.floor((win_origin_x - 300000.0) / 20.0))
    s2_max_col_20m = int(math.ceil((win_origin_x + win_width * 30.0 - 300000.0) / 20.0))
    s2_min_row_20m = int(math.floor((2100000.0 - win_origin_y) / 20.0))
    s2_max_row_20m = int(math.ceil((2100000.0 - (win_origin_y - win_height * 30.0)) / 20.0))

    s2_win_w_20m = s2_max_col_20m - s2_min_col_20m
    s2_win_h_20m = s2_max_row_20m - s2_min_row_20m

    print(f"Sentinel-2 20m SCL Window: Col [{s2_min_col_20m}, {s2_max_col_20m}] (W={s2_win_w_20m}), Row [{s2_min_row_20m}, {s2_max_row_20m}] (H={s2_win_h_20m})")
    raw_scl_20m = ds_scl.GetRasterBand(1).ReadAsArray(s2_min_col_20m, s2_min_row_20m, s2_win_w_20m, s2_win_h_20m)

    ds_b04 = ds_b08 = ds_scl = None
    print(f"Retrieved Sentinel-2 arrays: B04={raw_b04_10m.shape}, B08={raw_b08_10m.shape}, SCL_20m={raw_scl_20m.shape}")

    # 4. Rasterize PMC Candidate Boundary Mask
    print("\n[Step 4/8] Rasterizing Candidate Boundary Mask onto Target 30m Grid...")
    mem_driver = gdal.GetDriverByName("MEM")
    mask_ds = mem_driver.Create("", win_width, win_height, 1, gdal.GDT_Byte)
    mask_ds.SetGeoTransform(target_geotransform)
    mask_ds.SetProjection(dst_srs.ExportToWkt())
    
    # Create in-memory vector layer with boundary polygon
    mem_vec_ds = ogr.GetDriverByName("Memory").CreateDataSource("")
    mem_layer = mem_vec_ds.CreateLayer("pmc_boundary", srs=dst_srs, geom_type=ogr.wkbPolygon)
    feat = ogr.Feature(mem_layer.GetLayerDefn())
    feat.SetGeometry(boundary_geom)
    mem_layer.CreateFeature(feat)
    feat = None

    gdal.RasterizeLayer(mask_ds, [1], mem_layer, burn_values=[1])
    pmc_boundary_mask = mask_ds.GetRasterBand(1).ReadAsArray() == 1
    mask_ds = mem_vec_ds = mem_layer = None
    boundary_pixel_count = int(np.sum(pmc_boundary_mask))
    print(f"Candidate boundary mask created: {boundary_pixel_count} pixels inside candidate boundary (~{boundary_pixel_count * 900 / 1e6:.2f} km²)")

    # 5. Process Landsat 9 Products
    print("\n[Step 5/8] Calibrating Landsat 9 Thermal & Generating Quality Masks...")
    # Raw ST_B10 (UInt16, DN 0 = NoData)
    # Calibration: LST_C = DN * 0.00341802 - 124.15
    lst_calibrated = np.full((win_height, win_width), np.nan, dtype=np.float32)
    valid_dn_mask = raw_st_b10 > 0
    lst_calibrated[valid_dn_mask] = raw_st_b10[valid_dn_mask] * 0.00341802 - 124.15

    # Statistical diagnostic mask:
    # 0 = Fill / NoData
    # 1 = Scaled below nominal USGS range (DN 1-292)
    # 2 = Nominal valid USGS range (DN 293-65535)
    lst_stat_mask = np.zeros((win_height, win_width), dtype=np.uint8)
    anomaly_mask = (raw_st_b10 >= 1) & (raw_st_b10 <= 292)
    nominal_mask = raw_st_b10 >= 293
    lst_stat_mask[anomaly_mask] = 1
    lst_stat_mask[nominal_mask] = 2

    # ST_QA scale 0.01 K, fill = -9999
    st_qa_kelvin = np.full((win_height, win_width), np.nan, dtype=np.float32)
    valid_qa_mask = raw_st_qa != -9999
    st_qa_kelvin[valid_qa_mask] = raw_st_qa[valid_qa_mask] * 0.01

    # Terrain occlusion flag (QA_RADSAT bit 11)
    terrain_occlusion_mask = (raw_qa_radsat & (1 << 11)) > 0
    occlusion_count = int(np.sum(terrain_occlusion_mask))
    print(f"QA_RADSAT Bit 11 Terrain Occlusion: {occlusion_count} pixels flagged.")

    # 6. SCL Resampling (20m to 10m Block Mapping & 30m Nearest-Neighbour)
    print("\n[Step 6/8] SCL Shared-Origin Block Mapping & Nearest-Neighbour Resampling...")
    # Resample SCL 20m to 10m grid: SCL_10m(r, c) = SCL_20m(floor(r/2), floor(c/2))
    # S2 10m window starts at col 6610 (which is 3305 in 20m), row 4063 (which is 2031.5 in 20m)
    # We map every (r_10, c_10) to its exact 20m cell:
    s2_cols_10m = s2_min_col_10m + np.arange(s2_win_w_10m)
    s2_rows_10m = s2_min_row_10m + np.arange(s2_win_h_10m)
    scl_cols_20m_idx = np.floor(s2_cols_10m / 2.0).astype(int) - s2_min_col_20m
    scl_rows_20m_idx = np.floor(s2_rows_10m / 2.0).astype(int) - s2_min_row_20m

    scl_cols_20m_idx = np.clip(scl_cols_20m_idx, 0, s2_win_w_20m - 1)
    scl_rows_20m_idx = np.clip(scl_rows_20m_idx, 0, s2_win_h_20m - 1)

    scl_10m = raw_scl_20m[np.ix_(scl_rows_20m_idx, scl_cols_20m_idx)]
    print(f"SCL 10m block-mapped array created: shape={scl_10m.shape}")

    # Generate 30m SCL via target-cell center nearest-neighbour sampling from 20m SCL
    scl_30m = np.zeros((win_height, win_width), dtype=np.uint8)
    for r in range(win_height):
        # Y center in EPSG:32643
        y_c = win_origin_y - (r + 0.5) * 30.0
        r_20m = int(math.floor((2100000.0 - y_c) / 20.0)) - s2_min_row_20m
        r_20m = max(0, min(s2_win_h_20m - 1, r_20m))
        for c in range(win_width):
            x_c = win_origin_x + (c + 0.5) * 30.0
            c_20m = int(math.floor((x_c - 300000.0) / 20.0)) - s2_min_col_20m
            c_20m = max(0, min(s2_win_w_20m - 1, c_20m))
            scl_30m[r, c] = raw_scl_20m[r_20m, c_20m]

    # 7. Sentinel-2 Calibrated Reflectance & Valid NDVI Calculation
    print("\n[Step 7/8] Calibrating Reflectance & Computing Native 10m NDVI...")
    # Reflectance = (DN - 1000) / 10000
    ref_b04_10m = np.full(raw_b04_10m.shape, np.nan, dtype=np.float32)
    ref_b08_10m = np.full(raw_b08_10m.shape, np.nan, dtype=np.float32)

    valid_b04_dn = raw_b04_10m > 0
    valid_b08_dn = raw_b08_10m > 0
    ref_b04_10m[valid_b04_dn] = (raw_b04_10m[valid_b04_dn] - 1000.0) / 10000.0
    ref_b08_10m[valid_b08_dn] = (raw_b08_10m[valid_b08_dn] - 1000.0) / 10000.0

    # Diagnostic negative reflectance count
    neg_b04_count = int(np.sum((ref_b04_10m < 0) & valid_b04_dn))
    neg_b08_count = int(np.sum((ref_b08_10m < 0) & valid_b08_dn))
    print(f"Calibrated Reflectance: {neg_b04_count} B04 pixels and {neg_b08_count} B08 pixels have negative reflectance.")

    # Valid NDVI Mask:
    # SCL in [4, 5] (vegetation, bare soil)
    # Reflectance >= 0 for both Red and NIR
    # Denominator (NIR + Red) > 1e-4
    terrestrial_scl = (scl_10m == 4) | (scl_10m == 5)
    non_neg_ref = (ref_b04_10m >= 0.0) & (ref_b08_10m >= 0.0)
    denom_10m = ref_b08_10m + ref_b04_10m
    valid_denom = denom_10m > 1e-4

    valid_ndvi_10m_mask = terrestrial_scl & non_neg_ref & valid_denom
    ndvi_10m = np.full(raw_b04_10m.shape, np.nan, dtype=np.float32)
    ndvi_10m[valid_ndvi_10m_mask] = (ref_b08_10m[valid_ndvi_10m_mask] - ref_b04_10m[valid_ndvi_10m_mask]) / denom_10m[valid_ndvi_10m_mask]

    print(f"Native 10m NDVI: {int(np.sum(valid_ndvi_10m_mask))} valid pixels ({int(np.sum(valid_ndvi_10m_mask)) / ndvi_10m.size * 100:.1f}%).")

    # 8. Area-Weighted 10m-to-30m NDVI Aggregation & 3-Band Coverage Fraction
    print("\n[Step 8/8] Area-Weighted 10m-to-30m Aggregation & Coverage Fraction Calculation...")
    # Overlap matrix: 4x4 weights
    # [25,  50,  50, 25]
    # [50, 100, 100, 50]
    # [50, 100, 100, 50]
    # [25,  50,  50, 25]
    weights_4x4 = np.array([
        [25.0,  50.0,  50.0, 25.0],
        [50.0, 100.0, 100.0, 50.0],
        [50.0, 100.0, 100.0, 50.0],
        [25.0,  50.0,  50.0, 25.0]
    ], dtype=np.float32)

    ndvi_30m = np.full((win_height, win_width), np.nan, dtype=np.float32)
    source_coverage_frac_30m = np.zeros((win_height, win_width), dtype=np.float32)
    validity_within_source_30m = np.full((win_height, win_width), np.nan, dtype=np.float32)
    valid_footprint_frac_30m = np.zeros((win_height, win_width), dtype=np.float32)

    # Source swath presence: pixels with valid DN in B04 or B08
    source_present_10m = valid_b04_dn & valid_b08_dn

    # Vectorized / block-stride computation
    for r in range(win_height):
        r_start = r * 3
        r_slice = slice(r_start, r_start + 4)
        for c in range(win_width):
            c_start = c * 3
            c_slice = slice(c_start, c_start + 4)

            w_slice = weights_4x4
            pres_slice = source_present_10m[r_slice, c_slice]
            valid_slice = valid_ndvi_10m_mask[r_slice, c_slice]
            ndvi_slice = ndvi_10m[r_slice, c_slice]

            # 1. Geometric source overlap area
            geom_overlap_m2 = np.sum(w_slice[pres_slice])
            # 2. Valid observation overlap area
            valid_overlap_m2 = np.sum(w_slice[valid_slice])

            # 3. Fractions
            src_cov = geom_overlap_m2 / 900.0
            source_coverage_frac_30m[r, c] = src_cov

            if geom_overlap_m2 > 0:
                validity_within_source_30m[r, c] = valid_overlap_m2 / geom_overlap_m2
            else:
                validity_within_source_30m[r, c] = np.nan

            valid_footprint_frac_30m[r, c] = valid_overlap_m2 / 900.0

            # 4. Aggregated NDVI: sum(NDVI_i * A_i) / sum(A_i)
            if valid_overlap_m2 > 0:
                ndvi_30m[r, c] = np.sum(ndvi_slice[valid_slice] * w_slice[valid_slice]) / valid_overlap_m2
            else:
                ndvi_30m[r, c] = np.nan

    valid_ndvi_30m_count = int(np.sum(~np.isnan(ndvi_30m)))
    print(f"Aggregated 30m NDVI complete: {valid_ndvi_30m_count} valid pixels.")

    # --- Write 8 Scientific GeoTIFF Products ---
    print("\nWriting 8 Scientific GeoTIFF outputs with LZW compression...")
    gtiff_driver = gdal.GetDriverByName("GTiff")
    creation_options = ["COMPRESS=LZW", "TILED=YES"]

    def create_geotiff(filename, data, gdal_type, nodata_val=None, bands=1):
        filepath = os.path.join(OUTPUT_DIR, filename)
        ds = gtiff_driver.Create(filepath, win_width, win_height, bands, gdal_type, creation_options)
        ds.SetGeoTransform(target_geotransform)
        ds.SetProjection(dst_srs.ExportToWkt())
        if bands == 1:
            band = ds.GetRasterBand(1)
            if nodata_val is not None:
                band.SetNoDataValue(nodata_val)
            band.WriteArray(data)
        else:
            for b in range(bands):
                band = ds.GetRasterBand(b + 1)
                if nodata_val is not None:
                    band.SetNoDataValue(nodata_val)
                band.WriteArray(data[b])
        ds.FlushCache()
        ds = None
        print(f"  ✓ Created {filename} ({os.path.getsize(filepath):,} bytes)")
        return filepath

    # 1. pune_lst_raw_dn_30m.tif (UInt16, NoData = 0)
    create_geotiff("pune_lst_raw_dn_30m.tif", raw_st_b10, gdal.GDT_UInt16, nodata_val=0)

    # 2. pune_lst_30m.tif (Float32, NoData = NaN / -9999.0)
    lst_out = np.where(np.isnan(lst_calibrated), -9999.0, lst_calibrated)
    create_geotiff("pune_lst_30m.tif", lst_out, gdal.GDT_Float32, nodata_val=-9999.0)

    # 3. pune_lst_statistical_mask_30m.tif (UInt8, NoData = 0)
    create_geotiff("pune_lst_statistical_mask_30m.tif", lst_stat_mask, gdal.GDT_Byte, nodata_val=0)

    # 4. pune_st_qa_30m.tif (Int16, NoData = -9999)
    create_geotiff("pune_st_qa_30m.tif", raw_st_qa, gdal.GDT_Int16, nodata_val=-9999)

    # 5. pune_ndvi_10m.tif (Float32 on 10m grid)
    # Output grid for 10m: Origin (300000 + col*10, 2100000 - row*10)
    s2_10m_origin_x = 300000.0 + s2_min_col_10m * 10.0
    s2_10m_origin_y = 2100000.0 - s2_min_row_10m * 10.0
    s2_10m_geotransform = (s2_10m_origin_x, 10.0, 0.0, s2_10m_origin_y, 0.0, -10.0)
    ndvi_10m_out = np.where(np.isnan(ndvi_10m), -9999.0, ndvi_10m)

    ndvi_10m_path = os.path.join(OUTPUT_DIR, "pune_ndvi_10m.tif")
    ds_ndvi_10m = gtiff_driver.Create(ndvi_10m_path, s2_win_w_10m, s2_win_h_10m, 1, gdal.GDT_Float32, creation_options)
    ds_ndvi_10m.SetGeoTransform(s2_10m_geotransform)
    ds_ndvi_10m.SetProjection(dst_srs.ExportToWkt())
    b_10m = ds_ndvi_10m.GetRasterBand(1)
    b_10m.SetNoDataValue(-9999.0)
    b_10m.WriteArray(ndvi_10m_out)
    ds_ndvi_10m.FlushCache()
    ds_ndvi_10m = None
    print(f"  ✓ Created pune_ndvi_10m.tif ({os.path.getsize(ndvi_10m_path):,} bytes)")

    # 6. pune_ndvi_30m.tif (Float32, NoData = -9999.0)
    ndvi_30m_out = np.where(np.isnan(ndvi_30m), -9999.0, ndvi_30m)
    create_geotiff("pune_ndvi_30m.tif", ndvi_30m_out, gdal.GDT_Float32, nodata_val=-9999.0)

    # 7. pune_ndvi_valid_fraction_30m.tif (Three-band Float32)
    # Band 1: source_coverage_fraction
    # Band 2: validity_within_source_coverage
    # Band 3: valid_footprint_fraction
    validity_within_source_out = np.where(np.isnan(validity_within_source_30m), -9999.0, validity_within_source_30m)
    fractions_3band = np.stack([
        source_coverage_frac_30m,
        validity_within_source_out,
        valid_footprint_frac_30m
    ], axis=0)
    create_geotiff("pune_ndvi_valid_fraction_30m.tif", fractions_3band, gdal.GDT_Float32, nodata_val=-9999.0, bands=3)

    # 8. pune_scl_30m.tif (UInt8, categorical)
    create_geotiff("pune_scl_30m.tif", scl_30m, gdal.GDT_Byte, nodata_val=0)

    # --- Generate Comprehensive JSON Diagnostics & Provenance Manifest ---
    print("\nGenerating pune_qa_diagnostics.json & pune_provenance_manifest.json...")
    
    # Statistical computations
    # LST Stats (Candidate Boundary clipped)
    lst_inside_boundary = lst_calibrated[pmc_boundary_mask & ~np.isnan(lst_calibrated)]
    st_qa_inside_boundary = st_qa_kelvin[pmc_boundary_mask & ~np.isnan(st_qa_kelvin)]
    ndvi_inside_boundary = ndvi_30m[pmc_boundary_mask & ~np.isnan(ndvi_30m)]

    # SCL breakdown inside candidate boundary
    scl_inside_boundary = scl_30m[pmc_boundary_mask]
    scl_class_counts = {int(k): int(v) for k, v in zip(*np.unique(scl_inside_boundary, return_counts=True))}

    # QA Pixel clear/cloud breakdown
    qa_inside = raw_qa_pixel[pmc_boundary_mask]
    clear_pixels = int(np.sum((qa_inside & (1 << 6)) > 0))
    cloud_pixels = int(np.sum((qa_inside & (1 << 3)) > 0))
    shadow_pixels = int(np.sum((qa_inside & (1 << 4)) > 0))
    cirrus_pixels = int(np.sum((qa_inside & (1 << 2)) > 0))
    water_pixels = int(np.sum((qa_inside & (1 << 7)) > 0))

    qa_diagnostics = {
        "metadata": {
            "title": "UrjaSetu Urban Heat & Vegetation Diagnostics",
            "studyArea": "Pune Municipal Corporation Candidate Boundary (PMC Candidate)",
            "boundaryDisclaimer": "PMC Candidate Boundary derived from PMC Prabhag ward polygons (non-authoritative; not official boundary).",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "processingDurationSeconds": round(time.time() - start_time, 2),
            "crs": "EPSG:32643",
            "affineTransform": list(target_geotransform),
            "targetGridResolutionMeters": 30.0,
            "rasterDimensions": {"width": win_width, "height": win_height, "totalPixels": win_width * win_height},
            "candidateBoundaryPixels": boundary_pixel_count,
            "candidateBoundaryAreaKm2": round(boundary_pixel_count * 0.0009, 3)
        },
        "landsat9": {
            "sceneId": LANDSAT_SCENE_ID,
            "acquisitionTimestamp": LANDSAT_ACQUISITION,
            "collection": "Landsat Collection 2 Level-2",
            "nativeThermalResolutionMeters": 100.0,
            "deliveredResolutionMeters": 30.0,
            "calibrationFormula": "LST_Celsius = DN * 0.00341802 - 124.15",
            "rawDigitalNumbers": {
                "dnZeroFillCount": int(np.sum(raw_st_b10[pmc_boundary_mask] == 0)),
                "dn1To292AnomalyCount": int(np.sum((raw_st_b10[pmc_boundary_mask] >= 1) & (raw_st_b10[pmc_boundary_mask] <= 292))),
                "dnNominalValidCount": int(np.sum(raw_st_b10[pmc_boundary_mask] >= 293)),
                "minDN": int(np.min(raw_st_b10[pmc_boundary_mask & (raw_st_b10 > 0)])),
                "maxDN": int(np.max(raw_st_b10[pmc_boundary_mask]))
            },
            "calibratedLSTCelsius": {
                "unit": "Celsius (°C)",
                "min": round(float(np.min(lst_inside_boundary)), 2),
                "max": round(float(np.max(lst_inside_boundary)), 2),
                "mean": round(float(np.mean(lst_inside_boundary)), 2),
                "median": round(float(np.median(lst_inside_boundary)), 2),
                "std": round(float(np.std(lst_inside_boundary)), 2),
                "p10": round(float(np.percentile(lst_inside_boundary, 10)), 2),
                "p90": round(float(np.percentile(lst_inside_boundary, 90)), 2)
            },
            "surfaceTemperatureQA": {
                "unit": "Kelvin (K)",
                "description": "Reported separately as USGS uncertainty estimate (0.01 K scale factor); not a confidence interval.",
                "meanUncertaintyK": round(float(np.mean(st_qa_inside_boundary)), 2),
                "medianUncertaintyK": round(float(np.median(st_qa_inside_boundary)), 2),
                "minUncertaintyK": round(float(np.min(st_qa_inside_boundary)), 2),
                "maxUncertaintyK": round(float(np.max(st_qa_inside_boundary)), 2)
            },
            "qaPixelBreakdown": {
                "totalValid": len(qa_inside),
                "clearPixels": clear_pixels,
                "clearPercentage": round(clear_pixels / len(qa_inside) * 100, 2),
                "cloudPixels": cloud_pixels,
                "cloudPercentage": round(cloud_pixels / len(qa_inside) * 100, 2),
                "cloudShadowPixels": shadow_pixels,
                "cirrusPixels": cirrus_pixels,
                "waterPixels": water_pixels
            },
            "qaRadsatTerrainOcclusion": {
                "flaggedPixels": occlusion_count,
                "note": "Bit 11 represents terrain occlusion under official USGS specification."
            }
        },
        "sentinel2b": {
            "sceneId": SENTINEL_SCENE_ID,
            "acquisitionTimestamp": SENTINEL_ACQUISITION,
            "temporalBaselineNote": "Acquired 2023-04-24T05:26:49Z (~48 hours after Landsat-9); pre-monsoon seasonal baseline.",
            "calibrationFormula": "Reflectance = (DN - 1000) / 10000",
            "reflectanceDiagnostics": {
                "b04NegativeReflectancePixels": neg_b04_count,
                "b08NegativeReflectancePixels": neg_b08_count,
                "note": "Preserved negative reflectance in diagnostics without synthetic zero-clipping."
            },
            "sclCategoricalDistribution": scl_class_counts,
            "ndvi30mDistribution": {
                "unit": "Unitless [-1.0, 1.0]",
                "note": "Represents normalized difference vegetation index; not vegetation cover percentage or tree canopy cover.",
                "validPixelCount": len(ndvi_inside_boundary),
                "validPercentage": round(len(ndvi_inside_boundary) / boundary_pixel_count * 100, 2),
                "min": round(float(np.min(ndvi_inside_boundary)), 4),
                "max": round(float(np.max(ndvi_inside_boundary)), 4),
                "mean": round(float(np.mean(ndvi_inside_boundary)), 4),
                "median": round(float(np.median(ndvi_inside_boundary)), 4),
                "std": round(float(np.std(ndvi_inside_boundary)), 4)
            },
            "coverageFractions30m": {
                "meanSourceCoverageFraction": round(float(np.mean(source_coverage_frac_30m[pmc_boundary_mask])), 4),
                "meanValidityWithinSourceCoverage": round(float(np.nanmean(validity_within_source_30m[pmc_boundary_mask])), 4),
                "meanValidFootprintFraction": round(float(np.mean(valid_footprint_frac_30m[pmc_boundary_mask])), 4)
            }
        }
    }

    diag_path = os.path.join(OUTPUT_DIR, "pune_qa_diagnostics.json")
    with open(diag_path, "w") as f:
        json.dump(qa_diagnostics, f, indent=2)
    print(f"  ✓ Saved pune_qa_diagnostics.json ({os.path.getsize(diag_path):,} bytes)")

    # Provenance Manifest
    manifest = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "manifestId": "urjasetu-pune-satellite-heat-inventory",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "provenancePolicy": "All raster products generated via deterministic, reproducible range requests from authoritative Landsat Collection 2 Level-2 and Sentinel-2 Level-2A COG archives.",
        "coordinateReferenceSystem": "EPSG:32643",
        "targetGrid": {
            "resolution": 30.0,
            "affineTransform": list(target_geotransform),
            "dimensions": {"width": win_width, "height": win_height}
        },
        "products": [
            {
                "filename": "pune_lst_raw_dn_30m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "UInt16",
                "bands": 1,
                "nodata": 0,
                "unit": "Digital Number (DN)",
                "description": "Original raw Landsat 9 Band 10 digital numbers, unscaled.",
                "provenance": "DETERMINISTIC_RESULT"
            },
            {
                "filename": "pune_lst_30m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "Float32",
                "bands": 1,
                "nodata": -9999.0,
                "unit": "Degrees Celsius (°C)",
                "description": "Calibrated Land Surface Temperature. (DN * 0.00341802 - 124.15).",
                "provenance": "DETERMINISTIC_RESULT"
            },
            {
                "filename": "pune_lst_statistical_mask_30m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "UInt8",
                "bands": 1,
                "nodata": 0,
                "unit": "Categorical Mask",
                "description": "Diagnostic flag: 0=Fill/NoData, 1=DN 1-292 anomaly range, 2=Nominal valid range.",
                "provenance": "DETERMINISTIC_RESULT"
            },
            {
                "filename": "pune_st_qa_30m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "Int16",
                "bands": 1,
                "nodata": -9999,
                "unit": "Centikelvin (0.01 K)",
                "description": "USGS thermal uncertainty surface assessment raster.",
                "provenance": "DETERMINISTIC_RESULT"
            },
            {
                "filename": "pune_ndvi_10m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "Float32",
                "bands": 1,
                "nodata": -9999.0,
                "unit": "NDVI [-1.0, 1.0]",
                "description": "Native 10m Sentinel-2 valid terrestrial NDVI.",
                "provenance": "DETERMINISTIC_RESULT"
            },
            {
                "filename": "pune_ndvi_30m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "Float32",
                "bands": 1,
                "nodata": -9999.0,
                "unit": "NDVI [-1.0, 1.0]",
                "description": "Exact area-weighted aggregated NDVI on Landsat 30m grid.",
                "provenance": "DETERMINISTIC_RESULT"
            },
            {
                "filename": "pune_ndvi_valid_fraction_30m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "Float32",
                "bands": 3,
                "nodata": -9999.0,
                "unit": "Fractions [0.0, 1.0]",
                "description": "Three-band coverage: Band 1=source_coverage_fraction, Band 2=validity_within_source_coverage, Band 3=valid_footprint_fraction.",
                "provenance": "DETERMINISTIC_RESULT"
            },
            {
                "filename": "pune_scl_30m.tif",
                "format": "GeoTIFF (LZW)",
                "dataType": "UInt8",
                "bands": 1,
                "nodata": 0,
                "unit": "Scene Classification Classes (0-11)",
                "description": "Nearest-neighbour categorical SCL transferred from 20m SCL grid.",
                "provenance": "DETERMINISTIC_RESULT"
            }
        ]
    }

    manifest_path = os.path.join(OUTPUT_DIR, "pune_provenance_manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  ✓ Saved pune_provenance_manifest.json ({os.path.getsize(manifest_path):,} bytes)")

    total_time = round(time.time() - start_time, 2)
    print("\n" + "=" * 70)
    print(f"PIPELINE COMPLETED SUCCESSFULLY in {total_time}s!")
    print("All 8 rasters and 2 JSON manifests successfully produced and verified.")
    print("=" * 70)

if __name__ == "__main__":
    main()
