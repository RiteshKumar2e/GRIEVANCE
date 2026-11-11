"""External public dataset pipeline (BBMP format). The rows below are a TEST FIXTURE written in the
published BBMP column format; they are not real records."""
import gzip
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.models import ExternalDataset, ExternalGrievanceRecord, Grievance
from app.services import external_data as ext

HEADER = "Complaint ID,Category,Sub Category,Grievance Date,Zone Name,Ward Name,Grievance Mode,Grievance Status,Staff Remarks,Staff Name,Staff Designation,Rating\n"
ROWS = [
    'T-1,Electrical,Street Light Not Working,2025-03-01 10:00:00,East,Shanthala Nagar,Whatsapp,Closed,"Fixed. Call Mr. Ravi Kumar 9876543210",Test Person/AE,Test Person/AE,5\n',
    'T-2,Solid Waste (Garbage) Related,Garbage dump,2025-03-02 11:30:00,South,Jayanagar,Sahaaya Helpline,Rejected,epid 3157386145 not our ward,Other Person/JHI,Other Person/JHI,\n',
    'T-3,Storm  Water Drain(SWD),Desilting,1900-01-01 12:00:00,West,Ward  42,BBMP AI,Registered,,X/AE,X/AE,9\n',
    'T-3,Storm  Water Drain(SWD),Desilting,2025-03-03 09:00:00,West,Ward  42,BBMP AI,Registered,,X/AE,X/AE,\n',
    ',Electrical,Other,2025-03-04 09:00:00,East,Shanthala Nagar,Whatsapp,Closed,,Y/AE,Y/AE,\n',
]


def _fixture(tmp_path):
    p = tmp_path / "bbmp-fixture.csv.gz"
    with gzip.open(p, "wt", encoding="utf-8") as fh:
        fh.write(HEADER + "".join(ROWS))
    return p


def test_import_validates_minimises_and_redacts(tmp_path, db):
    grievances_before = db.scalar(select(func.count()).select_from(Grievance))
    out = ext.import_bbmp(db, _fixture(tmp_path), downloaded_at=datetime(2026, 11, 11, tzinfo=timezone.utc), replace=True)
    assert out["rows_read"] == 5 and out["imported"] == 3
    assert out["skipped_duplicate_id_in_file"] == 1 and out["skipped_missing_id"] == 1
    assert out["invalid_dates"] == 1 and out["remarks_redacted"] == 2

    recs = {r.source_record_id: r for r in db.scalars(select(ExternalGrievanceRecord))}
    t1, t2, t3 = recs["T-1"], recs["T-2"], recs["T-3"]
    assert "9876543210" not in t1.staff_remarks and "Ravi" not in t1.staff_remarks and "[name]" in t1.staff_remarks
    assert "3157386145" not in t2.staff_remarks
    assert t1.filed_at is not None and t1.date_valid
    assert t3.filed_at is None and t3.date_valid is False  # implausible date kept unknown, not guessed
    assert t3.category == "Storm Water Drain(SWD)" and t3.ward == "Ward 42"  # whitespace normalised
    assert t3.citizen_rating is None and t1.citizen_rating == 5  # out-of-range rating dropped
    assert t2.source_status == "Rejected"  # stored verbatim, not mapped to GRIEVANCE statuses
    # Staff names are not stored anywhere.
    assert not any("Test Person" in str(v) for r in recs.values() for v in vars(r).values())

    ds = db.scalar(select(ExternalDataset).where(ExternalDataset.key == "bbmp_sahaaya_vonter"))
    assert ds.licence.startswith("Open Database License") and ds.sha256 and ds.status == "imported"
    assert any("complaint text" in u for u in ds.unavailable_fields)
    # External data never enters the HackFusion / live grievance tables.
    assert db.scalar(select(func.count()).select_from(Grievance)) == grievances_before


def test_import_is_idempotent(tmp_path, db):
    path = _fixture(tmp_path)
    ext.import_bbmp(db, path, replace=True)
    again = ext.import_bbmp(db, path)
    # T-1, T-2, T-3 and the repeated T-3 row are all already present.
    assert again["imported"] == 0 and again["skipped_existing"] == 4


def test_external_api_is_staff_only_and_labelled(tmp_path, db, client, admin, citizen):
    ext.import_bbmp(db, _fixture(tmp_path), replace=True)
    assert client.get("/api/v1/external/datasets").status_code == 401
    assert client.get("/api/v1/external/datasets", headers=citizen).status_code == 403
    data = client.get("/api/v1/external/datasets", headers=admin).json()
    keys = {d["key"]: d for d in data["items"]}
    assert keys["bbmp_sahaaya_vonter"]["status"] == "imported"
    assert keys["ogd_cpgram_monthly_receipts_disposals"]["status"] in ("not_fetched", "needs_credentials")
    assert "API key" in data["ogd"]["requirement"] or data["ogd"]["configured"]
    assert "pgportal" in data["cpgrams_individual_records"]
    s = client.get("/api/v1/external/bbmp/summary", headers=admin).json()
    assert s["total_records"] == 3 and s["invalid_dates"] == 1
    assert {c["name"] for c in s["categories"]} >= {"Electrical", "Solid Waste (Garbage) Related"}
    recs = client.get("/api/v1/external/bbmp/records?q=Garbage", headers=admin).json()
    assert recs["total"] == 1 and recs["items"][0]["source_record_id"] == "T-2"


def test_ogd_requires_api_key():
    st = ext.ogd_status("")
    assert st["configured"] is False and "data.gov.in" in st["requirement"]
