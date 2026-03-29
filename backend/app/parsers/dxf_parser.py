"""DXF parser -- extracts entity coordinates from AutoCAD DXF files."""

import io

import ezdxf
from ezdxf.entities import DXFGraphic

from app.parsers.base import ParseResult

HEADERS = ["entity_type", "layer", "easting", "northing", "elevation"]


def _entity_rows(entity: DXFGraphic) -> list[list[str]]:
    """Extract coordinate rows from a single DXF entity."""
    rows: list[list[str]] = []
    etype = entity.dxftype()
    layer = entity.dxf.layer if entity.dxf.hasattr("layer") else "0"

    if etype == "POINT":
        loc = entity.dxf.location
        rows.append([etype, layer, str(loc.x), str(loc.y), str(loc.z)])

    elif etype == "LINE":
        start = entity.dxf.start
        end = entity.dxf.end
        rows.append([etype, layer, str(start.x), str(start.y), str(start.z)])
        rows.append([etype, layer, str(end.x), str(end.y), str(end.z)])

    elif etype == "LWPOLYLINE":
        # get_points returns tuples of (x, y, [start_width, end_width, bulge])
        for pt in entity.get_points(format="xyb"):
            x, y = pt[0], pt[1]
            rows.append([etype, layer, str(x), str(y), "0.0"])

    elif etype == "POLYLINE":
        for vertex in entity.vertices:
            loc = vertex.dxf.location
            rows.append([etype, layer, str(loc.x), str(loc.y), str(loc.z)])

    elif etype == "CIRCLE":
        center = entity.dxf.center
        rows.append([etype, layer, str(center.x), str(center.y), str(center.z)])

    elif etype == "ARC":
        center = entity.dxf.center
        rows.append([etype, layer, str(center.x), str(center.y), str(center.z)])

    elif etype == "3DFACE":
        for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
            if entity.dxf.hasattr(attr):
                pt = getattr(entity.dxf, attr)
                rows.append([etype, layer, str(pt.x), str(pt.y), str(pt.z)])

    elif etype == "INSERT":
        # Expand block references via virtual_entities
        try:
            for virtual_entity in entity.virtual_entities():
                rows.extend(_entity_rows(virtual_entity))
        except Exception:
            # If block expansion fails, record the insertion point
            insert_pt = entity.dxf.insert
            rows.append([
                etype, layer,
                str(insert_pt.x), str(insert_pt.y), str(insert_pt.z),
            ])

    return rows


def parse_dxf(file_bytes: bytes) -> ParseResult:
    """Parse DXF bytes into a normalized ParseResult.

    Handles POINT, LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, 3DFACE,
    and INSERT (block reference) entities.
    All row values are strings.
    """
    stream = io.TextIOWrapper(
        io.BytesIO(file_bytes), encoding="utf-8", errors="replace"
    )
    doc = ezdxf.read(stream)
    msp = doc.modelspace()

    rows: list[list[str]] = []
    layers: set[str] = set()
    warnings: list[str] = []

    for entity in msp:
        entity_rows = _entity_rows(entity)
        for row in entity_rows:
            layers.add(row[1])
        rows.extend(entity_rows)

    return ParseResult(
        headers=list(HEADERS),
        rows=rows,
        total_rows=len(rows),
        metadata={"layers": sorted(layers)},
        warnings=warnings,
        source_format="dxf",
    )
