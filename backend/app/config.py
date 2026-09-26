"""
Configuration and Domain Constants for VARUNA Scientific Backend.
Matches the 12 Canonical Indian Meteorological Zones and canonical models.
"""
from pathlib import Path
from typing import Dict, List, Any
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "cache"
REPORTS_DIR = BASE_DIR / "reports"
MODELS_DIR = BASE_DIR / "models"
DOCS_DIR = BASE_DIR.parent / "docs"

# Ensure directories exist
for directory in [DATA_DIR, CACHE_DIR, REPORTS_DIR, MODELS_DIR, DOCS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

class Region(BaseModel):
    id: str
    name: str
    state: str
    lat: float
    lng: float
    zone: str
    regime: str
    elevation_m: float
    stations_count: int

CANONICAL_REGIONS: Dict[str, Region] = {
    "delhi_ncr": Region(
        id="delhi_ncr",
        name="Delhi NCR",
        state="Delhi / Haryana",
        lat=28.6139,
        lng=77.2090,
        zone="North-West Plains",
        regime="Northern Plains Convective / Western Disturbance",
        elevation_m=216.0,
        stations_count=28
    ),
    "mumbai_coastal": Region(
        id="mumbai_coastal",
        name="Mumbai Coastal",
        state="Maharashtra",
        lat=19.0760,
        lng=72.8777,
        zone="Konkan Maritime Zone",
        regime="West Coast Orographic Monsoon Surge",
        elevation_m=14.0,
        stations_count=36
    ),
    "western_ghats": Region(
        id="western_ghats",
        name="Western Ghats (Mahabaleshwar)",
        state="Maharashtra / Karnataka",
        lat=17.9237,
        lng=73.6586,
        zone="High Ghats Escarpment",
        regime="High-Elevation Orographic Cloud Burst & Runoff",
        elevation_m=1353.0,
        stations_count=22
    ),
    "gujarat_industrial": Region(
        id="gujarat_industrial",
        name="Jamnagar Petrochemical Belt",
        state="Gujarat",
        lat=22.4707,
        lng=70.0577,
        zone="Kathiawar Coastal Strip",
        regime="Arid / Arabian Sea Marine Boundary Layer Inversion",
        elevation_m=20.0,
        stations_count=24
    ),
    "odisha_coast": Region(
        id="odisha_coast",
        name="Paradip Port / Bay Coast",
        state="Odisha",
        lat=20.3164,
        lng=86.6085,
        zone="Mahanadi Deltaic Littoral",
        regime="Bay of Bengal Depressions & Cyclonic Inflow",
        elevation_m=8.0,
        stations_count=32
    ),
    "bengaluru_deccan": Region(
        id="bengaluru_deccan",
        name="Bengaluru Deccan",
        state="Karnataka",
        lat=12.9716,
        lng=77.5946,
        zone="South Interior Plateau",
        regime="Semi-Arid Peninsular Convergence Zone",
        elevation_m=920.0,
        stations_count=30
    ),
    "punjab_agri": Region(
        id="punjab_agri",
        name="Punjab Central Agro-Belt",
        state="Punjab",
        lat=30.9010,
        lng=75.8573,
        zone="Indo-Gangetic Basin",
        regime="Sub-Tropical Basin Inversion & Boundary Moisture Pool",
        elevation_m=244.0,
        stations_count=26
    ),
    "assam_valley": Region(
        id="assam_valley",
        name="Guwahati / Brahmaputra Valley",
        state="Assam",
        lat=26.1445,
        lng=91.7362,
        zone="Sub-Himalayan Trough",
        regime="Eastern Valley Trapped Convection & High Precipitable Water",
        elevation_m=55.0,
        stations_count=20
    ),
    "chennai_coastal": Region(
        id="chennai_coastal",
        name="Chennai Coromandel",
        state="Tamil Nadu",
        lat=13.0827,
        lng=80.2707,
        zone="Coromandel Coastal Plain",
        regime="Northeast Monsoon Easterly Wave Perturbation",
        elevation_m=6.0,
        stations_count=25
    ),
    "rajasthan_thar": Region(
        id="rajasthan_thar",
        name="Jodhpur / Western Thar",
        state="Rajasthan",
        lat=26.2389,
        lng=73.0243,
        zone="Thar Arid Zone",
        regime="Subtropical Thermal Low & Dust Advection",
        elevation_m=231.0,
        stations_count=16
    ),
    "kerala_coast": Region(
        id="kerala_coast",
        name="Kochi Malabar Coast",
        state="Kerala",
        lat=9.9312,
        lng=76.2673,
        zone="Malabar Maritime Zone",
        regime="Equatorial Low-Level Jet Cross-Equatorial Influx",
        elevation_m=4.0,
        stations_count=29
    ),
    "central_highlands": Region(
        id="central_highlands",
        name="Bhopal / Central Highlands",
        state="Madhya Pradesh",
        lat=23.2599,
        lng=77.4126,
        zone="Vindhya Basin Plateau",
        regime="Monsoon Trough Axial Oscillation & Mid-Tropospheric Vortex",
        elevation_m=527.0,
        stations_count=23
    ),
}

CANONICAL_MODELS = {
    "ecmwf_ifs": {
        "id": "ecmwf_ifs",
        "short_id": "ifs",
        "name": "ECMWF IFS",
        "type": "Physics-Based NWP",
        "resolution": "0.1° (~9 km)",
        "open_meteo_model": "ecmwf_ifs025",
        "weight_color": "#3B82F6",
    },
    "ecmwf_aifs": {
        "id": "ecmwf_aifs",
        "short_id": "aifs",
        "name": "ECMWF AIFS",
        "type": "Deep Learning Transformer NWP",
        "resolution": "0.25° (~28 km)",
        "open_meteo_model": "ecmwf_aifs025_single",
        "weight_color": "#8B5CF6",
    },
    "ncep_gfs": {
        "id": "ncep_gfs",
        "short_id": "gfs",
        "name": "NOAA GFS",
        "type": "Operational Global NWP (FV3)",
        "resolution": "0.13° (~13 km)",
        "open_meteo_model": "gfs_seamless",
        "weight_color": "#10B981",
    },
    "dwd_icon": {
        "id": "dwd_icon",
        "short_id": "icon",
        "name": "DWD ICON",
        "type": "Icosahedral Non-Hydrostatic NWP",
        "resolution": "0.12° (~13 km)",
        "open_meteo_model": "icon_seamless",
        "weight_color": "#F59E0B",
    }
}

CANONICAL_VARIABLES = {
    "rainfall": {
        "id": "rainfall",
        "label": "Rainfall",
        "unit": "mm",
        "open_meteo_param": "precipitation",
        "accumulation": "24h_sum",
        "precision": 1
    },
    "temperature": {
        "id": "temperature",
        "label": "Temperature",
        "unit": "°C",
        "open_meteo_param": "temperature_2m",
        "accumulation": "instantaneous",
        "precision": 1
    },
    "wind_speed": {
        "id": "wind_speed",
        "label": "Wind Speed",
        "unit": "km/h",
        "open_meteo_param": "wind_speed_10m",
        "accumulation": "instantaneous",
        "precision": 1
    },
    "pressure": {
        "id": "pressure",
        "label": "Surface Pressure",
        "unit": "hPa",
        "open_meteo_param": "surface_pressure",
        "accumulation": "instantaneous",
        "precision": 1
    }
}

SYNOPTIC_REGIMES = [
    "Monsoonal Active Surge",
    "Monsoonal Break / Trough Shift",
    "Western Disturbance / Upper Trough",
    "Severe Pre-Monsoon Convective / Nor'wester",
    "Subtropical Heatwave / Low-Level Thermal Ridge",
    "Post-Monsoon Depression / Cyclonic Perturbation"
]

DATA_MODES = {
    "LIVE": "LIVE",
    "REPLAY": "REPLAY",
    "DEMO": "DEMO",
    "ERROR": "ERROR"
}
