"""
Open-Meteo Multi-Model Data Provider Adapter for VARUNA.
Fetches and normalizes ECMWF IFS, ECMWF AIFS (Single), NOAA GFS, DWD ICON, and ERA5.
Integrates SQLite response caching to respect rate limits.
"""
import urllib.request
import urllib.parse
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from ..config import CANONICAL_REGIONS, CANONICAL_MODELS, CANONICAL_VARIABLES
from .base import AbstractWeatherProvider, NormalizedForecastPoint, NormalizedForecastSeries, ProviderStatus
from .cache import get_cached_response, set_cached_response

logger = logging.getLogger("varuna.providers.open_meteo")

FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast"
HISTORICAL_BASE_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
PREVIOUS_RUNS_BASE_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1/archive"

VARIABLE_PARAM_MAP = {
    "rainfall": "precipitation",
    "temperature": "temperature_2m",
    "wind_speed": "wind_speed_10m",
    "pressure": "surface_pressure",
}

VARIABLE_UNITS = {
    "rainfall": "mm",
    "temperature": "°C",
    "wind_speed": "km/h",
    "pressure": "hPa",
}

class OpenMeteoProvider(AbstractWeatherProvider):
    """Integrated provider for all 4 global NWP/AI models via Open-Meteo."""

    def __init__(self):
        self._provider_id = "open_meteo_multi"
        self._name = "Open-Meteo Multi-Model Pipeline (IFS, AIFS, GFS, ICON)"

    @property
    def provider_id(self) -> str:
        return self._provider_id

    @property
    def display_name(self) -> str:
        return self._name

    def fetch_live_raw(self, lat: float, lon: float, models: List[str], variables: List[str]) -> Dict[str, Any]:
        """Fetch live forecasts for requested models and variables."""
        models_str = ",".join(models)
        hourly_str = ",".join(variables)
        cache_key = f"live_{lat:.4f}_{lon:.4f}_{models_str}_{hourly_str}"
        
        cached = get_cached_response(cache_key)
        if cached:
            return cached

        params = {
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "hourly": hourly_str,
            "models": models_str,
            "timezone": "UTC"
        }
        url = f"{FORECAST_BASE_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": "VARUNA-Backend/1.0"})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
            # Cache live forecasts for 30 minutes
            set_cached_response(cache_key, data, ttl_seconds=1800.0)
            return data

    def fetch_historical_raw(
        self,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str,
        models: List[str],
        variables: List[str]
    ) -> Dict[str, Any]:
        """Fetch archived forecasts from historical-forecast-api."""
        models_str = ",".join(models)
        hourly_str = ",".join(variables)
        cache_key = f"hist_{lat:.4f}_{lon:.4f}_{start_date}_{end_date}_{models_str}_{hourly_str}"
        
        cached = get_cached_response(cache_key)
        if cached:
            return cached

        params = {
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "start_date": start_date,
            "end_date": end_date,
            "hourly": hourly_str,
            "models": models_str,
            "timezone": "UTC"
        }
        url = f"{HISTORICAL_BASE_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": "VARUNA-Backend/1.0"})
        with urllib.request.urlopen(req, timeout=25) as res:
            data = json.loads(res.read().decode("utf-8"))
            # Historical forecasts are static, cache permanently (ttl=-1)
            set_cached_response(cache_key, data, ttl_seconds=-1.0)
            return data

    def fetch_previous_runs_raw(
        self,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str,
        models: List[str],
        lead_days: List[int] = [1, 2, 3, 5]
    ) -> Dict[str, Any]:
        """Fetch forecasts at fixed lead-time offsets (day1=24h, 2=48h, 3=72h, 5=120h)."""
        models_str = ",".join(models)
        lead_str = ",".join([f"temperature_2m_previous_day{d}" for d in lead_days])
        cache_key = f"prev_runs_{lat:.4f}_{lon:.4f}_{start_date}_{end_date}_{models_str}_{lead_str}"
        
        cached = get_cached_response(cache_key)
        if cached:
            return cached

        params = {
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "start_date": start_date,
            "end_date": end_date,
            "hourly": lead_str,
            "models": models_str,
            "timezone": "UTC"
        }
        url = f"{PREVIOUS_RUNS_BASE_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": "VARUNA-Backend/1.0"})
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode("utf-8"))
            set_cached_response(cache_key, data, ttl_seconds=-1.0)
            return data

    def fetch_era5_reference_raw(
        self,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str,
        variables: List[str]
    ) -> Dict[str, Any]:
        """Fetch ERA5 reanalysis reference series from archive-api."""
        hourly_str = ",".join(variables)
        cache_key = f"era5_{lat:.4f}_{lon:.4f}_{start_date}_{end_date}_{hourly_str}"
        
        cached = get_cached_response(cache_key)
        if cached:
            return cached

        params = {
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "start_date": start_date,
            "end_date": end_date,
            "hourly": hourly_str,
            "timezone": "UTC"
        }
        url = f"{ARCHIVE_BASE_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": "VARUNA-Backend/1.0"})
        with urllib.request.urlopen(req, timeout=25) as res:
            data = json.loads(res.read().decode("utf-8"))
            set_cached_response(cache_key, data, ttl_seconds=-1.0)
            return data

    async def get_forecast(
        self,
        region_id: str,
        variable: str,
        mode: str = "LIVE"
    ) -> NormalizedForecastSeries:
        """Fetch and normalize current forecast for the specified region and variable."""
        if region_id not in CANONICAL_REGIONS:
            raise ValueError(f"Unknown region {region_id}")

        reg = CANONICAL_REGIONS[region_id]
        param = VARIABLE_PARAM_MAP.get(variable, "precipitation")
        unit = VARIABLE_UNITS.get(variable, "mm")

        open_meteo_models = [
            CANONICAL_MODELS["ecmwf_ifs"]["open_meteo_model"],
            CANONICAL_MODELS["ecmwf_aifs"]["open_meteo_model"],
            CANONICAL_MODELS["ncep_gfs"]["open_meteo_model"],
            CANONICAL_MODELS["dwd_icon"]["open_meteo_model"],
        ]

        try:
            raw_data = self.fetch_live_raw(reg.lat, reg.lng, open_meteo_models, [param])
            hourly = raw_data.get("hourly", {})
            times = hourly.get("time", [])
            
            init_time = datetime.now(timezone.utc)
            points: List[NormalizedForecastPoint] = []
            
            # Map Open-Meteo column keys
            for idx, t_str in enumerate(times[:168]):  # 7-day horizon
                valid_time = datetime.fromisoformat(t_str).replace(tzinfo=timezone.utc)
                lead_hours = idx
                
                # Check for each model
                for model_key, model_meta in CANONICAL_MODELS.items():
                    om_model = model_meta["open_meteo_model"]
                    # If multiple models, Open-Meteo appends _modelname
                    col_key = f"{param}_{om_model}" if f"{param}_{om_model}" in hourly else param
                    val_list = hourly.get(col_key, [])
                    val = val_list[idx] if idx < len(val_list) and val_list[idx] is not None else 0.0
                    
                    points.append(
                        NormalizedForecastPoint(
                            model=model_key,
                            variable=variable,
                            region_id=region_id,
                            latitude=reg.lat,
                            longitude=reg.lng,
                            init_time=init_time,
                            valid_time=valid_time,
                            lead_time_hours=lead_hours,
                            value=round(float(val), 2),
                            unit=unit,
                            source="Open-Meteo Multi-Model API",
                            data_mode="LIVE"
                        )
                    )

            return NormalizedForecastSeries(
                model="ensemble_4m",
                variable=variable,
                region_id=region_id,
                latitude=reg.lat,
                longitude=reg.lng,
                init_time=init_time,
                unit=unit,
                source="Open-Meteo Multi-Model API",
                data_mode="LIVE",
                points=points
            )

        except Exception as e:
            logger.error(f"Live fetch failed for {region_id} {variable}: {e}")
            raise

    async def get_status(self) -> ProviderStatus:
        """Probe Open-Meteo health."""
        try:
            raw = self.fetch_live_raw(28.6139, 77.2090, ["gfs_seamless"], ["temperature_2m"])
            return ProviderStatus(
                provider_id=self.provider_id,
                name=self.display_name,
                status="ONLINE",
                data_mode="LIVE",
                endpoint=FORECAST_BASE_URL,
                last_sync=datetime.now(timezone.utc),
                latency_ms=raw.get("generationtime_ms", 12.5),
                sample_count=len(raw.get("hourly", {}).get("time", [])),
                message="Connected to Open-Meteo Global NWP/AI Gateway"
            )
        except Exception as e:
            return ProviderStatus(
                provider_id=self.provider_id,
                name=self.display_name,
                status="OFFLINE",
                data_mode="ERROR",
                endpoint=FORECAST_BASE_URL,
                message=f"Connection failed: {str(e)}"
            )
