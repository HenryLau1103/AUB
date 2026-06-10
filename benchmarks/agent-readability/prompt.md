Read the `examples/freeform-actions.ui.json` content provided in the `<blueprint_json>` block. Do not infer or redesign anything.

Return only one JSON object with exactly these keys:

- `version`
- `root_id`
- `root_layout_mode`
- `node_count`
- `direct_root_children`
- `primary_cta_desktop` with `x`, `y`, `width`, `height`, `z_index`
- `primary_cta_mobile` with `x`, `y`, `width`, `height`, `z_index`
- `secondary_cta_mobile_x`
- `stats_card_layout_mode`
- `stats_card_direction`
- `action_primary_token`
- `primary_action`
- `interaction_count`
- `acceptance_count`

Use numbers as numbers and preserve child order.
For `node_count`, count every object in the top-level `nodes` array, including the root and nodes nested under other nodes. Do not use the direct-root-child count.
For `direct_root_children`, return the ordered array of child id strings exactly as declared in the root node. Do not return the number of children.
