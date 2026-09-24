# CrazyGames submission notes

Verified against official documentation on **24 September 2026**. This project targets a **Basic Launch submission**. A GitHub release or working ZIP is not a CrazyGames acceptance, publication, or traffic guarantee.

## Current integration

`src/platform.js` uses the current [HTML5 SDK v3](https://docs.crazygames.com/sdk/intro/), loaded from `https://sdk.crazygames.com/crazygames-sdk-v3.js`. It waits for `SDK.init()` before sending events. The adapter:

- Loads the SDK only on `crazygames.com` / `crazygames-cdn.com` and their subdomains, with a matching embedding referrer, or with the explicit `?crazygames=true` test switch.
- Makes no SDK network request during ordinary standalone play, including localhost. All actual game code and assets are local.
- Has a four-second script-load timeout and a separate four-second initialization timeout. Failure leaves the puzzle playable. Late initialization cannot attach a broken session.
- Remembers whether the player is playing while initialization is in flight, then reports the current state once ready. Repeated identical play states do not send duplicate events.
- Uses v3 `loadingStart` / `loadingStop`, `gameplayStart` / `gameplayStop`, and `happytime`. There are no v2 `sdkGameLoadingStart` calls.

Call `initPlatform()` once during startup. Call `setPlaying(true)` when play becomes available and `setPlaying(false)` when opening a menu, pausing, or ending a run. Do not send gameplay transitions merely because the tab loses focus: the portal handles that. Reserve `celebrate()` for a notable milestone. The loading pair is intentionally brief because there are no deferred game-asset downloads. [Official game-event documentation](https://docs.crazygames.com/sdk/game/).

## Local and portal QA

1. Serve the game normally and verify a full run, touch input, restart, settings, and restored progress with the internet disconnected. The local server is still needed; ES modules are not intended to run through a `file://` double-click.
2. For SDK smoke testing, open the local URL with `?crazygames=true`, for example `http://localhost:4173/?crazygames=true`. This is our adapter switch, not a CrazyGames SDK parameter. The SDK recognizes `localhost` and `127.0.0.1` as local environments; use the browser console to inspect events. Internet access is required only for this optional test.
3. On another QA hostname, `?crazygames=true&useLocalSdk=true` also asks the SDK to use its local test mode. Never include `useLocalSdk=true` in the submitted production URL.
4. Upload the build through the [Developer Portal](https://developer.crazygames.com/) and test with its Preview tool. This is the definitive embedding check. The optional URL flag can cover embeds with an unavailable referrer.
5. Exercise desktop landscape, phone portrait and landscape, and an iframe near 907×510 and 821×462 pixels. Check browser refresh, no-move/game-over state, storage restrictions, and slow/offline SDK behavior. CrazyGames requires English, responsive legibility, and mouse/touch controls where supported; custom in-game fullscreen buttons are prohibited because the portal provides fullscreen. [Gameplay requirements](https://docs.crazygames.com/requirements/gameplay/).

## Build and upload

Create a ZIP of the **built game contents**, with `index.html` at the archive root. Include the generated JavaScript, CSS, and assets using relative paths. Exclude `.git`, `node_modules`, test files, and documentation. Test the ZIP contents via a local static server before upload, including a nested URL path so accidental absolute asset URLs are caught. The repository README describes this project's build and packaging command.

The technical limits currently specify ≤50 MB initial download, ≤250 MB total and ≤1,500 files; without an integrated SDK the total must be ≤50 MB. Mobile-homepage eligibility needs ≤20 MB initial download. The bundle should remain far below those ceilings. Chrome and Edge are expected to work; Safari and mobile should be checked separately. [Technical requirements](https://docs.crazygames.com/requirements/technical/).

## Store assets still needed for submission

Prepare three consistent covers:

| Cover | Required size |
| --- | --- |
| Landscape | 1920 × 1080 px (16:9) |
| Portrait | 800 × 1200 px (2:3) |
| Square | 800 × 800 px (1:1) |

Also record silent gameplay preview videos in landscape 1080p (16:9) and portrait 1080p (2:3). Aim for 15–20 seconds; the maximum file size is 50 MB. Use the cover as the opening frame. Avoid borders, store logos, promotional text, black bars, and the default mouse cursor. Cover text should contain only the game's title. [Official cover and preview specifications](https://docs.crazygames.com/requirements/game-covers/).

## Basic Launch versus Full Launch

Basic Launch has an optional SDK and disabled monetization. CrazyGames initially tests a limited audience, ordinarily for 7–21 days, and evaluates engagement before deciding whether the game can progress. Approval, reach, retention, and organic traffic cannot be predicted from an existing game's public rating. [Launch process](https://docs.crazygames.com/) and [Basic Launch guide](https://docs.crazygames.com/resources/basic-launch-metrics/).

This game has no ads, paid items, external logins, backend, public leaderboard, or cloud-save integration. Progress stored by the browser is local to that browser and device. The adapter is a small Basic Launch integration, **not a claim of Full Implementation compliance**.

Before a Full Launch submission, review all current [integration requirements](https://docs.crazygames.com/requirements/intro/) with the portal QA team. Work may include CrazyGames ad integration and interruption handling if monetizing, the SDK's `muteAudio` preference and settings-change listener, platform progress/account integration where applicable, and device/browser QA. Any monetization must use CrazyGames rather than external ads. [Advertisement requirements](https://docs.crazygames.com/requirements/ads/) and [account integration requirements](https://docs.crazygames.com/requirements/account-integration/).
