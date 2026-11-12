# Poker Chips

Poker with friends, each on their own phone, joined by a room code. Two kinds of table:

- **Real cards** – you deal a physical deck and the app keeps the chips:
  stacks, bets, pots, side pots, buy-ins and the final settlement.
- **Online poker** – the app deals too. Cards are dealt by a server-side
  referee, so each phone only ever receives its own two cards, and the winner
  is decided automatically.

The interface is available in Persian (right-to-left) and English; all text
lives in `src/ui/i18n.ts`.

## Run

```bash
npm install
npx expo start        # then press i / a / w, or scan the QR code with Expo Go
npm test              # game-engine tests
npm run typecheck
npm run lint
```

Without a server configured the app runs in a local trial mode: tables live on
one device only (the host can seat "players without a phone" and act for them).

## Server (Supabase)

Tables are shared through a Supabase project.

- `supabase/migrations/` – the table and the RPCs used by real-card tables.
  Apply with `npx supabase db push --remote`.
- `supabase/functions/poker/` – the referee for online tables. It imports the
  game rules from `supabase/functions/_shared/engine.js`, which is generated
  from `src/engine`. After changing the engine run `npm run deploy:functions`.

Put the project URL and publishable key in `.env` (see `.env.example`), then
restart with `npx expo start --clear`. `.env` is not committed.

## Website

The web build is hosted on EAS Hosting at https://poker-chips.expo.app and can
be added to a phone's home screen (`public/manifest.json`). It talks to the
same Supabase project as the native app, so a table can mix phones on the app
and phones or computers on the site.

```bash
npm run deploy:web    # export the web build and publish it as production
```

`EXPO_PUBLIC_*` values are baked in at export time from `.env`.

## Layout

- `src/engine/` – pure game rules (no UI, no network): betting in `engine.ts`,
  cards and hand ranking in `cards.ts`, dealing and showdown in `online.ts`.
- `src/net/` – table storage and sync (Supabase, or local storage as a fallback).
- `src/app/` – screens (Expo Router). `src/ui/` – shared components.
