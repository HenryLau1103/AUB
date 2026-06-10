# Implement the AUB benchmark

Read the Blueprint in `<blueprint_json>` and return exactly one JSON object:

```json
{
  "html": "<!doctype html>...",
  "implementation_report": {}
}
```

Requirements:

1. `html` must be one complete standalone HTML document with inline CSS and JavaScript. Do not use external assets, libraries, fonts, or network requests.
2. Render every Blueprint node exactly once with `data-aub-node="<node id>"`.
   - Do not rely on `id` attributes.
   - Every CSS and JavaScript selector for a Blueprint node must use its exact `[data-aub-node="<node id>"]` selector.
3. Preserve the declared parent/child hierarchy and direct-child order.
4. The root is a full-viewport, `position: relative` freeform surface. Direct root children use `position: absolute`.
5. Implement the exact desktop placements by default, tablet placements at `max-width: 1100px`, and mobile placements at `max-width: 600px`. Coordinates and dimensions are CSS pixels.
6. Resolve the declared design tokens exactly. Use the declared typography, colors, radii, spacing, and shadow.
7. Use these deterministic base styles:
   - `html, body`: margin 0, width 100%, min-height 100%, `font-family: system-ui` exactly, without fallback families.
   - `h1, h2`: margin 0.
   - The root explicitly sets `color: #0f172a` and `font-family: system-ui`.
   - Buttons: border 0, padding 0, font `600 14px/1 system-ui`, cursor pointer.
   - The secondary button has a `1px solid #cbd5e1` border.
   - The card uses `box-sizing: border-box`, `color: #0f172a`, and `font-family: system-ui`.
8. The card must use its declared flex column auto layout, padding, and gap.
   - Nested card children remain in normal flex flow and must not use absolute positioning.
9. Both buttons must have visible `:focus-visible` outlines.
10. Clicking either button must set `document.body.dataset.lastAction` to its exact Blueprint action string. Do not navigate away from the benchmark page.
11. The page must not horizontally overflow in any declared viewport.
12. Fill the supplied implementation report template:
    - framework: `standalone-html`
    - route: `/`
    - files: `["index.html"]`
    - every node status: `mapped`, file: `index.html`
    - every acceptance status: `pass` with at least one concrete evidence entry
    - unresolved: `[]`

Do not redesign, infer alternate behavior, add extra visible UI, or return Markdown.
