import path from "path"
import timelineConfig from "../../../timeline.config.json"
import { FilePath, FullSlug } from "../../util/path"
import {
  parseTimelineDate,
  parseTimelineDuration,
  TimelineConfig,
  TimelineData,
} from "../../util/timeline"
import { BuildCtx } from "../../util/ctx"
import { QuartzEmitterPlugin } from "../types"
import { ProcessedContent } from "../vfile"
import { write } from "./helpers"

const config = timelineConfig as TimelineConfig
const START_KEYS = ["timeline-start", "scene-start", "timelineStart", "sceneStart"]
const DURATION_KEYS = ["timeline-duration", "scene-duration", "timelineDuration", "sceneDuration"]
const ACTIVE_KEYS = ["timeline-active", "scene-active", "timelineActive", "sceneActive"]
const CHARACTER_KEYS = [
  "timeline-characters",
  "scene-characters",
  "timelineCharacters",
  "sceneCharacters",
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function firstDefined(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asList)
  if (typeof value !== "string") return []

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) =>
      item
        .replace(/^\[\[|\]\]$/g, "")
        .split("|")[0]
        .split("#")[0]
        .trim(),
    )
    .filter(Boolean)
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return undefined
  if (["true", "yes", "active", "current", "активна", "активно"].includes(value.toLowerCase())) {
    return true
  }
  if (
    ["false", "no", "inactive", "previous", "completed", "завершена", "завершено"].includes(
      value.toLowerCase(),
    )
  ) {
    return false
  }
  return undefined
}

function tagsFrom(frontmatter: Record<string, unknown>): string[] {
  return asList(frontmatter.tags).map((tag) => tag.toLowerCase())
}

function charactersFromMarkdown(value: unknown): string[] {
  if (typeof value !== "string") return []
  const participants = value.match(/^\*\*Участники:\*\*\s*(.+)$/im)?.[1]
  return participants ? asList(participants.match(/\[\[[^\]]+\]\]/g) ?? participants) : []
}

function sceneFromContent(content: ProcessedContent): TimelineData["scenes"][number] | undefined {
  const [, file] = content
  const frontmatter = asRecord(file.data.frontmatter)
  const nested = asRecord(frontmatter.timeline ?? frontmatter.scene)
  const startValue =
    firstDefined(nested, ["start", "date"]) ?? firstDefined(frontmatter, [...START_KEYS, "start"])
  const durationValue =
    firstDefined(nested, ["duration"]) ?? firstDefined(frontmatter, [...DURATION_KEYS, "duration"])
  const endValue =
    firstDefined(nested, ["end"]) ?? firstDefined(frontmatter, ["timeline-end", "scene-end"])
  const startMs = parseTimelineDate(startValue)
  const durationMs = parseTimelineDuration(durationValue)
  const endMs = endValue !== undefined ? parseTimelineDate(endValue) : undefined
  const calculatedEnd =
    startMs !== undefined && durationMs !== undefined ? startMs + durationMs : endMs

  if (startMs === undefined || calculatedEnd === undefined || calculatedEnd <= startMs)
    return undefined

  const relativePath = String(file.data.relativePath ?? file.data.slug ?? "")
  const name = path.posix.basename(relativePath).replace(/\.md$/i, "")
  const tags = tagsFrom(frontmatter)
  const activeValue =
    firstDefined(nested, ["active", "status"]) ??
    firstDefined(frontmatter, [...ACTIVE_KEYS, "active"])
  const active =
    parseBoolean(activeValue) ??
    (tags.some((tag) => ["active", "current", "активна", "активно"].includes(tag))
      ? true
      : tags.some((tag) =>
            ["inactive", "previous", "completed", "завершена", "завершено"].includes(tag),
          )
        ? false
        : true)
  const characters = asList(
    firstDefined(nested, ["characters", "participants"]) ??
      firstDefined(frontmatter, [...CHARACTER_KEYS, "characters", "participants"]),
  )
  const resolvedCharacters = characters.length > 0 ? characters : charactersFromMarkdown(file.value)
  const start = String(startValue)
  const duration =
    durationValue === undefined ? `${(calculatedEnd - startMs) / 86400000}d` : String(durationValue)

  return {
    id: String(file.data.slug),
    slug: String(file.data.slug),
    name,
    start,
    duration,
    startMs,
    endMs: calculatedEnd,
    active,
    characters: [...new Set(resolvedCharacters)],
  }
}

async function emitTimeline(ctx: BuildCtx, content: ProcessedContent[]): Promise<FilePath> {
  const scenes = content
    .map(sceneFromContent)
    .filter((scene): scene is NonNullable<typeof scene> => !!scene)
  return write({
    ctx,
    slug: "static/timeline" as FullSlug,
    ext: ".json",
    content: JSON.stringify({ config, scenes } satisfies TimelineData),
  })
}

export const TimelineDataEmitter: QuartzEmitterPlugin = () => ({
  name: "TimelineData",
  async *emit(ctx, content) {
    yield await emitTimeline(ctx, content)
  },
  async *partialEmit(ctx, content, _resources, changeEvents) {
    if (!changeEvents.some((event) => event.path.endsWith(".md"))) return
    yield await emitTimeline(ctx, content)
  },
})
