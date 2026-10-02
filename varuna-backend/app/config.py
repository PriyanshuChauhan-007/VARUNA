from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
REPLAY_DIR = DATA_DIR / "replay"
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"
CACHE_DIR = BASE_DIR / "cache"
DOCS_DIR = BASE_DIR / "docs"

for _d in (DATA_DIR, REPLAY_DIR, MODELS_DIR, REPORTS_DIR, CACHE_DIR, DOCS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

CACHE_DB_PATH = CACHE_DIR / "varuna_cache.sqlite3"
ALIGNED_CSV = DATA_DIR / "aligned_multi_season_lead_data.csv"
PROVENANCE_JSON = DATA_DIR / "provenance.json"
REPLAY_TIMELINES = REPLAY_DIR / "timelines.json"
META_MODEL_PATH = MODELS_DIR / "xgboost_meta_temperature.joblib"
BLEND_TEST_CSV = REPORTS_DIR / "blend_test_results.csv"

APP_VERSION = "1.0.0"

BENCHMARKED_REGIONS = {
    "delhi_ncr",
    "mumbai_coastal",
    "western_ghats",
    "odisha_coast",
    "bengaluru_deccan",
    "rajasthan_thar",
}

REGIONS: dict[str, dict] = {
    "delhi_ncr": {
        "name": "Delhi NCR", "state": "Delhi / Haryana", "lat": 28.6139,
        "lon": 77.209, "zone": "North-West Plains",
    },
    "mumbai_coastal": {
        "name": "Mumbai Coastal", "state": "Maharashtra", "lat": 19.076,
        "lon": 72.8777, "zone": "Konkan Maritime Zone",
    },
    "western_ghats": {
        "name": "Western Ghats (Mahabaleshwar)", "state": "Maharashtra / Karnataka", "lat": 17.9237,
        "lon": 73.6586, "zone": "High Ghats Escarpment",
    },
    "gujarat_industrial": {
        "name": "Jamnagar Petrochemical Belt", "state": "Gujarat", "lat": 22.4707,
        "lon": 70.0577, "zone": "Kathiawar Coastal Strip",
    },
    "odisha_coast": {
        "name": "Paradip Port / Bay Coast", "state": "Odisha", "lat": 20.3164,
        "lon": 86.6085, "zone": "Mahanadi Deltaic Littoral",
    },
    "bengaluru_deccan": {
        "name": "Bengaluru Deccan", "state": "Karnataka", "lat": 12.9716,
        "lon": 77.5946, "zone": "South Interior Plateau",
    },
    "punjab_agri": {
        "name": "Punjab Central Agro-Belt", "state": "Punjab", "lat": 30.901,
        "lon": 75.8573, "zone": "Indo-Gangetic Basin",
    },
    "assam_valley": {
        "name": "Guwahati / Brahmaputra Valley", "state": "Assam", "lat": 26.1445,
        "lon": 91.7362, "zone": "Sub-Himalayan Trough",
    },
    "chennai_coastal": {
        "name": "Chennai Coromandel", "state": "Tamil Nadu", "lat": 13.0827,
        "lon": 80.2707, "zone": "Coromandel Coastal Plain",
    },
    "rajasthan_thar": {
        "name": "Jodhpur / Western Thar", "state": "Rajasthan", "lat": 26.2389,
        "lon": 73.0243, "zone": "Thar Arid Zone",
    },
    "kerala_coast": {
        "name": "Kochi Malabar Coast", "state": "Kerala", "lat": 9.9312,
        "lon": 76.2673, "zone": "Malabar Maritime Zone",
    },
    "central_highlands": {
        "name": "Bhopal / Central Highlands", "state": "Madhya Pradesh", "lat": 23.2599,
        "lon": 77.4126, "zone": "Vindhya Basin Plateau",
    },
    "kolkata_littoral": {
        "name": "Kolkata / Gangetic Delta", "state": "West Bengal", "lat": 22.5726,
        "lon": 88.3639, "zone": "Lower Gangetic Delta",
    },
    "hyderabad_plateau": {
        "name": "Hyderabad / Telangana Plateau", "state": "Telangana", "lat": 17.385,
        "lon": 78.4867, "zone": "Telangana Semi-Arid Plateau",
    },
    "ahmedabad_plains": {
        "name": "Ahmedabad / North Gujarat", "state": "Gujarat", "lat": 23.0225,
        "lon": 72.5714, "zone": "North Gujarat Semi-Arid Basin",
    },
    "jaipur_semiarid": {
        "name": "Jaipur / Eastern Rajasthan", "state": "Rajasthan", "lat": 26.9124,
        "lon": 75.7873, "zone": "Aravalli Semi-Arid Zone",
    },
    "lucknow_basin": {
        "name": "Lucknow / Central Awadh", "state": "Uttar Pradesh", "lat": 26.8467,
        "lon": 80.9462, "zone": "Central Gangetic Plain",
    },
    "kanpur_industrial": {
        "name": "Kanpur / Middle Gangetic Plain", "state": "Uttar Pradesh", "lat": 26.4499,
        "lon": 80.3319, "zone": "Middle Gangetic Industrial Belt",
    },
    "patna_gangetic": {
        "name": "Patna / Lower Gangetic Basin", "state": "Bihar", "lat": 25.5941,
        "lon": 85.1376, "zone": "Middle-Lower Gangetic Transition",
    },
    "shimla_himalayan": {
        "name": "Shimla / Western Himalayan Ridge", "state": "Himachal Pradesh", "lat": 31.1048,
        "lon": 77.1734, "zone": "Western Himalayan Montane",
    },
    "dehradun_foothills": {
        "name": "Dehradun / Shiwalik Foothills", "state": "Uttarakhand", "lat": 30.3165,
        "lon": 78.0322, "zone": "Sub-Himalayan Dun Valley",
    },
    "srinagar_valley": {
        "name": "Srinagar / Kashmir Basin", "state": "Jammu & Kashmir", "lat": 34.0837,
        "lon": 74.7973, "zone": "Kashmir Intermontane Basin",
    },
    "chandigarh_plains": {
        "name": "Chandigarh / Shivalik Plain", "state": "Punjab / Haryana", "lat": 30.7333,
        "lon": 76.7794, "zone": "North-Western Sub-Montane Strip",
    },
    "amritsar_border": {
        "name": "Amritsar / Upper Bari Doab", "state": "Punjab", "lat": 31.634,
        "lon": 74.8723, "zone": "Upper Indus Basin",
    },
    "varanasi_eastern_up": {
        "name": "Varanasi / Kashi Riparian Plains", "state": "Uttar Pradesh", "lat": 25.3176,
        "lon": 82.9739, "zone": "Eastern Gangetic Plain",
    },
    "agra_yamuna": {
        "name": "Agra / Braj Plain", "state": "Uttar Pradesh", "lat": 27.1767,
        "lon": 78.0081, "zone": "Yamuna Semi-Arid Basin",
    },
    "indore_malwa": {
        "name": "Indore / Malwa Plateau", "state": "Madhya Pradesh", "lat": 22.7196,
        "lon": 75.8577, "zone": "Malwa Trappean Plateau",
    },
    "jabalpur_narmada": {
        "name": "Jabalpur / Narmada Basin", "state": "Madhya Pradesh", "lat": 23.1815,
        "lon": 79.9864, "zone": "Central Narmada Rifts",
    },
    "raipur_chhattisgarh": {
        "name": "Raipur / Mahanadi Basin", "state": "Chhattisgarh", "lat": 21.2514,
        "lon": 81.6296, "zone": "Mahanadi Upper Plain",
    },
    "ranchi_chota_nagpur": {
        "name": "Ranchi / Chota Nagpur Plateau", "state": "Jharkhand", "lat": 23.3441,
        "lon": 85.3096, "zone": "Chota Nagpur High Plateau",
    },
    "bhubaneswar_coastal": {
        "name": "Bhubaneswar / Coastal Plain", "state": "Odisha", "lat": 20.2961,
        "lon": 85.8245, "zone": "Odisha Coastal Belt",
    },
    "visakhapatnam_coast": {
        "name": "Visakhapatnam / Northern Circars", "state": "Andhra Pradesh", "lat": 17.6868,
        "lon": 83.2185, "zone": "Eastern Ghats Coastal Littoral",
    },
    "vijayawada_krishna": {
        "name": "Vijayawada / Krishna Delta", "state": "Andhra Pradesh", "lat": 16.5062,
        "lon": 80.648, "zone": "Coastal Andhra Delta",
    },
    "coimbatore_gap": {
        "name": "Coimbatore / Palghat Gap", "state": "Tamil Nadu", "lat": 11.0168,
        "lon": 76.9558, "zone": "Palghat Orographic Funnel",
    },
    "madurai_vaigai": {
        "name": "Madurai / Vaigai Basin", "state": "Tamil Nadu", "lat": 9.9252,
        "lon": 78.1198, "zone": "South Tamil Nadu Rainshadow Plains",
    },
    "thiruvananthapuram_south": {
        "name": "Thiruvananthapuram / Travancore Coast", "state": "Kerala", "lat": 8.5241,
        "lon": 76.9366, "zone": "Southern Malabar Littoral",
    },
    "goa_konkan": {
        "name": "Panaji / Central Konkan", "state": "Goa", "lat": 15.4909,
        "lon": 73.8278, "zone": "Central Konkan Maritime",
    },
    "pune_desh": {
        "name": "Pune / Western Desh", "state": "Maharashtra", "lat": 18.5204,
        "lon": 73.8567, "zone": "Western Ghats Leeward Rainshadow",
    },
    "nagpur_vidarbha": {
        "name": "Nagpur / Vidarbha Belt", "state": "Maharashtra", "lat": 21.1458,
        "lon": 79.0882, "zone": "Vidarbha Semi-Arid Basin",
    },
    "surat_tapti": {
        "name": "Surat / South Gujarat Coast", "state": "Gujarat", "lat": 21.1702,
        "lon": 72.8311, "zone": "South Gujarat Estuary",
    },
    "kota_chambal": {
        "name": "Kota / Chambal Basin", "state": "Rajasthan", "lat": 25.2138,
        "lon": 75.8648, "zone": "Hadoti Ravine Plateau",
    },
    "shillong_meghalaya": {
        "name": "Shillong / Khasi Hills", "state": "Meghalaya", "lat": 25.5788,
        "lon": 91.8933, "zone": "Meghalaya Orographic Crest",
    },
    "agartala_tripura": {
        "name": "Agartala / Tripura Valley", "state": "Tripura", "lat": 23.8315,
        "lon": 91.2868, "zone": "Surma-Meghna Trough",
    },
    "imphal_manipur": {
        "name": "Imphal / Manipur Basin", "state": "Manipur", "lat": 24.817,
        "lon": 93.9368, "zone": "Eastern Intermontane Valley",
    },
    "port_blair_andaman": {
        "name": "Port Blair / Andaman Island", "state": "Andaman & Nicobar", "lat": 11.6234,
        "lon": 92.7265, "zone": "Andaman Sea Marine Core",
    },
}

for _rid, _r in REGIONS.items():
    _r["id"] = _rid
    _r["validated"] = _rid in BENCHMARKED_REGIONS
    _r["benchmarked"] = _rid in BENCHMARKED_REGIONS

MODEL_IDS: dict[str, str] = {
    "ecmwf_ifs": "ecmwf_ifs025",
    "ecmwf_aifs": "ecmwf_aifs025_single",
    "ncep_gfs": "gfs_seamless",
    "dwd_icon": "icon_seamless",
}
MODEL_KEYS: list[str] = list(MODEL_IDS.keys())
MODEL_NAMES: dict[str, str] = {
    "ecmwf_ifs": "ECMWF IFS",
    "ecmwf_aifs": "ECMWF AIFS",
    "ncep_gfs": "NOAA GFS",
    "dwd_icon": "DWD ICON",
}

VARIABLES: dict[str, dict] = {
    "temperature": {"openmeteo": "temperature_2m", "unit": "\u00b0C", "validated": True},
    "rainfall": {"openmeteo": "precipitation", "unit": "mm", "validated": False},
    "wind_speed": {"openmeteo": "wind_speed_10m", "unit": "km/h", "validated": False},
    "pressure": {"openmeteo": "surface_pressure", "unit": "hPa", "validated": False},
}
VARIABLE_KEYS: list[str] = list(VARIABLES.keys())

LEAD_TIMES: list[int] = [24, 48, 72, 120]
FORECAST_HORIZON_CAP_H = 168
HORIZON_NOTE = (
    "Forecast horizon is capped at 168 h (7 days). "
    "Longer horizons are not supported by this system."
)
LEAD_TO_PREVIOUS_DAY: dict[int, str] = {
    24: "previous_day1",
    48: "previous_day2",
    72: "previous_day3",
    120: "previous_day5",
}

BENCHMARK_WINDOWS: dict[str, tuple[str, str]] = {
    "winter": ("2026-01-10", "2026-01-17"),
    "pre_monsoon": ("2026-04-10", "2026-04-17"),
    "monsoon": ("2026-07-01", "2026-07-15"),
    "post_monsoon": ("2026-09-01", "2026-09-08"),
}
BENCHMARK_REGION_IDS: list[str] = sorted(BENCHMARKED_REGIONS)

SPLIT_TRAIN = 0.65
SPLIT_VAL = 0.15
SPLIT_TEST = 0.20

XGB_PARAMS = {
    "n_estimators": 80,
    "max_depth": 4,
    "learning_rate": 0.06,
    "subsample": 1.0,
    "colsample_bytree": 1.0,
    "objective": "reg:squarederror",
    "n_jobs": -1,
    "random_state": 42,
}
FEATURE_NAMES: list[str] = [
    "latitude",
    "longitude",
    "elevation_m",
    "lead_time_hours",
    "day_of_year",
    "hour_of_day",
    "month",
    "regime_index",
    "ensemble_mean",
    "ensemble_spread",
    "model_own_forecast",
]
WEIGHT_EPSILON = 1e-6

EXTREME_THRESHOLDS = {
    "heavy_rain_mm_24h": 64.5,
    "very_heavy_rain_mm_24h": 115.6,
    "heatwave_c": 45.0,
    "wind_squall_kmh": 55.0,
    "wind_gale_kmh": 62.0,
}

REGIME_CLASSES: list[str] = [
    "Monsoonal Active Surge",
    "Monsoonal Break",
    "Western Disturbance",
    "Pre-Monsoon Convective",
    "Subtropical Heatwave",
    "Post-Monsoon Depression",
]

FORECAST_API = os.environ.get("VARUNA_FORECAST_API", "https://api.open-meteo.com/v1/forecast")
PREVIOUS_RUNS_API = os.environ.get(
    "VARUNA_PREVIOUS_RUNS_API", "https://previous-runs-api.open-meteo.com/v1/forecast"
)
ARCHIVE_API = os.environ.get("VARUNA_ARCHIVE_API", "https://archive-api.open-meteo.com/v1/archive")

HTTP_TIMEOUT_S = float(os.environ.get("VARUNA_HTTP_TIMEOUT_S", "30"))
HTTP_RETRIES = 3
CACHE_TTL_LIVE_S = 30 * 60

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://varuna-rose.vercel.app",
    *([o.strip().rstrip("/") for o in os.environ.get("VARUNA_CORS_ORIGINS", "").split(",") if o.strip()]),
]

ATTRIBUTION = (
    "Data: Open-Meteo (CC BY 4.0), ECMWF, NOAA, DWD. "
    "Verification reference: ERA5 reanalysis, not station observations."
)
