"""Script to inspect dataset counts precisely."""
import pandas as pd

df = pd.read_csv('backend/data/aligned_multi_season_lead_data.csv')
print("Total rows:", len(df))
print("\nRows per region:")
for reg, cnt in df['region_id'].value_counts().items():
    print(f"  {reg}: {cnt}")

print("\nRows per lead time:")
for lt, cnt in df['lead_time_hours'].value_counts().sort_index().items():
    print(f"  {lt}h: {cnt}")

print("\nRows per season:")
for s, cnt in df['season'].value_counts().items():
    print(f"  {s}: {cnt}")

print("\nUnique valid timestamps globally:", df['timestamp'].nunique())
print("\nUnique valid timestamps per season:")
for s in ['Winter', 'Pre-Monsoon', 'Monsoon', 'Post-Monsoon']:
    sub = df[df['season'] == s]
    print(f"  {s}: {sub['timestamp'].nunique()} unique timestamps (rows: {len(sub)})")

init_times = set()
for _, r in df.iterrows():
    t_val = pd.to_datetime(r['timestamp'])
    t_init = t_val - pd.Timedelta(hours=int(r['lead_time_hours']))
    init_times.add(t_init)
print("\nUnique initialization timestamps:", len(init_times))

print("\nRows per model:")
for m in ['ecmwf_ifs', 'ecmwf_aifs', 'ncep_gfs', 'dwd_icon']:
    print(f"  {m}: {df[m + '_val'].notna().sum()}")
