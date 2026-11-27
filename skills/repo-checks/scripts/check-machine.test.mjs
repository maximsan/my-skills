import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DEFAULT_FLOOR_GB,
  GIGABYTE,
  diskIsShort,
  isOverloaded,
  readMachine,
  report,
} from "./check-machine.mjs";

const floorBytes = DEFAULT_FLOOR_GB * GIGABYTE;

describe("readMachine", () => {
  test("reads this machine: some disk free, some cores, a load", () => {
    const machine = readMachine();

    assert.ok(machine.freeDiskBytes > 0);
    assert.ok(machine.cores > 0);
    assert.ok(machine.load >= 0);
    assert.equal(machine.floorBytes, floorBytes);
  });

  test("a floor in gigabytes becomes bytes", () => {
    assert.equal(readMachine({ floorGb: 1 }).floorBytes, GIGABYTE);
  });
});

describe("report", () => {
  test("a disk under the floor fails the run", () => {
    const machine = { freeDiskBytes: floorBytes - 1, floorBytes, load: 1, cores: 10 };

    assert.equal(diskIsShort(machine), true);
    assert.match(report(machine), /^✗ machine: 4\.0 GB free, under the 4 GB floor/);
  });

  // The load this Mac showed on 24 October 2026 while a suite ran beside it.
  test("more load than cores warns that a failed test may have run out of time", () => {
    const machine = { freeDiskBytes: floorBytes, floorBytes, load: 13.5, cores: 10 };

    assert.equal(diskIsShort(machine), false);
    assert.equal(isOverloaded(machine), true);
    assert.match(report(machine), /^! machine: 4\.0 GB free, load 13\.5 on 10 cores/);
  });

  test("a machine with free disk and low load passes", () => {
    const machine = { freeDiskBytes: floorBytes, floorBytes, load: 5.7, cores: 10 };

    assert.equal(report(machine), "✓ machine: 4.0 GB free, load 5.7 on 10 cores");
  });
});
