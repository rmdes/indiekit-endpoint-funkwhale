import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateLegacyDates, syncListenings } from "../lib/sync.js";

// Minimal stand-in for a MongoDB collection: records calls in order.
function fakeCollection() {
  const calls = [];
  return {
    calls,
    createIndex: async () => {},
    updateMany: async (filter, update) => {
      calls.push({ op: "updateMany", filter, update });
      return { modifiedCount: 0 };
    },
    findOne: async () => {
      calls.push({ op: "findOne" });
      return { listenedAt: "2026-10-10T16:07:35.393Z" };
    },
    updateOne: async () => {},
  };
}

test("migrateLegacyDates converts Date-typed listenedAt and syncedAt to ISO strings", async () => {
  const collection = fakeCollection();
  await migrateLegacyDates(collection);

  const fields = collection.calls.map((c) => Object.keys(c.filter)[0]);
  assert.deepEqual(fields.sort(), ["listenedAt", "syncedAt"]);
  for (const { filter, update } of collection.calls) {
    const [field] = Object.keys(filter);
    assert.deepEqual(filter[field], { $type: "date" });
    // Same format as Date#toISOString(), so legacy and new values sort together
    assert.deepEqual(update, [
      { $set: { [field]: { $dateToString: { date: `$${field}`, format: "%Y-%m-%dT%H:%M:%S.%LZ" } } } },
    ]);
  }
});

test("syncListenings migrates legacy dates before looking up the latest listening", async () => {
  const collection = fakeCollection();
  const db = { collection: () => collection };
  let since;
  const client = { getNewListenings: async (date) => { since = date; return []; } };

  await syncListenings(db, client);

  const firstFindOne = collection.calls.findIndex((c) => c.op === "findOne");
  const migrations = collection.calls.filter((c) => c.op === "updateMany").length;
  assert.equal(migrations, 2);
  assert.ok(collection.calls.slice(0, firstFindOne).every((c) => c.op === "updateMany"));
  assert.equal(since.toISOString(), "2026-10-10T16:07:35.393Z");
});
