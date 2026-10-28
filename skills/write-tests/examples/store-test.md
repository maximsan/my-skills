# Example: a store test

Read with Step 1 of [SKILL.md](../SKILL.md), for a store's test. It tests the made-up `web-shop` files in `create`'s
examples. It shows the **shape**. The store is in [store.md](../../create/examples/store.md).

---

`src/stores/__tests__/checkoutStore.test.ts`

```ts
import { initialState, useCheckoutStore } from "@/stores/checkoutStore"

const { actions } = useCheckoutStore.getState()

beforeEach(() => {
  useCheckoutStore.setState(initialState)
})

describe("checkoutStore", () => {
  it("starts on the payment step with no card chosen", () => {
    expect(useCheckoutStore.getState()).toMatchObject({ step: "payment", selectedCardId: null })
  })

  it("keeps the chosen card on the way to the review step", () => {
    actions.selectCard("c-1")
    actions.goToReview()

    expect(useCheckoutStore.getState()).toMatchObject({ step: "review", selectedCardId: "c-1" })
  })

  it("forgets the choice after a reset", () => {
    actions.selectCard("c-1")

    actions.reset()

    expect(useCheckoutStore.getState()).toMatchObject(initialState)
  })
})
```

What to notice:
- A store needs no component to test: `getState()` runs the actions and reads the result directly.
- `setState(initialState)` before each test, because the store lives for the whole test file.
