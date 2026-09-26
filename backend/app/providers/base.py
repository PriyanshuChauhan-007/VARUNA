"""
Base provider abstractions and normalized data structures for VARUNA.
Enforces consistent schemas across ECMWF IFS, ECMWF AIFS, NOAA GFS, DWD ICON, and ERA5.
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class NormalizedForecastPoint(BaseModel):
    model: str
    variable: str
    region_id: str
    latitude: float
    longitude: float
    init_time: datetime
    valid_time: datetime
    lead_time_hours: int
    value: float
    unit: str
    source: str
    run_id: Optional[str] = None
    data_mode: str = "LIVE"  # "LIVE" | "REPLAY" | "DEMO"

class NormalizedForecastSeries(BaseModel):
    model: str
    variable: str
    region_id: str
    latitude: float
    longitude: float
    init_time: datetime
    unit: str
    source: str
    data_mode: str
    points: List[NormalizedForecastPoint] = Field(default_factory=list)

class ProviderStatus(BaseModel):
    provider_id: str
    name: str
    status: str  # "ONLINE" | "DEGRADED" | "OFFLINE" | "STAGED"
    data_mode: str
    endpoint: str
    last_sync: Optional[datetime] = None
    latency_ms: Optional[float] = None
    sample_count: int = 0
    message: str = "Operating normally"

class AbstractWeatherProvider(ABC):
    """Abstract base class for all weather model data providers."""
    
    @property
    @abstractmethod
    def provider_id(self) -> str:
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        pass

    @abstractmethod
    async def get_forecast(
        self,
        region_id: str,
        variable: str,
        mode: str = "LIVE"
    ) -> NormalizedForecastSeries:
        """Fetch current forecast series for a region and variable."""
        pass

    @abstractmethod
    async def get_status(self) -> ProviderStatus:
        """Return provider health, latency, and ingestion status."""
        pass
