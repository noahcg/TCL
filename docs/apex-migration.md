# .waterCooler to TCL migration runbook

## What the current snapshot contains

The published app was inspected through normal browser navigation. The archive displays 15 cards and no visible pagination. Each card links to the article page using `p2_slug` and a session-bound checksum. The browser opened each card in that same session, captured the actual article HTML, separately recorded its `pre` text and element IDs, and checked the page title and subtitle against the archive. It also captured nine Quick Wins and six Resources. The snapshot omits APEX session and checksum URLs.

The snapshot is browser-rendered HTML. It preserves the full visible body and raw captured markup, including original sections, headings, 95 article code blocks, typography, and source credits present in the body. It includes the dates shown on the archive cards. Database CLOB bytes, table IDs, bylines, publication or update timestamp semantics, tags, drafts, and archived rows require privileged source evidence. The browser capture made no claims about missing values. The importer sealed the transferred snapshot after verifying content and code against that evidence. A second capture from a fresh session independently matched all 30 entries.

## Preferred export using owner-approved read access

1. In APEX App Builder locate .waterCooler, the Articles list and detail pages, the parsing schema, region sources and processes, and the parameter mapping for `P2_SLUG`. Determine whether the bodies are in tables or views, packaged PL/SQL, static region HTML, or a documented data source. A split App Builder export can help locate definitions. Application export by itself covers definitions. [Oracle application export guide](https://docs.oracle.com/en/database/oracle/apex/26.1/apxdc/exporting-and-importing-applications.html)
2. Review data scope with the owner. Resolve the primary key, slug, formats and lengths, appropriate timezone and publication states, authors/credits, categories, attachments and redirects. Record which values are unavailable and map them to null. APEX SQL Workshop Data Workshop can help on supported versions. Independently validate long text before treating a text or XML unload as authoritative. [Oracle SQL Workshop unload guide](https://docs.oracle.com/en/database/oracle/apex/26.2/aeutl/accessing-load-data-and-unload-data-wizards.html)
3. Have the owner or DBA expose two narrow read-only views, or export equivalent records locally using their approved tooling. The inventory view returns `SOURCE_ID` as a string and mapped `STATUS` directly from the in-scope article base records. The second view returns the projected rows below. If existing approved views have equivalent columns, use those. Keep app configuration and unrelated data outside the export.
4. Run the exporter using a read-only account. It reconciles the two views within one read-only transaction, fetches the full LOB, and checks its database-reported length. The `BODY_UNITS` contract uses UTF-16 code units for the configured source projection. Check a non-BMP example against the actual Oracle LOB configuration. Preserve a full private archive and derive a reviewable published candidate. [Oracle LOB driver documentation](https://python-oracledb.readthedocs.io/en/stable/user_guide/lob_data.html)

| View column | Mapped value |
| --- | --- |
| `SOURCE_ID`, `SLUG` | Existing stable primary key cast to string, and existing slug verbatim. Reconcile incompatible or duplicate slugs before import. |
| `TITLE`, `SUMMARY`, `AUTHOR`, `ATTRIBUTION` | Source values. Include explicit credits and license statements. Null means unknown. |
| `PUBLISHED_ON`, `UPDATED_AT` | Source publication calendar date `YYYY-MM-DD` and updated ISO timestamp with offset. |
| `STATUS`, `BODY_FORMAT` | Explicitly mapped `draft`, `published`, or `archived` and `html`, `text`, or `markdown`. |
| `BODY`, `BODY_UNITS` | Original CLOB or text and full database length. Use the source LOB length function where appropriate. Avoid SQL display limits and VARCHAR conversions. |
| `PUBLIC_TAGS_JSON`, `PRIVATE_METADATA_JSON` | Optional JSON array of public tag strings and a private metadata object. Preserve other original metadata in the latter. |

```sh
python3 -m venv artifacts/migration/venv
source artifacts/migration/venv/bin/activate
python -m pip install oracledb
python scripts/migration/export-apex.py \
  --article-view TCL_ARTICLE_EXPORT_VIEW \
  --inventory-view TCL_ARTICLE_INVENTORY_VIEW \
  --source https://oracleapex.com/ords/r/nglushien/watercooler/ \
  --output artifacts/migration/owner-export-001
```

Set `TCL_ORACLE_USER` and `TCL_ORACLE_DSN` in the local environment beforehand. The driver prompts for the password. The view names are contract examples. Substitute the actual names discovered by the owner. No Oracle credentials or signed URLs belong in the repo. The exporter has not been run on the owner’s Oracle schema yet.

If articles live in static regions or a service, use the application definition to locate the source and build the same candidate from verified original bodies. If the owner grants only public browser access, use the capture workflow below. A browser capture cannot reveal drafts or private metadata.

## Capture published content when direct data export is unavailable

```sh
npx playwright install chromium
npm run content:capture -- artifacts/migration/watercooler-next.json
npm run content:verify -- artifacts/migration/watercooler-next.json
```

The capture opens the existing public homepage and follows the signed links inside a fresh browser session. It reads rendered HTML via public page selectors. It does not create source-side data, guess URL signatures, or use a session from another person. If pages or pagination change, stop, review the selectors and enumerate the complete visible archive before recapturing. If browser automation cannot reach the app, the owner can open each article from the archive and save the complete rendered article HTML plus exact metadata and code inventory. Screenshots can identify omissions but are unsuitable as a full-text source.

An Oracle article-only bundle carries forward the verified Quick Wins and Resources baseline. If equivalent source tables exist, reconcile and export those after verifying their source IDs, code and external links. Assets must be inventoried using source-relative paths and stored or mapped with their content types, hashes and attribution. Preserve raw asset references in the private archive and use reviewed public paths. The initial articles had no media references in their captured bodies.

## Verify, import and roll back

```sh
npm run content:verify -- artifacts/migration/owner-export-001/published-candidate.json
npm run content:import -- artifacts/migration/owner-export-001/published-candidate.json
npm run content:verify
npm test
npm run build
npm run test:browser
```

- Review the dry-run counts, added and changed slugs, and content diff. Reconcile all source IDs and publication flags with the inventory. Report missing author/attribution fields and confirm bylines as part of owner review. The snapshot SHA-256 detects subsequent changes to the bundle. It is an integrity check; custody and owner verification establish provenance.
- Check the longest bodies and representative examples against Oracle and the legacy view using headings, first and last paragraphs, complete code and character lengths. Verify all source IDs are unique, all URLs case-consistent, and every existing permalink resolves. The importer rejects unexpected removals. Review any intended unpublish for permalink consequences before explicitly allowing removals. A renamed published record requires a deliberately designed and tested redirect before changing the source slug mapping.
- Compare storage and display. Raw HTML/text stays in the reviewed snapshot. The build creates a separate sanitized rendering and verifies article prose, code and existing element IDs against source. Handle unexpected sanitization failures by reviewing a render rule or a scoped demo. Never patch source bytes to trick validation.
- Import is repeatable with the same input and guarded by an exclusive write lock. Review the generated diff, save it in a versioned commit, and deploy a preview. Restore the last reviewed source revision to reverse a migration, then rebuild. A failed Oracle export stays separate from the published baseline. Keep the owner’s private archives outside version control.
