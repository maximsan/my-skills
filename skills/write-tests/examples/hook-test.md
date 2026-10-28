# Example: a hook test

Read with Step 1 of [SKILL.md](../SKILL.md), for a hook's test. It tests the made-up `web-shop` files in `create`'s
examples. It shows the **shape**. The hook is in [hook.md](../../create/examples/hook.md), and the store it uses in
[store.md](../../create/examples/store.md).

---

`src/hooks/__tests__/useSavedCards.test.ts`

The hook's job is to turn Apollo's answer into options, and to pass a choice to the store. So the test fakes
Apollo's `useQuery`, the network's edge, and uses the real store.

```ts
import { useQuery } from "@apollo/client"
import { act, renderHook } from "@testing-library/react"
import { useSavedCards } from "@/hooks/useSavedCards"
import { initialState, useCheckoutStore } from "@/stores/checkoutStore"

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useQuery: jest.fn(),
}))

const answerWith = (savedCards: { id: string; brand: string; last4: string }[] | null) => {
  jest.mocked(useQuery).mockReturnValue({
    data: { savedCards },
    loading: false,
    error: undefined,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useQuery>)
}

const setup = () => renderHook(() => useSavedCards("customer-7")).result

beforeEach(() => {
  jest.clearAllMocks()
  useCheckoutStore.setState(initialState)
})

describe("useSavedCards", () => {
  it("offers the saved cards sorted by their label", () => {
    answerWith([
      { id: "c-2", brand: "Visa", last4: "1881" },
      { id: "c-1", brand: "Amex", last4: "3005" },
    ])

    const savedCards = setup()

    expect(savedCards.current.cardOptions.map((option) => option.label)).toEqual([
      "Amex ending 3005",
      "Visa ending 1881",
    ])
  })

  it("offers no cards to a new account, whose wallet is null", () => {
    answerWith(null)

    const savedCards = setup()

    expect(savedCards.current.cardOptions).toEqual([])
  })

  it("remembers the chosen card for the rest of checkout", () => {
    answerWith([{ id: "c-1", brand: "Amex", last4: "3005" }])
    const savedCards = setup()

    act(() => savedCards.current.selectCard("c-1"))

    expect(savedCards.current.selectedCardId).toBe("c-1")
    expect(useCheckoutStore.getState().selectedCardId).toBe("c-1")
  })
})
```

What to notice:
- `jest.requireActual` keeps the rest of `@apollo/client` real. Only `useQuery` is faked.
- The one `as unknown as` is in the helper, where the test builds Apollo's result by hand. No test repeats it.
- The store is real, and `setState(initialState)` puts it back before each test. The last test checks it with
  `getState()`, because no component reads it here.
