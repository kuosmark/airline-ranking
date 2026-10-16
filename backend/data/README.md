# Aircraft type reference

`mictronics-aircraft-types.json` is derived from `types.json` in the
[Mictronics aircraft database](https://github.com/Mictronics/aircraft-database)
full `indexedDB.zip` export. It maps ICAO type codes to the supplied readable names.
The initial import uses the 11 October 2026 export (database version 526).
Generic designators and non-aircraft entries are excluded. Names can describe a
family rather than the exact variant; upstream capitalization is preserved.

This adapted database is available under the
[Open Data Commons Attribution License](https://opendatacommons.org/licenses/by/1-0/).
The supplied licence is retained in `mictronics-LICENSE.txt`, and the application's
“How does it work?” section credits Mictronics. Keep both when updating.
Operator-drawer labels retain their existing normalization rules.

## Updates

The backend bundles this file, so application use makes no reference-data requests.
The GitHub Actions **Update aircraft type reference** workflow runs on the first
of each month at 07:23 UTC, or manually through **Run workflow**. Scheduling is
best-effort and becomes active only after the workflow is merged into main.

It downloads the full export, imports only names, and rejects malformed entries,
duplicate codes, a changed licence or removal of more than 5% of existing codes.
Unchanged names produce no PR. Changed names run `npm run check`, then open or
update one PR on `codex/update-aircraft-types`. The owner reviews changed names
and approves merging; the workflow never merges or deploys. A failed update
leaves the deployed reference unchanged. Investigate failed Actions runs rather
than bypassing validation.

Repository Settings → Actions → General → Workflow permissions must allow
GitHub Actions to create pull requests. The workflow uses the built-in token;
no personal token is needed. GitHub may require a maintainer to select
**Approve workflows to run** on the generated PR. Confirm CI passes on the latest
revision before merging.

To reproduce an update locally:

```sh
curl --fail --location https://raw.githubusercontent.com/Mictronics/aircraft-database/main/indexedDB.zip --output /tmp/mictronics.zip
python3 scripts/update-aircraft-types.py /tmp/mictronics.zip
npm run check
```

Python 3 uses only its standard library. Review the JSON diff, particularly code
removals and family-name changes. Do not infer additional aliases from similar names.
