import assert from "node:assert/strict";
import test from "node:test";

import { decodeBasicAuthorization, matchesBasicAuthorizationHeader } from "./admin-auth";

test("decodeBasicAuthorization parses a valid basic auth header", () => {
  const header = `Basic ${Buffer.from("relay:secret-pass").toString("base64")}`;

  assert.deepEqual(decodeBasicAuthorization(header), {
    username: "relay",
    password: "secret-pass",
  });
});

test("decodeBasicAuthorization rejects malformed basic auth headers", () => {
  assert.equal(decodeBasicAuthorization(undefined), null);
  assert.equal(decodeBasicAuthorization("Bearer token"), null);
  assert.equal(decodeBasicAuthorization("Basic"), null);
  assert.equal(decodeBasicAuthorization("Basic broken"), null);
  assert.equal(
    decodeBasicAuthorization(`Basic ${Buffer.from("missing-separator").toString("base64")}`),
    null,
  );
});

test("matchesBasicAuthorizationHeader compares both username and password", () => {
  const validHeader = `Basic ${Buffer.from("relay:secret-pass").toString("base64")}`;
  const wrongPasswordHeader = `Basic ${Buffer.from("relay:not-it").toString("base64")}`;
  const wrongUsernameHeader = `Basic ${Buffer.from("other:secret-pass").toString("base64")}`;

  assert.equal(matchesBasicAuthorizationHeader(validHeader, "relay", "secret-pass"), true);
  assert.equal(matchesBasicAuthorizationHeader(wrongPasswordHeader, "relay", "secret-pass"), false);
  assert.equal(matchesBasicAuthorizationHeader(wrongUsernameHeader, "relay", "secret-pass"), false);
});
