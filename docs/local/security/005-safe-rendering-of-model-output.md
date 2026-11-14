# Security 005: Model output and source excerpts are not treated as unsafe HTML

- **Status:** Open
- **Severity:** High (XSS through prompt injection in indexed source)
- **Area:** `apps/web` (chat view, source inspector)
- **Target stage:** 9

## Problem

Stage 9 isolates retrieved code inside the prompt, but no stage covers how answers and excerpts are rendered. A comment in an indexed file can steer the model into emitting HTML, `javascript:` links, or markdown images pointing at remote hosts. Rendering that output as HTML runs script against the local API or leaks data through image requests.

## Proposed fix

- Never use `dangerouslySetInnerHTML` for answers or excerpts.
- If markdown is rendered, disable raw HTML and allow only text, code, lists, emphasis, and links.
- Allow only internal link targets (citations); drop or render as text any `http(s):`, `javascript:`, `data:` URL.
- Do not render remote images.
- Show source excerpts as plain text in `<pre>`/`<code>`.

## Tests

- Fixture answers containing `<img src=x onerror=...>`, `<script>`, `[x](javascript:...)`, and `![](https://example.invalid/x.png)` render inert, with no requests made.
- Citation chips still link to the source inspector.

## Related

- [004-security-headers-csp.md](004-security-headers-csp.md)
- [../improvements/009-required-e2e.md](../improvements/009-required-e2e.md)
