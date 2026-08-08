# Owner setup checklist

These are the external actions that cannot be completed by repository code.

- [ ] Create/select a dedicated Google Cloud project; record its numeric project number.
- [ ] Enable Google Sheets API, Google Drive API, and Google Picker API.
- [ ] Configure Google Auth Platform as External; while Testing, add the owner as a test user.
- [ ] Add only `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive.file`.
- [ ] Create a Web OAuth client with the exact localhost/production origins and `/api/auth/google/callback` URLs from [the setup guide](docs/google-oauth-vercel-setup.md).
- [ ] Create a Picker API key restricted to Google Picker API and the exact localhost/production HTTP referrers.
- [ ] Provision a pooled Postgres database (Vercel Marketplace Neon preferred) and expose its pooled URL as `DATABASE_URL`.
- [ ] Apply `migrations/001_google_connections.sql` to development, then deliberately to production.
- [ ] Generate independent `TOKEN_ENCRYPTION_KEY` and `SESSION_SECRET` values; store them only in local/Vercel secret storage.
- [ ] Set every variable listed in `.env.example` for Development and Production with correct environment scoping.
- [ ] Build the real Google Sheet with all ten exact machine tabs from [Finance Data Schema v1](docs/finance-data-schema-v1.md). Do not modify the real sheet during initial testing; use a copy.
- [ ] Run locally with `npx vercel dev --listen 3000`, complete OAuth using the allowlisted account, and select the copied test Sheet.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, `npm run smoke:browser`, and `npm run smoke:offline`.
- [ ] Deploy through the existing owner-controlled Vercel workflow only after checking production variables and the production database migration.
- [ ] Verify live login, Picker, refresh, reconnect, change-sheet, logout, and disconnect with the copied Sheet before selecting the real Sheet.
- [ ] Move the OAuth app from Testing to In production when ready, then reconnect once. Until then, expect the `drive.file` refresh grant to expire after seven days.

Detailed instructions and troubleshooting: [docs/google-oauth-vercel-setup.md](docs/google-oauth-vercel-setup.md).
