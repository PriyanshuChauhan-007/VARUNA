# VARUNA: Known Limitations & Operational Boundaries

**Document**: System Limitations and Future Engineering Horizons  
**Status**: Authoritative  

---

## 1. Meteorological & Physical Boundaries

1. **Orographic Sub-Grid Phenomena**:
   - While ECMWF IFS operates at ~9 km resolution, micro-scale convective cloud bursts in narrow Western Ghats valleys or Himalayan foothills can exceed the resolvable physics of hydrostatic global models.
2. **Convective Precipitation Extremes**:
   - Deep learning models (ECMWF AIFS) are trained with loss functions that can smooth localized extreme precipitation spikes (e.g. > 150 mm in 3 hours). The meta-model dynamically shifts weight toward high-resolution NWP (IFS, ICON) during heavy convective regimes.
3. **Tropical Cyclogenesis Initial Shock**:
   - Rapid cyclonic intensification over the warm Bay of Bengal remains challenging for global models prior to cyclonic eye formation.

---

## 2. Telemetry & Ingestion Boundaries

1. **IMD In-Situ Station Mesh**:
   - Ministry of Earth Sciences (MoES) operational AWS telemetry requires institutional API keys and VPN peering. The system explicitly declares this stream as pending integration (`IMD AWS — Integration Pending`) rather than fabricating synthetic station telemetry.
2. **Public Tier API Quotas**:
   - Open-Meteo's generous free tier provides 10,000 daily API calls. The internal SQLite cache prevents redundant network round-trips and guarantees uninterrupted local operation during hackathon judging.
