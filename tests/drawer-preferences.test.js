import test from "node:test";
import assert from "node:assert/strict";
import { readDrawerWidth, saveDrawerWidth } from "../src/drawer-preferences.js";
test("missing or invalidated storage cannot break the drawer", async () => {
  for (const api of [
    {},
    { storage: {} },
    {
      storage: {
        local: {
          get() {
            throw new Error("Extension context invalidated");
          },
          set() {
            throw new Error("Extension context invalidated");
          },
        },
      },
    },
  ]) {
    assert.equal(await readDrawerWidth(api), 460);
    await saveDrawerWidth(700, api);
  }
});
test("available storage restores and saves the chosen width", async () => {
  let stored;
  const api = {
    storage: {
      local: {
        get: async () => ({ drawerWidth: 650 }),
        set: async (value) => {
          stored = value;
        },
      },
    },
  };
  assert.equal(await readDrawerWidth(api), 650);
  await saveDrawerWidth(700, api);
  assert.deepEqual(stored, { drawerWidth: 700 });
});
