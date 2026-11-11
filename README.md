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

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Copy `.env.example` to `.env` and fill in the project URL and publishable key.
3. Restart `npx expo start --clear`.

## Layout

- `src/engine/` – pure game rules (no UI, no network). `reduce(state, action, actorId)`.
- `src/net/` – table storage and sync (Supabase, or local storage as a fallback).
- `src/app/` – screens (Expo Router). `src/ui/` – shared components.
