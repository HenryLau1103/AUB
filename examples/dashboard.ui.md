# Dashboard Overview — Implementation Brief

> **Version:** 0.1.0
> **Source:** `examples/dashboard.ui.json`
> **Target framework:** any (this brief is framework-agnostic)

This document is the Agent context export of a UI Blueprint. Read it top-to-bottom before implementing. The acceptance checklist at the bottom is the contract — every item must pass before this implementation is considered done.

---

## 1. Screen Summary

| Field | Value |
|---|---|
| **id** | `dashboard.overview` |
| **name** | Dashboard Overview |
| **type** | `dashboard` |
| **platform** | `web` |
| **primary_user_goal** | Let the user see high-level business metrics and drill into a specific data table row for detail. |

The screen is a SaaS analytics dashboard. The user lands here to scan 4 KPI metrics, glance at a revenue trend chart, and inspect the most recent orders. Clicking an order row opens a side drawer for details.

---

## 2. Component Hierarchy

```
app_shell  (grid, full screen)
├── sidebar  (240px wide, vertical nav)
│   ├── nav_item  Overview        [active]
│   ├── nav_item  Orders
│   ├── nav_item  Customers
│   ├── nav_item  Reports
│   └── nav_item  Settings
├── top_bar  (horizontal header)
│   ├── text_input  Search (placeholder: "Search orders, customers...")
│   └── menu        User Menu
│                    ├── Profile
│                    └── Sign out
└── main  (scrollable, flex column)
    ├── section  Page Title         "Overview"
    ├── section  Metric Row         (4-col grid, 16px gap)
    │   ├── metric_card  Revenue
    │   ├── metric_card  Orders
    │   ├── metric_card  New Customers
    │   └── metric_card  Conversion
    ├── section  Chart Panel
    │   └── chart_placeholder  Revenue trend (30d)
    └── section  Recent Orders
        └── data_table  Recent Orders (5 columns, sortable/filterable)
            └── (states: table_empty_state, table_loading_state, table_error_state)
```

Every node in the tree is a **registered semantic component type** (not a generic rectangle). When you implement, you MUST use components that map to the stated type — not visual stand-ins.

---

## 3. Layout Contract

- **App shell** is a grid container holding sidebar (240px), top bar, and main area.
- **Sidebar** is a flex column with 4px vertical gap between nav items, 16/24px padding.
- **Top bar** is a flex row, `align: center`, `justify: space-between`, 16px horizontal padding, 16px horizontal gap.
- **Main** is a flex column with 24px vertical gap, 32px side padding.
- **Metric row** is a grid with 4 columns, 16/16px gap.

**Forbidden:** absolute coordinates (`x`, `y`, `top`, `left` in pixels). Express all positioning with flex/grid, gaps, and padding.

---

## 4. Interaction Rules

| Source | Trigger | Action | Result |
|---|---|---|---|
| `search_input` | submit | `navigate:/search?q=...` | User is routed to /search with query in URL |
| `user_menu` | click | `open:user_menu_dropdown` | Dropdown appears with Profile and Sign out |
| `menu_logout` | click | `submit:logout` | Session ends; user is routed to `/auth/login` |
| `orders_table` (row) | click | `open:order_detail` | Side drawer slides in from the right within 200ms |
| `nav_item_overview` | click | `navigate:/dashboard` | Routes to dashboard |
| `nav_item_settings` | click | `navigate:/settings` | Routes to settings |

Every interaction declares its **trigger**, **action verb-noun**, and **observable result state**. Do not invent interactions not listed here.

---

## 5. Responsive Rules

| Viewport | Target | Rule | Effect |
|---|---|---|---|
| `tablet` (≤1024px) | `sidebar` | `drawer` | Default visible: false. Triggered by hamburger. |
| `mobile` (≤390px) | `sidebar` | `drawer` | Same as tablet. |
| `tablet` (≤1024px) | `metric_row` | `stack` | Grid columns: 2 |
| `mobile` (≤390px) | `metric_row` | `stack` | Grid columns: 1 |
| `mobile` (≤390px) | `orders_table` | `card_list` | Convert table to stacked card list. Primary field: `order_id` |

Every responsive decision is declared explicitly. The agent MUST NOT collapse the sidebar silently, hide the metric row, or change table to horizontal scroll without a declared rule.

---

## 6. Non-Violable Conditions

These are hard constraints. Violating any of them is a Blocker.

1. **No absolute coordinates** anywhere in the implementation. Use flex/grid.
2. **Sidebar width 240px** on desktop. Not 220, not 260, not auto.
3. **Metric row is a 4-column grid** on desktop with 16px gap. Not 3, not 5, not 12px.
4. **Order row click** MUST open a side drawer (not a modal, not a new page).
5. **Mobile table view** MUST be a card list, not horizontal scroll.
6. **All interactive elements** must have a minimum touch target of 44×44px on mobile.
7. **All form inputs** must have a programmatic label (not just placeholder).
8. **Empty / loading / error states** for `orders_table` are wired — not silent blanks.

---

## 7. Acceptance Checklist

This checklist is the contract. Every item must be verifiable. Mark each `[x]` only after manual or automated verification.

### Layout (2)

- [ ] **acc_layout_shell** (blocker) — App shell uses grid layout with sidebar (240px), top bar, and main. Verify with `getComputedStyle` or DOM inspection.
- [ ] **acc_layout_metric_row** (must) — Metric row renders 4 cards in a 4-column grid with 16px gap on desktop.

### Interaction (2)

- [ ] **acc_interaction_row_click** (must) — Clicking an order row opens a detail drawer within 200ms. Verify with interaction replay.
- [ ] **acc_interaction_logout** (must) — Clicking Sign out terminates session and routes to `/auth/login`.

### Responsive (3)

- [ ] **acc_responsive_sidebar** (must) — Sidebar becomes a drawer triggered by a hamburger below 1024px.
- [ ] **acc_responsive_metric_row** (must) — Metric row collapses to 2 columns at 1024px, 1 column at 390px.
- [ ] **acc_responsive_table** (must) — Orders table becomes a card list on mobile (not horizontal scroll).

### Accessibility (3)

- [ ] **acc_a11y_keyboard** (must) — All interactive elements reachable by keyboard tab order; visible focus ring.
- [ ] **acc_a11y_labels** (must) — All form inputs have an associated label or `aria-label`.
- [ ] **acc_a11y_touch_targets** (should) — All interactive elements ≥44×44px on mobile.

### Content (1)

- [ ] **acc_content_empty** (should) — When the orders list is empty, the empty_state node renders.

**Total: 11 verifiable items** (≥5 required by spec).

---

## 8. Agent Task

You are implementing the dashboard described above. Your deliverable is:

1. A new file or route at `/dashboard` matching the component hierarchy in §2.
2. Implementation that respects the layout contract in §3.
3. Wiring of all 6 interactions in §4.
4. Responsive behavior per §5.
5. A passing run of the acceptance checklist in §7 — every item verifiable, not vibes.

### Implementation order (suggested, not strict)

1. App shell + sidebar + top bar (skeleton, no data)
2. Metric row with 4 hardcoded cards
3. Recent orders table with hardcoded rows
4. Wire `orders_table` row click → detail drawer
5. Wire `search_input` submit → route
6. Wire `user_menu` open/close + logout
7. Add responsive rules (sidebar drawer, metric stack, table card list)
8. Add empty/loading/error states for the table
9. Run axe accessibility audit, fix any issues
10. Run acceptance checklist, mark all items

### Stop conditions

- **Blocker found:** stop and report. Do not "fix forward" by relaxing the spec.
- **Acceptance item impossible as specified:** stop and report. Do not silently weaken the criterion.
- **Component type does not exist in your framework:** stop and report. Do not substitute a generic `<div>`.

### Output format (when done)

Report per acceptance item:

```
[ ] acc_id — pass | fail | needs-review
    evidence: <screenshot path | file:line | dom query | interaction log>
    notes: <if any>
```

If any item is `fail` or `needs-review`, the implementation is not done.
