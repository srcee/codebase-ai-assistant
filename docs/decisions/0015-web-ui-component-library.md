# 0015: Web UI component library

Status: accepted (before Stage 17)

## Context

The web app used plain HTML controls and one stylesheet with five colors. It worked but looked unfinished, had no dark mode beyond the browser default, and every new view (projects, the citations inspector, and later reports and charts) would need its own hand-written controls. The UI must stay fully offline: no CDNs, web fonts, or telemetry.

## Decision

- **Mantine** (`@mantine/core`, `@mantine/hooks`, pinned) for components and theming. Its props read like plain React, it ships plain CSS (no CSS-in-JS runtime, no Tailwind), its components are accessible, and `@mantine/charts` covers future reports without another library.
- **Tabler icons** (`@tabler/icons-react`, pinned), the set Mantine documents. Icons are bundled; nothing is fetched at runtime.
- **Theme** in `apps/web/src/app/theme/`: system font stacks only, `defaultColorScheme="auto"` with a manual light, dark, or system toggle, and an accent chosen from `indigo` (default), `blue`, or `teal`. Mantine stores the color scheme in `localStorage`; the accent is stored under `codebase-ai:accent` and validated on read.
- **Custom styles** only where Mantine has no component (chat bubbles, citation chips, the drop zone), as CSS modules next to the component, using Mantine CSS variables so they follow the theme.
- **Native controls kept** for the scope picker and collection origin (`NativeSelect`) and for file uploads (`input type=file` in a styled drop zone), so keyboard, screen reader, and test behavior stay as before and `@mantine/dropzone` is not needed.
- **Tests** render through `src/testing/render.tsx`, which wraps the theme provider; `src/testing/setup.ts` stubs the browser APIs jsdom lacks (`matchMedia`, `ResizeObserver`, `document.fonts`).

## Alternatives

- **MUI**: complete, but heavier, Emotion CSS-in-JS at runtime, and more verbose theming.
- **shadcn/ui** (Radix + Tailwind): copies component source into the repository and adds Tailwind; more code to own.
- **Plain CSS with design tokens**: no dependency, but every control, focus state, and chart would be built by hand.

## Consequences

- The bundle includes the full Mantine stylesheet (about 38 kB gzipped); importing per-component styles can trim it if it matters.
- Mantine injects `<style>` tags for its CSS variables and uses inline `style` attributes. The Stage 19 Content Security Policy must pass a nonce through `MantineProvider`'s `getStyleNonce` or allow inline styles. Mantine's `ColorSchemeScript` is not used because it is an inline script; the page can flash the light theme briefly on first load in dark mode.
