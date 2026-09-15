# Photo upload protocol and release plan

Status: implemented and locally tested; not deployed. September 14, 2026.

## Ownership and limits

The browser calls `storage.uploadPhoto({ sessionToken, bytes, contentType })`. The action validates the JPEG bytes, resolves the session through an internal mutation, reserves quota, stores the image itself, and internally binds that exact storage ID and SHA-256 digest to the user. There is no public API for claiming an arbitrary existing storage ID.

`claimPhotoUploads(ctx, userId, ids, hotspotId)` runs inside the hotspot-creation transaction. Unknown IDs, other users' uploads, duplicate IDs, already-used photos, expired uploads, and missing/mismatched storage metadata fail the whole report transaction. Existing report images remain readable.

| Control | Limit |
| --- | --- |
| Report photos | 3 distinct owned uploads |
| Prepared photo | JPEG, 512 KiB |
| JPEG frame headers | At most 4096 per dimension and 16 million pixels |
| Browser source preparation | 3 JPEG/PNG/WebP files, 10 MiB each |
| Per-user upload attempts | 12 per fixed hour; 36 per fixed day |
| Whole-deployment attempts | 100 per fixed hour; 300 per fixed day |
| Whole-deployment reserved bytes | 128 MiB per fixed day; 512 MiB cumulative pilot ceiling |

Limits are defined in `shared/photo-upload.ts`. Failed attempts after reservation count toward quota. The cumulative ceiling does not reset when files are removed; review usage before changing it. Deployment-wide limits bound new upload storage even when an attacker creates fresh anonymous sessions, but are not bot detection and do not prevent invocation-cost or availability attacks. Fixed windows permit bursts at window boundaries.

JPEG checks inspect framing and dimensions, not complete decoding or malware scanning. Do not describe uploaded files as harmless or sanitized. Browser EXIF fields and device fingerprints are no longer sent in report arguments; image bytes remain untrusted content.

## Additive schema plan

New tables: `photoUploads`, `uploadQuotas`, `uploadCleanupState`. Existing report fields, IDs, and stored images are preserved; no backfill or deletion of legacy data is required. No ownership is inferred for legacy files.

New uploads expire after 24 hours unless claimed. A 15-minute job processes at most 50 expired records, 50 expired quota records, and one 50-file storage page. Claims and expiration deletion use transactions, so a cleanup/claim race cannot leave a successfully claimed image deleted. A MIME parameter marks new protocol files solely for cleanup; it is not an ownership credential. The storage sweep reclaims marked, unowned files after interrupted actions. Scanning is incremental, so cleanup eligibility at 24 hours is not an exact deletion-time promise. Unmarked legacy files are untouched.

## Coordinated release required

The live Render frontend currently uses Convex development deployment `chatty-puffin-875`; a default `convex deploy` targets separate production `cautious-bison-677`. Select the actual intended target explicitly.

Prepare and test the frontend release before switching the backend protocol. Old frontend bundles call `generateUploadUrl`, which now fails closed with a refresh instruction. Deploying only this backend change would interrupt live photo reporting. Confirm Render access and release coordination first. Previously issued direct upload URLs can remain valid for one hour; they cannot be made safe by client validation. [Convex upload documentation](https://docs.convex.dev/file-storage/upload-files)

Verify after release: anonymous session creation, photo upload, report persistence, rejection of foreign/replayed IDs, legacy image display, and cleanup/counter behavior. Do not restore unrestricted upload URLs as a rollback shortcut.

## Verification

20 storage regressions, 6 upload-hook regressions, and 3 form-input tests pass. Backend TypeScript and the production frontend build pass. The installed `convex-test` 0.0.54 omits stored Blob MIME metadata; `test-fixtures/convex-storage.ts` restores that one field in tests using the actual stored Blob. Production MIME/checksum validation remains strict. Verify upload acceptance against an actual staging deployment before release.
