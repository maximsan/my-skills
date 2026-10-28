# Example: a component

Read with Step 1 of [SKILL.md](../SKILL.md), for a new component. Written for a made-up `web-shop` app, to the React,
TypeScript and microfrontend rules. It shows the **shape**.

- **The example decides:** a component renders, and a hook holds the behavior. The props type is exported next to the
  component. Loading, error and empty states all render something.
- **The app's model file decides:** folder and file names, the `@/` alias, and the i18n import, e.g. a wrapper around
  react-i18next.

The hook it calls is in [hook.md](hook.md). A new component usually gets a story too: [story.md](story.md).

---

`src/components/checkout/SavedCardPicker.tsx`

```tsx
import { useTranslation } from "react-i18next"
import { useSavedCards } from "@/hooks/useSavedCards"

export type SavedCardPickerProps = {
  customerId: string
}

export const SavedCardPicker = ({ customerId }: SavedCardPickerProps) => {
  const { t } = useTranslation(["webShop"])
  const { cardOptions, selectedCardId, selectCard, isLoading, error, retry } = useSavedCards(customerId)

  if (isLoading) {
    return <p role="status">{t("savedCards.loading")}</p>
  }

  if (error) {
    return (
      <div role="alert">
        <p>{t("savedCards.loadFailed")}</p>
        <button type="button" onClick={retry}>
          {t("savedCards.retry")}
        </button>
      </div>
    )
  }

  if (cardOptions.length === 0) {
    return <p>{t("savedCards.empty")}</p>
  }

  return (
    <fieldset className="web-shop-saved-cards">
      <legend>{t("savedCards.legend")}</legend>
      {cardOptions.map((option) => (
        <label key={option.id}>
          <input
            type="radio"
            name="saved-card"
            checked={option.id === selectedCardId}
            onChange={() => selectCard(option.id)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
```

What to notice:
- The data and the change handler come from a hook. The component only renders them.
- Each state the fetch can be in renders something: loading, error with a retry, empty, and the list.
- The text goes through the app's own i18n namespace. The class carries the app's prefix.
