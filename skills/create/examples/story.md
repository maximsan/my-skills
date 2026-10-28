# Example: a story

Read with Step 1 of [SKILL.md](../SKILL.md), for a new Storybook story. Written for a made-up `web-shop` app, to the
React, TypeScript and microfrontend rules. It shows the **shape**. It's the story of the component in
[component.md](component.md).

- **The example decides:** one story per state the component can show, and MSW handlers taken from the app's shared
  handlers file.
- **The app's model file decides:** where the handlers live, the providers a decorator wraps, and the viewports and
  locales the app's stories use.

---

`src/components/checkout/SavedCardPicker.stories.tsx`

In Storybook the component runs for real, hook and Apollo included, so the network is faked with MSW. That's the
one place MSW is used: tests fake the hooks instead.

```tsx
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite"
import { INITIAL_VIEWPORTS } from "storybook/viewport"
import { SavedCardPicker } from "./SavedCardPicker"
import {
  savedCardsHandler,
  emptySavedCardsHandler,
  failingSavedCardsHandler,
} from "@/mocks/handlers/savedCards"
import { ShopProvider } from "@/context/shop"

const meta = {
  title: "Components/Checkout/SavedCardPicker",
  component: SavedCardPicker,
  args: {
    customerId: "customer-7",
  },
  parameters: {
    msw: { handlers: [savedCardsHandler] },
  },
} satisfies Meta<typeof SavedCardPicker>

export default meta
type Story = StoryObj<typeof SavedCardPicker>

const mobile = {
  viewport: { viewports: INITIAL_VIEWPORTS, defaultViewport: "iphone14" },
}

export const Desktop: Story = {}

export const Mobile: Story = {
  parameters: mobile,
}

export const EmptyWallet: Story = {
  parameters: {
    msw: { handlers: [emptySavedCardsHandler] },
  },
}

export const LoadFailed: Story = {
  parameters: {
    msw: { handlers: [failingSavedCardsHandler] },
  },
}

const expressCheckoutDecorator: Decorator = (Story) => (
  <ShopProvider value={{ featureSwitches: { FS_EXPRESS_CHECKOUT: true } }}>
    <Story />
  </ShopProvider>
)

export const ExpressCheckout: Story = {
  decorators: [expressCheckoutDecorator],
}

export const EmptyWalletFrenchMobile: Story = {
  globals: { locale: "fr-CA" },
  parameters: {
    ...mobile,
    msw: { handlers: [emptySavedCardsHandler] },
  },
}
```

What to notice:
- One story per state the component can show: the list, an empty wallet, a failed load. A reviewer sees each one
  without faking anything by hand.
- The handlers come from the app's shared MSW handlers file, never written inside a story.
- The mobile viewport is named once and reused, so changing the device means changing one line.
- A decorator wraps only the stories that need a different context, such as a feature switch.
