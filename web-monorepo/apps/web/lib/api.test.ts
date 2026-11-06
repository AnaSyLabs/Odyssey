import assert from "node:assert/strict";
import test from "node:test";
import { fail, route } from "./api.ts";

test("fail answers { error } with the status and extra headers", async () => {
  const res = fail(401, "nope", { headers: { "www-authenticate": "Bearer" } });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("www-authenticate"), "Bearer");
  assert.deepEqual(await res.json(), { error: "nope" });
});

test("route passes responses through and turns throws into a JSON 500", async () => {
  const ok = route(async (n: number) => Response.json({ n }));
  assert.deepEqual(await (await ok(2)).json(), { n: 2 });

  const log = console.error;
  console.error = () => {};
  try {
    const res = await route(async () => { throw new Error("Missing env SECRET"); })();
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /went wrong/);
    assert.doesNotMatch(body.error, /SECRET/); // internals stay in the log
  } finally {
    console.error = log;
  }
});
