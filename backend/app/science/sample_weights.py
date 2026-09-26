import pandas as pd
from backend.app.science.meta_model import VarunaMetaModel
from backend.app.config import REPORTS_DIR, BASE_DIR

meta = VarunaMetaModel()
meta.load_checkpoint()
df = pd.read_csv('backend/data/aligned_multi_season_lead_data.csv')

# Pick 10 diverse records across seasons, regions, lead times
test_queries = [
    ("delhi_ncr", "Winter", 24),
    ("rajasthan_thar", "Winter", 120),
    ("mumbai_coastal", "Pre-Monsoon", 48),
    ("bengaluru_deccan", "Pre-Monsoon", 72),
    ("western_ghats", "Monsoon", 24),
    ("odisha_coast", "Monsoon", 48),
    ("delhi_ncr", "Monsoon", 120),
    ("delhi_ncr", "Post-Monsoon", 72),
    ("mumbai_coastal", "Post-Monsoon", 120),
    ("rajasthan_thar", "Post-Monsoon", 24)
]

records = []
for r_id, season, lead in test_queries:
    sub = df[(df["season"] == season) & (df["region_id"] == r_id) & (df["lead_time_hours"] == lead)]
    if len(sub) > 0:
        row = sub.iloc[len(sub) // 2]
        m_vals = {m: row[f"{m}_val"] for m in ["ecmwf_ifs", "ecmwf_aifs", "ncep_gfs", "dwd_icon"]}
        res = meta.predict_adaptive_weights(
            lat=row["latitude"], lon=row["longitude"], elev=row["elevation_m"],
            day_of_year=int(row["day_of_year"]), hour=int(row["hour_of_day"]), month=int(row["month"]),
            regime_idx=int(row["regime_index"]), model_values=m_vals, lead_time_hours=int(row["lead_time_hours"])
        )
        w = res["weights"]
        records.append({
            "region_id": r_id,
            "season": season,
            "valid_time": row["timestamp"],
            "lead_time_hours": lead,
            "regime": row["regime"],
            "ifs_weight": w["ecmwf_ifs"],
            "aifs_weight": w["ecmwf_aifs"],
            "gfs_weight": w["ncep_gfs"],
            "icon_weight": w["dwd_icon"],
            "sum_check": sum(w.values())
        })

df_out = pd.DataFrame(records)
print(df_out.to_string(index=False))
df_out.to_csv(REPORTS_DIR / "adaptive_weights_sample_matrix.csv", index=False)
df_out.to_csv(BASE_DIR.parent / "reports" / "adaptive_weights_sample_matrix.csv", index=False)
