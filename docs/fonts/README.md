# Bundled font

The PWA bundles **Google Sans Flex v22** (last modified 2026-07-30) from the official [Google Fonts family](https://fonts.google.com/specimen/Google+Sans+Flex). The repository consumes the Google Fonts files through the version-pinned `@fontsource-variable/google-sans-flex` package, whose metadata identifies `https://github.com/google/fonts` as the upstream source and preserves the original font binaries.

`src/design/googleSansFlex.css` includes the full-axis Latin and Latin Extended WOFF2 subsets. Vite fingerprints them and Workbox precaches them with the app shell, so no runtime font request leaves the device and the family remains available offline.

The application uses the official family name, not an unofficial “Google Sans Rounded” font. Rounded terminals are produced with the variable settings `ROND: 100`, `wdth: 100`, automatic optical sizing, and role-specific `wght` values.

Copyright 2015 Google LLC. The font is licensed under the SIL Open Font License 1.1; the retained license is in [Google-Sans-Flex-OFL.txt](./Google-Sans-Flex-OFL.txt).
