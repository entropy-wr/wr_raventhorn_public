export const TIMELINE_DAY = 24 * 60 * 60 * 1000

export type TimelineConfig = {
  calendar: {
    start: string
    end: string
  }
  initialWindow: {
    start: string
    end: string
  }
  maxOverlapForRed: number
}

export type TimelineScene = {
  id: string
  slug: string
  name: string
  start: string
  duration: string
  startMs: number
  endMs: number
  active: boolean
  characters: string[]
}

export type TimelineData = {
  config: TimelineConfig
  scenes: TimelineScene[]
}

/** Parse an ISO-like calendar value without Date's special handling of years 0-99. */
export function parseTimelineDate(value: unknown): number | undefined {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : undefined
  }

  if (typeof value !== "string") return undefined

  const match = value
    .trim()
    .match(
      /^(\d{1,6})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/,
    )
  if (!match) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText] = match
  const date = new Date(0)
  date.setUTCFullYear(Number(yearText), Number(monthText) - 1, Number(dayText))
  date.setUTCHours(
    Number(hourText ?? 0),
    Number(minuteText ?? 0),
    Number(secondText ?? 0),
    Number((millisecondText ?? "0").padEnd(3, "0")),
  )

  if (
    date.getUTCFullYear() !== Number(yearText) ||
    date.getUTCMonth() !== Number(monthText) - 1 ||
    date.getUTCDate() !== Number(dayText)
  ) {
    return undefined
  }

  return date.getTime()
}

export function parseTimelineDuration(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value * TIMELINE_DAY : undefined
  }
  if (typeof value !== "string") return undefined

  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined

  const iso = normalized.match(/^p(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)w)?$/)
  if (iso) {
    const days = Number(iso[1] ?? 0) + Number(iso[2] ?? 0) * 7
    return days > 0 ? days * TIMELINE_DAY : undefined
  }

  const match = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(milliseconds?|ms|seconds?|s|minutes?|m|hours?|h|days?|d|weeks?|w)$/,
  )
  if (!match) return undefined

  const amount = Number(match[1])
  const unit = match[2]
  const multiplier = unit.startsWith("ms")
    ? 1
    : unit.startsWith("s")
      ? 1000
      : unit.startsWith("m")
        ? 60 * 1000
        : unit.startsWith("h")
          ? 60 * 60 * 1000
          : unit.startsWith("w")
            ? 7 * TIMELINE_DAY
            : TIMELINE_DAY

  return amount > 0 ? amount * multiplier : undefined
}

export function overlapColor(overlap: number, maximumOverlap: number, configuredRedAt = 5): string {
  const redAt = Math.max(configuredRedAt, maximumOverlap, 2)
  const progress = Math.max(0, Math.min(1, (overlap - 1) / (redAt - 1)))
  const stops: [number, [number, number, number]][] = [
    [0, [139, 92, 246]],
    [0.25, [37, 99, 235]],
    [0.5, [234, 179, 8]],
    [0.75, [249, 115, 22]],
    [1, [220, 38, 38]],
  ]

  for (let index = 1; index < stops.length; index++) {
    const [stop, color] = stops[index]
    const [previousStop, previousColor] = stops[index - 1]
    if (progress <= stop) {
      const amount = (progress - previousStop) / (stop - previousStop)
      const channels = color.map((channel, channelIndex) =>
        Math.round(previousColor[channelIndex] + (channel - previousColor[channelIndex]) * amount),
      )
      return `rgb(${channels.join(", ")})`
    }
  }

  return "rgb(220, 38, 38)"
}
