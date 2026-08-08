export const EXPLORER_ORDER_PROPERTY = "order"

type FrontmatterData = {
  frontmatter?: unknown
}

export function getExplorerOrder(data: FrontmatterData): number | undefined {
  const frontmatter = data.frontmatter
  if (!frontmatter || typeof frontmatter !== "object") return undefined

  const value = (frontmatter as Record<string, unknown>)[EXPLORER_ORDER_PROPERTY]
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function compareExplorerOrder(first: FrontmatterData, second: FrontmatterData): number {
  return (getExplorerOrder(second) ?? 0) - (getExplorerOrder(first) ?? 0)
}
