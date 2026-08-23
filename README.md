# CertDue

US bookkeeping / CAS firms. Keep client resale and exemption certificates complete and unexpired.

$129/mo. One firm, many clients. Not Avalara. Not a legal opinion.

## Env (Vercel)

- `STRIPE_SECRET_KEY` live
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` live
- `BLOB_READ_WRITE_TOKEN` from a Vercel Blob store on this project (certs + vault JSON)
- `CRON_SECRET` optional

Daily cron `/api/cron` emails the firm at 60 / 30 / 7 days and when expired.

Do not take a live $129 unless asked.
