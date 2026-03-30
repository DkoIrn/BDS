"""Tests for CRS auto-detection heuristics."""

import pytest

from app.transforms._detect_crs import detect_crs_from_values, utm_zone_from_lonlat


class TestDetectCrsFromValues:
    def test_wgs84_detected(self):
        epsg, note = detect_crs_from_values([0.5, 1.2], [51.4, 51.5])
        assert epsg == 4326
        assert "WGS84" in note or "wgs84" in note.lower()

    def test_osgb36_detected(self):
        epsg, note = detect_crs_from_values([350000, 360000], [600000, 610000])
        assert epsg == 27700
        assert "OSGB36" in note or "osgb" in note.lower()

    def test_utm_detected_returns_none(self):
        """UTM ranges are ambiguous -- return None with informational note."""
        epsg, note = detect_crs_from_values([500000, 510000], [5700000, 5710000])
        assert epsg is None
        assert "UTM" in note or "utm" in note.lower()

    def test_empty_values(self):
        epsg, note = detect_crs_from_values([], [])
        assert epsg is None
        assert "no coordinate" in note.lower()

    def test_negative_longitude_wgs84(self):
        epsg, note = detect_crs_from_values([-73.9, -74.0], [40.7, 40.8])
        assert epsg == 4326


class TestUtmZoneFromLonlat:
    def test_london(self):
        """London is in UTM zone 30N -> EPSG 32630."""
        epsg = utm_zone_from_lonlat(-0.12, 51.5)
        assert epsg == 32630

    def test_new_york(self):
        """New York is in UTM zone 18N -> EPSG 32618."""
        epsg = utm_zone_from_lonlat(-74.0, 40.7)
        assert epsg == 32618

    def test_southern_hemisphere(self):
        """Sydney is in UTM zone 56S -> EPSG 32756."""
        epsg = utm_zone_from_lonlat(151.2, -33.9)
        assert epsg == 32756
