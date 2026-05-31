# Sobagi Admin / Debug Panel

Small internal local QA tool for Sobagi mailbox, discovery/bag, and app-state
inspection.

This repository is intentionally separate from the main Sobagi app. It does not
add routes, screens, or behavior to the production app.

## Architecture

- Static browser app under `src/`.
- No server and no production data connection.
- Reads/writes browser `localStorage` using Sobagi storage key names.
- Keeps a thin schema copy in `src/sobagi-schema.ts` instead of importing app
  modules, so bundling cannot affect the app.
- Destructive actions require `window.confirm`.

## Files

- `src/index.html` - admin shell.
- `src/main.ts` - rendering and event wiring.
- `src/sobagi-schema.ts` - copied storage keys plus letter/item id metadata.
- `src/storage-adapter.ts` - JSON localStorage helpers.
- `src/mailbox.ts` - mailbox state, explanations, read/unread actions.
- `src/discovery.ts` - discovery queue, kept/found item actions.
- `src/state.ts` - app state summaries and raw storage view.
- `src/debug-actions.ts` - reset, seed, and simulation helpers.
- `src/operator.ts` - operator outbox, audit log, and direct state controls.
- `src/styles.css` - plain internal UI styling.

## Run

Install dependencies once:

```bash
npm install
```

Build:

```bash
npm run build
```

Run the admin web/API server:

```bash
npm run serve
```

Open `http://127.0.0.1:4173`.

The same server exposes:

- `POST /api/messages` - create an operator letter for all users or one user.
- `GET /api/messages` - list operator letters.
- `DELETE /api/messages/:id` - remove an operator letter.
- `GET /api/letters?userId=...` - app-facing letter feed.
- `POST /api/ops` - create an operational command for all users or one user.
- `GET /api/ops/pending?userId=...` - app-facing operational command feed.

## Verify

```bash
npm run typecheck
npm run build
```

## Safety Notes

- This is local/dev first. It mutates only the browser storage visible to the
  page where it is opened.
- It does not read or mutate production user data.
- Operator messages are all letters. The Sobagi app reads them through
  `/api/letters?userId=...` and shows them in the normal mailbox.
- The local server stores messages in `data/messages.json`, which is ignored by
  git.
- `Fresh wipe local app state`, mailbox reset, bag reset, and seeded-expense
  clearing require confirmation.
- Time simulation writes admin/debug keys and safe rollover hints only. The
  production Sobagi app does not consume admin-only clock overrides.
- The schema is a copied adapter. When Sobagi storage keys or letter/item ids
  change, update `src/sobagi-schema.ts`.

## Current v1 Coverage

- Operator letters:
  - send a letter to all users
  - send a letter to a specific app user id
  - inspect generated JSON payloads
  - delete/clear queued letters
  - audit operator actions

- Operational commands:
  - grant a built-in mailbox letter
  - mark a mailbox letter read/unread
  - reset mailbox state
  - enqueue or keep an item
  - reset discovery/bag state
  - set recordedDaysCount, streak, totalRecordCount, and room stage

- Mailbox:
  - delivered/read/unread listing
  - available/scheduled/condition-unmet explanations
  - force deliver
  - mark read/unread
  - reset mailbox state

- Discovery and bag:
  - kept ids
  - discovery queue and queue front
  - found trinkets and duplicate counts
  - force enqueue
  - force keep
  - add/remove kept item ids
  - add/remove found entries
  - set found duplicate count
  - set queue front
  - set/clear staged and pending item ids
  - clear queue
  - reset bag/discovery state
  - sample discovery trigger

- User/app state:
  - recorded days, streak, total records
  - today's record shape
  - current emotion
  - room stage
  - visit/rest/discovery markers
  - raw known storage keys

- Debug actions:
  - fresh wipe known local state
  - reset mailbox
  - reset discovery/bag
  - set pebble count
  - set room stage
  - simulate next day
  - admin-only morning/night clock marker
  - seed and clear example expenses
