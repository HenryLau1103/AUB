# Failure Cases — Where Text-Only UI Description Breaks

**Phase 0 deliverable** — five concrete cases of vibe-coding failure this project must prevent. Each case is structured as: **prompt** → **agent's typical output** → **specific failure mode** → **what a Blueprint would have enforced**.

These cases are not strawmen. They are the dominant patterns observed across Codex, Claude Code, and Cursor sessions when a user describes UI without a structured spec.

---

## Case 1: "Build me a dashboard like Stripe"

### The prompt
> *"Build me a dashboard like Stripe."*

### What the agent typically produces
- A generic React app with `Card`, `Table`, `Button` from a UI library
- Layout: 1-column stack of cards, no sidebar
- Charts: a single line chart placeholder
- 3 hardcoded metric cards with `Lorem ipsum` values
- No filters, no date range, no drill-down
- Mobile: a vertical scroll of the same content

### Specific failure modes
| # | What was lost | Why text failed |
|---|---------------|-----------------|
| F1.1 | Information density — Stripe's dashboard shows 5–8 cards in a row, not 1 | "Like Stripe" is a reference, not a layout |
| F1.2 | Sidebar navigation with grouped sections | Not mentioned, agent invented single-page layout |
| F1.3 | Top filter bar (date range, status, account) | Not mentioned, agent skipped it entirely |
| F1.4 | Data table with sort/filter/pagination, not just cards | Agent guessed based on "dashboard" stereotype |
| F1.5 | Empty state, loading state, error state | None requested, none produced |

### What a Blueprint would have enforced
- `screen.type = "dashboard"`, `platform = "web"`
- `app_shell` with `sidebar` (240px) + `top_bar` + `main` (flex column)
- `metric_row` containing 4 `metric_card` nodes (label, value, delta, trend)
- `data_table` with declared `columns` and `filterable: true`
- Responsive rules: sidebar → drawer <1024px, metric_row → 2-col <1024, 1-col <640
- Acceptance items: "main content max-width 1200px", "metric cards have delta indicator"

---

## Case 2: "Add a settings page"

### The prompt
> *"Add a settings page where users can change their preferences."*

### What the agent typically produces
- A single `<Form>` with `Input` and `Button`
- No grouping, no section headers
- All fields stacked vertically with no labels
- No save / cancel / success state
- No "danger zone" for destructive actions
- Mobile: same form, no responsive considerations

### Specific failure modes
| # | What was lost | Why text failed |
|---|---------------|-----------------|
| F2.1 | Field grouping (Profile / Notifications / Billing / Danger zone) | Not mentioned, agent assumed one form |
| F2.2 | Field types and validation (email format, password strength) | "Preferences" is ambiguous — preferences to *what*? |
| F2.3 | Save / Cancel / Discard changes behavior | Never specified |
| F2.4 | Accessibility — labels, `aria-describedby`, error messages | Never specified |
| F2.5 | Responsive — on mobile, settings should remain a single column with section anchors | Never specified |

### What a Blueprint would have enforced
- `screen.type = "settings"`, `platform = "web"`
- 4 `section` nodes: Profile, Notifications, Billing, Danger Zone
- Each section has typed fields (text_input with `validation: email`, toggle, select)
- Each form input has explicit `label` and `error_message` in content
- `primary_button` "Save Changes" with disabled-state until dirty
- Acceptance items: "all inputs have associated label", "danger zone section requires confirmation modal", "changes persist on save and survive reload"

---

## Case 3: "Make the sidebar clean and minimal"

### The prompt
> *"Make the sidebar cleaner and more minimal."*

### What the agent typically produces
- Sidebar still at 240px, content unchanged
- Some padding tweaks, some font-size changes
- No structural change — agent edits CSS, not layout

### Specific failure modes
| # | What was lost | Why text failed |
|---|---------------|-----------------|
| F3.1 | Concrete width target ("160px collapsed / 240px expanded") | "Clean" is subjective |
| F3.2 | Icon-only mode vs. icon+label mode | Never specified |
| F3.3 | Which items to keep / which to group / which to move to overflow menu | Never specified |
| F3.4 | Hover and active states | Never specified |
| F3.5 | How collapse should animate | Never specified |

### What a Blueprint would have enforced
- `sidebar` with `width: { default: 240, collapsed: 64 }`
- Each `nav_item` declares `icon`, `label`, `section` (group)
- `variant: "icon-only" | "icon+label"` per breakpoint
- `interaction`: hover/click rules with explicit `result_state`
- Acceptance items: "sidebar collapses to 64px <1024px", "nav groups separated by 16px gap", "active item has 2px left border accent"

---

## Case 4: "Match this Figma screenshot"

### The prompt
> *[Figma screenshot attached]* *"Build this page."*

### What the agent typically produces
- An OCR-and-guess pass: text content is roughly right, layout is approximated
- Visual hierarchy is lost (which element is the "primary" CTA?)
- Spacing is off (24px vs 32px gap — visually similar, structurally different)
- Color tokens are not preserved (uses random Tailwind colors)
- Responsive: completely ignored (Figma frame is desktop-only)
- Interaction: ignored (static screenshot)

### Specific failure modes
| # | What was lost | Why text failed |
|---|---------------|-----------------|
| F4.1 | Semantic intent — is the right card a "metric_card" or a "feature_highlight"? | Image has no semantic layer |
| F4.2 | Spacing tokens — 8px grid? 12px grid? | Image has no token system |
| F4.3 | Color tokens — `primary`, `surface`, `text-muted` | Image pixels don't map to design tokens |
| F4.4 | Interactive states — hover, focus, disabled, loading | Image is one moment in time |
| F4.5 | Mobile and tablet variants | Figma frame is typically desktop-only |
| F4.6 | Why each element exists — primary_user_goal, role | Image has no intent layer |

### What a Blueprint would have enforced
- The user opens the editor and *recreates* the design with semantic components
- Spacing is captured as `gap: 16`, `padding: { x: 24, y: 16 }` — not pixel-pushed
- Colors become tokens (`surface.primary`, `text.secondary`)
- Every node has `role` and `intent` (e.g. `metric_card.role = "kpi_summary"`)
- The screenshot is a *reference*, not the source. The Blueprint is the source.

---

## Case 5: "It should be responsive like Notion"

### The prompt
> *"The page should be responsive like Notion."*

### What the agent typically produces
- A media query added with `md:` breakpoint, content reflows somewhat
- Sidebar disappears entirely on mobile (lost functionality)
- Tables stay as tables (overflow horizontally, unreadable on phone)
- Charts squish instead of stacking
- Touch targets remain 24×24px (too small for fingers)

### Specific failure modes
| # | What was lost | Why text failed |
|---|---------------|-----------------|
| F5.1 | Specific breakpoints (Notion uses 768, 1024, 1440) | "Like Notion" is not a breakpoint spec |
| F5.2 | Component-level responsive rules — sidebar → drawer / hide / bottom-nav | Never specified *which* rule applies to *which* component |
| F5.3 | Table behavior on mobile — card list vs horizontal scroll vs column reduction | "Responsive" doesn't say how |
| F5.4 | Touch target sizes (Apple HIG: 44px, Material: 48px) | Never specified |
| F5.5 | Navigation pattern on mobile (drawer, bottom nav, hamburger) | Never specified |

### What a Blueprint would have enforced
- 3 viewports declared: `desktop 1440×900`, `tablet 1024×768`, `mobile 390×844`
- Per-component responsive rules:
  - `sidebar`: mobile → `drawer`
  - `data_table`: mobile → `card_list`
  - `top_bar`: mobile → keep with hamburger
- Acceptance items per breakpoint:
  - "all interactive elements ≥ 44px on mobile"
  - "table converts to card list < 640px"
  - "sidebar is reachable via hamburger < 1024px"

---

## Pattern Across All 5 Cases

| Failure type | Cases | Why Blueprint fixes it |
|--------------|-------|------------------------|
| Ambiguity in nouns (dashboard, settings, clean, responsive) | 1, 2, 3, 5 | Semantic component types force explicit choices |
| Missing structure (groups, sections, hierarchy) | 1, 2, 3 | Tree structure + role field is mandatory |
| Subjective adjectives (clean, minimal) | 3 | Acceptance items must be measurable, no "looks good" |
| Image-as-source | 4 | Blueprint is structured, not a raster; user recreates with semantic components |
| Implicit behavior (interactions, responsive) | 1, 2, 3, 4, 5 | Every interaction has trigger + action + result_state declared |
| Missing acceptance signal | 1, 2, 3, 4, 5 | ≥5 verifiable items per screen, gated by checklist renderer |

## 6. The Anti-Pattern This Design Must NOT Repeat

> "It should look like X" / "It should feel like Y" / "Just like Z but with..."

These prompts fail for the same reason: they ask the agent to *infer* structure and intent. The Blueprint format is a refusal of that — every dimension of the screen is declared explicitly, validated, and reviewable.
