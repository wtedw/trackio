import { describe, expect, test } from "vitest";
import { histogramHistory, histogramSnapshot, histogramBars } from "./histograms.js";

const histogram = (values, bins = [0, 1, 2]) => ({ _type: "trackio.histogram", bins, values });
const row = (step, value, series_key = "a") => ({ step, series_key, run: series_key, distribution: value });

describe("histogram history", () => {
  test("retains chronological history and the final update at a duplicate step", () => {
    const history = histogramHistory([
      row(20, histogram([2, 3])), row(10, histogram([1, 0])),
      row(20, histogram([4, 5], [-1, 0, 1])), row(10, histogram([6, 7]), "b"),
    ]).distribution;
    expect(history.map(({ key, step }) => [key, step])).toEqual([["a", 10], ["b", 10], ["a", 20]]);
    expect(history[2].values).toEqual([4, 5]);
    expect(history[2].bins).toEqual([-1, 0, 1]);
  });

  test("isolates metrics and ignores scalar or malformed entries", () => {
    const history = histogramHistory([{ ...row(1, histogram([1, 2])), other: histogram([3, 4]), scalar: 42 },
      row(2, { _type: "trackio.histogram", bins: [] })]);
    expect(Object.keys(history)).toEqual(["distribution", "other"]);
    expect(history.distribution).toHaveLength(1);
    expect(Object.keys(histogramHistory([]))).toEqual([]);
  });

  test("supports arbitrary metric names", () => {
    expect(histogramHistory([{ ...row(1, 0), constructor: histogram([1, 2]) }]).constructor).toHaveLength(1);
  });

  test("selects the latest measurement at or before the cursor for each run", () => {
    const history = histogramHistory([row(10, histogram([1, 2])), row(30, histogram([3, 4])), row(20, histogram([5, 6]), "b")]).distribution;
    expect(histogramSnapshot(history, 5)).toEqual([]);
    expect(histogramSnapshot(history, 15).map((item) => item.step)).toEqual([10]);
    expect(histogramSnapshot(history, 25).map((item) => item.step)).toEqual([10, 20]);
    expect(histogramSnapshot(history).map((item) => item.step)).toEqual([30, 20]);
  });

  test("export bars preserve every step and its own bin boundaries", () => {
    const history = histogramHistory([row(10, histogram([1, 2])), row(20, histogram([3], [5, 10]))]).distribution;
    expect(histogramBars(history).map(({ step, bin_start, bin_end, count }) => [step, bin_start, bin_end, count])).toEqual([
      [10, 0, 1, 1], [10, 1, 2, 2], [20, 5, 10, 3],
    ]);
    expect(histogramBars(histogramSnapshot(history))).toHaveLength(1);
  });
});
