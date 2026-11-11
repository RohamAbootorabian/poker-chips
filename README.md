# Poker Chips

Play poker with real cards and let the app keep the chips: stacks, bets, pots,
side pots, buy-ins and the final settlement. Every player joins the same table
from their own phone with a room code.

Planned second mode: full online poker with cards dealt in the app.

## Run

```bash
npm install
npx expo start        # then press i / a / w, or scan the QR code with Expo Go
npm test              # game-engine tests
npm run typecheck
```

Without a server configured the app runs in a local trial mode: tables live on
one device only (the host can seat "players without a phone" and act for them).

## Connect devices (Supabase)

Tables are shared through a Supabase project. The schema lives in
`supabase/migrations/`; apply it with `npx supabase db push --remote`.

Put the project URL and publishable key in `.env` (see `.env.example`), then
restart with `npx expo start --clear`. `.env` is not committed.

## Layout

- `src/engine/` – pure game rules (no UI, no network). `reduce(state, action, actorId)`.
- `src/net/` – table storage and sync (Supabase, or local storage as a fallback).
- `src/app/` – screens (Expo Router). `src/ui/` – shared components.
