"""LandXML parser -- extracts CgPoints and Alignment coordinate data."""

import io

from lxml import etree

from app.parsers.base import ParseResult

# Supported LandXML namespaces
LANDXML_NAMESPACES = [
    "http://www.landxml.org/schema/LandXML-1.2",
    "http://www.landxml.org/schema/LandXML-1.1",
    "http://www.landxml.org/schema/LandXML-1.0",
]

HEADERS = ["source", "point_name", "easting", "northing", "elevation"]


def _detect_namespace(root: etree._Element) -> str:
    """Detect which LandXML namespace the document uses, or empty string."""
    tag = root.tag
    if "}" in tag:
        ns = tag.split("}")[0].lstrip("{")
        return ns
    return ""


def _parse_cgpoint_text(text: str) -> tuple[str, str, str]:
    """Parse CgPoint text content: 'northing easting elevation'.

    Returns (northing, easting, elevation) as strings.
    """
    parts = text.strip().split()
    northing = parts[0] if len(parts) > 0 else ""
    easting = parts[1] if len(parts) > 1 else ""
    elevation = parts[2] if len(parts) > 2 else ""
    return northing, easting, elevation


def _ns_path(ns: str, xpath: str) -> str:
    """Build a namespace-prefixed XPath from a simple path.

    If ns is empty, returns the path as-is.
    Converts tags like 'CgPoints/CgPoint' to '{ns}CgPoints/{ns}CgPoint'.
    """
    if not ns:
        return xpath
    parts = xpath.split("/")
    return "/".join(f"{{{ns}}}{p}" if p and not p.startswith(".") else p for p in parts)


def parse_landxml(file_bytes: bytes) -> ParseResult:
    """Parse LandXML bytes into a normalized ParseResult.

    Extracts CgPoints (survey control points) and Alignment coordinate
    geometry. All row values are strings.

    Raises ValueError if the XML is not a LandXML file.
    """
    try:
        tree = etree.parse(io.BytesIO(file_bytes))
    except etree.XMLSyntaxError as exc:
        raise ValueError(f"Invalid XML: {exc}") from exc

    root = tree.getroot()

    # Validate root tag contains "LandXML"
    root_local = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if "LandXML" not in root_local:
        raise ValueError(
            f"File is not a LandXML document (root element: {root_local})"
        )

    ns = _detect_namespace(root)

    rows: list[list[str]] = []
    warnings: list[str] = []

    # --- Extract CgPoints ---
    cgpoint_count = 0
    cgpoints_path = f".//{_ns_path(ns, 'CgPoint')}"
    for cg in root.iter(_ns_path(ns, "CgPoint") if ns else "CgPoint"):
        name = cg.get("name", "")
        text = cg.text or ""
        if not text.strip():
            warnings.append(f"CgPoint '{name}' has no coordinate text")
            continue
        northing, easting, elevation = _parse_cgpoint_text(text)
        rows.append(["CgPoint", name, easting, northing, elevation])
        cgpoint_count += 1

    # --- Extract Alignments ---
    alignment_count = 0
    alignment_tag = f"{{{ns}}}Alignment" if ns else "Alignment"
    for alignment in root.iter(alignment_tag):
        alignment_count += 1
        alignment_name = alignment.get("name", "")

        # Find CoordGeom children
        coordgeom_tag = f"{{{ns}}}CoordGeom" if ns else "CoordGeom"
        for coordgeom in alignment.iter(coordgeom_tag):
            # Process Line elements
            line_tag = f"{{{ns}}}Line" if ns else "Line"
            for line_el in coordgeom.iter(line_tag):
                start_tag = f"{{{ns}}}Start" if ns else "Start"
                end_tag = f"{{{ns}}}End" if ns else "End"

                start_el = line_el.find(start_tag)
                end_el = line_el.find(end_tag)

                if start_el is not None and start_el.text:
                    n, e, elev = _parse_cgpoint_text(start_el.text)
                    rows.append(["Alignment", alignment_name, e, n, elev])

                if end_el is not None and end_el.text:
                    n, e, elev = _parse_cgpoint_text(end_el.text)
                    rows.append(["Alignment", alignment_name, e, n, elev])

            # Process Curve elements
            curve_tag = f"{{{ns}}}Curve" if ns else "Curve"
            for curve_el in coordgeom.iter(curve_tag):
                for child_tag_name in ["Start", "Center", "End"]:
                    tag = f"{{{ns}}}{child_tag_name}" if ns else child_tag_name
                    el = curve_el.find(tag)
                    if el is not None and el.text:
                        n, e, elev = _parse_cgpoint_text(el.text)
                        rows.append(["Alignment", alignment_name, e, n, elev])

    return ParseResult(
        headers=list(HEADERS),
        rows=rows,
        total_rows=len(rows),
        metadata={
            "cgpoint_count": cgpoint_count,
            "alignment_count": alignment_count,
        },
        warnings=warnings,
        source_format="landxml",
    )
