# Deferred Items - Phase 20

## Pre-existing Test Failures

- `tests/parsers/test_parse_dispatch.py::TestDispatchParser::test_unsupported_extension_raises` - fails independently of Phase 20 changes. Parser dispatch test expects ValueError for unsupported extensions but none is raised.
