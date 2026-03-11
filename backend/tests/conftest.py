import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def sample_df() -> pd.DataFrame:
    """Realistic survey data with KP, DOB, DOC, easting, northing columns (~20 rows)."""
    return pd.DataFrame(
        {
            "kp": [
                0.000, 0.010, 0.020, 0.030, 0.040, 0.050, 0.060, 0.070,
                0.080, 0.090, 0.100, 0.110, 0.120, 0.130, 0.140, 0.150,
                0.160, 0.170, 0.180, 0.190,
            ],
            "dob": [
                1.2, 1.3, 1.1, 1.4, 1.2, 1.5, 1.3, 1.2,
                1.4, 1.1, 1.3, 1.2, 1.5, 1.4, 1.3, 1.2,
                1.1, 1.4, 1.3, 1.2,
            ],
            "doc": [
                0.8, 0.9, 0.7, 0.8, 0.9, 1.0, 0.8, 0.7,
                0.9, 0.8, 1.0, 0.9, 0.8, 0.7, 0.9, 0.8,
                1.0, 0.9, 0.8, 0.7,
            ],
            "easting": [
                500000.0, 500010.0, 500020.0, 500030.0, 500040.0,
                500050.0, 500060.0, 500070.0, 500080.0, 500090.0,
                500100.0, 500110.0, 500120.0, 500130.0, 500140.0,
                500150.0, 500160.0, 500170.0, 500180.0, 500190.0,
            ],
            "northing": [
                6000000.0, 6000010.0, 6000020.0, 6000030.0, 6000040.0,
                6000050.0, 6000060.0, 6000070.0, 6000080.0, 6000090.0,
                6000100.0, 6000110.0, 6000120.0, 6000130.0, 6000140.0,
                6000150.0, 6000160.0, 6000170.0, 6000180.0, 6000190.0,
            ],
        }
    )


@pytest.fixture
def sample_mappings() -> list[dict]:
    """Column mappings matching the ColumnMapping structure from the frontend."""
    return [
        {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
        {"index": 1, "originalName": "dob", "mappedType": "dob", "ignored": False},
        {"index": 2, "originalName": "doc", "mappedType": "doc", "ignored": False},
        {"index": 3, "originalName": "easting", "mappedType": "easting", "ignored": False},
        {"index": 4, "originalName": "northing", "mappedType": "northing", "ignored": False},
    ]


@pytest.fixture
def default_config() -> dict:
    """Default validation thresholds -- generous to avoid false positives."""
    return {
        "dob_min": 0,
        "dob_max": 10,
        "doc_min": 0,
        "doc_max": 10,
        "depth_min": 0,
        "depth_max": 500,
        "kp_gap_max": 0.1,
        "duplicate_kp_tolerance": 0.001,
        "zscore_threshold": 3.0,
        "iqr_multiplier": 1.5,
    }
