# External dataset provenance

GRIEVANCE keeps three kinds of data strictly apart:

| Kind | Tables | Label in UI | Used by the agents? |
|------|--------|-------------|---------------------|
| HackFusion datasets (Category Master, Mock Grievance History, Department Directory) | `grievance_categories`, `grievances` (historical), `departments`, `officers` | `SYNTHETIC` until the official files are imported, then `OFFICIAL` | Yes: policy, RAG, duplicates, SLA prediction |
| External public datasets (this document) | `external_datasets`, `external_grievance_records`, `official_dataset_rows` | `PUBLIC DATA` with source and licence | No. Reference statistics and record explorer only |
| Live grievances filed in the app | `grievances` (`data_source = LIVE`) | none | Yes |

External records are never merged into the HackFusion tables, never embedded, and never used as training
labels.

Files in `*/raw/` are the original downloads, kept unmodified and excluded from git. Re-create them with
`python -m app.cli external fetch` and compare the checksums below.

---

## 1. BBMP Sahaaya 2.0 citizen grievances (imported)

| | |
|---|---|
| Source page | https://github.com/Vonter/bbmp-citizen-grievances |
| File | https://raw.githubusercontent.com/Vonter/bbmp-citizen-grievances/main/data/citizen-grievances.csv.gz |
| Original publisher | BBMP, via the Bengaluru Smart City Limited website (https://smartoneblr.com/NicApplicationStatus.htm); compiled by Vonter |
| Licence | Open Database License (ODbL) v1.0. Some individual contents are under copyright by BBMP. |
| Attribution | Contains information from bbmp-citizen-grievances (github.com/Vonter/bbmp-citizen-grievances), made available under the ODbL v1.0. |
| Downloaded | 2026-11-11T08:33Z (UTC) |
| Size / SHA-256 | 28,800,264 bytes / `4248ccf24dbde56ebb360d0111b94476b3f186dd1f6c5feec298e5fff1c36e37` |
| Local path | `backend/data/external/bbmp/raw/citizen-grievances.csv.gz` |

**Profile (measured on the downloaded file):**

- 1,230,890 rows, 12 columns: Complaint ID, Category, Sub Category, Grievance Date, Zone Name, Ward Name,
  Grievance Mode, Grievance Status, Staff Remarks, Staff Name, Staff Designation, Rating.
- 0 duplicate Complaint IDs, 0 fully duplicated rows.
- Grievance Date: 1,230,416 plausible values from 2020-02-08 to 2026-08-21; 474 implausible values
  (e.g. 1900-01-01, 2048-02-28).
- Missing values: Rating 1,190,790; Staff Remarks 22,999; Zone Name 587; Grievance Mode 587; Staff
  Designation 587; Grievance Status 57; Staff Name 57.
- 32 categories, 187 sub-categories, 485 wards, 16 zones, 40 intake channels, 8 statuses (Closed,
  Registered, Non Relevant, Rejected, Resolved, ReOpen, In Progress, Long Term Solution).
- Personal data found: phone numbers in 15,241 Staff Remarks and 90 e-mail addresses; staff names (with
  phone numbers in 3,346 values) in Staff Name / Staff Designation; honorific-prefixed names and property
  IDs (ePIDs) in some remarks.

**Transformations applied by `app/services/external_data.py`:**

1. Dropped `Staff Name` and `Staff Designation` entirely.
2. Redacted mobile and landline numbers, e-mail addresses, numbers of six or more digits and
   honorific-prefixed names in `Staff Remarks`.
3. Collapsed repeated whitespace in category, sub-category, zone, ward and channel names.
4. Parsed `Grievance Date` as Asia/Kolkata local time and stored it in UTC. Dates before 2015-01-01 or after
   the download date are stored as NULL with `date_valid = false`. No value is guessed.
5. Kept `Rating` only when it is an integer from 1 to 5.
6. Stored `Grievance Status` verbatim as `source_status`. It is not mapped to GRIEVANCE statuses. The source
   uses "Rejected"; GRIEVANCE itself never rejects grievances.

**Import result (2026-11-11):** 1,230,890 records imported, 0 skipped; 474 dates stored as unavailable;
18,336 remarks changed by redaction. A post-import scan of all 1,207,850 stored remarks found no mobile
numbers, e-mail addresses, numbers of six or more digits or honorific-prefixed names.

**Not available in this dataset (left empty, never invented):** complaint text written by the citizen;
resolution or closure timestamps (so resolution time and SLA outcomes cannot be computed); SLA targets;
coordinates; the responsible department beyond BBMP's own category; citizen identity.

**Consequences for GRIEVANCE:** the records cannot be used for text-based RAG or semantic duplicate
detection because they contain no complaint text, and they cannot train SLA predictions because they have
no resolution dates. They are used for real-world volume, category, status, channel and ward statistics
and a searchable record explorer.

## 2. BBMP Grievances Data, OpenCity (verification only)

| | |
|---|---|
| Source page | https://www.data.opencity.in/dataset/bbmp-grievances-data |
| File used | 2025 resource: `.../resource/1342a93b-9a61-4766-9c34-c8357b7926c2/download/b0d6e9ff-5eef-48bf-ba86-985dbe8112d1.csv` |
| Publisher | BBMP organisation account on OpenCity |
| Licence | "Other (Public Domain)", as stated on the dataset page (CKAN `license_id: other-pd`) |
| Downloaded | 2026-11-11T08:33Z (UTC) |
| Size / SHA-256 | 18,272,067 bytes / `56793f672e0bef58bd0dd256245c6fae7047bb3bb1d59426ffed052385121db8` |

126,974 rows, 8 columns, Grievance Date from 2025-01-01 to 2025-06-19. Every Complaint ID also appears in
dataset 1; category matches for 99.28% and status for 93.25% of shared IDs. The status differences reflect the
different snapshot dates. **Not imported**, so nothing is double counted. It is kept as an independent check.
The other yearly files (2020 to 2024) on the same page were not downloaded.

## 3. data.gov.in CPGRAM catalogues (need an API key)

| Catalogue | URL | Catalogue ID |
|---|---|---|
| CPGRAM Nodal Public Grievance Officers Details | https://data.gov.in/catalog/cpgram-nodal-public-grievance-officers-details | `055eeced-b527-4106-9866-a89a3ff68f35` |
| Monthly Department-wise public grievance receipts and disposals | https://data.gov.in/catalog/monthly-department-wise-public-grievance-receipts-and-disposals | `9891bb4a-7f02-444a-b6bc-2691589d9a64` |
| Keyword listing | https://www.data.gov.in/keywords/CPGRAM | |

Licence: Government Open Data License - India. The catalogue pages are public, but the OGD API answered
`{"error": "Authorization field missing"}` when called without a key, so **no rows were downloaded**.

To import them: register on https://data.gov.in, generate a personal API key (My Account), set
`DATA_GOV_IN_API_KEY` in `backend/.env`, then run `python -m app.cli external fetch-ogd`. Rows are stored
verbatim with their field list. The monthly receipts and disposals are aggregate statistics; phone, mobile,
e-mail and fax fields are removed from the nodal officer directory before storage. This fetcher has not been
run against the live API because no key was available.

## 4. CPGRAMS individual grievances (not accessible)

Individual CPGRAMS grievance records are not published as open data. They are available only to authorised
government users through https://pgportal.gov.in. GRIEVANCE does not scrape authenticated systems and does
not use these records.
