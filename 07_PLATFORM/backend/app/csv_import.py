import csv
import io

from fastapi import UploadFile


async def parse_csv_rows(file: UploadFile) -> list[dict]:
    content = (await file.read()).decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(content)))
    # A row with more fields than the header stashes the overflow under the
    # DictReader restkey, which defaults to None. Every caller unpacks a row
    # with **row to build a schema/model instance; a non-string key there
    # raises TypeError ("keywords must be strings") instead of the
    # ValidationError callers already catch per-row, crashing the whole
    # import on one malformed row (e.g. a stray trailing comma) rather than
    # skipping just that row. Dropping the overflow keeps well-formed rows
    # unaffected and makes a ragged row degrade to "extra columns ignored"
    # instead of a 500.
    for row in rows:
        row.pop(None, None)
    return rows
