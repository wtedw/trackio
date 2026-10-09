// Keep one value per metric/run/step, without dropping earlier steps.
export function histogramHistory(records) {
  const entries = new Map();
  for (const record of records) {
    for (const [metric, value] of Object.entries(record)) {
      if (value?._type !== "trackio.histogram" || !Array.isArray(value.bins) || value.bins.length < 2) continue;
      const step = record.step ?? 0;
      entries.set(JSON.stringify([metric, record.series_key, step]), {
        metric, key: record.series_key, label: record.run, step,
        bins: value.bins, values: value.values ?? [],
      });
    }
  }
  const result = Object.create(null);
  for (const item of entries.values()) (result[item.metric] ??= []).push(item);
  for (const items of Object.values(result)) items.sort((a, b) => a.step - b.step);
  return result;
}

// Runs may log at different intervals. Show their latest measurement at or
// before the cursor; never borrow a future measurement from another run.
export function histogramSnapshot(items, step = Infinity) {
  const latest = new Map();
  for (const item of items) {
    if (item.step > step) continue;
    if (!latest.has(item.key) || item.step >= latest.get(item.key).step) latest.set(item.key, item);
  }
  return [...latest.values()];
}

export function histogramBars(items) {
  return items.flatMap((item) => {
    const n = Math.min(item.bins.length - 1, item.values.length);
    return Array.from({ length: Math.max(0, n) }, (_, i) => ({
      bin_start: item.bins[i], bin_end: item.bins[i + 1], count: item.values[i],
      key: item.key, label: item.label || item.key, step: item.step,
    }));
  });
}
