# OFFSCRPT V74.1 — Master Control Diagnostics & Cloud Integrity

## Fixed
- Presence diagnostics no longer rely on `collectionGroup("members")`, which could be denied when unrelated `members` collections participate in rule evaluation.
- Admin community-post inventory no longer relies on `collectionGroup("posts")`; it enumerates the known community post collections.
- Platform analytics no longer relies on `collectionGroup("analytics")`; each article analytics subcollection is read directly under the admin authorization path.
- Master Control core loading no longer treats the optional presence count as a reason to report a failed core cloud check.
- V74.0 duplicate AdminControlPanel imports/state declarations were normalized.

## Integrity
- No local/static content fallback was added.
- No synthetic analytics values were added.
- Cloud writes remain Firestore-backed and subject to Firestore Security Rules.
- The browser-injected `VM88 ... reportAllChanges ... startTime` console error is not present in the OFFSCRPT source tree; it is therefore not claimed as an application-source bug.
