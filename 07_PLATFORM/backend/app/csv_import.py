import csv
import io

from fastapi import UploadFile


async def parse_csv_rows(file: UploadFile) -> list[dict]:
    content = (await file.read()).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(content)))
