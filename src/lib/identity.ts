import 'expo-sqlite/localStorage/install';

const ID_KEY = 'pc.deviceId';
const NAME_KEY = 'pc.name';
const SECRET_KEY = 'pc.secret';

function randomId(): string {
  let out = '';
  for (let i = 0; i < 16; i++) out += Math.floor(Math.random() * 36).toString(36);
  return out;
}

/** Stable anonymous id for this device; it identifies the player at a table. */
export function getDeviceId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

/** Never shared with other players; proves to the server that this device owns its seat. */
export function getSecret(): string {
  let secret = localStorage.getItem(SECRET_KEY);
  if (!secret) {
    secret = randomId() + randomId();
    localStorage.setItem(SECRET_KEY, secret);
  }
  return secret;
}

export function getName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function setName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim());
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newTableCode(): string {
  let out = '';
  for (let i = 0; i < 5; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}
