"""KML writer -- converts ParseResult to KML bytes."""

from lxml import etree

from app.parsers.base import ParseResult
from app.writers._coords import LON_NAMES, LAT_NAMES, ELEV_NAMES, find_column

KML_NS = "http://www.opengis.net/kml/2.2"
NSMAP = {None: KML_NS}


def write_kml(result: ParseResult) -> tuple[bytes, list[str]]:
    """Convert a ParseResult to KML bytes.

    Returns:
        Tuple of (kml_bytes, warnings).
    """
    warnings: list[str] = []
    lon_idx = find_column(result.headers, LON_NAMES)
    lat_idx = find_column(result.headers, LAT_NAMES)
    elev_idx = find_column(result.headers, ELEV_NAMES)

    has_coords = lon_idx is not None and lat_idx is not None
    if not has_coords:
        warnings.append("No coordinate columns found. Placemarks will have no geometry.")

    # Always add CRS warning when coordinates are present
    warnings.append(
        "Coordinates written as-is. KML viewers expect WGS84 (longitude/latitude). "
        "If your data uses projected coordinates, positions may appear incorrect."
    )

    # Determine coordinate column indices
    coord_indices: set[int] = set()
    if lon_idx is not None:
        coord_indices.add(lon_idx)
    if lat_idx is not None:
        coord_indices.add(lat_idx)
    if elev_idx is not None:
        coord_indices.add(elev_idx)

    # Non-coordinate headers for ExtendedData
    non_coord_headers = [
        (i, h) for i, h in enumerate(result.headers) if i not in coord_indices
    ]

    # Build KML tree
    kml = etree.Element(f"{{{KML_NS}}}kml", nsmap=NSMAP)
    document = etree.SubElement(kml, f"{{{KML_NS}}}Document")
    doc_name = etree.SubElement(document, f"{{{KML_NS}}}name")
    doc_name.text = "Converted Data"

    for row in result.rows:
        placemark = etree.SubElement(document, f"{{{KML_NS}}}Placemark")

        # Placemark name: first non-coordinate column value
        if non_coord_headers and len(row) > non_coord_headers[0][0]:
            pm_name = etree.SubElement(placemark, f"{{{KML_NS}}}name")
            pm_name.text = row[non_coord_headers[0][0]]

        # Point geometry
        if has_coords:
            try:
                lon = float(row[lon_idx])
                lat = float(row[lat_idx])
                point = etree.SubElement(placemark, f"{{{KML_NS}}}Point")
                coords_el = etree.SubElement(point, f"{{{KML_NS}}}coordinates")
                if elev_idx is not None:
                    try:
                        elev = float(row[elev_idx])
                        coords_el.text = f"{lon},{lat},{elev}"
                    except (ValueError, IndexError):
                        coords_el.text = f"{lon},{lat}"
                else:
                    coords_el.text = f"{lon},{lat}"
            except (ValueError, IndexError):
                pass  # skip geometry for bad rows

        # ExtendedData for non-coordinate columns
        if non_coord_headers:
            ext_data = etree.SubElement(placemark, f"{{{KML_NS}}}ExtendedData")
            for i, header in non_coord_headers:
                if i < len(row):
                    data_el = etree.SubElement(ext_data, f"{{{KML_NS}}}Data")
                    data_el.set("name", header)
                    value_el = etree.SubElement(data_el, f"{{{KML_NS}}}value")
                    value_el.text = row[i]

    return etree.tostring(
        kml, xml_declaration=True, encoding="UTF-8", pretty_print=True
    ), warnings
