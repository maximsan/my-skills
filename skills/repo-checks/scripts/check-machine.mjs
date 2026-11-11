#!/usr/bin/env node
/**
 * Prints what the machine has for a run: free disk on the volume that holds
 * the current folder, and the load average against the processor cores.
 * Fails under the disk floor. Run it first in a repo's check command, and by
 * hand before a long build.
 *
 * Usage: node check-machine.mjs [--floor-gb 4] [--volume <path>]
 */
import { statfsSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
import { parseArgs } from "node:util";

import { exitCodeOf, runsAsScript } from "./shared.mjs";

export const GIGABYTE = 1024 ** 3;

/** Under this much free disk a run stops before it starts. */
export const DEFAULT_FLOOR_GB = 4;

/**
 * What the machine has, read once.
 * @param {{ volume?: string, floorGb?: number }} [options] `volume`: a path on the disk to measure, the current
 *   folder by default; `floorGb`: the free gigabytes under which a run stops
 * @returns {Machine} free disk, the disk floor, load and cores
 */
export function readMachine({ volume = process.cwd(), floorGb = DEFAULT_FLOOR_GB } = {}) {
  const stats = statfsSync(volume);
  const [oneMinuteLoad] = loadavg();

  return {
    freeDiskBytes: Number(stats.bavail) * Number(stats.bsize),
    floorBytes: floorGb * GIGABYTE,
    load: oneMinuteLoad,
    cores: availableParallelism(),
  };
}

/**
 * @typedef {object} Machine
 * @property {number} freeDiskBytes bytes free on the volume
 * @property {number} floorBytes free bytes under which a run stops
 * @property {number} load the one-minute load average: processes that wanted to run
 * @property {number} cores processor cores
 */

/**
 * Whether free disk is under the floor, so a run should not start.
 * @param {Machine} machine what the machine has
 * @returns {boolean} true when free disk is under the floor
 */
export function diskIsShort(machine) {
  return machine.freeDiskBytes < machine.floorBytes;
}

/**
 * More processes wanting to run than cores: a test can then run out of time
 * while other work holds the processor.
 * @param {Machine} machine what the machine has
 * @returns {boolean} true when the load average is above the core count
 */
export function isOverloaded(machine) {
  return machine.load > machine.cores;
}

/**
 * Why a failed test in this run may not be a defect.
 * @param {Machine} machine what the machine has
 * @returns {string} the warning, naming the load and the core count
 */
export function loadWarning(machine) {
  return (
    `load ${machine.load.toFixed(1)} on ${machine.cores} cores: a failed test `
    + "may have run out of time because other work held the processor. Rerun it "
    + "alone before reading it as a defect"
  );
}

/**
 * One line: ✗ under the disk floor, ! with more load than cores, else ✓.
 * @param {Machine} machine what the machine has
 * @returns {string} the line to print
 */
export function report(machine) {
  const free = `${(machine.freeDiskBytes / GIGABYTE).toFixed(1)} GB`;

  if (diskIsShort(machine)) {
    const floor = machine.floorBytes / GIGABYTE;

    return `✗ machine: ${free} free, under the ${floor} GB floor: `
      + "free some disk first (the disk-audit skill finds what can go)";
  }

  if (isOverloaded(machine)) {
    return `! machine: ${free} free, ${loadWarning(machine)}`;
  }

  return `✓ machine: ${free} free, load ${machine.load.toFixed(1)} on ${machine.cores} cores`;
}

/**
 * Prints the machine's report and says whether the run may go on.
 * @param {string[]} argv the command-line arguments after the script's path
 * @returns {number} the exit code: 1 under the disk floor, else 0
 */
export function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "floor-gb": { type: "string", default: String(DEFAULT_FLOOR_GB) },
      volume: { type: "string", default: process.cwd() },
    },
  });
  const machine = readMachine({
    volume: values.volume,
    floorGb: Number(values["floor-gb"]),
  });

  console.log(report(machine));

  return diskIsShort(machine) ? 1 : 0;
}

const [, , ...scriptArgs] = process.argv;

if (runsAsScript(import.meta.url)) {
  process.exitCode = exitCodeOf(() => main(scriptArgs));
}
