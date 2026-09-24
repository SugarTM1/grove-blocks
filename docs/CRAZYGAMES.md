# CrazyGames submission notes

Verified against official documentation on **24 September 2026**. This project targets a **Basic Launch submission**. A GitHub release or working ZIP is not a CrazyGames acceptance, publication, or traffic guarantee.

## Current integration

Version **1.0.2** adds progress saving through the Data Module. `src/platform.js` uses the current [HTML5 SDK v3](https://docs.crazygames.com/sdk/intro/), loaded from `https://sdk.crazygames.com/crazygames-sdk-v3.js`. It waits for `SDK.init()` before sending events or accessing data. The adapter:

- Loads the SDK only on `crazygames.com` / `crazygames-cdn.com` and their subdomains, with a matching embedding referrer, or with the explicit `?crazygames=true` switch used by the submitted iframe URL and local SDK tests.
- Makes no SDK network request during ordinary standalone play, including localhost. All actual game code and assets are local.
- Has a four-second script-load timeout and a separate four-second initialization timeout. Failure leaves the puzzle playable. Late initialization cannot attach a broken session.
- Remembers whether the player is playing while initialization is in flight, then reports the current state once ready. Repeated identical play states do not send duplicate events.
- Uses v3 `loadingStart` / `loadingStop`, `gameplayStart` / `gameplayStop`, and `happytime`. There are no v2 `sdkGameLoadingStart` calls.

Call `initPlatform()` once during startup. Call `setPlaying(true)` when play becomes available and `setPlaying(false)` when opening a menu, pausing, or ending a run. Do not send gameplay transitions merely because the tab loses focus: the portal handles that. Reserve `celebrate()` for a notable milestone. The loading pair is intentionally brief because there are no deferred game-asset downloads. [Official game-event documentation](https://docs.crazygames.com/sdk/game/).

## Progress saving and iframe submission

For an iframe submission, use [https://sugartm1.github.io/grove-blocks/?crazygames=true](https://sugartm1.github.io/grove-blocks/?crazygames=true). In **Does your game save progress?**, select exactly **Yes, using the Data Module from the CrazyGames SDK**. This selection enables the Data Module; Automatic Progress Save for direct LocalStorage does not cover iframe games.

`src/progress.js` waits for platform initialization and reads `SDK.data.getItem("grove-blocks-v1")` before gameplay or any save. On CrazyGames, both guests and signed-in players use the Data Module exclusively. The SDK manages guest storage and account cloud synchronization. Game mutations save the Classic and Daily sessions, personal best, collection, palette, and sound preference through `SDK.data.setItem`. Unchanged snapshots are not written again. [Official Data Module documentation](https://docs.crazygames.com/sdk/data/).

Ordinary standalone play, including the GitHub Pages link without the flag, keeps the existing browser-local save. Standalone and CrazyGames progress are separate. This is the first CrazyGames submission, so the game does not import standalone browser saves into a CrazyGames account. Existing standalone progress remains intact.

If SDK initialization or the initial Data Module read fails, the game remains playable with session-only progress and does not write a new game over unread cloud data. Unrecognized cloud saves are also preserved rather than replaced. Failed writes display **Session only**. Direct LocalStorage is not used as a fallback inside an active CrazyGames session.

CrazyGames automatically reloads Data Module games when the player signs in and refreshes the page on sign-out; the game therefore loads the current account or guest save during startup. No custom account backend or authentication prompt is required. [Official authentication behavior](https://docs.crazygames.com/sdk/user/#auth-listener).

## Local and portal QA

1. Serve the game normally and verify a full run, touch input, restart, settings, and restored progress with the internet disconnected. The local server is still needed; ES modules are not intended to run through a `file://` double-click.
2. For SDK smoke testing, open the local URL with `?crazygames=true`, for example `http://localhost:4173/?crazygames=true`. This is our adapter switch, not a CrazyGames SDK parameter. The SDK recognizes `localhost` and `127.0.0.1` as local environments; use the browser console to inspect events. Internet access is required only for this optional test.
3. On another QA hostname, `?crazygames=true&useLocalSdk=true` also asks the SDK to use its local test mode. Never include `useLocalSdk=true` in the submitted production URL.
4. Submit the iframe URL above or upload the build through the [Developer Portal](https://developer.crazygames.com/), enable the Data Module progress option, and test with its Preview tool. This is the definitive embedding check. The iframe URL flag covers embeds with an unavailable referrer.
5. Exercise desktop landscape, phone portrait and landscape, and an iframe near 907×510 and 821×462 pixels. Check browser refresh, no-move/game-over state, storage restrictions, and slow/offline SDK behavior. CrazyGames requires English, responsive legibility, and mouse/touch controls where supported; custom in-game fullscreen buttons are prohibited because the portal provides fullscreen. [Gameplay requirements](https://docs.crazygames.com/requirements/gameplay/).
6. **Real cloud QA is still required in the Developer Portal.** Verify guest progress after refresh, sign-in with an existing account save, sign-in to an account with no previous progress, sign-out, and restoration on a second device using the same account. Allow time for the SDK's debounced synchronization before comparing devices. Simulated SDK checks and localhost tests do not verify production cloud synchronization.

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

This game has no ads, paid items, external logins, custom backend, or public leaderboard. It integrates CrazyGames Data Module cloud saves for signed-in players; standalone browser progress remains local to that browser and device. The adapter remains a Basic Launch integration, **not a claim of Full Implementation compliance**.

Before a Full Launch submission, review all current [integration requirements](https://docs.crazygames.com/requirements/intro/) with the portal QA team. Work may include CrazyGames ad integration and interruption handling if monetizing, the SDK's `muteAudio` preference and settings-change listener, verification of progress/account behavior, and device/browser QA. Any monetization must use CrazyGames rather than external ads. [Advertisement requirements](https://docs.crazygames.com/requirements/ads/) and [account integration requirements](https://docs.crazygames.com/requirements/account-integration/).
