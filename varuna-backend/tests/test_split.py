"""Chronological split invariants (Section 2.6)."""
import pandas as pd

from app.science.alignment import ALIGNED_COLUMNS, split_partitions


def _df(n_timestamps: int = 100, rows_per_ts: int = 3) -> pd.DataFrame:
    rows = []
    for t in range(n_timestamps):
        ts = f"2026-{1 + t // 28:02d}-{1 + t % 28:02d}T{t % 24:02d}:00"
        for r in range(rows_per_ts):
            rows.append({"timestamp": ts, "row": r})
    return pd.DataFrame(rows)


def test_no_timestamp_in_two_partitions():
    df = _df()
    train, val, test = split_partitions(df)
    ts_train, ts_val, ts_test = (set(x["timestamp"]) for x in (train, val, test))
    assert not (ts_train & ts_val)
    assert not (ts_train & ts_test)
    assert not (ts_val & ts_test)
    assert len(train) + len(val) + len(test) == len(df)


def test_partition_ordering_is_chronological():
    df = _df()
    train, val, test = split_partitions(df)
    assert max(train["timestamp"]) <= min(val["timestamp"])
    assert max(val["timestamp"]) <= min(test["timestamp"])


def test_split_fractions_approximately_65_15_20():
    df = _df(100)
    train, val, test = split_partitions(df)
    n = df["timestamp"].nunique()
    assert train["timestamp"].nunique() == int(n * 0.65)
    assert val["timestamp"].nunique() == int(n * 0.15)
    assert test["timestamp"].nunique() == n - int(n * 0.65) - int(n * 0.15)


def test_all_rows_sharing_a_timestamp_stay_together():
    df = _df(50, rows_per_ts=4)
    train, val, test = split_partitions(df)
    for part in (train, val, test):
        counts = part.groupby("timestamp").size()
        assert ((counts == 4) | (counts == 0)).all()


def test_empty_dataframe_safe():
    df = pd.DataFrame(columns=ALIGNED_COLUMNS)
    train, val, test = split_partitions(df)
    assert len(train) == len(val) == len(test) == 0
