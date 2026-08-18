import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTRACT_VERSION } from "@life/domain-types";
import { SURFACE_VERSION_STATUS, VERSIONED_SURFACES } from "../src/surfaces.js";

test("SURFACE_VERSION_STATUS: covers every VERSIONED_SURFACES entry exactly once", () => {
  const surfaces = SURFACE_VERSION_STATUS.map((s) => s.surface);
  assert.equal(surfaces.length, VERSIONED_SURFACES.length);
  assert.equal(new Set(surfaces).size, surfaces.length);
});

test("SURFACE_VERSION_STATUS: domain-contracts is tracked and matches the real CONTRACT_VERSION", () => {
  const entry = SURFACE_VERSION_STATUS.find((s) => s.surface === "domain-contracts");
  assert.ok(entry);
  assert.equal(entry!.trackedVersion, CONTRACT_VERSION);
});

test("SURFACE_VERSION_STATUS: every entry has a non-empty note explaining its status", () => {
  for (const entry of SURFACE_VERSION_STATUS) {
    assert.ok(entry.note.length > 0, `empty note for ${entry.surface}`);
  }
});
