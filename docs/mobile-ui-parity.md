# PAYDAN mobile demo catalog and UI parity

## Why the demo products were missing

The web demo account uses a private fixture scope. Its catalog is stored in
`testProducts`, while the mobile catalog endpoint only queried `products`. The
same email therefore saw seeded listings on the web and an empty catalog in
Expo Go.

`src/server/mobile-catalog.ts` now selects the product record kind and owner
from the signed-in viewer:

- Demo buyer: `testProducts` owned by that buyer.
- Normal member and guest: the regular `products` catalog.
- Product detail and related products use the same scope.

The fix is covered in `tests/mobile-api.test.ts` by a test that seeds a demo
product and verifies another buyer cannot read it.

This backend change is committed and pushed as `e0e575d` (`fix: scope mobile
catalog for demo buyer`). The demo account sees its seeded catalogue once that
commit is live in production.

## UI parity patch

`docs/mobile-ui-parity.patch` contains the React Native changes that mirror the
web storefront's mobile design:

- PAYDAN wordmark header and green hero with the web's hero copy.
- Signed-in dashboard greeting, shortcut cards, department bottom sheet, and
  sourcing card.
- Guest department cards and price-free trending products.
- Web-style product tiles with discount badges, overlay wishlist control,
  uppercase green brand label, price row, and availability pill.
- Five-tab bottom navigation with the raised green Ask PAYDAN action.
- Brand component tests.
- A document-style scroll shell using `flexGrow` instead of `flex: 1`, so
  every storefront screen grows past the viewport and scrolls normally.
- Guest "How PAYDAN works" and support sections, plus a signed-in "Your next
  steps" card, mirroring the Next.js home and dashboard sections.

The wordmark is drawn with native text, so no new binary asset is required.

The patch has been applied to the physical mobile repository. To reproduce it
from a clean baseline:

```powershell
cd C:\Users\PRAISE\Desktop\paydan\paydan\paydan-mobile
git apply --check ..\paydan-next\docs\mobile-ui-parity.patch
git apply ..\paydan-next\docs\mobile-ui-parity.patch
npm run typecheck
npm test -- --runInBand --forceExit
npm run lint
```

Then restart Expo on the LAN interface, clear the proxy variables, and switch
the bundler to Expo Go with `s` if Expo prompts for a development build:

```powershell
[Environment]::GetEnvironmentVariables().Keys |
  Where-Object { $_ -match '(?i)^(http|https|all|git_http|git_https|no)_proxy$' } |
  ForEach-Object { [Environment]::SetEnvironmentVariable($_, $null, 'Process') }
$env:EXPO_NO_TYPESCRIPT_SETUP='1'
npx expo start --lan --clear --port 8081
```

## Verification

- Backend typecheck: passed.
- Backend tests: 3 files, 88 tests passed.
- Mobile API tests: 26 passed, including demo-buyer catalogue isolation.
- Mobile typecheck: passed.
- Mobile tests: 8 suites, 21 tests passed, including a scroll-container
  regression test.
- Mobile lint: passed.
- The verified UI files were copied from the patched working copy into the
  physical mobile repository after `git apply` hit a Windows path-creation
  error; hashes matched for all six files.

## Deployment note

The backend catalog fix has been committed and pushed. After the production
deploy completes, sign out and back in on the demo account so the mobile client
gets a fresh session, then restart Expo Go with the clean bundle.
