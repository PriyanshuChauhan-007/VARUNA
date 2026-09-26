"""
Spatio-Temporal Alignment Engine for Weather Forecasts and ERA5 Reference Data.
Aligns model forecast members with reference reanalysis timestamps without temporal leakage.
Calculates residuals, ensemble spreads, and contextual features.
"""
from typing import Dict, List, Any, Tuple
import pandas as pd
import numpy as np
from datetime import datetime
from .regime import classify_synoptic_regime

def align_forecasts_with_reference(
    raw_forecast_data: Dict[str, Any],
    raw_reference_data: Dict[str, Any],
    region_id: str,
    region_meta: Any,
    variable: str
) -> pd.DataFrame:
    """
    Align raw multi-model forecast JSON with raw ERA5 reference JSON for a region.
    Produces a unified DataFrame with one row per valid timestamp.
    """
    f_hourly = raw_forecast_data.get("hourly", {})
    r_hourly = raw_reference_data.get("hourly", {})
    
    times_f = f_hourly.get("time", [])
    times_r = r_hourly.get("time", [])
    
    # Common timestamps
    common_times = sorted(list(set(times_f).intersection(set(times_r))))
    if not common_times:
        return pd.DataFrame()

    var_param_map = {
        "rainfall": "precipitation",
        "temperature": "temperature_2m",
        "wind_speed": "wind_speed_10m",
        "pressure": "surface_pressure"
    }
    param = var_param_map.get(variable, "temperature_2m")
    
    # Map model column names
    model_col_map = {
        "ecmwf_ifs": f"{param}_ecmwf_ifs025",
        "ecmwf_aifs": f"{param}_ecmwf_aifs025_single",
        "ncep_gfs": f"{param}_gfs_seamless",
        "dwd_icon": f"{param}_icon_seamless"
    }

    # Reference column
    ref_col = param

    # Build dictionaries indexed by timestamp for O(1) alignment
    f_df = pd.DataFrame(f_hourly).set_index("time")
    r_df = pd.DataFrame(r_hourly).set_index("time")

    rows = []
    lat = region_meta.lat
    lng = region_meta.lng
    elev = region_meta.elevation_m

    for t_str in common_times:
        if t_str not in f_df.index or t_str not in r_df.index:
            continue
            
        r_val = r_df.loc[t_str, ref_col] if ref_col in r_df.columns else None
        if r_val is None or pd.isna(r_val):
            continue

        # Extract values for each model
        model_vals = {}
        for m_key, col_name in model_col_map.items():
            if col_name in f_df.columns:
                val = f_df.loc[t_str, col_name]
                if val is not None and not pd.isna(val):
                    model_vals[m_key] = float(val)

        # Require all 4 models to be present for balanced meta-model training
        if len(model_vals) != 4:
            continue

        t_dt = datetime.fromisoformat(t_str)
        vals_arr = np.array(list(model_vals.values()))
        ens_mean = float(np.mean(vals_arr))
        ens_spread = float(np.std(vals_arr))

        # Regime classification
        temp_val = float(f_df.loc[t_str, f"temperature_2m_ecmwf_ifs025"]) if f"temperature_2m_ecmwf_ifs025" in f_df.columns else 25.0
        press_val = float(f_df.loc[t_str, f"surface_pressure_ecmwf_ifs025"]) if f"surface_pressure_ecmwf_ifs025" in f_df.columns else 1010.0
        wind_val = float(f_df.loc[t_str, f"wind_speed_10m_ecmwf_ifs025"]) if f"wind_speed_10m_ecmwf_ifs025" in f_df.columns else 10.0
        precip_val = float(f_df.loc[t_str, f"precipitation_ecmwf_ifs025"]) if f"precipitation_ecmwf_ifs025" in f_df.columns else 0.0

        regime_info = classify_synoptic_regime(
            lat=lat,
            lng=lng,
            valid_time=t_dt,
            temp_2m=temp_val,
            surface_pressure=press_val,
            wind_speed=wind_val,
            precipitation=precip_val
        )

        row = {
            "timestamp": t_str,
            "region_id": region_id,
            "latitude": lat,
            "longitude": lng,
            "elevation_m": elev,
            "variable": variable,
            "reference_val": float(r_val),
            "ensemble_mean": ens_mean,
            "ensemble_spread": ens_spread,
            "day_of_year": t_dt.timetuple().tm_yday,
            "hour_of_day": t_dt.hour,
            "month": t_dt.month,
            "regime": regime_info["regime"],
            "regime_index": regime_info["regime_index"],
        }

        # Add per-model values and errors
        for m_key, val in model_vals.items():
            err = val - float(r_val)
            abs_err = abs(err)
            sq_err = err ** 2
            row[f"{m_key}_val"] = val
            row[f"{m_key}_err"] = err
            row[f"{m_key}_abs_err"] = abs_err
            row[f"{m_key}_sq_err"] = sq_err

        rows.append(row)

    return pd.DataFrame(rows)

def align_previous_runs_with_reference(
    raw_prev_data: Dict[str, Any],
    raw_reference_data: Dict[str, Any],
    region_id: str,
    region_meta: Any,
    season_name: str,
    lead_mapping: Dict[int, int] = {1: 24, 2: 48, 3: 72, 5: 120}
) -> pd.DataFrame:
    """
    Align multi-lead previous runs data (24h, 48h, 72h, 120h) with ERA5 reference.
    Produces one row per (valid_timestamp, lead_time_hours).
    """
    f_hourly = raw_prev_data.get("hourly", {})
    r_hourly = raw_reference_data.get("hourly", {})

    times_f = f_hourly.get("time", [])
    times_r = r_hourly.get("time", [])
    common_times = sorted(list(set(times_f).intersection(set(times_r))))
    if not common_times:
        return pd.DataFrame()

    f_df = pd.DataFrame(f_hourly).set_index("time")
    r_df = pd.DataFrame(r_hourly).set_index("time")

    rows = []
    lat = region_meta.lat
    lng = region_meta.lng
    elev = region_meta.elevation_m

    model_keys = {
        "ecmwf_ifs": "ecmwf_ifs025",
        "ecmwf_aifs": "ecmwf_aifs025_single",
        "ncep_gfs": "gfs_seamless",
        "dwd_icon": "icon_seamless"
    }

    ref_col = "temperature_2m"

    for t_str in common_times:
        if t_str not in f_df.index or t_str not in r_df.index:
            continue
        r_val = r_df.loc[t_str, ref_col] if ref_col in r_df.columns else None
        if r_val is None or pd.isna(r_val):
            continue

        t_dt = datetime.fromisoformat(t_str)

        # Iterate over each lead time
        for day_offset, lead_h in lead_mapping.items():
            model_vals = {}
            for m_key, om_id in model_keys.items():
                col_name = f"temperature_2m_previous_day{day_offset}_{om_id}"
                if col_name in f_df.columns:
                    val = f_df.loc[t_str, col_name]
                    if val is not None and not pd.isna(val):
                        model_vals[m_key] = float(val)

            # Ensure all 4 models are available for this lead step
            if len(model_vals) != 4:
                continue

            vals_arr = np.array(list(model_vals.values()))
            ens_mean = float(np.mean(vals_arr))
            ens_spread = float(np.std(vals_arr))

            # Regime classification based on contemporaneous conditions
            ifs_col = f"temperature_2m_previous_day{day_offset}_ecmwf_ifs025"
            temp_est = float(f_df.loc[t_str, ifs_col]) if ifs_col in f_df.columns else float(r_val)

            regime_info = classify_synoptic_regime(
                lat=lat,
                lng=lng,
                valid_time=t_dt,
                temp_2m=temp_est,
                surface_pressure=1010.0,
                wind_speed=12.0,
                precipitation=0.0
            )

            row = {
                "timestamp": t_str,
                "season": season_name,
                "region_id": region_id,
                "latitude": lat,
                "longitude": lng,
                "elevation_m": elev,
                "variable": "temperature",
                "lead_time_hours": lead_h,
                "reference_val": float(r_val),
                "ensemble_mean": ens_mean,
                "ensemble_spread": ens_spread,
                "day_of_year": t_dt.timetuple().tm_yday,
                "hour_of_day": t_dt.hour,
                "month": t_dt.month,
                "regime": regime_info["regime"],
                "regime_index": regime_info["regime_index"],
            }

            for m_key, val in model_vals.items():
                err = val - float(r_val)
                abs_err = abs(err)
                sq_err = err ** 2
                row[f"{m_key}_val"] = val
                row[f"{m_key}_err"] = err
                row[f"{m_key}_abs_err"] = abs_err
                row[f"{m_key}_sq_err"] = sq_err

            rows.append(row)

    return pd.DataFrame(rows)
