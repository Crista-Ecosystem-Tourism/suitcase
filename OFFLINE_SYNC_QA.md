# Offline sync: device QA

Run this on a development or staging API. Use disposable accounts and data only.

## Setup

1. Install the native build on two devices, or on one device and one emulator.
2. Configure the build with the test `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_IDENTITY_API_URL` values.
3. Sign in as account A and open Trips and Goals while online. This writes the server workspace snapshot to the device.
4. For the conflict scenario, sign in as account A on the second device too. Keep both devices on the same workspace.

## Offline snapshot and FIFO replay

1. On device A, disable Wi-Fi and mobile data. Return to Trips or Goals, then restart the app.
2. Expected: the last server workspace remains visible. The app must not show an empty workspace as a successful refresh.
3. While still offline, create a trip named `Offline QA <timestamp>`, add one expense to it, and create one goal.
4. Expected: each action appears locally and the Profile screen shows pending synchronization. The count is at least three.
5. Restore connectivity, open Profile, and press **Sync now**.
6. Expected: the pending count becomes zero. The server workspace contains one trip, one expense, and one goal with the chosen values.
7. Close and reopen the app, then press **Sync now** again.
8. Expected: no duplicate trips, expenses, or goals appear. Creation is deduplicated by the client request ID.

## Conflict resolution

1. With both devices online, open the same existing trip and let each device load the current state.
2. On device A, disable networking and change the trip city to `Offline city`.
3. On device B, while online, change the same trip city to `Server city` and save it.
4. Restore connectivity on device A, open Profile, and press **Sync now**.
5. Expected: device A keeps the queued change as a conflict, shows its path in the Profile screen, and does not silently overwrite `Server city`.
6. Select **Keep server**.
7. Expected: the conflict disappears; a workspace refresh shows `Server city`.
8. Repeat steps 1–5 with fresh values and select **Keep local**, then press **Sync now**.
9. Expected: the queued mutation replays without its stale `base_updated_at`; a refreshed workspace shows the local city once.

## Offline deletion and account boundary

1. On device A, cache a test goal, disable networking, and delete it.
2. Expected: the goal disappears locally and Profile reports a pending change.
3. Restore connectivity and sync.
4. Expected: the goal is absent from the server workspace; repeating sync does not change the result.
5. Sign out from account A, then sign in as account B while offline.
6. Expected: account B never receives account A's cached trips, expenses, or goals. Workspace snapshots and queues are keyed by account ID.

## Evidence to retain

Record the build version, API environment, two account IDs, timestamps, pending-count screenshots, the conflict choice, and the final `GET /suitcase/workspace` response for each scenario. Do not record tokens, passwords, or production personal data.
