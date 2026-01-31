# Data Harbor - CSV/XLS Intake Component

Data Harbor is a web-based intake component that lets users upload CSV or Excel files, map source columns to a database schema, and ingest records with duplicate protection. It is designed as the first module in a multi-part ingestion platform.

## Features

- Upload `.csv`, `.xls`, or `.xlsx` files.
- Preview the first rows of incoming data.
- Map source columns to database fields and assign data types.
- Approve mappings before ingestion.
- Ingest data with a progress bar.
- Avoid duplicates using a configurable de-duplication key.
- View recent database records and import summaries.

## How it works

1. **Upload** a CSV or Excel file.
2. **Preview** the detected rows and columns.
3. **Map** each source column to a destination field and select a data type.
4. **Approve** the mapping and ingest the data.
5. **Review** results: new records vs. duplicates.

## Data storage

This demo stores records locally in the browser using `localStorage` (key: `dataharbor-db`). In production, you would send the mapped payloads to a backend API and persist them in a real database.

## De-duplication

Select a de-duplication key (email, ID, phone, etc.). If a newly ingested record shares the same key as an existing record, it is skipped and counted as a duplicate.

## Tech notes

- Uses the [SheetJS](https://sheetjs.com/) browser library for Excel parsing.
- CSV parsing is handled in the browser for this prototype.

## Next steps

- Add authentication and user-level audit trails.
- Validate values against database constraints.
- Support multi-table mapping and relational joins.
- Connect ingestion to a backend service and real database.
