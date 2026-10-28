# Example: a store

Read with Step 1 of [SKILL.md](../SKILL.md), for a new store. Written for a made-up `web-shop` app, to the React,
TypeScript and microfrontend rules. It shows the **shape**.

- **The example decides:** state and actions typed apart, the actions in one object, and `initialState` exported.
- **The app's model file decides:** the store's middleware.

---

`src/stores/checkoutStore.ts`

```ts
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

type CheckoutState = {
  selectedCardId: string | null
  step: "payment" | "review"
}

type CheckoutActions = {
  actions: {
    selectCard: (cardId: string) => void
    goToReview: () => void
    reset: () => void
  }
}

export type CheckoutStore = CheckoutState & CheckoutActions

export const initialState: CheckoutState = {
  selectedCardId: null,
  step: "payment",
}

export const useCheckoutStore = create<CheckoutStore>()(
  devtools(
    immer((set) => ({
      ...initialState,
      actions: {
        selectCard: (selectedCardId) => set({ selectedCardId }, undefined, "Checkout:selectCard"),
        goToReview: () => set({ step: "review" }, undefined, "Checkout:goToReview"),
        reset: () => set(initialState, undefined, "Checkout:reset"),
      },
    })),
    { name: "Checkout", enabled: true },
  ),
)

export const useCheckoutStoreActions = () => useCheckoutStore((state) => state.actions)

/** For code outside React that needs the value once, e.g. an analytics listener. It doesn't subscribe. */
export const getSelectedCardId = () => useCheckoutStore.getState().selectedCardId
```

What to notice:
- UI state only. The saved cards are server data, so they stay in Apollo's cache and never get copied here.
- `step` is a union of the real steps, not a `string`.
- Every `set` is named, `"Checkout:selectCard"`, so the devtools show which action changed what.
- The actions sit in one object that never changes, so `useCheckoutStoreActions()` never causes a re-render.

## Reading a store: a selector, or `getState()`

| Where the code runs | Use | Why |
|---|---|---|
| A component, or a hook a component calls, that shows the value | `useCheckoutStore((state) => state.selectedCardId)` | It subscribes: the component re-renders when the value changes |
| An event handler that needs the latest value when it runs | `useCheckoutStore.getState().selectedCardId`, or the store's `get…()` helper | It reads the value at that moment, so a handler made earlier never sees a stale one |
| Code outside React: an event listener, analytics, a plain function | `getSelectedCardId()` | Hooks can't run there |
| A test, to arrange or check the store | `useCheckoutStore.setState(...)` and `.getState()` | It sets and reads the store directly, with no component |

**Never call `getState()` to read a value a component shows.** It doesn't subscribe, so the screen keeps the old
value after the store changes.
