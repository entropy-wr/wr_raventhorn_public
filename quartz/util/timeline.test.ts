import assert from "node:assert/strict"
import test from "node:test"
import { overlapColor, parseTimelineDate, parseTimelineDuration, TIMELINE_DAY } from "./timeline"

test("parses dates from the story calendar", () => {
  const start = parseTimelineDate("7452-09-01")
  const nextDay = parseTimelineDate("7452-09-02")

  assert.ok(start !== undefined)
  assert.equal(nextDay! - start!, TIMELINE_DAY)
})

test("parses common scene durations", () => {
  assert.equal(parseTimelineDuration("12h"), 12 * 60 * 60 * 1000)
  assert.equal(parseTimelineDuration("2 weeks"), 14 * TIMELINE_DAY)
  assert.equal(parseTimelineDuration("P2W"), 14 * TIMELINE_DAY)
  assert.equal(parseTimelineDuration(3), 3 * TIMELINE_DAY)
})

test("moves from purple to red using the configured overlap range", () => {
  assert.equal(overlapColor(1, 1), "rgb(139, 92, 246)")
  assert.equal(overlapColor(5, 5), "rgb(220, 38, 38)")
  assert.equal(overlapColor(8, 8), "rgb(220, 38, 38)")
  assert.notEqual(overlapColor(3, 8), overlapColor(1, 8))
})
