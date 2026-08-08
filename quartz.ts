import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

import * as ExternalPlugin from "./.quartz/plugins"
import type { ExplorerOptions } from "./.quartz/plugins"

const sortFn: ExplorerOptions["sortFn"] = (a, b) => {
  const aValue = a.data?.order
  const bValue = b.data?.order
  const aParsed = typeof aValue === "number" || typeof aValue === "string" ? Number(aValue) : 0
  const bParsed = typeof bValue === "number" || typeof bValue === "string" ? Number(bValue) : 0
  const aOrder = Number.isFinite(aParsed) ? aParsed : 0
  const bOrder = Number.isFinite(bParsed) ? bParsed : 0

  if (!a.isFolder && !b.isFolder) {
    if (aOrder !== bOrder) return bOrder - aOrder
  }

  if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
    return (a.displayName || "").localeCompare(b.displayName || "", undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }

  return a.isFolder ? -1 : 1
}

ExternalPlugin.Explorer({
  sortFn,
})

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
