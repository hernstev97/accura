# Google OAuth, Picker, Postgres, and Vercel setup

No step in this document should place a secret in Git or a `VITE_` variable. The implementation is a Google OAuth web-server flow; Google explicitly describes refresh tokens as a server-side/offline mechanism ([OAuth web-server guide](https://developers.google.com/identity/protocols/oauth2/web-server)).

Examples below assume:

- local origin: `http://localhost:3000`
- local callback: `http://localhost:3000/api/auth/google/callback`
- production origin: `https://finance.example.com`
- production callback: `https://finance.example.com/api/auth/google/callback`

Replace only `finance.example.com` with the actual stable production domain. OAuth does not support a wildcard callback for changing Vercel Preview URLs; use a fixed preview/custom domain and a separate OAuth client/project if live Preview OAuth is required.

## 1. Create the Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a dedicated project for this application. Do not reuse an unrelated production project.
3. Record both the **Project ID** and numeric **Project number**. The number is available under **IAM & Admin → Settings** and becomes `GOOGLE_CLOUD_PROJECT_NUMBER`. Picker's `setAppId` specifically requires the project number ([Picker App ID reference](https://developers.google.com/workspace/drive/picker/reference/picker.pickerbuilder.setappid)).

## 2. Enable APIs

Under **APIs & Services → Library**, enable all three:

1. Google Sheets API
2. Google Drive API
3. Google Picker API

Picker is a separate API from Drive and must be enabled explicitly ([Picker web guide](https://developers.google.com/workspace/drive/picker/guides/web-picker)).

## 3. Configure Google Auth Platform

In **Google Auth Platform**:

1. **Branding:** provide app name, support email, and developer contact email. For a public In-production app, use owned homepage/privacy-policy domains as Google requests.
2. **Audience:** choose **External**.
3. While publishing status is **Testing**, add the exact `ALLOWED_GOOGLE_EMAIL` account as a test user.
4. **Data Access / Scopes:** add only:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.file`
5. Do not add `drive`, `drive.readonly`, `spreadsheets`, or `spreadsheets.readonly`.

`drive.file` is Google's recommended per-file scope with Picker and is classified as non-sensitive ([Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)).

### Testing status warning

Because this app requests `drive.file` in addition to identity scopes, an External app in **Testing** receives refresh tokens that expire seven days after consent. Google documents that the seven-day exception applies only when requests are limited to identity/profile scopes ([Google OAuth overview](https://developers.google.com/identity/protocols/oauth2), [Audience help](https://support.google.com/cloud/answer/15549945)). Expect to reconnect weekly until publishing status changes.

## 4. Create the Web OAuth client

Under **Google Auth Platform → Clients**:

1. Create a client of type **Web application**.
2. Add these exact authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://finance.example.com`
3. Add these exact authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://finance.example.com/api/auth/google/callback`
4. Save the Client ID as `GOOGLE_CLIENT_ID`.
5. Save the Client secret as `GOOGLE_CLIENT_SECRET`.

Redirect matching is exact: scheme, host, port, path, and trailing slash must agree. The callback route has no trailing slash.

## 5. Create and restrict the Picker API key

Under **APIs & Services → Credentials**:

1. Create an API key named for the finance Picker.
2. Application restriction: **Websites / HTTP referrers**.
3. Add local referrers:
   - `http://localhost:3000`
   - `http://localhost:3000/*`
4. Add production referrers:
   - `https://finance.example.com`
   - `https://finance.example.com/*`
5. API restriction: **Restrict key → Google Picker API only**.
6. Save the key as `GOOGLE_API_KEY`.

Google recommends both website and API restrictions ([API key restrictions](https://cloud.google.com/api-keys/docs/add-restrictions-api-keys)). This key is expected to be visible to Picker in browser memory; the restrictions are its security boundary. Do not use this key for server Sheets/Drive calls, which use OAuth bearer tokens.

## 6. Provision Postgres

Preferred path:

1. In the Vercel project, open **Storage/Marketplace**.
2. Provision **Neon Postgres** and connect it to this project. Vercel Marketplace provisioning injects database environment variables automatically.
3. Use the pooled Postgres connection string as `DATABASE_URL`. If the integration used another variable name, explicitly add the same pooled URL under `DATABASE_URL`.
4. Scope production data to Production. Use a separate branch/database or disposable local database for Development/Preview.

An existing managed Postgres database is also supported if its TLS connection string works with the `postgres` Node package and Vercel Functions. Avoid a low unpooled connection limit.

## 7. Apply the SQL migration

Never run the production migration until its target URL has been checked. For a local/development database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_google_connections.sql
```

The migration is idempotent (`IF NOT EXISTS`) and creates only `google_connections`. Verify:

```bash
psql "$DATABASE_URL" -c '\d+ google_connections'
```

Apply the same file once to the intended production database during the owner-controlled release process. The repository does not run migrations automatically during builds.

## 8. Generate secrets

Generate independently; never reuse values:

```bash
openssl rand -base64 32  # TOKEN_ENCRYPTION_KEY: decodes to exactly 32 bytes
openssl rand -base64 48  # SESSION_SECRET
```

Store outputs directly in the local secret file/Vercel dashboard. Do not paste them into chat, issues, logs, or commits.

## 9. Set environment variables

Copy `.env.example` names and set:

| Variable | Local | Production | Browser-visible? |
|---|---|---|---:|
| `APP_ORIGIN` | `http://localhost:3000` | exact HTTPS origin | yes conceptually, stored server-side |
| `GOOGLE_CLIENT_ID` | dev Web client | production Web client | public identifier; Picker receives it |
| `GOOGLE_CLIENT_SECRET` | dev secret | production secret | no |
| `GOOGLE_API_KEY` | restricted local key | restricted production key | yes, Picker only |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | numeric project number | numeric project number | yes, Picker App ID |
| `GOOGLE_OAUTH_REDIRECT_URI` | exact localhost callback | exact production callback | no need to expose |
| `ALLOWED_GOOGLE_EMAIL` | test owner | production owner | no |
| `DATABASE_URL` | dev pooled URL | production pooled URL | no |
| `TOKEN_ENCRYPTION_KEY` | dev key | independent production key | no |
| `SESSION_SECRET` | dev secret | independent production secret | no |

Vercel Dashboard path: **Project → Settings → Environment Variables**. Add server secrets as sensitive variables and scope them deliberately to Development, Preview, and/or Production. Do not create any `VITE_GOOGLE_*`, `VITE_DATABASE_*`, or `VITE_*SECRET*` variable.

For local development after linking:

```bash
npx vercel link
npx vercel env pull .env.local --environment=development
```

`vercel env pull` overwrites the target file, so do not keep unsynchronized manual notes in it.

## 10. Run locally

Install dependencies, then use Vercel's local runtime so root `api/` functions and Vite run together:

```bash
npm install
npx vercel dev --listen 3000
```

Vercel documents `vercel dev` as the local emulation path for Functions ([Vercel CLI docs](https://vercel.com/docs/cli/dev)); root `api/*.ts` files are supported for Vite projects ([Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)). Open `http://localhost:3000`.

For credential-free UI work only:

```bash
npm run dev:mock
```

Mock mode uses anonymous fixture data and a fake Picker selection. It does not exercise Functions, OAuth, Postgres, or Google.

## 11. Pre-deployment verification

Run without Google credentials:

```bash
npm test
npm run lint
npm run build
```

For browser/offline tests, run the production preview and the mocked suites:

```bash
npm run preview
npm run smoke:browser
npm run smoke:offline
```

Then, using development infrastructure only, verify login, allowlist rejection, Picker filtering, first sync, manual refresh, change-sheet validation, reconnect, logout, and disconnect.

## 12. Deploy safely

1. Confirm the production database migration has run.
2. Confirm all production environment variables are present and Preview does not inherit the production database unless intended.
3. Confirm the Google production origin/callback and Picker referrers exactly match the stable domain.
4. Deploy through the existing owner-controlled Git/Vercel process. Do not use `--build-env` or checked-in `.env` files to pass secrets.
5. Inspect the built browser assets for secret variable names/values before live OAuth testing.
6. Perform one owner login, select a copy/test workbook first, verify data, then change to the intended workbook.

## 13. Move OAuth from Testing to In production

When ready, open **Google Auth Platform → Audience** and select **Publish app / In production**. Review current Google branding/verification prompts. `drive.file` is non-sensitive, but Google can still require branding verification and display an unverified warning until requirements are met.

After publishing, reconnect once so the server receives a new long-lived offline grant. Delete any obsolete Testing connection row or use the in-app disconnect flow first. Do not assume an already-issued seven-day Testing refresh token becomes long-lived automatically.

## Rotation and reconnect

- OAuth client secret: update Google/Vercel together, redeploy, then reconnect if exchanges fail.
- Session secret: rotate in Vercel and redeploy; all app sessions become invalid.
- Token encryption key: disconnect/delete existing encrypted rows first, rotate, deploy, then reconnect. Old ciphertext cannot be decrypted with the new key.
- Picker API key: create/restrict replacement, update Vercel, verify Picker, then delete old key.
- Revoked/expired Google grant: app displays reconnect; authorize again.

## Troubleshooting

| Symptom | Check |
|---|---|
| `redirect_uri_mismatch` | Exact `GOOGLE_OAUTH_REDIRECT_URI`, Google Web client callback, scheme/host/port/path, no trailing slash. |
| OAuth state error | Cookies allowed, same browser tab, callback within ten minutes, `APP_ORIGIN` correct, no proxy rewriting cookies. |
| “account not allowed” | Google ID-token email is verified and exactly equals `ALLOWED_GOOGLE_EMAIL` case-insensitively. |
| No refresh token | `access_type=offline` and consent prompt are present; disconnect prior grant and consent again; check Testing expiration. |
| Picker opens blank/403 | Picker API enabled; key permits exact referrer and only Picker API; App ID is numeric project number; client/project match. |
| Picker cannot see a file | Sign in with the same account; use a native Google Sheet; `drive.file` only exposes files selected/shared through this app. |
| Selected file rejected | Drive MIME must be `application/vnd.google-apps.spreadsheet`, not uploaded Excel. |
| Schema error | Use the location list and `docs/finance-data-schema-v1.md`; use numeric money, real booleans, ISO dates, exact headers. |
| `reconnect_required` | Refresh token was revoked/expired (`invalid_grant`); reconnect. Testing grants expire after seven days. |
| Database error | `DATABASE_URL` present, pooled/TLS URL valid, migration applied, database reachable from Vercel region. |
| Works in Vite, API 404 | Use `npx vercel dev --listen 3000`, not plain `npm run dev`, for real Functions. |
