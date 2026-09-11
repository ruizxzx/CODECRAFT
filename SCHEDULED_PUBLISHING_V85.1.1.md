# OFFSCRPT Scheduled Publishing — V85.1.1

## Why Vercel Cron is not used

OFFSCRPT is currently deployed on Vercel Hobby. Native Vercel Cron schedules that run more frequently than once per day are not deployable on that plan. V85.1.0 used `* * * * *`, which caused the deployment configuration to be rejected.

V85.1.1 removes the native Vercel cron entry.

## Scheduler

Scheduled publishing is triggered by the repository's GitHub Actions workflow:

`.github/workflows/process-schedules.yml`

The workflow runs every 5 minutes and calls:

`/api/cron/process-schedules`

It also supports manual execution with `workflow_dispatch`.

The scheduler is intentionally outside Vercel's native cron configuration so the Vercel Hobby deployment remains valid.

## Required configuration

### Vercel environment

Set:

- `CRON_SECRET`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

The `CRON_SECRET` must be identical between Vercel and GitHub.

### GitHub repository secret

Create:

`CRON_SECRET`

with the same value used in Vercel.

### Optional GitHub repository variable

Create:

`OFFSCRPT_PRODUCTION_URL`

with the production origin, for example:

`https://offscrpt.vercel.app`

If it is not defined, the workflow defaults to that URL.

## Security

The schedule endpoint now requires `CRON_SECRET` to be configured and requires a matching `Authorization: Bearer <CRON_SECRET>` header.

Do not put the secret in source code, `VITE_*` variables, workflow YAML, logs, or Firestore.

## Timing behavior

GitHub Actions scheduled workflows are interval-based triggers and may experience scheduler delay. The processor is therefore designed to process all due items rather than assuming an exact invocation timestamp.

A publication scheduled for 19:30 is published on the first successful processor run after its scheduled timestamp.

The endpoint remains idempotent through publication-state checks.

## Failure handling

The workflow uses `curl --fail` and exits non-zero on a failed HTTP request.

Publishing failures are returned by the processor and can be investigated through GitHub Actions logs and the existing Master Control operational tooling.

For higher precision or stronger uptime guarantees later, OFFSCRPT can move the scheduler to a dedicated external scheduler or Vercel Pro Cron without changing the processing endpoint.
