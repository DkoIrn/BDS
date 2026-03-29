"""KML/KMZ parser -- extracts placemarks with coordinates and extended data."""

import io
import zipfile

from lxml import etree

from app.parsers.base import ParseResult

KML_NS = "http://www.opengis.net/kml/2.2"
NSMAP = {"kml": KML_NS}


def _parse_coordinates(coord_text: str) -> list[tuple[str, str, str]]:
    """Parse KML coordinate string into list of (lon, lat, elev) tuples."""
    result = []
    for token in coord_text.strip().split():
        parts = token.split(",")
        lon = parts[0] if len(parts) > 0 else ""
        lat = parts[1] if len(parts) > 1 else ""
        elev = parts[2] if len(parts) > 2 else ""
        result.append((lon, lat, elev))
    return result


def parse_kml(file_bytes: bytes) -> ParseResult:
    """Parse KML bytes into a normalized ParseResult.

    Extracts Placemark name, description, coordinates, and extended data.
    All row values are strings.
    """
    root = etree.parse(io.BytesIO(file_bytes)).getroot()

    # Find all Placemarks (handle with or without namespace)
    placemarks = root.findall(f".//{{{KML_NS}}}Placemark")
    if not placemarks:
        # Try without namespace
        placemarks = root.findall(".//Placemark")

    # Collect all extended data keys across placemarks
    ext_data_keys: set[str] = set()
    for pm in placemarks:
        # ExtendedData/Data elements
        for data_el in pm.findall(f".//{{{KML_NS}}}Data") + pm.findall(".//Data"):
            name = data_el.get("name")
            if name:
                ext_data_keys.add(name)
        # ExtendedData/SchemaData/SimpleData elements
        for sd in pm.findall(f".//{{{KML_NS}}}SimpleData") + pm.findall(
            ".//SimpleData"
        ):
            name = sd.get("name")
            if name:
                ext_data_keys.add(name)

    sorted_ext_keys = sorted(ext_data_keys)
    headers = ["name", "description", "longitude", "latitude", "elevation"] + sorted_ext_keys

    rows: list[list[str]] = []
    warnings: list[str] = []

    for pm in placemarks:
        # Extract name
        name_el = pm.find(f"{{{KML_NS}}}name")
        if name_el is None:
            name_el = pm.find("name")
        name = name_el.text if name_el is not None and name_el.text else ""

        # Extract description
        desc_el = pm.find(f"{{{KML_NS}}}description")
        if desc_el is None:
            desc_el = pm.find("description")
        description = desc_el.text if desc_el is not None and desc_el.text else ""

        # Extract coordinates
        coord_el = pm.find(f".//{{{KML_NS}}}coordinates")
        if coord_el is None:
            coord_el = pm.find(".//coordinates")

        if coord_el is None or not coord_el.text:
            warnings.append(f"Placemark '{name}' has no coordinates")
            continue

        coord_points = _parse_coordinates(coord_el.text)

        # Extract extended data values
        ext_values: dict[str, str] = {}
        for data_el in pm.findall(f".//{{{KML_NS}}}Data") + pm.findall(".//Data"):
            key = data_el.get("name")
            val_el = data_el.find(f"{{{KML_NS}}}value")
            if val_el is None:
                val_el = data_el.find("value")
            if key and val_el is not None and val_el.text:
                ext_values[key] = val_el.text
        for sd in pm.findall(f".//{{{KML_NS}}}SimpleData") + pm.findall(
            ".//SimpleData"
        ):
            key = sd.get("name")
            if key and sd.text:
                ext_values[key] = sd.text

        for lon, lat, elev in coord_points:
            row = [name, description, lon, lat, elev]
            for key in sorted_ext_keys:
                row.append(ext_values.get(key, ""))
            rows.append(row)

    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={"placemark_count": len(placemarks)},
        warnings=warnings,
        source_format="kml",
    )


def parse_kmz(file_bytes: bytes) -> ParseResult:
    """Parse KMZ (zipped KML) bytes into ParseResult.

    Extracts the first .kml file from the archive and delegates to parse_kml.
    """
    zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    kml_name = None
    for name in zf.namelist():
        if name.lower().endswith(".kml"):
            kml_name = name
            break

    if kml_name is None:
        raise ValueError("KMZ archive does not contain a .kml file")

    kml_bytes = zf.read(kml_name)
    result = parse_kml(kml_bytes)
    result.source_format = "kmz"
    return result
