import { openDatabase } from "../../.tsc-tests/lib/server/db.js";
import { registerUser } from "../../.tsc-tests/lib/server/users.js";

export function freshDb() {
  return openDatabase(":memory:");
}

let n = 0;
export function makeUser(db, name) {
  n += 1;
  const nickname = name ?? `Player${n}`;
  const r = registerUser(db, { nickname, email: `${nickname.toLowerCase()}@example.com`, password: "secret123" });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
