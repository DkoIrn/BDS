"""Script to create sample.dxf fixture for testing."""

import os
import ezdxf

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")


def create_sample_dxf():
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    # Add a POINT entity on layer "Survey"
    msp.add_point((100.0, 200.0, 5.0), dxfattribs={"layer": "Survey"})

    # Add a LINE entity on layer "Centerline"
    msp.add_line(
        start=(100.0, 200.0, 5.0),
        end=(150.0, 250.0, 6.0),
        dxfattribs={"layer": "Centerline"},
    )

    # Add an LWPOLYLINE entity on layer "Boundary"
    msp.add_lwpolyline(
        [(10.0, 20.0), (30.0, 40.0), (50.0, 60.0)],
        dxfattribs={"layer": "Boundary"},
    )

    filepath = os.path.join(FIXTURES_DIR, "sample.dxf")
    doc.saveas(filepath)
    print(f"Created {filepath}")


if __name__ == "__main__":
    create_sample_dxf()
