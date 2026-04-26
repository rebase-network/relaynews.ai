import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRelayModelStatusTrend7d,
  computeHealthStatusFromAvailability,
} from "./relay-model-health";

test("computeHealthStatusFromAvailability returns unknown without samples", () => {
  assert.equal(computeHealthStatusFromAvailability(null, 0), "unknown");
  assert.equal(computeHealthStatusFromAvailability(1, 0), "unknown");
});

test("computeHealthStatusFromAvailability uses relay monitoring thresholds", () => {
  assert.equal(computeHealthStatusFromAvailability(1, 6), "healthy");
  assert.equal(computeHealthStatusFromAvailability(0.98, 6), "healthy");
  assert.equal(computeHealthStatusFromAvailability(0.5, 6), "degraded");
  assert.equal(computeHealthStatusFromAvailability(0, 6), "down");
});

test("buildRelayModelStatusTrend7d fills missing days as unknown", () => {
  const trend = buildRelayModelStatusTrend7d({
    measuredAt: "2026-04-15T10:00:00.000Z",
    rows: [
      {
        dateKey: "2026-04-10",
        availability: 1,
        sampleCount: 12,
      },
      {
        dateKey: "2026-04-12",
        availability: 0.5,
        sampleCount: 4,
      },
      {
        dateKey: "2026-04-15",
        availability: 0,
        sampleCount: 2,
      },
    ],
  });

  assert.deepEqual(trend, [
    { dateKey: "2026-04-09", status: "unknown", availability: null },
    { dateKey: "2026-04-10", status: "healthy", availability: 1 },
    { dateKey: "2026-04-11", status: "unknown", availability: null },
    { dateKey: "2026-04-12", status: "degraded", availability: 0.5 },
    { dateKey: "2026-04-13", status: "unknown", availability: null },
    { dateKey: "2026-04-14", status: "unknown", availability: null },
    { dateKey: "2026-04-15", status: "down", availability: 0 },
  ]);
});
