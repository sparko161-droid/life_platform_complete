import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTRACT_VERSION } from "@life/domain-types";
import { InvalidSemVerError, compareSemVer, formatSemVer, isCompatible, parseSemVer } from "../src/semver.js";

test("parseSemVer: parses a well-formed version", () => {
  assert.deepEqual(parseSemVer("1.2.3"), { major: 1, minor: 2, patch: 3 });
});

test("parseSemVer: rejects a malformed version", () => {
  assert.throws(() => parseSemVer("1.2"), InvalidSemVerError);
  assert.throws(() => parseSemVer("1.2.3-beta"), InvalidSemVerError);
  assert.throws(() => parseSemVer("v1.2.3"), InvalidSemVerError);
});

test("formatSemVer: round-trips parseSemVer", () => {
  assert.equal(formatSemVer(parseSemVer("0.2.0")), "0.2.0");
});

test("compareSemVer: orders by major, then minor, then patch", () => {
  assert.equal(compareSemVer(parseSemVer("1.0.0"), parseSemVer("2.0.0")), -1);
  assert.equal(compareSemVer(parseSemVer("1.1.0"), parseSemVer("1.0.9")), 1);
  assert.equal(compareSemVer(parseSemVer("1.0.1"), parseSemVer("1.0.2")), -1);
  assert.equal(compareSemVer(parseSemVer("1.2.3"), parseSemVer("1.2.3")), 0);
});

test("isCompatible: same version is compatible", () => {
  assert.equal(isCompatible("0.2.0", "0.2.0"), true);
});

test("isCompatible: a producer ahead on minor/patch is compatible", () => {
  assert.equal(isCompatible("0.2.0", "0.3.0"), true);
  assert.equal(isCompatible("0.2.0", "0.2.5"), true);
});

test("isCompatible: a producer behind the consumer is NOT compatible", () => {
  assert.equal(isCompatible("0.3.0", "0.2.0"), false);
});

test("isCompatible: a major mismatch is NOT compatible regardless of direction", () => {
  assert.equal(isCompatible("1.0.0", "2.0.0"), false);
  assert.equal(isCompatible("2.0.0", "1.9.9"), false);
});

test("regression: the real CONTRACT_VERSION is a valid, self-compatible semver", () => {
  assert.doesNotThrow(() => parseSemVer(CONTRACT_VERSION));
  assert.equal(isCompatible(CONTRACT_VERSION, CONTRACT_VERSION), true);
});
