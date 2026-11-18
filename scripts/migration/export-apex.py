"""Read an owner-approved Oracle view and write a private full-content snapshot."""

import argparse
import datetime as dt
import getpass
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

REQUIRED = {
    "source_id", "slug", "title", "summary", "author", "attribution",
    "published_on", "updated_at", "status", "body_format", "body", "body_units",
}
STATUS = {"published", "draft", "archived"}
FORMATS = {"html", "text", "markdown"}
IDENTIFIER = re.compile(r"[A-Za-z][A-Za-z0-9_$#]{0,127}(?:\.[A-Za-z][A-Za-z0-9_$#]{0,127})?")
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def convert(row):
    """Validate CLOB fidelity and the agreed view column semantics."""
    source_id = row["source_id"]
    body = row["body"]
    status = row["status"]
    if not isinstance(source_id, str) or not source_id.strip():
        raise ValueError("SOURCE_ID must be a nonempty string")
    if row["slug"] is not None and (not isinstance(row["slug"], str) or not SLUG.fullmatch(row["slug"])):
        raise ValueError(f"{source_id}: invalid slug, record the original and resolve with the owner")
    if status not in STATUS or row["body_format"] not in FORMATS:
        raise ValueError(f"{source_id}: unexpected publication state or body format")
    if status == "published" and not all(isinstance(x, str) and x.strip() for x in (row["slug"], row["title"], body)):
        raise ValueError(f"{source_id}: published row lacks slug, title or body")
    if body is None:
        if row["body_units"] is not None:
            raise ValueError(f"{source_id}: body length mismatch")
        data = None
    else:
        if not isinstance(body, str) or len(body.encode("utf-16-le")) // 2 != row["body_units"]:
            raise ValueError(f"{source_id}: CLOB length mismatch. Check the view's length units and driver.")
        data = body.encode("utf-8")
    published_on = row["published_on"]
    updated_at = row["updated_at"]
    if published_on is not None:
        if not isinstance(published_on, str) or dt.date.fromisoformat(published_on).isoformat() != published_on:
            raise ValueError(f"{source_id}: publication date must be YYYY-MM-DD")
    if updated_at is not None:
        if not isinstance(updated_at, str) or dt.datetime.fromisoformat(updated_at).utcoffset() is None:
            raise ValueError(f"{source_id}: updated time requires an ISO-8601 offset or Z")
    public_tags = json.loads(row.get("public_tags_json") or "[]")
    if not isinstance(public_tags, list) or not all(isinstance(tag, str) and tag.strip() for tag in public_tags):
        raise ValueError(f"{source_id}: invalid public tags")
    return {
        "sourceId": source_id, "slug": row["slug"], "title": row["title"],
        "summary": row["summary"], "author": row["author"], "attribution": row["attribution"],
        "date": published_on, "updatedAt": updated_at, "status": status, "format": row["body_format"],
        "body": body, "oracleBodyUnits": row["body_units"],
        "utf8Bytes": len(data) if data is not None else None,
        "sha256": hashlib.sha256(data).hexdigest() if data is not None else None,
        "tags": public_tags,
    }


def fetch_articles(connection, article_view, inventory_view):
    # The views define the owner-reviewed scope. A separate inventory catches missing joins.
    with connection.cursor() as cursor:
        cursor.execute("SET TRANSACTION READ ONLY")
        cursor.execute(f"SELECT source_id, status FROM {inventory_view} ORDER BY source_id")
        inventory = cursor.fetchall()
        if len(inventory) != len({source_id for source_id, _ in inventory}):
            raise ValueError("The source inventory has duplicate IDs")
        cursor.arraysize = 20
        cursor.execute(f"SELECT * FROM {article_view} ORDER BY source_id", fetch_lobs=False)
        columns = [item.name.lower() for item in cursor.description]
        if not REQUIRED <= set(columns):
            raise ValueError("The mapping view is missing required columns")
        articles = []
        private_metadata = {}
        for values in cursor:
            row = dict(zip(columns, values, strict=True))
            entry = convert(row)
            articles.append(entry)
            if row.get("private_metadata_json") is not None:
                private_metadata[entry["sourceId"]] = json.loads(row["private_metadata_json"])
        if inventory != [(row["sourceId"], row["status"]) for row in articles]:
            raise ValueError("Source ID/status inventory differs from exported rows")
        return articles, private_metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--article-view", required=True)
    parser.add_argument("--inventory-view", required=True)
    parser.add_argument("--source", required=True, help="HTTPS public APEX app base ending in /")
    parser.add_argument("--output", type=Path, required=True, help="New directory inside artifacts/migration/")
    args = parser.parse_args()

    if not all(IDENTIFIER.fullmatch(name) for name in (args.article_view, args.inventory_view)):
        parser.error("View names must be Oracle identifiers or SCHEMA.VIEW")
    source = urlsplit(args.source)
    if (source.scheme != "https" or not source.hostname or source.username or source.password
            or source.query or source.fragment or not source.path.endswith("/")):
        parser.error("Source must be a clean HTTPS app base URL ending in /")
    private_root = Path("artifacts/migration").resolve()
    output = args.output.resolve()
    if private_root not in output.parents or output.exists():
        parser.error("Output must be a new directory under artifacts/migration/")

    try:
        import oracledb
    except ImportError:
        parser.error("Install python-oracledb in your local virtual environment")
    try:
        user = os.environ["TCL_ORACLE_USER"]
        dsn = os.environ["TCL_ORACLE_DSN"]
    except KeyError:
        parser.error("Set TCL_ORACLE_USER and TCL_ORACLE_DSN to the approved read-only account")
    password = getpass.getpass("Read-only Oracle password: ")
    try:
        with oracledb.connect(user=user, password=password, dsn=dsn) as connection:
            articles, private_metadata = fetch_articles(connection, args.article_view, args.inventory_view)
    finally:
        del password

    published = [row for row in articles if row["status"] == "published"]
    if not published or len({row["slug"] for row in published}) != len(published):
        raise ValueError("Expected published records with distinct slugs")

    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    output.mkdir(mode=0o700)
    date = dt.datetime.now(dt.timezone.utc).date().isoformat()
    bundle = {
        "method": "oracle-article-export", "source": args.source, "capturedOn": date,
        "articles": published, "quick": [], "resources": [],
    }
    files = {
        "private-archive.json": {**bundle, "articles": articles, "privateMetadata": private_metadata},
        "published-candidate.json": bundle,
    }
    for name, data in files.items():
        path = output / name
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    print(f"Verified {len(articles)} inventory rows, including {len(published)} published articles.")
    print(f"Review {output / 'published-candidate.json'} before importing.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        sys.exit(str(error))
