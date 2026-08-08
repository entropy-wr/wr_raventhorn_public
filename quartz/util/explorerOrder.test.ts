import test from "node:test"
import assert from "node:assert"
import { compareExplorerOrder, getExplorerOrder } from "./explorerOrder"

test("reads finite numeric explorer order values", () => {
  assert.strictEqual(getExplorerOrder({ frontmatter: { order: 10 } }), 10)
  assert.strictEqual(getExplorerOrder({ frontmatter: { order: "10" } }), 10)
  assert.strictEqual(getExplorerOrder({ frontmatter: { order: " 10 " } }), 10)
  assert.strictEqual(getExplorerOrder({ frontmatter: { order: "not-a-number" } }), undefined)
  assert.strictEqual(getExplorerOrder({ frontmatter: { order: Number.NaN } }), undefined)
  assert.strictEqual(getExplorerOrder({}), undefined)
})

test("sorts higher explorer orders first", () => {
  const high = { frontmatter: { order: 10 } }
  const low = { frontmatter: { order: 1 } }
  const unset = { frontmatter: {} }

  assert.strictEqual(compareExplorerOrder(high, low), -9)
  assert.strictEqual(compareExplorerOrder(low, high), 9)
  assert.strictEqual(compareExplorerOrder(unset, low), 1)
  assert.strictEqual(compareExplorerOrder(unset, { frontmatter: {} }), 0)
})
