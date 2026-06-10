/**
 * UI Blueprint TypeScript types.
 *
 * These types are the TypeScript surface of `ui-blueprint.schema.json`.
 * They are hand-maintained to match the schema field-for-field.
 *
 * Synchronization rule: when the JSON Schema changes, update these types in
 * the same commit. A validation test in `tests/types.test.ts` round-trips
 * `examples/dashboard.ui.json` through both surfaces to catch drift.
 *
 * Source of truth: `schema/ui-blueprint.schema.json`
 */

export type SemVer = `${number}.${number}.${number}`;

/** Top-level document. */
export interface Blueprint {
  /** Semantic version of the schema this document conforms to. */
  version: SemVer;
  /** Screen metadata. */
  screen: Screen;
  /** At least one viewport. */
  viewports: Viewport[];
  /** Tree of semantic UI nodes. The first node MUST be the root. */
  nodes: UINode[];
  /** User-driven interactions. */
  interactions: Interaction[];
  /** Per-viewport rules that override or transform node layout. */
  responsive: Responsive[];
  /** Verifiable acceptance items. >=5 per screen. */
  acceptance: Acceptance[];
  /** Shared visual vocabulary used by nodes. */
  design_system?: DesignSystem;
  /** Optional origin metadata for imported Blueprints. */
  provenance?: Provenance;
}

export interface Screen {
  id: string;
  name: string;
  type: ScreenType;
  platform: Platform;
  primary_user_goal: string;
  notes?: string;
}

export type ScreenType =
  | 'dashboard'
  | 'form'
  | 'landing'
  | 'settings'
  | 'admin_table'
  | 'detail'
  | 'auth'
  | 'error'
  | 'empty'
  | 'workspace'
  | 'communication'
  | 'content'
  | 'commerce'
  | 'calendar'
  | 'files'
  | 'onboarding';

export type Platform = 'web' | 'mobile-web' | 'ios' | 'android' | 'desktop';

export interface Viewport {
  id: 'desktop' | 'tablet' | 'mobile' | 'wide';
  width: number;
  height: number;
}

/** Semantic component type — agents read this to know WHAT a node is. */
export type ComponentType =
  | 'app_shell' | 'page' | 'section' | 'header' | 'sidebar' | 'top_bar' | 'bottom_nav'
  | 'stack' | 'grid' | 'split_pane' | 'scroll_area'
  | 'metric_card' | 'data_table' | 'list' | 'detail_panel' | 'chart_placeholder' | 'timeline' | 'activity_feed'
  | 'form' | 'field_group' | 'text_input' | 'select' | 'checkbox' | 'radio_group' | 'toggle' | 'slider' | 'date_picker' | 'file_upload'
  | 'button' | 'icon_button' | 'button_group' | 'menu' | 'toolbar' | 'command_palette'
  | 'modal' | 'drawer' | 'toast' | 'alert' | 'empty_state' | 'loading_state' | 'error_state'
  | 'tabs' | 'breadcrumb' | 'pagination' | 'stepper' | 'nav_item'
  | 'heading' | 'text' | 'card' | 'image' | 'icon' | 'avatar' | 'badge' | 'tag' | 'divider' | 'link'
  | 'textarea' | 'search_input' | 'calendar' | 'kanban_board' | 'kanban_column' | 'rich_text_editor';

export type ContainerComponentType = Extract<
  ComponentType,
  | 'app_shell' | 'page' | 'section' | 'header' | 'sidebar' | 'top_bar' | 'bottom_nav'
  | 'stack' | 'grid' | 'split_pane' | 'scroll_area'
  | 'list' | 'detail_panel' | 'timeline' | 'activity_feed'
  | 'form' | 'field_group' | 'menu' | 'toolbar' | 'button_group' | 'command_palette'
  | 'tabs' | 'stepper' | 'card' | 'kanban_board' | 'kanban_column' | 'rich_text_editor'
>;

export type LeafComponentType = Exclude<ComponentType, ContainerComponentType>;

export type NodeState =
  | 'default' | 'hover' | 'focus' | 'active' | 'disabled'
  | 'loading' | 'empty' | 'error' | 'selected';

export interface UINode {
  id: string;
  type: ComponentType;
  name: string;
  /** Agent-facing role/intent. WHY this node exists. */
  role: string;
  parent_id: string | null;
  children?: string[];
  layout?: Layout;
  /** Exact geometry per viewport. Used when the parent layout mode is freeform. */
  placements?: Partial<Record<ViewportId, Placement>>;
  content?: Content;
  style?: Style;
  states?: NodeState[];
  constraints?: NodeConstraints;
  source?: SourceReference;
  bindings?: Bindings;
  validation?: NodeValidation;
  initial_state?: InitialState;
}

export interface Provenance {
  source_kind: 'native' | 'angular-component' | 'html' | 'figma' | 'image' | 'other';
  framework?: string;
  importer_version: string;
  entry_file?: string;
  source_files: string[];
}

export interface SourceReference {
  file: string;
  line?: number;
  column?: number;
  selector?: string;
}

export interface Bindings {
  value?: string;
  options?: string;
  visibility?: string;
  enabled?: string;
  repeat?: string;
  selected?: string;
}

export interface NodeValidation {
  required?: boolean;
  pattern?: string;
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
}

export interface InitialState {
  visibility?: 'visible' | 'hidden';
  expanded?: boolean;
  selected?: boolean;
}

export interface NodeConstraints {
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  /** Minimum interactive area in pixels (Apple HIG 44, Material 48). */
  touch_target_min?: number;
}

export interface Layout {
  mode?: 'auto' | 'freeform';
  display?: 'flex' | 'grid' | 'block' | 'inline' | 'none';
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  wrap?: boolean;
  grid?: GridConfig;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: Spacing;
  padding?: PaddingBox;
  width?: Size;
  height?: Size;
  min_width?: Size;
  max_width?: Size;
}

export type ViewportId = Viewport['id'];

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
  z_index?: number;
  order?: number;
  grow?: number;
  basis?: number;
  grid_column?: number;
  grid_row?: number;
  column_span?: number;
  row_span?: number;
}

export interface GridConfig {
  columns?: number;
  rows?: number;
  template?: string;
}

export interface Spacing {
  x?: number;
  y?: number;
}

export interface PaddingBox {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface Size {
  value: number;
  unit: 'px' | '%' | 'rem' | 'vw' | 'vh';
}

export interface Content {
  text?: string;
  placeholder?: string;
  /** Symbolic reference to a data source, e.g. 'metrics.revenue.current'. */
  data_binding?: string;
  columns?: TableColumn[];
  items?: ListItem[];
  /** Symbolic action intent, e.g. 'submit', 'navigate:/settings'. */
  action?: string;
  /** Accessible label for form inputs and icon buttons. */
  label?: string;
  empty_state?: string;
  loading_state?: string;
  error_state?: string;
  src?: string;
  alt?: string;
  icon?: string;
  value?: string;
  helper_text?: string;
  variant?: string;
}

export interface TableColumn {
  id: string;
  header: string;
  data_binding?: string;
  sortable?: boolean;
  filterable?: boolean;
  cell_kind?: 'text' | 'number' | 'date' | 'link' | 'icon' | 'action' | 'status' | 'checkbox';
  icon?: string;
  action?: string;
  sticky?: boolean;
  align?: 'start' | 'center' | 'end';
  visible_when?: string;
  width?: Size;
}

export interface ListItem {
  id: string;
  label?: string;
  icon?: string;
  action?: string;
}

export interface Style {
  /** Design tokens applied to this node. */
  tokens?: Record<string, string>;
  elevation?: number;
  background?: string;
  foreground?: string;
  border?: string;
  typography?: string;
  radius?: string;
  shadow?: string;
  opacity?: number;
  variant?: string;
}

export interface DesignSystem {
  name: string;
  colors?: Record<string, string>;
  typography?: Record<string, string>;
  spacing?: Record<string, string>;
  radii?: Record<string, string>;
  shadows?: Record<string, string>;
}

export type InteractionTrigger =
  | 'click' | 'double_click' | 'hover' | 'focus' | 'blur'
  | 'change' | 'submit' | 'key_enter' | 'key_escape'
  | 'swipe_left' | 'swipe_right' | 'load' | 'scroll';

export interface Interaction {
  id: string;
  trigger: InteractionTrigger;
  source_node_id: string;
  /** Verb-noun form: 'navigate:/foo', 'open:bar', 'submit:form_x'. */
  action: string;
  /** Optional target node id or route. */
  target?: string;
  /** What changes as a result. Must be observable and verifiable. */
  result_state: string;
}

export type ResponsiveViewport = 'desktop' | 'tablet' | 'mobile' | 'wide';

export type ResponsiveRule =
  | 'keep' | 'hide' | 'drawer' | 'bottom_nav' | 'stack' | 'scroll'
  | 'card_list' | 'col_reduce' | 'collapse' | 'expand'
  | 'icon_only' | 'label_only';

export interface Responsive {
  viewport: ResponsiveViewport;
  rule: ResponsiveRule;
  target_node_id: string;
  /** Specific property overrides. Empty object means no change beyond the rule. */
  changes: Record<string, unknown>;
}

export type AcceptanceType = 'layout' | 'interaction' | 'responsive' | 'a11y' | 'content' | 'performance';
export type AcceptancePriority = 'blocker' | 'must' | 'should' | 'nice';
export type VerificationMethod =
  | 'manual_visual' | 'manual_ia_review'
  | 'dom_query' | 'computed_style' | 'axe_audit'
  | 'screenshot_diff' | 'interaction_replay' | 'code_diff';

export interface Acceptance {
  id: string;
  type: AcceptanceType;
  /** Verifiable assertion. Must be testable, not subjective. */
  statement: string;
  /** Node id, viewport id, or selector pattern. */
  target: string;
  priority: AcceptancePriority;
  verification_method: VerificationMethod;
}
