# Example: a component test

Read with Step 1 of [SKILL.md](../SKILL.md), for a component's test. It tests the made-up `web-shop` files in `create`'s
examples. It shows the **shape**. The component is in [component.md](../../create/examples/component.md), and the hook
it calls in [hook.md](../../create/examples/hook.md).

---

`src/components/checkout/__tests__/SavedCardPicker.test.tsx`

The component's job is to render what its hook hands back. So the test fakes the app's own hook, the module edge,
and checks what the user sees.

```tsx
import { ApolloError } from "@apollo/client"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SavedCardPicker, type SavedCardPickerProps } from "@/components/checkout/SavedCardPicker"
import { useSavedCards } from "@/hooks/useSavedCards"

jest.mock("@/hooks/useSavedCards")

type SavedCardsResult = ReturnType<typeof useSavedCards>

const defaultProps = {
  customerId: "customer-7",
} satisfies SavedCardPickerProps

const hookReturns = (overrides: Partial<SavedCardsResult> = {}) => {
  const result = {
    cardOptions: [
      { id: "c-1", label: "Amex ending 3005" },
      { id: "c-2", label: "Visa ending 1881" },
    ],
    selectedCardId: null,
    selectCard: jest.fn(),
    isLoading: false,
    error: undefined,
    retry: jest.fn(),
    ...overrides,
  } satisfies SavedCardsResult

  jest.mocked(useSavedCards).mockReturnValue(result)

  return result
}

const setup = (props: Partial<SavedCardPickerProps> = {}) => {
  const user = userEvent.setup()

  render(<SavedCardPicker {...defaultProps} {...props} />)

  return { user }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("SavedCardPicker", () => {
  it("lists each saved card as an option", () => {
    hookReturns()

    setup()

    expect(screen.getByRole("radio", { name: "Amex ending 3005" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Visa ending 1881" })).toBeInTheDocument()
  })

  it("shows the card already chosen as checked", () => {
    hookReturns({ selectedCardId: "c-2" })

    setup()

    expect(screen.getByRole("radio", { name: "Visa ending 1881" })).toBeChecked()
  })

  it("passes the card the user picks to the hook", async () => {
    const { selectCard } = hookReturns()
    const { user } = setup()

    await user.click(screen.getByRole("radio", { name: "Amex ending 3005" }))

    expect(selectCard).toHaveBeenCalledWith("c-1")
  })

  it("asks for a card when there are none", () => {
    hookReturns({ cardOptions: [] })

    setup()

    expect(screen.getByText("Add a card to pay faster next time.")).toBeInTheDocument()
  })

  it("shows that the cards are loading", () => {
    hookReturns({ isLoading: true })

    setup()

    expect(screen.getByRole("status")).toHaveTextContent("Loading your cards…")
  })

  it("offers a retry when the cards can't load", async () => {
    const { retry } = hookReturns({ error: new ApolloError({ errorMessage: "network" }) })
    const { user } = setup()

    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(retry).toHaveBeenCalledTimes(1)
  })
})
```

What to notice:
- `hookReturns()` gives each test the full result, so a test names only what it changes.
- `satisfies` checks the fake result against the hook's real return type. When the hook gains a field, the test
  stops compiling instead of passing with a stale fake.
- Two tests check a call: `selectCard` and `retry`. Here, calling them is all the component does with a click. The
  hook test checks what the call leads to.
- No test checks a class or a test id. Each finds the element the way a user does.

## Browser stubs

A component that needs a browser feature jsdom lacks, such as `ResizeObserver` or `scrollIntoView`, gets it from
the app's Jest setup file, stubbed once for every test. Look there first. Add the stub there, not in one test's
`beforeEach`, so the next test file doesn't need its own copy.
