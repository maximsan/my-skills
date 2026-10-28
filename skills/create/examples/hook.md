# Example: a hook that fetches

Read with Step 1 of [SKILL.md](../SKILL.md), for a new hook that fetches. Written for a made-up `web-shop` app, to the
React, TypeScript and microfrontend rules. It shows the **shape**.

- **The example decides:** the hook hands back what the component needs, never Apollo's result.
- **The app's model file decides:** where the `.gql` files and the generated types live, and `useQuery` or
  `useLazyQuery`, with its options.

The store it reads is in [store.md](store.md).

---

`src/hooks/useSavedCards.ts`

```ts
import { useMemo } from "react"
import { useQuery } from "@apollo/client"
import { useTranslation } from "react-i18next"
import type { GetSavedCardsQuery, GetSavedCardsQueryVariables } from "@/graphql/generated"
import { GET_SAVED_CARDS } from "@/graphql/queries/savedCards.gql"
import { useCheckoutStore, useCheckoutStoreActions } from "@/stores/checkoutStore"

export type SavedCardOption = {
  id: string
  label: string
}

export const useSavedCards = (customerId: string) => {
  const { t } = useTranslation(["webShop"])
  const selectedCardId = useCheckoutStore((state) => state.selectedCardId)
  const { selectCard } = useCheckoutStoreActions()

  const { data, loading, error, refetch } = useQuery<GetSavedCardsQuery, GetSavedCardsQueryVariables>(
    GET_SAVED_CARDS,
    { variables: { customerId } },
  )

  const cardOptions = useMemo<SavedCardOption[]>(
    () =>
      // null for a new account, [] for an emptied wallet: both mean "no cards" here.
      (data?.savedCards ?? [])
        .map((card) => ({ id: card.id, label: t("savedCards.card", { brand: card.brand, last4: card.last4 }) }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [data, t],
  )

  return {
    cardOptions,
    selectedCardId,
    selectCard,
    isLoading: loading,
    error,
    retry: () => {
      void refetch()
    },
  }
}
```

What to notice:
- The query and its types come from the app's `.gql` file and generated types, never written by hand here.
- It hands back what the component needs: ready-made options, the choice, and what to call. The component never
  sees Apollo's result.
- It reads the store through a selector and the actions hook, so it re-renders only when `selectedCardId` changes.
- No `console.log` in `onError`, and no `as` on the data: Apollo's `error` already reaches the component.
