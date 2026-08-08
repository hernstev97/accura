# Security and data flow

## Trust boundaries

```text
Google account / consent
        │ authorization code + state
        ▼
Vercel Function trust boundary ───── PostgreSQL
  OAuth callback                     encrypted refresh token
  session validation                 selected Sheet metadata
  Google token refresh
  Drive MIME/access check
  Sheets batchGet + validation
        │ normalized FinanceDataV1 only
        ▼
Browser PWA ───── IndexedDB last-known-good FinanceDataV1
```

The browser is untrusted. It receives a signed-in status, CSRF token, selected file metadata, normalized finance records, and—only while opening Picker—a short-lived Google access token plus public Picker configuration. It never receives the Google refresh token, OAuth client secret, database credential, encryption key, or session secret.

## OAuth flow

1. `GET /api/auth/google/start` generates high-entropy `state`, nonce, and PKCE verifier/challenge.
2. The verifier, state, nonce, issued time, and ten-minute expiry are HMAC-signed in an HttpOnly, SameSite=Lax transaction cookie.
3. Google receives only `openid`, `email`, `profile`, and `drive.file`, with offline access and explicit consent.
4. `GET /api/auth/google/callback` validates the signed cookie, expiry, and constant-time state comparison before exchanging the authorization code with the PKCE verifier.
5. The ID token signature, issuer, audience, nonce, immutable `sub`, email, and `email_verified` claim are checked.
6. Access is allowed only when the verified email equals `ALLOWED_GOOGLE_EMAIL`.
7. The refresh token is encrypted and upserted under Google `sub`; the app session is an expiring HMAC-signed HttpOnly cookie.

OAuth callback failures redirect with a small allowlisted error code. Authorization codes, tokens, claims, and stack traces are not reflected or logged.

## Why `drive.file`

`drive.file` grants per-file access to files opened/shared through the app and Picker. It avoids broad Drive-wide read scopes. Google recommends combining it with Picker for narrow user-selected access: [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

The server requests no Sheets OAuth scope. Once a Google Sheet has been selected for this application under `drive.file`, the bearer token can read that selected file through the Sheets API.

## Token encryption and storage

- Refresh tokens are encrypted with AES-256-GCM.
- `TOKEN_ENCRYPTION_KEY` must decode from base64 to exactly 32 bytes.
- Each encrypted value has a random 96-bit IV and authentication tag.
- Additional authenticated data binds ciphertext to `finance-google-token:<google-sub>`, preventing a ciphertext row from being swapped to another subject.
- The stored string is versioned (`v1`) to permit a deliberate future key/format migration.
- Plaintext exists only in server-function memory while refreshing or revoking access.
- The database stores only subject, verified email, encrypted token, scopes, selected file ID/name, and timestamps.

Key rotation currently requires reconnecting: change `TOKEN_ENCRYPTION_KEY`, delete existing connection rows, and have the allowlisted user authorize again. Never change the key while expecting old ciphertext to remain decryptable.

## Session and CSRF security

- Session and OAuth cookies are HttpOnly and SameSite=Lax.
- Production cookies include `Secure`; local HTTP development intentionally does not.
- The session contains immutable Google `sub`, verified email, a random CSRF value, issued time, and expiry; it contains no Google token.
- Every mutating endpoint requires both the CSRF header and an exact `Origin === APP_ORIGIN` check.
- Every protected endpoint rechecks the allowlisted email embedded in the signed session.
- Responses containing auth or finance state use `Cache-Control: no-store`.

Changing `SESSION_SECRET` invalidates all application sessions but does not delete the server-side Google connection.

## Picker handling

`GET /api/google/picker` obtains a fresh short-lived access token server-side and sends it to the authenticated browser with the restricted API key, client identifier, and Cloud project number. The browser keeps it only in the Picker call closure, clears its reference when Picker completes/cancels, and never writes it to storage or logs.

Picker is filtered to Google Sheets and does not enable multi-select. Its file ID and display name are untrusted hints. `PUT /api/google/spreadsheet` independently:

1. checks authentication and CSRF;
2. fetches Drive metadata;
3. rejects inaccessible, trashed, or non-Sheets files;
4. reads all machine ranges with one Sheets `batchGet`;
5. parses, normalizes to cents, and validates schema v1;
6. commits ID/name only after all checks pass.

## Server-only Sheets access

Regular refreshes use `GET /api/finance`. The server decrypts the refresh token, obtains a short-lived access token, reads the selected Sheet using `batchGet`, validates it, and returns only `FinanceDataV1`. The app does not contain a hardcoded Sheet URL and does not call Sheets directly.

Google `invalid_grant` and unauthorized API responses become `reconnect_required`. Other Google/network failures use structured non-secret error codes. Validation details contain only location and expected format, never unrelated cell contents.

## Same-origin endpoint surface

| Method and path | Purpose | Protection |
|---|---|---|
| `GET /api/auth/google/start` | Create signed OAuth transaction and redirect to Google | state, nonce, PKCE, short-lived HttpOnly cookie |
| `GET /api/auth/google/callback` | Validate callback, exchange code, allowlist user, persist encrypted connection | state/PKCE/nonce, Google JWT verification, email allowlist |
| `GET /api/session` | Return minimal app session and selected-file status | signed HttpOnly session if present |
| `POST /api/auth/logout` | Clear app session | authenticated session, exact Origin, CSRF |
| `POST /api/connection/disconnect` | Revoke token, delete connection, clear session | authenticated session, exact Origin, CSRF |
| `GET /api/google/picker` | Return one short-lived access token and public Picker config | authenticated allowlisted session |
| `PUT /api/google/spreadsheet` | Validate candidate file/workbook, then save selection | authenticated session, exact Origin, CSRF, strict JSON body |
| `GET /api/finance` | Read, normalize, validate, and return current `FinanceDataV1` | authenticated allowlisted session and stored selection |

Handlers reject unsupported methods, use `Cache-Control: no-store`, and return structured errors without stack traces.

## IndexedDB and offline implications

The service worker precaches the application shell. After a successful sync, the browser stores one normalized last-known-good v1 snapshot plus spreadsheet ID/name and refresh time in IndexedDB.

This cache deliberately contains personal financial data in plaintext under the browser profile. It contains no OAuth token or server credential. Anyone with access to the unlocked browser profile may be able to inspect it. Device encryption, a locked OS account, and browser-profile hygiene remain user responsibilities.

When the session endpoint is unreachable during offline startup, the PWA may display this cached snapshot without revalidating the HttpOnly session, because no server is reachable. It is clearly marked offline/stale. Signing out hides data but keeps the local snapshot for subsequent offline use by the same private-device owner. Disconnecting is the destructive privacy action and removes it.

## Refresh behavior

- Refresh after authentication when a selected file exists.
- Refresh immediately after successful spreadsheet selection.
- Refresh on app startup.
- Refresh on foreground return only when the last success is older than ten minutes.
- Refresh when connectivity returns and on explicit manual action.
- No polling and no cron.
- Concurrent requests deduplicate; generation checks and abort controllers prevent old responses from replacing a newer selection.
- Any invalid/new failure retains the last-known-good data and marks it stale, offline, invalid, or reconnect-required.

## Logout and disconnect

- **Logout** validates CSRF, clears the application session, and hides in-memory finance data. It does not revoke Google or delete the server connection.
- **Disconnect** validates CSRF, attempts Google token revocation, deletes the Postgres row even if revocation fails, clears the session, clears in-memory data, and deletes the IndexedDB snapshot after server confirmation.

## Threat model and known limitations

Mitigated:

- stolen source/client bundle cannot reveal refresh tokens or secrets;
- OAuth login CSRF/code interception is constrained by state, nonce, callback validation, and PKCE;
- cross-site mutations require SameSite cookie, exact Origin, and CSRF token;
- arbitrary Google files are constrained by allowlisting, `drive.file`, Picker, server MIME/access checks, and a saved ID;
- malicious workbook shapes cannot bypass strict parsing, referential integrity, version checks, or integer-cent normalization;
- stale network responses cannot replace a newer selection.

Known limitations:

- This is a single-allowlisted-user application, not multi-tenant account management.
- IndexedDB is not encrypted by the application; offline availability trades server reauthentication for local-device trust.
- The app does not detect Sheet changes until an allowed refresh trigger occurs.
- Token revocation is best-effort because Google may be unreachable; local deletion still completes.
- No application-level rate limiter is included. Vercel/Google platform limits apply; add rate limiting before broadening beyond one user.
- Live OAuth, Picker, database, and production headers require the external setup and cannot be verified by credential-free tests.
