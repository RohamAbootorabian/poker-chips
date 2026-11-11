// Entry point bundled into supabase/functions/_shared/engine.js (npm run build:functions).
export { createTable } from './engine';
export { emptyPrivate, onlineStep } from './online';
export type { PrivateState } from './online';
export { GameError } from './types';
export type { Action, Settings, TableState } from './types';
