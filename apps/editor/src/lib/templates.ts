import { componentLabel, t, type Language } from './i18n';
import type { Acceptance, Blueprint, ComponentType, Layout, UINode } from '../types';

export type TemplateId = 'dashboard' | 'landing' | 'settings';

export const TEMPLATE_IDS: TemplateId[] = ['dashboard', 'landing', 'settings'];

interface NodeInput {
  id: string;
  type: ComponentType;
  name: string;
  role: string;
  parent_id: string | null;
  children?: string[];
  layout?: Layout;
  content?: UINode['content'];
  constraints?: UINode['constraints'];
}

export function templateLabel(language: Language, id: TemplateId): string {
  const key = {
    dashboard: 'templateDashboard',
    landing: 'templateLanding',
    settings: 'templateSettings',
  } satisfies Record<TemplateId, Parameters<typeof t>[1]>;
  return t(language, key[id]);
}

export function createTemplateBlueprint(id: TemplateId, language: Language): Blueprint {
  switch (id) {
    case 'dashboard':
      return createDashboardTemplate(language);
    case 'landing':
      return createLandingTemplate(language);
    case 'settings':
      return createSettingsTemplate(language);
  }
}

function createDashboardTemplate(language: Language): Blueprint {
  const zh = language === 'zh-Hant';
  return blueprint({
    screenId: 'template.dashboard',
    name: zh ? '後台儀表板' : 'Dashboard App',
    type: 'dashboard',
    goal: zh
      ? '讓使用者從左側導覽進入模組，並在主內容查看關鍵指標、趨勢與近期訂單。'
      : 'Let users navigate modules from the sidebar and review KPIs, trends, and recent orders in the main content.',
    nodes: [
      node('app_shell', 'app_shell', zh ? '應用框架' : 'App Shell', zh ? '最上層版面，負責放置左側欄、頂部列與主頁面。' : 'Top-level layout that positions sidebar, top bar, and main page.', null, ['sidebar', 'top_bar', 'main_page']),
      node('sidebar', 'sidebar', zh ? '主側邊欄' : 'Primary Sidebar', zh ? '主要導覽；放在應用框架中會顯示在左側。' : 'Primary navigation; appears on the left when placed inside app shell.', 'app_shell', ['nav_overview', 'nav_orders', 'nav_customers', 'nav_reports'], sidebarLayout(), { label: zh ? '營運中心' : 'Operations' }),
      node('nav_overview', 'nav_item', zh ? '總覽' : 'Overview', zh ? '目前頁面的導覽項目。' : 'Current screen navigation item.', 'sidebar', undefined, undefined, { label: zh ? '總覽' : 'Overview', action: 'navigate:/dashboard' }),
      node('nav_orders', 'nav_item', zh ? '訂單' : 'Orders', zh ? '前往訂單列表。' : 'Navigate to orders.', 'sidebar', undefined, undefined, { label: zh ? '訂單' : 'Orders', action: 'navigate:/orders' }),
      node('nav_customers', 'nav_item', zh ? '客戶' : 'Customers', zh ? '前往客戶列表。' : 'Navigate to customers.', 'sidebar', undefined, undefined, { label: zh ? '客戶' : 'Customers', action: 'navigate:/customers' }),
      node('nav_reports', 'nav_item', zh ? '報表' : 'Reports', zh ? '前往報表。' : 'Navigate to reports.', 'sidebar', undefined, undefined, { label: zh ? '報表' : 'Reports', action: 'navigate:/reports' }),
      node('top_bar', 'top_bar', zh ? '頂部列' : 'Top Bar', zh ? '主內容上方操作列，包含搜尋和帳號選單。' : 'Action bar above main content with search and account menu.', 'app_shell', ['global_search', 'account_menu']),
      node('global_search', 'text_input', zh ? '全域搜尋' : 'Global Search', zh ? '搜尋訂單、客戶與報表。' : 'Search orders, customers, and reports.', 'top_bar', undefined, undefined, { label: zh ? '搜尋' : 'Search', placeholder: zh ? '搜尋訂單、客戶...' : 'Search orders, customers...' }),
      node('account_menu', 'menu', zh ? '帳號選單' : 'Account Menu', zh ? '使用者帳號操作。' : 'User account actions.', 'top_bar', [], undefined, { label: zh ? '帳號' : 'Account' }),
      node('main_page', 'page', zh ? '主內容頁面' : 'Main Page', zh ? '儀表板主要內容區。' : 'Main dashboard content area.', 'app_shell', ['page_header', 'metric_grid', 'chart_section', 'orders_section'], pageLayout()),
      node('page_header', 'section', zh ? '頁面標題' : 'Page Header', zh ? '說明目前儀表板內容。' : 'Describes the current dashboard.', 'main_page', undefined, undefined, { text: zh ? '總覽' : 'Overview' }),
      node('metric_grid', 'section', zh ? '指標區' : 'Metric Grid', zh ? '以格線放置四張關鍵指標卡。' : 'Grid section containing four KPI cards.', 'main_page', ['metric_revenue', 'metric_orders', 'metric_customers', 'metric_conversion'], gridLayout(4)),
      metric('metric_revenue', zh ? '營收' : 'Revenue', 'metrics.revenue.current', 'metric_grid', language),
      metric('metric_orders', zh ? '訂單數' : 'Orders', 'metrics.orders.current', 'metric_grid', language),
      metric('metric_customers', zh ? '新客戶' : 'New Customers', 'metrics.customers.current', 'metric_grid', language),
      metric('metric_conversion', zh ? '轉換率' : 'Conversion', 'metrics.conversion.current', 'metric_grid', language),
      node('chart_section', 'section', zh ? '營收趨勢' : 'Revenue Trend', zh ? '圖表區段，內含圖表佔位元件。' : 'Chart section containing a chart placeholder.', 'main_page', ['revenue_chart'], undefined, { label: zh ? '近 30 天營收趨勢' : 'Revenue trend, last 30 days' }),
      node('revenue_chart', 'chart_placeholder', zh ? '營收圖表' : 'Revenue Chart', zh ? '留給圖表套件實作的視覺位置。' : 'Visual slot for chart implementation.', 'chart_section'),
      node('orders_section', 'section', zh ? '近期訂單' : 'Recent Orders', zh ? '表格區段，內含資料表格。' : 'Table section containing a data table.', 'main_page', ['orders_table']),
      table('orders_table', zh ? '訂單表格' : 'Orders Table', zh ? '近期訂單' : 'Recent orders', 'orders_section', language),
    ],
  }, language);
}

function createLandingTemplate(language: Language): Blueprint {
  const zh = language === 'zh-Hant';
  return blueprint({
    screenId: 'template.landing',
    name: zh ? '產品 Landing 頁' : 'Product Landing Page',
    type: 'landing',
    goal: zh ? '呈現產品價值、功能區塊與主要註冊行動。' : 'Present product value, feature sections, and the primary signup action.',
    nodes: [
      node('page', 'page', zh ? 'Landing 頁面' : 'Landing Page', zh ? '行銷頁的根頁面。' : 'Root page for the marketing screen.', null, ['top_nav', 'hero', 'feature_grid', 'proof_section', 'cta_section'], pageLayout()),
      node('top_nav', 'top_bar', zh ? '頂部導覽' : 'Top Navigation', zh ? '品牌、導覽與登入按鈕。' : 'Brand, navigation, and login action.', 'page', ['product_nav', 'login_button']),
      node('product_nav', 'nav_item', zh ? '產品' : 'Product', zh ? '導向產品介紹區。' : 'Navigate to product details.', 'top_nav', undefined, undefined, { label: zh ? '產品' : 'Product', action: 'navigate:#product' }),
      node('login_button', 'button', zh ? '登入按鈕' : 'Login Button', zh ? '次要登入操作。' : 'Secondary login action.', 'top_nav', undefined, undefined, { label: zh ? '登入' : 'Log in', action: 'navigate:/login' }),
      node('hero', 'section', zh ? '主視覺區' : 'Hero Section', zh ? '第一屏價值主張與主要行動。' : 'First viewport value proposition and primary action.', 'page', ['hero_actions'], undefined, { text: zh ? '把 UI 意圖變成可執行藍圖' : 'Turn UI intent into executable blueprints' }),
      node('hero_actions', 'button_group', zh ? '主行動群組' : 'Hero Actions', zh ? '包含主要和次要行動。' : 'Primary and secondary hero actions.', 'hero', ['primary_cta', 'secondary_cta']),
      node('primary_cta', 'button', zh ? '開始使用' : 'Get Started', zh ? '主要註冊行動。' : 'Primary signup action.', 'hero_actions', undefined, undefined, { label: zh ? '開始使用' : 'Get started', action: 'navigate:/signup' }),
      node('secondary_cta', 'button', zh ? '查看範例' : 'View Examples', zh ? '次要範例導覽。' : 'Secondary examples action.', 'hero_actions', undefined, undefined, { label: zh ? '查看範例' : 'View examples', action: 'navigate:#examples' }),
      node('feature_grid', 'grid', zh ? '功能格線' : 'Feature Grid', zh ? '用格線展示三個功能面板。' : 'Grid showing three feature panels.', 'page', ['feature_schema', 'feature_editor', 'feature_export'], gridLayout(3)),
      node('feature_schema', 'detail_panel', zh ? '結構化 Schema' : 'Structured Schema', zh ? '說明 schema 是來源真相。' : 'Explains schema as source of truth.', 'feature_grid', [], undefined, { label: zh ? 'Schema 是來源真相' : 'Schema as source of truth' }),
      node('feature_editor', 'detail_panel', zh ? '視覺編輯器' : 'Visual Editor', zh ? '說明可視化編排。' : 'Explains visual composition.', 'feature_grid', [], undefined, { label: zh ? '可視化編排 UI' : 'Compose UI visually' }),
      node('feature_export', 'detail_panel', zh ? '代理輸出' : 'Agent Export', zh ? '說明輸出給 coding agent。' : 'Explains export for coding agents.', 'feature_grid', [], undefined, { label: zh ? '輸出給 coding agent' : 'Export for coding agents' }),
      node('proof_section', 'section', zh ? '信任指標' : 'Proof Section', zh ? '以指標卡呈現可信度。' : 'Uses metric cards to communicate credibility.', 'page', ['proof_accuracy', 'proof_speed'], gridLayout(2)),
      metric('proof_accuracy', zh ? '驗證規則' : 'Validation Rules', 'blueprints.validation.rules', 'proof_section', language),
      metric('proof_speed', zh ? '交付速度' : 'Delivery Speed', 'blueprints.delivery.speed', 'proof_section', language),
      node('cta_section', 'section', zh ? '底部行動' : 'Final CTA', zh ? '頁尾註冊行動區。' : 'Footer signup action area.', 'page', ['footer_cta'], undefined, { text: zh ? '準備好建立第一份 UI Blueprint？' : 'Ready to build your first UI Blueprint?' }),
      node('footer_cta', 'button', zh ? '建立藍圖' : 'Create Blueprint', zh ? '前往建立流程。' : 'Navigate to creation flow.', 'cta_section', undefined, undefined, { label: zh ? '建立藍圖' : 'Create blueprint', action: 'navigate:/new' }),
    ],
  }, language);
}

function createSettingsTemplate(language: Language): Blueprint {
  const zh = language === 'zh-Hant';
  return blueprint({
    screenId: 'template.settings',
    name: zh ? '設定表單' : 'Settings Form',
    type: 'settings',
    goal: zh ? '讓使用者透過左側導覽進入設定，並編輯個人資料與通知偏好。' : 'Let users reach settings through sidebar navigation and edit profile and notification preferences.',
    nodes: [
      node('app_shell', 'app_shell', zh ? '應用框架' : 'App Shell', zh ? '設定頁使用的外框版面。' : 'Shell layout for the settings screen.', null, ['sidebar', 'top_bar', 'settings_page']),
      node('sidebar', 'sidebar', zh ? '設定側邊欄' : 'Settings Sidebar', zh ? '設定分類導覽，放在應用框架左側。' : 'Settings navigation categories on the left side of app shell.', 'app_shell', ['nav_profile', 'nav_team', 'nav_billing'], sidebarLayout(), { label: zh ? '設定' : 'Settings' }),
      node('nav_profile', 'nav_item', zh ? '個人資料' : 'Profile', zh ? '目前設定分類。' : 'Current settings category.', 'sidebar', undefined, undefined, { label: zh ? '個人資料' : 'Profile', action: 'navigate:/settings/profile' }),
      node('nav_team', 'nav_item', zh ? '團隊' : 'Team', zh ? '團隊設定連結。' : 'Team settings link.', 'sidebar', undefined, undefined, { label: zh ? '團隊' : 'Team', action: 'navigate:/settings/team' }),
      node('nav_billing', 'nav_item', zh ? '帳務' : 'Billing', zh ? '帳務設定連結。' : 'Billing settings link.', 'sidebar', undefined, undefined, { label: zh ? '帳務' : 'Billing', action: 'navigate:/settings/billing' }),
      node('top_bar', 'top_bar', zh ? '設定頂部列' : 'Settings Top Bar', zh ? '設定頁標題與帳號選單。' : 'Settings title and account menu.', 'app_shell', ['settings_search']),
      node('settings_search', 'text_input', zh ? '搜尋設定' : 'Settings Search', zh ? '搜尋設定項目。' : 'Search settings.', 'top_bar', undefined, undefined, { label: zh ? '搜尋設定' : 'Search settings', placeholder: zh ? '搜尋設定...' : 'Search settings...' }),
      node('settings_page', 'page', zh ? '設定頁面' : 'Settings Page', zh ? '表單主內容。' : 'Main form content.', 'app_shell', ['breadcrumb', 'profile_form'], pageLayout()),
      node('breadcrumb', 'breadcrumb', zh ? '麵包屑' : 'Breadcrumb', zh ? '顯示目前設定位置。' : 'Shows current settings location.', 'settings_page', undefined, undefined, { label: zh ? '個人資料' : 'Profile' }),
      node('profile_form', 'form', zh ? '個人資料表單' : 'Profile Form', zh ? '編輯個人資料和偏好設定。' : 'Edit profile and preferences.', 'settings_page', ['account_group', 'preference_group', 'form_actions'], formLayout(), { label: zh ? '個人資料' : 'Profile', action: 'submit:save_profile' }),
      node('account_group', 'field_group', zh ? '帳號資訊' : 'Account Info', zh ? '基本帳號欄位。' : 'Basic account fields.', 'profile_form', ['name_input', 'email_input', 'role_select']),
      input('name_input', zh ? '姓名' : 'Name', zh ? '輸入姓名' : 'Enter name', 'account_group', language),
      input('email_input', zh ? '電子郵件' : 'Email', zh ? '輸入電子郵件' : 'Enter email', 'account_group', language),
      node('role_select', 'select', zh ? '角色' : 'Role', zh ? '角色下拉選單。' : 'Role dropdown.', 'account_group', undefined, undefined, { label: zh ? '角色' : 'Role', placeholder: zh ? '選擇角色' : 'Choose role' }),
      node('preference_group', 'field_group', zh ? '偏好設定' : 'Preferences', zh ? '通知和安全偏好。' : 'Notification and security preferences.', 'profile_form', ['email_toggle', 'security_checkbox']),
      node('email_toggle', 'toggle', zh ? '電子郵件通知' : 'Email Notifications', zh ? '控制是否寄送通知。' : 'Controls notification emails.', 'preference_group', undefined, undefined, { label: zh ? '電子郵件通知' : 'Email notifications' }),
      node('security_checkbox', 'checkbox', zh ? '啟用雙重驗證' : 'Enable Two-factor', zh ? '安全設定核取方塊。' : 'Security setting checkbox.', 'preference_group', undefined, undefined, { label: zh ? '啟用雙重驗證' : 'Enable two-factor authentication' }),
      node('form_actions', 'toolbar', zh ? '表單操作' : 'Form Actions', zh ? '儲存和取消操作。' : 'Save and cancel actions.', 'profile_form', ['save_button', 'cancel_button']),
      node('save_button', 'button', zh ? '儲存' : 'Save', zh ? '提交表單。' : 'Submit the form.', 'form_actions', undefined, undefined, { label: zh ? '儲存' : 'Save', action: 'submit:profile_form' }),
      node('cancel_button', 'button', zh ? '取消' : 'Cancel', zh ? '取消變更。' : 'Cancel changes.', 'form_actions', undefined, undefined, { label: zh ? '取消' : 'Cancel', action: 'navigate:/settings' }),
    ],
  }, language);
}

function blueprint(input: {
  screenId: string;
  name: string;
  type: Blueprint['screen']['type'];
  goal: string;
  nodes: UINode[];
}, language: Language): Blueprint {
  return {
    version: '0.1.0',
    screen: {
      id: input.screenId,
      name: input.name,
      type: input.type,
      platform: 'web',
      primary_user_goal: input.goal,
      notes: language === 'zh-Hant'
        ? '此範本展示元件父子關係：側邊欄要放在應用框架中才會顯示為左側欄。'
        : 'This template demonstrates component hierarchy: sidebar appears as a left rail when placed inside app_shell.',
    },
    viewports: [
      { id: 'desktop', width: 1440, height: 900 },
      { id: 'tablet', width: 1024, height: 768 },
      { id: 'mobile', width: 390, height: 844 },
    ],
    nodes: input.nodes,
    interactions: [],
    responsive: [
      {
        viewport: 'mobile',
        rule: 'stack',
        target_node_id: input.nodes[0]?.id ?? 'root',
        changes: {},
      },
    ],
    acceptance: acceptance(language),
  };
}

function node(
  id: string,
  type: ComponentType,
  name: string,
  role: string,
  parent_id: string | null,
  children?: string[],
  layout?: Layout,
  content?: UINode['content']
): UINode {
  const result: UINode = { id, type, name, role, parent_id };
  if (children) result.children = children;
  if (layout) result.layout = layout;
  if (content) result.content = content;
  return result;
}

function metric(id: string, label: string, binding: string, parentId: string, language: Language): UINode {
  return node(
    id,
    'metric_card',
    label,
    language === 'zh-Hant' ? `顯示「${label}」指標。` : `Displays the ${label} metric.`,
    parentId,
    undefined,
    undefined,
    { label, data_binding: binding }
  );
}

function table(id: string, name: string, label: string, parentId: string, language: Language): UINode {
  const zh = language === 'zh-Hant';
  return node(id, 'data_table', name, zh ? '顯示可排序的資料列表。' : 'Displays a sortable data list.', parentId, undefined, undefined, {
    label,
    data_binding: 'orders.recent',
    columns: [
      { id: 'order_id', header: zh ? '訂單編號' : 'Order ID', sortable: true },
      { id: 'customer', header: zh ? '客戶' : 'Customer', sortable: true },
      { id: 'amount', header: zh ? '金額' : 'Amount', sortable: true },
      { id: 'status', header: zh ? '狀態' : 'Status', filterable: true },
    ],
  });
}

function input(id: string, label: string, placeholder: string, parentId: string, language: Language): UINode {
  return node(
    id,
    'text_input',
    label,
    language === 'zh-Hant' ? `輸入「${label}」。` : `Input for ${label}.`,
    parentId,
    undefined,
    undefined,
    { label, placeholder }
  );
}

function sidebarLayout(): Layout {
  return {
    display: 'flex',
    direction: 'column',
    gap: { y: 4 },
    padding: { top: 24, right: 16, bottom: 24, left: 16 },
    width: { value: 240, unit: 'px' },
  };
}

function pageLayout(): Layout {
  return {
    display: 'flex',
    direction: 'column',
    gap: { y: 20 },
    padding: { top: 24, right: 28, bottom: 32, left: 28 },
  };
}

function gridLayout(columns: number): Layout {
  return {
    display: 'grid',
    grid: { columns },
    gap: { x: 14, y: 14 },
  };
}

function formLayout(): Layout {
  return {
    display: 'flex',
    direction: 'column',
    gap: { y: 16 },
    padding: { top: 18, right: 18, bottom: 18, left: 18 },
  };
}

function acceptance(language: Language): Acceptance[] {
  const zh = language === 'zh-Hant';
  return [
    {
      id: 'acc_template_layout',
      type: 'layout',
      statement: zh ? '桌面版中主要結構元件依父子關係清楚排列。' : 'Primary structural components are clearly arranged according to hierarchy on desktop.',
      target: '*',
      priority: 'must',
      verification_method: 'manual_visual',
    },
    {
      id: 'acc_template_interaction',
      type: 'interaction',
      statement: zh ? '所有按鈕和導覽項目都有 action 意圖。' : 'All buttons and navigation items declare an action intent.',
      target: '*',
      priority: 'must',
      verification_method: 'manual_ia_review',
    },
    {
      id: 'acc_template_responsive',
      type: 'responsive',
      statement: zh ? '手機版可堆疊閱讀且不需要水平捲動。' : 'Mobile can be read as stacked content without horizontal scrolling.',
      target: 'mobile',
      priority: 'must',
      verification_method: 'manual_visual',
    },
    {
      id: 'acc_template_a11y',
      type: 'a11y',
      statement: zh ? '互動元件具備可理解的文字標籤。' : 'Interactive components have understandable text labels.',
      target: '*',
      priority: 'must',
      verification_method: 'manual_ia_review',
    },
    {
      id: 'acc_template_content',
      type: 'content',
      statement: zh ? '每個區段名稱能說明該區域用途。' : 'Every section name explains the purpose of that area.',
      target: '*',
      priority: 'should',
      verification_method: 'manual_ia_review',
    },
  ];
}
