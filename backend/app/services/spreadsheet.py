"""Reading and writing .xlsx / .csv files for import and export."""

import csv
import io
from datetime import date, datetime
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MEDIA_TYPE = "text/csv; charset=utf-8"


def _clean_cell(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    if isinstance(value, datetime):
        return value.date()
    return value


def read_table(filename: str, content: bytes) -> tuple[list[Any], list[tuple[int, list[Any]]]]:
    """Return (header row, [(sheet row number, cells)]) from the first sheet. Blank rows are skipped.

    Raises ValueError for unsupported or unreadable files.
    """
    name = filename.lower()
    if name.endswith(".xlsx"):
        try:
            sheet = load_workbook(io.BytesIO(content), read_only=True, data_only=True).worksheets[0]
        except Exception as exc:
            raise ValueError(f"Could not read Excel file: {exc}") from exc
        raw_rows = [list(r) for r in sheet.iter_rows(values_only=True)]
    elif name.endswith(".csv"):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
        raw_rows = list(csv.reader(io.StringIO(text)))
    else:
        raise ValueError("Upload an .xlsx or .csv file")

    if not raw_rows:
        raise ValueError("The file is empty")

    rows = []
    for row_number, raw in enumerate(raw_rows[1:], start=2):
        cells = [_clean_cell(v) for v in raw]
        if any(v is not None for v in cells):
            rows.append((row_number, cells))
    return raw_rows[0], rows


def to_xlsx(headers: list[str], rows: list[list[Any]], sheet_title: str = "Sheet1") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_title[:31]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append(row)
    for index, label in enumerate(headers, start=1):
        letter = ws.cell(row=1, column=index).column_letter
        ws.column_dimensions[letter].width = max(14, len(str(label)) + 2)
        for (cell,) in ws.iter_rows(min_row=2, min_col=index, max_col=index):
            if isinstance(cell.value, date):
                cell.number_format = "DD/MM/YYYY"
    ws.freeze_panes = "A2"
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def to_csv(headers: list[str], rows: list[list[Any]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([v.strftime("%d/%m/%Y") if isinstance(v, date) else ("" if v is None else v) for v in row])
    # BOM so Excel opens UTF-8 correctly
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def file_response_headers(filename: str) -> dict[str, str]:
    return {"Content-Disposition": f'attachment; filename="{filename}"'}
