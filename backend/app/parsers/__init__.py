"""Parser package -- dispatch registry for all supported file formats."""

import os
from typing import Callable

from app.parsers.base import ParseResult
from app.parsers.geojson_parser import parse_geojson
from app.parsers.shapefile_parser import parse_shapefile_zip
from app.parsers.kml_parser import parse_kml, parse_kmz
from app.parsers.landxml_parser import parse_landxml
from app.parsers.dxf_parser import parse_dxf

# Maps file extension (lowercase, with dot) to parser function
PARSER_REGISTRY: dict[str, Callable[[bytes], ParseResult]] = {
    ".geojson": parse_geojson,
    ".json": parse_geojson,
    ".zip": parse_shapefile_zip,
    ".kml": parse_kml,
    ".kmz": parse_kmz,
    ".xml": parse_landxml,
    ".dxf": parse_dxf,
}


def dispatch_parser(file_bytes: bytes, filename: str) -> ParseResult:
    """Route a file to the correct parser based on its extension.

    Args:
        file_bytes: Raw file content as bytes.
        filename: Original filename (used for extension detection).

    Returns:
        ParseResult from the appropriate parser.

    Raises:
        ValueError: If the file extension is not supported.
    """
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    parser = PARSER_REGISTRY.get(ext)
    if parser is None:
        supported = ", ".join(sorted(PARSER_REGISTRY.keys()))
        raise ValueError(
            f"Unsupported file format '{ext}'. Supported: {supported}"
        )

    return parser(file_bytes)
