"""Tests for data validation and geographical integrity."""

import pytest
from src.data.load import describe_columns, scan_all
from src.data.validate import validate_corpus


def test_dataset_shards_exist():
    lf = scan_all()
    n = lf.select("loc_id").unique().collect().height
    assert n == 127, f"Expected 127 location shards, found {n}"


def test_validation_passes():
    report = validate_corpus()
    assert report["status"] == "PASS", f"Data validation failed: {report}"
    assert report["row_count"] == 9582912
    assert report["raw_files"] == 127
    assert len(report.get("issues", [])) == 0
