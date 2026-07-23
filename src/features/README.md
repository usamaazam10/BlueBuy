# features

Feature-based modules. Each subfolder is a self-contained slice of the app
(e.g. `products/`, `cart/`, `checkout/`, `auth/`) and may contain its own
`components/`, `hooks/`, `api/`, `types.ts`, and `constants.ts`.

Keep cross-feature primitives in `@/components/ui`, and truly shared logic in
`@/lib`, `@/hooks`, or `@/utils`.
