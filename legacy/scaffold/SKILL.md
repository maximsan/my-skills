> **LEGACY — do not use.**
> Replaced by the `create` skill: `skills/create/SKILL.md`.
> Kept only as a record of the original prompt for creating new code.
>
> Every requirement below carried over, but not into one place. What deliberately changed:
>
> - The four pasted code skeletons are gone. The new skill names one real **model file** in the repo you're working in and copies that, because a pasted template goes stale the moment the real pattern moves — and a template full of one app's imports is exactly what stopped this being reusable.
> - "Read the relevant existing files to match local patterns" became an output: a convention table where every row cites the `file:line` it was read from. The instruction below can't be checked; the table can.
> - The new skill adds a row for what else must be edited to make the new file reachable — the barrel export, the route, the locale key. That miss is the most common way creating a file goes wrong and nothing here asked about it.
> - The general TypeScript rules (`no any`, no nested ternaries, no namespace imports, no `console.log`, no lodash/moment) became eslint config instead of prose, per `rules/react.md`'s own test: a lint rule can't be skimmed past.
> - Everything naming this one app — the `app-` class prefix, `cn()`, `getTestId`, `useTranslation(["app"])`, `@app/*` imports, the Zustand devtools+immer shape — belongs in that app's `docs/ai/PATTERNS.md`. `useIsPrimaryMode` and other domain-specific names belong in its `GLOSSARY.md`.

---

---
name: scaffold
description: Create new components, hooks, stores, or utility functions following example codebase conventions
argument-hint: <what-to-create>
---

Create following example conventions: $ARGUMENTS

Before writing any code, read the relevant existing files near where the new code will live to match local patterns.

## Component Pattern

```typescript
import { cn } from "@/utils/cn"
import { getTestId } from "@/utils/tests"
import { useTranslation } from "@app/i18n"

const COMPONENT_NAME = "My Component"

export const TestId = {
  wrapper: getTestId(COMPONENT_NAME, "wrapper")
}

export type MyComponentProps = {
  title: string
  className?: string
}

const MyComponent = ({ title, className }: MyComponentProps) => {
  const { t } = useTranslation(["app"])

  return (
    <div
      className={cn("app-flex app-flex-col", className)}
      data-testid={TestId.wrapper}
    >
      {title}
    </div>
  )
}

MyComponent.displayName = COMPONENT_NAME.replace(/\s+/g, "")

export default MyComponent
```

**Rules:**
- `COMPONENT_NAME` is a readable string with spaces (e.g., `"Empty State Message"`)
- `displayName = COMPONENT_NAME.replace(/\s+/g, "")` — always at the bottom
- Export `Props` type before the component
- Export `TestId` object using `getTestId(COMPONENT_NAME, "elementName")`
- Pass `className` prop through `cn()` to allow consumer override
- All Tailwind classes use `app-` prefix
- Use `cn()` from `@/utils/cn` for conditional class merging
- Use `useTranslation(["app"])` — never hard-code user-visible strings
- Functional components only
- Co-locate tests in `__tests__/` next to the component

## Hook Pattern

```typescript
import { useExperience } from "@app/experience-context"

export const useMyHook = () => {
  // Single responsibility — one concern per hook
}
```

**Rules:**
- Add TSDoc (`/** ... */`) documenting purpose, data flow, and non-obvious design decisions
- Named exports only (no default exports)
- Single responsibility — one concern per hook
- Use meaningful names that convey domain purpose
- For adapter/routing hooks, route based on feature flag or persona — don't accumulate side effects:

```typescript
export const useMyAction = () => {
  const isPrimaryMode = useIsPrimaryMode()
  const handlePrimaryMode = useMyActionPrimary()
  const handleSecondaryMode = useMyActionSecondary()

  return isPrimaryMode ? handlePrimaryMode : handleSecondaryMode
}
```

## Zustand Store Pattern

```typescript
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

type MyStoreState = {
  items: string[]
  isLoading: boolean
}

type MyStoreActions = {
  actions: {
    setItems: (items: string[]) => void
    setIsLoading: (isLoading: boolean) => void
    resetStore: () => void
  }
}

export const initialState: MyStoreState = {
  items: [],
  isLoading: false
}

type MyStore = MyStoreState & MyStoreActions

export const useMyStore = create<MyStore>()(
  devtools(
    immer((set) => ({
      ...initialState,
      actions: {
        setItems: (items) => set({ items }),
        setIsLoading: (isLoading) => set({ isLoading }),
        resetStore: () => set(initialState)
      }
    })),
    { name: "MyStore" }
  )
)

// Selector hooks for fine-grained subscriptions
export const useMyStoreValues = () =>
  useMyStore(({ items, isLoading }) => ({ items, isLoading }))

export const useMyStoreActions = () => useMyStore(({ actions }) => actions)

// Getters for access outside React components
export const getItems = () => useMyStore.getState().items
```

**Rules:**
- Separate state type from actions type, combine at the end
- Always export `initialState`
- Wrap with `devtools(immer(...))` — immer inside, devtools outside
- Mutate only inside `set()` callbacks
- Export separate selector hooks for values and actions
- Export `getXxx()` functions for outside-React access

## Utility Function Pattern

```typescript
export const calculateTotal = (prices: number[]): number => {
  return prices.reduce((sum, price) => sum + price, 0)
}
```

**Rules:**
- Add TSDoc (`/** ... */`) documenting purpose and non-obvious design decisions
- Named exports only
- Use descriptive names — no abbreviations (`customer` not `c`, `status` not `s`)
- Prefer native builtins over utility libraries (no lodash, moment)
- Use `unknown` for unsafe input, narrow via type guards
- Use `satisfies` over type annotations or assertions

## General Rules (All New Code)

- Use `@/` path alias for all src imports
- Always use named imports — no namespace imports (`import * as`)
- Use `satisfies` over `: T` or `as T`
- No `any` type — find existing types or create new ones
- No `ts-expect-error` — properly type new code
- No short/abbreviated names (`v`, `e`, `i`, `match`, `result`, `item`, `data`)
- No nested ternary operators — use explicit conditional blocks
- `return` always on its own line inside braces — never `if (...) return`
- Prefer dot notation (`obj.property`) over bracket notation
- No stray `console.log` in production code
- Keep data fetching in hooks/service layers, not component bodies
- Use shared types/enums (`AutocompleteDataItem`, `DataType`, `SourceType`) — avoid magic strings
- Prefer shared utils (`sortingByAlphabet`, `sanitizeValue`, `isFilterApplied`, etc.)

## Workflow

1. Read nearby files to match local patterns (imports, naming, structure)
2. Create the new code following the patterns above
3. Run `npx tsc --noEmit` to type-check
4. Run relevant tests and fix any failures
