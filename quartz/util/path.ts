// Re-export shared path utilities from @quartz-community/utils
export {
  isFilePath,
  isFullSlug,
  isSimpleSlug,
  isRelativeURL,
  isAbsoluteURL,
  getFullSlug,
  slugifyFilePath,
  simplifySlug,
  joinSegments,
  endsWith,
  trimSuffix,
  stripSlashes,
  getFileExtension,
  isFolderPath,
  getAllSegmentPrefixes,
  pathToRoot,
  resolveRelative,
  splitAnchor,
  slugTag,
  transformInternalLink,
  transformLink,
  normalizeHastElement,
} from "@quartz-community/utils"

export type {
  FilePath,
  FullSlug,
  SimpleSlug,
  RelativeURL,
  TransformOptions,
} from "@quartz-community/utils"

// --- v5-specific exports below ---

export const QUARTZ = "quartz"

/**
 * Extract the deployment subpath (e.g. "/wr_raventhorn_public") from a base URL.
 *
 * `cfg.baseUrl` may be either a full URL ("https://host/path/") or host-only
 * ("host/path/"). Previously this was consumed as `new URL(\`https://${baseUrl}\`)`,
 * which silently mangles a value that already includes a protocol (the host
 * becomes part of the pathname, e.g. "//host/path"). That broke consumers like
 * the graph view's `data-basepath`, which could no longer strip the prefix from
 * the current page slug — so the local graph rendered with no connections when
 * the site was deployed under a subpath.
 */
export function basePathFromBaseUrl(baseUrl: string | undefined | null): string {
  if (!baseUrl) return ""
  const withProto = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`
  return new URL(withProto).pathname.replace(/\/$/, "")
}

// from micromorph/src/utils.ts
// https://github.com/natemoo-re/micromorph/blob/main/src/utils.ts#L5
const _rebaseHtmlElement = (el: Element, attr: string, newBase: string | URL) => {
  const rebased = new URL(el.getAttribute(attr)!, newBase)
  el.setAttribute(attr, rebased.pathname + rebased.hash)
}
export function normalizeRelativeURLs(el: Element | Document, destination: string | URL) {
  el.querySelectorAll('[href=""], [href^="./"], [href^="../"]').forEach((item) => {
    _rebaseHtmlElement(item, "href", destination)
  })
  el.querySelectorAll('[src=""], [src^="./"], [src^="../"]').forEach((item) => {
    _rebaseHtmlElement(item, "src", destination)
  })
}
