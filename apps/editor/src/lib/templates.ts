import { t, type Language } from './i18n';
import { defaultLayoutForType } from './store';
import type { Acceptance, Blueprint, ComponentType, Interaction, Placement, UINode } from '../types';
import { defaultDesignSystem } from '../../../../scripts/migrate-blueprint.mjs';
import { scaffoldInteractions } from '../../../../scripts/scaffold-blueprint.lib.mjs';

export type TemplateId =
  | 'dashboard'
  | 'admin-table'
  | 'crm'
  | 'kanban'
  | 'chat'
  | 'mail'
  | 'wiki'
  | 'files'
  | 'calendar'
  | 'settings'
  | 'catalog'
  | 'product-detail'
  | 'checkout'
  | 'feed'
  | 'booking'
  | 'landing'
  | 'pricing'
  | 'onboarding';

export const TEMPLATE_IDS: TemplateId[] = [
  'dashboard', 'admin-table', 'crm', 'kanban', 'chat', 'mail', 'wiki', 'files', 'calendar',
  'settings', 'catalog', 'product-detail', 'checkout', 'feed', 'booking', 'landing', 'pricing', 'onboarding',
];

export const TEMPLATE_GROUPS = [
  { id: 'business', labelZh: '商務軟體', labelEn: 'Business software', ids: ['dashboard', 'admin-table', 'crm', 'kanban', 'settings'] as TemplateId[] },
  { id: 'productivity', labelZh: '協作與生產力', labelEn: 'Collaboration & productivity', ids: ['chat', 'mail', 'wiki', 'files', 'calendar'] as TemplateId[] },
  { id: 'commerce', labelZh: '商務與服務', labelEn: 'Commerce & services', ids: ['catalog', 'product-detail', 'checkout', 'booking'] as TemplateId[] },
  { id: 'consumer', labelZh: '內容與成長', labelEn: 'Content & growth', ids: ['feed', 'landing', 'pricing', 'onboarding'] as TemplateId[] },
] as const;

const LABELS: Record<TemplateId, [string, string]> = {
  dashboard: ['分析儀表板', 'Analytics Dashboard'],
  'admin-table': ['管理資料表', 'Admin Data Table'],
  crm: ['CRM 列表詳情', 'CRM List Detail'],
  kanban: ['專案看板', 'Project Kanban'],
  chat: ['團隊聊天', 'Team Chat'],
  mail: ['郵件收件匣', 'Mail Inbox'],
  wiki: ['文件 Wiki', 'Docs Wiki'],
  files: ['檔案管理', 'File Manager'],
  calendar: ['行事曆規劃', 'Calendar Planner'],
  settings: ['帳號設定', 'Account Settings'],
  catalog: ['商品目錄', 'Product Catalog'],
  'product-detail': ['商品詳情', 'Product Detail'],
  checkout: ['結帳流程', 'Checkout'],
  feed: ['內容動態', 'Content Feed'],
  booking: ['預約搜尋', 'Booking Search'],
  landing: ['SaaS Landing', 'SaaS Landing'],
  pricing: ['價格方案', 'Pricing'],
  onboarding: ['註冊與導覽', 'Signup & Onboarding'],
};

const DESCRIPTIONS: Record<TemplateId, [string, string]> = {
  dashboard: ['側邊導覽、KPI、趨勢圖與近期資料。', 'Sidebar, KPIs, trend chart, and recent data.'],
  'admin-table': ['篩選工具列、批次操作、資料表與分頁。', 'Filters, bulk actions, data table, and pagination.'],
  crm: ['客戶列表、聯絡人摘要、交易與活動紀錄。', 'Customer list, contact summary, deals, and activity.'],
  kanban: ['可橫向瀏覽的工作流程欄與任務卡。', 'Horizontal workflow columns with task cards.'],
  chat: ['頻道、對話訊息、成員資訊與輸入區。', 'Channels, messages, member details, and composer.'],
  mail: ['信箱分類、郵件列表與閱讀窗格。', 'Mailbox folders, message list, and reading pane.'],
  wiki: ['文件樹、編輯器、目錄與協作狀態。', 'Document tree, editor, outline, and collaboration status.'],
  files: ['資料夾樹、檔案格線、搜尋與詳細資料。', 'Folder tree, file grid, search, and details.'],
  calendar: ['迷你月曆、週行程與待辦議程。', 'Mini calendar, week schedule, and agenda.'],
  settings: ['設定分類、個人資料、安全與通知。', 'Settings navigation, profile, security, and notifications.'],
  catalog: ['商品篩選、排序、商品卡與分頁。', 'Product filters, sorting, cards, and pagination.'],
  'product-detail': ['商品圖片、資訊、選項、行動與說明分頁。', 'Gallery, product info, options, actions, and tabs.'],
  checkout: ['步驟、地址付款表單與訂單摘要。', 'Steps, address/payment forms, and order summary.'],
  feed: ['導覽、發文工具、動態串與熱門話題。', 'Navigation, composer, feed, and trending topics.'],
  booking: ['搜尋條件、結果列表、地圖與篩選。', 'Search criteria, results, map, and filters.'],
  landing: ['產品導覽、主視覺、功能、證明與 CTA。', 'Product navigation, hero, features, proof, and CTA.'],
  pricing: ['方案切換、價格卡、比較與常見問題。', 'Billing toggle, pricing cards, comparison, and FAQ.'],
  onboarding: ['註冊表單、步驟指示、說明與完成行動。', 'Signup form, progress, guidance, and completion action.'],
};

export function templateLabel(language: Language, id: TemplateId) {
  return LABELS[id][language === 'zh-Hant' ? 0 : 1];
}

export function templateDescription(language: Language, id: TemplateId) {
  return DESCRIPTIONS[id][language === 'zh-Hant' ? 0 : 1];
}

export function createTemplateBlueprint(id: TemplateId, language: Language): Blueprint {
  switch (id) {
    case 'dashboard': return dashboard(language);
    case 'admin-table': return adminTable(language);
    case 'crm': return crm(language);
    case 'kanban': return kanban(language);
    case 'chat': return chat(language);
    case 'mail': return mail(language);
    case 'wiki': return wiki(language);
    case 'files': return files(language);
    case 'calendar': return calendar(language);
    case 'settings': return settings(language);
    case 'catalog': return catalog(language);
    case 'product-detail': return productDetail(language);
    case 'checkout': return checkout(language);
    case 'feed': return feed(language);
    case 'booking': return booking(language);
    case 'landing': return landing(language);
    case 'pricing': return pricing(language);
    case 'onboarding': return onboarding(language);
  }
}

function dashboard(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('dashboard', 'dashboard', language, [
    direct('title', 'heading', zh ? '營運總覽' : 'Operations overview', pl(280, 92, 520, 46, 244, 88, 460, 44, 16, 76, 358, 44)),
    direct('subtitle', 'text', zh ? '追蹤本月銷售與客戶成長。' : 'Track monthly sales and customer growth.', pl(280, 144, 620, 38, 244, 138, 520, 38, 16, 126, 358, 42)),
    ...metricRow(language),
    direct('revenue_chart', 'chart_placeholder', zh ? '營收趨勢' : 'Revenue trend', pl(280, 330, 690, 280, 244, 400, 520, 170, 16, 452, 358, 230), { label: zh ? '近 30 天營收' : 'Revenue, last 30 days' }),
    container('summary_card', 'card', zh ? '通路摘要' : 'Channel summary', ['summary_metric', 'summary_text'], pl(990, 330, 410, 280, 780, 400, 228, 170, 16, 694, 358, 150)),
    child('summary_metric', 'metric_card', 'summary_card', zh ? '轉換率' : 'Conversion', { label: zh ? '轉換率' : 'Conversion', value: '4.8%' }),
    child('summary_text', 'text', 'summary_card', zh ? '自然搜尋仍是成長最快的通路。' : 'Organic search remains the fastest-growing channel.', { text: zh ? '自然搜尋仍是成長最快的通路。' : 'Organic search remains the fastest-growing channel.' }),
    direct('orders_table', 'data_table', zh ? '近期訂單' : 'Recent orders', pl(280, 630, 1120, 240, 244, 590, 764, 150, 16, 860, 358, 260), tableContent(language)),
  ]);
}

function adminTable(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('admin-table', 'admin_table', language, [
    direct('title', 'heading', zh ? '使用者管理' : 'User management', pl(280, 92, 460, 46, 244, 88, 420, 44, 16, 76, 358, 44)),
    container('filters', 'toolbar', zh ? '篩選與批次操作' : 'Filters and bulk actions', ['user_search', 'role_filter', 'status_filter', 'invite_button'], pl(280, 154, 1120, 68, 244, 146, 764, 68, 16, 130, 358, 180), undefined, rowLayout()),
    child('user_search', 'search_input', 'filters', zh ? '搜尋使用者' : 'Search users', { label: zh ? '搜尋' : 'Search', placeholder: zh ? '姓名或電子郵件' : 'Name or email' }),
    child('role_filter', 'select', 'filters', zh ? '角色' : 'Role', { label: zh ? '角色' : 'Role', placeholder: zh ? '全部角色' : 'All roles' }),
    child('status_filter', 'select', 'filters', zh ? '狀態' : 'Status', { label: zh ? '狀態' : 'Status', placeholder: zh ? '全部狀態' : 'All statuses' }),
    child('invite_button', 'button', 'filters', zh ? '邀請使用者' : 'Invite user', { label: zh ? '邀請使用者' : 'Invite user', action: 'open:invite_user' }),
    direct('users_table', 'data_table', zh ? '使用者資料表' : 'Users table', pl(280, 242, 1120, 520, 244, 234, 764, 430, 16, 326, 358, 430), {
      label: zh ? '所有使用者' : 'All users',
      data_binding: 'users.all',
      columns: [
        { id: 'user', header: zh ? '使用者' : 'User', sortable: true },
        { id: 'role', header: zh ? '角色' : 'Role', filterable: true },
        { id: 'status', header: zh ? '狀態' : 'Status', filterable: true },
        { id: 'last_active', header: zh ? '最後活動' : 'Last active', sortable: true },
      ],
    }),
    direct('pagination', 'pagination', zh ? '分頁' : 'Pagination', pl(1040, 782, 360, 52, 648, 682, 360, 52, 16, 776, 358, 52)),
  ]);
}

function crm(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('crm', 'detail', language, [
    direct('title', 'heading', zh ? '客戶關係管理' : 'Customer relationships', pl(280, 92, 560, 46, 244, 88, 500, 44, 16, 76, 358, 44)),
    container('customer_list', 'list', zh ? '客戶列表' : 'Customer list', ['customer_a', 'customer_b', 'customer_c'], pl(280, 158, 320, 700, 244, 146, 270, 600, 16, 136, 358, 190)),
    child('customer_a', 'nav_item', 'customer_list', zh ? '陳怡君 · Arc Studio' : 'Avery Chen · Arc Studio', { label: zh ? '陳怡君 · Arc Studio' : 'Avery Chen · Arc Studio', action: 'select:customer_a' }),
    child('customer_b', 'nav_item', 'customer_list', zh ? '王偉哲 · Northstar' : 'Noah Wang · Northstar', { label: zh ? '王偉哲 · Northstar' : 'Noah Wang · Northstar', action: 'select:customer_b' }),
    child('customer_c', 'nav_item', 'customer_list', zh ? '林雅婷 · Bridge Co.' : 'Mia Lin · Bridge Co.', { label: zh ? '林雅婷 · Bridge Co.' : 'Mia Lin · Bridge Co.', action: 'select:customer_c' }),
    container('contact_card', 'card', zh ? '客戶摘要' : 'Contact summary', ['contact_avatar', 'contact_name', 'contact_meta', 'contact_actions'], pl(620, 158, 780, 220, 530, 146, 478, 210, 16, 344, 358, 240)),
    child('contact_avatar', 'avatar', 'contact_card', zh ? '陳怡君' : 'Avery Chen', { alt: zh ? '陳怡君' : 'Avery Chen' }),
    child('contact_name', 'heading', 'contact_card', zh ? '陳怡君' : 'Avery Chen', { text: zh ? '陳怡君' : 'Avery Chen' }),
    child('contact_meta', 'text', 'contact_card', zh ? 'Arc Studio · 產品總監 · 台北' : 'Arc Studio · Product director · Taipei', { text: zh ? 'Arc Studio · 產品總監 · 台北' : 'Arc Studio · Product director · Taipei' }),
    child('contact_actions', 'button_group', 'contact_card', zh ? '聯絡操作' : 'Contact actions', undefined, ['email_action', 'call_action']),
    child('email_action', 'button', 'contact_actions', zh ? '寄送郵件' : 'Email', { label: zh ? '寄送郵件' : 'Email', action: 'compose:email' }),
    child('call_action', 'button', 'contact_actions', zh ? '安排通話' : 'Schedule call', { label: zh ? '安排通話' : 'Schedule call', action: 'open:schedule' }),
    container('deal_panel', 'detail_panel', zh ? '交易與活動' : 'Deals and activity', ['deal_metric', 'activity_feed'], pl(620, 398, 780, 460, 530, 374, 478, 372, 16, 604, 358, 420)),
    child('deal_metric', 'metric_card', 'deal_panel', zh ? '商機價值' : 'Pipeline value', { label: zh ? '商機價值' : 'Pipeline value', value: '$84,000' }),
    child('activity_feed', 'activity_feed', 'deal_panel', zh ? '近期活動' : 'Recent activity', undefined, ['activity_1', 'activity_2']),
    child('activity_1', 'text', 'activity_feed', zh ? '今天 10:40 更新採購時程。' : 'Updated purchase timeline today at 10:40.', { text: zh ? '今天 10:40 更新採購時程。' : 'Updated purchase timeline today at 10:40.' }),
    child('activity_2', 'text', 'activity_feed', zh ? '昨天寄出產品方案。' : 'Sent product proposal yesterday.', { text: zh ? '昨天寄出產品方案。' : 'Sent product proposal yesterday.' }),
  ]);
}

function kanban(language: Language) {
  const zh = language === 'zh-Hant';
  const columns = [
    ['todo', zh ? '待處理' : 'To do'],
    ['progress', zh ? '進行中' : 'In progress'],
    ['review', zh ? '審查中' : 'Review'],
    ['done', zh ? '已完成' : 'Done'],
  ] as const;
  const boardChildren = columns.map(([id]) => `column_${id}`);
  const nested: UINode[] = [];
  for (const [id, label] of columns) {
    nested.push(child(`column_${id}`, 'kanban_column', 'project_board', label, { label }, [`task_${id}_1`, `task_${id}_2`]));
    nested.push(child(`task_${id}_1`, 'card', `column_${id}`, `${label} 1`, { label: zh ? '改善登入流程' : 'Improve sign-in flow' }, [`task_${id}_1_title`, `task_${id}_1_tag`]));
    nested.push(child(`task_${id}_1_title`, 'text', `task_${id}_1`, zh ? '改善登入流程' : 'Improve sign-in flow', { text: zh ? '改善登入流程' : 'Improve sign-in flow' }));
    nested.push(child(`task_${id}_1_tag`, 'tag', `task_${id}_1`, 'Design', { text: 'Design' }));
    nested.push(child(`task_${id}_2`, 'card', `column_${id}`, `${label} 2`, { label: zh ? '更新分析事件' : 'Update analytics events' }, [`task_${id}_2_title`]));
    nested.push(child(`task_${id}_2_title`, 'text', `task_${id}_2`, zh ? '更新分析事件' : 'Update analytics events', { text: zh ? '更新分析事件' : 'Update analytics events' }));
  }
  return appBlueprint('kanban', 'workspace', language, [
    direct('title', 'heading', zh ? '產品開發看板' : 'Product development', pl(280, 92, 520, 46, 244, 88, 270, 44, 16, 76, 358, 44)),
    container('board_toolbar', 'toolbar', zh ? '看板工具' : 'Board tools', ['board_search', 'filter_button', 'add_task'], pl(820, 84, 580, 60, 530, 80, 478, 60, 16, 126, 358, 128), undefined, rowLayout()),
    child('board_search', 'search_input', 'board_toolbar', zh ? '搜尋任務' : 'Search tasks', { placeholder: zh ? '搜尋任務' : 'Search tasks' }),
    child('filter_button', 'button', 'board_toolbar', zh ? '篩選' : 'Filter', { label: zh ? '篩選' : 'Filter', action: 'open:filters' }),
    child('add_task', 'button', 'board_toolbar', zh ? '新增任務' : 'Add task', { label: zh ? '新增任務' : 'Add task', action: 'open:new_task' }),
    container('project_board', 'kanban_board', zh ? '工作流程' : 'Workflow', boardChildren, pl(280, 166, 1120, 690, 244, 160, 764, 586, 16, 276, 358, 540), undefined, { mode: 'auto', display: 'flex', direction: 'row', gap: { x: 14, y: 14 } }),
    ...nested,
  ]);
}

function chat(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('chat', 'communication', language, [
    container('channels', 'list', zh ? '頻道與私訊' : 'Channels and messages', ['channel_general', 'channel_product', 'dm_alex'], pl(280, 82, 260, 776, 244, 76, 230, 670, 16, 76, 358, 180)),
    child('channel_general', 'nav_item', 'channels', '# general', { label: '# general', action: 'select:general' }),
    child('channel_product', 'nav_item', 'channels', '# product', { label: '# product', action: 'select:product' }),
    child('dm_alex', 'nav_item', 'channels', zh ? '● 子晴' : '● Alex', { label: zh ? '● 子晴' : '● Alex', action: 'select:alex' }),
    container('conversation', 'card', '# product', ['conversation_title', 'messages', 'composer'], pl(560, 82, 610, 776, 490, 76, 518, 670, 16, 276, 358, 520)),
    child('conversation_title', 'heading', 'conversation', '# product', { text: '# product' }),
    child('messages', 'activity_feed', 'conversation', zh ? '對話訊息' : 'Messages', undefined, ['message_1', 'message_2', 'message_3']),
    child('message_1', 'text', 'messages', zh ? '子晴：新版畫布今天可以測試。' : 'Alex: The new canvas is ready to test today.', { text: zh ? '子晴：新版畫布今天可以測試。' : 'Alex: The new canvas is ready to test today.' }),
    child('message_2', 'text', 'messages', zh ? '承恩：我會先檢查行動版。' : 'Jordan: I will check mobile first.', { text: zh ? '承恩：我會先檢查行動版。' : 'Jordan: I will check mobile first.' }),
    child('message_3', 'text', 'messages', zh ? '你：收到，截圖放在線程。' : 'You: Got it, post screenshots in the thread.', { text: zh ? '你：收到，截圖放在線程。' : 'You: Got it, post screenshots in the thread.' }),
    child('composer', 'textarea', 'conversation', zh ? '訊息輸入' : 'Message composer', { placeholder: zh ? '傳送訊息到 #product' : 'Message #product', action: 'submit:message' }),
    container('members', 'detail_panel', zh ? '頻道資訊' : 'Channel details', ['member_count', 'member_list'], pl(1190, 82, 210, 776, 16, 766, 992, 260, 16, 816, 358, 260)),
    child('member_count', 'badge', 'members', zh ? '12 位成員' : '12 members', { text: zh ? '12 位成員' : '12 members' }),
    child('member_list', 'list', 'members', zh ? '成員' : 'Members', { label: zh ? '成員' : 'Members' }),
  ]);
}

function mail(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('mail', 'communication', language, [
    container('mail_folders', 'list', zh ? '信箱分類' : 'Mailbox folders', ['inbox', 'starred', 'sent', 'drafts'], pl(280, 82, 210, 776, 244, 76, 190, 670, 16, 76, 358, 160)),
    ...([
      ['inbox', zh ? '收件匣 24' : 'Inbox 24'],
      ['starred', zh ? '已加星號' : 'Starred'],
      ['sent', zh ? '寄件備份' : 'Sent'],
      ['drafts', zh ? '草稿 3' : 'Drafts 3'],
    ] satisfies Array<[string, string]>).map(([id, label]) => child(id, 'nav_item', 'mail_folders', label, { label, action: `select:${id}` })),
    container('message_list', 'list', zh ? '郵件列表' : 'Message list', ['mail_1', 'mail_2', 'mail_3', 'mail_4'], pl(510, 82, 380, 776, 450, 76, 330, 670, 16, 256, 358, 260)),
    ...['產品更新與下週排程', '六月帳單已開立', '設計審查摘要', '歡迎加入工作區'].map((label, index) => {
      const english = ['Product update and next week', 'June invoice available', 'Design review summary', 'Welcome to the workspace'][index] ?? label;
      return child(`mail_${index + 1}`, 'card', 'message_list', zh ? label : english, { label: zh ? label : english });
    }),
    container('message_reader', 'detail_panel', zh ? '郵件內容' : 'Message reader', ['mail_subject', 'mail_sender', 'mail_body', 'reply_button'], pl(910, 82, 490, 776, 800, 76, 208, 670, 16, 536, 358, 420)),
    child('mail_subject', 'heading', 'message_reader', zh ? '產品更新與下週排程' : 'Product update and next week', { text: zh ? '產品更新與下週排程' : 'Product update and next week' }),
    child('mail_sender', 'text', 'message_reader', zh ? '來自：產品團隊 · 今天 09:14' : 'From: Product team · Today 09:14', { text: zh ? '來自：產品團隊 · 今天 09:14' : 'From: Product team · Today 09:14' }),
    child('mail_body', 'text', 'message_reader', zh ? '新版編輯器已進入測試階段，請依清單確認自由拖曳、範本和匯出結果。' : 'The new editor is ready for testing. Please verify freeform layout, templates, and exports.', { text: zh ? '新版編輯器已進入測試階段，請依清單確認自由拖曳、範本和匯出結果。' : 'The new editor is ready for testing. Please verify freeform layout, templates, and exports.' }),
    child('reply_button', 'button', 'message_reader', zh ? '回覆' : 'Reply', { label: zh ? '回覆' : 'Reply', action: 'open:reply' }),
  ]);
}

function wiki(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('wiki', 'content', language, [
    container('doc_tree', 'list', zh ? '文件樹' : 'Document tree', ['doc_home', 'doc_product', 'doc_api', 'doc_release'], pl(280, 82, 250, 776, 244, 76, 220, 670, 16, 76, 358, 170)),
    ...([
      ['doc_home', zh ? '首頁' : 'Home'],
      ['doc_product', zh ? '產品規格' : 'Product specs'],
      ['doc_api', 'API'],
      ['doc_release', zh ? '版本紀錄' : 'Release notes'],
    ] satisfies Array<[string, string]>).map(([id, label]) => child(id, 'nav_item', 'doc_tree', label, { label, action: `open:${id}` })),
    container('editor', 'rich_text_editor', zh ? '文件編輯器' : 'Document editor', ['editor_toolbar', 'doc_title', 'doc_intro', 'doc_section', 'doc_body'], pl(550, 82, 650, 776, 480, 76, 528, 670, 16, 266, 358, 540)),
    child('editor_toolbar', 'toolbar', 'editor', zh ? '文字工具列' : 'Formatting toolbar', undefined, ['bold', 'italic', 'link']),
    child('bold', 'icon_button', 'editor_toolbar', zh ? '粗體' : 'Bold', { label: zh ? '粗體' : 'Bold', icon: 'bold', action: 'format:bold' }),
    child('italic', 'icon_button', 'editor_toolbar', zh ? '斜體' : 'Italic', { label: zh ? '斜體' : 'Italic', icon: 'italic', action: 'format:italic' }),
    child('link', 'icon_button', 'editor_toolbar', zh ? '連結' : 'Link', { label: zh ? '連結' : 'Link', icon: 'link', action: 'format:link' }),
    child('doc_title', 'heading', 'editor', zh ? 'UI Blueprint 0.2' : 'UI Blueprint 0.2', { text: 'UI Blueprint 0.2' }),
    child('doc_intro', 'text', 'editor', zh ? '這份文件說明自由畫布與精確幾何資料的使用方式。' : 'This document explains the freeform canvas and exact geometry data.', { text: zh ? '這份文件說明自由畫布與精確幾何資料的使用方式。' : 'This document explains the freeform canvas and exact geometry data.' }),
    child('doc_section', 'heading', 'editor', zh ? '自由與自動佈局' : 'Freeform and auto layout', { text: zh ? '自由與自動佈局' : 'Freeform and auto layout' }),
    child('doc_body', 'text', 'editor', zh ? '容器可自由切換模式，且每個 viewport 都能保存獨立位置。' : 'Containers can switch modes and preserve geometry per viewport.', { text: zh ? '容器可自由切換模式，且每個 viewport 都能保存獨立位置。' : 'Containers can switch modes and preserve geometry per viewport.' }),
    container('outline', 'detail_panel', zh ? '頁面目錄' : 'Page outline', ['outline_1', 'outline_2'], pl(1220, 82, 180, 776, 16, 766, 992, 180, 16, 826, 358, 170)),
    child('outline_1', 'link', 'outline', zh ? '概觀' : 'Overview', { text: zh ? '概觀' : 'Overview', action: 'navigate:#overview' }),
    child('outline_2', 'link', 'outline', zh ? '自由與自動佈局' : 'Freeform and auto layout', { text: zh ? '自由與自動佈局' : 'Freeform and auto layout', action: 'navigate:#layout' }),
  ]);
}

function files(language: Language) {
  const zh = language === 'zh-Hant';
  const fileCards = ['design', 'research', 'roadmap', 'assets'].map((id, index) => {
    const name = zh
      ? ['設計稿', '研究資料', '產品路線圖', '品牌素材'][index] ?? id
      : ['Design', 'Research', 'Roadmap', 'Brand assets'][index] ?? id;
    return child(`file_${id}`, 'card', 'file_grid', name, { label: name });
  });
  return appBlueprint('files', 'files', language, [
    container('folder_tree', 'list', zh ? '資料夾' : 'Folders', ['folder_home', 'folder_shared', 'folder_recent'], pl(280, 82, 230, 776, 244, 76, 210, 670, 16, 76, 358, 150)),
    child('folder_home', 'nav_item', 'folder_tree', zh ? '我的檔案' : 'My files', { label: zh ? '我的檔案' : 'My files', action: 'open:my_files' }),
    child('folder_shared', 'nav_item', 'folder_tree', zh ? '共用項目' : 'Shared', { label: zh ? '共用項目' : 'Shared', action: 'open:shared' }),
    child('folder_recent', 'nav_item', 'folder_tree', zh ? '最近使用' : 'Recent', { label: zh ? '最近使用' : 'Recent', action: 'open:recent' }),
    container('file_toolbar', 'toolbar', zh ? '檔案工具' : 'File tools', ['file_search', 'upload_file', 'new_folder'], pl(530, 82, 870, 66, 470, 76, 538, 66, 16, 246, 358, 150), undefined, rowLayout()),
    child('file_search', 'search_input', 'file_toolbar', zh ? '搜尋檔案' : 'Search files', { placeholder: zh ? '搜尋檔案' : 'Search files' }),
    child('upload_file', 'button', 'file_toolbar', zh ? '上傳' : 'Upload', { label: zh ? '上傳' : 'Upload', action: 'open:file_upload' }),
    child('new_folder', 'button', 'file_toolbar', zh ? '新增資料夾' : 'New folder', { label: zh ? '新增資料夾' : 'New folder', action: 'create:folder' }),
    container('file_grid', 'grid', zh ? '檔案格線' : 'File grid', fileCards.map((node) => node.id), pl(530, 168, 640, 690, 470, 158, 538, 588, 16, 416, 358, 420), undefined, { mode: 'auto', display: 'grid', grid: { columns: 2 }, gap: { x: 14, y: 14 } }),
    ...fileCards,
    container('file_details', 'detail_panel', zh ? '檔案詳細資料' : 'File details', ['file_preview', 'file_name', 'file_meta'], pl(1190, 168, 210, 690, 16, 766, 992, 180, 16, 856, 358, 180)),
    child('file_preview', 'image', 'file_details', zh ? '預覽' : 'Preview', { alt: zh ? '檔案預覽' : 'File preview' }),
    child('file_name', 'heading', 'file_details', zh ? '產品路線圖' : 'Product roadmap', { text: zh ? '產品路線圖' : 'Product roadmap' }),
    child('file_meta', 'text', 'file_details', zh ? 'PDF · 4.2 MB · 2 小時前更新' : 'PDF · 4.2 MB · Updated 2h ago', { text: zh ? 'PDF · 4.2 MB · 2 小時前更新' : 'PDF · 4.2 MB · Updated 2h ago' }),
  ]);
}

function calendar(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('calendar', 'calendar', language, [
    container('calendar_sidebar', 'card', zh ? '日期與行事曆' : 'Date and calendars', ['mini_calendar', 'calendar_list'], pl(280, 82, 260, 776, 244, 76, 230, 670, 16, 76, 358, 260)),
    child('mini_calendar', 'calendar', 'calendar_sidebar', zh ? '迷你月曆' : 'Mini calendar'),
    child('calendar_list', 'list', 'calendar_sidebar', zh ? '我的行事曆' : 'My calendars', { label: zh ? '工作、個人、提醒' : 'Work, personal, reminders' }),
    direct('week_calendar', 'calendar', zh ? '週行程' : 'Week schedule', pl(560, 82, 600, 776, 490, 76, 518, 670, 16, 356, 358, 460)),
    container('agenda', 'detail_panel', zh ? '今天議程' : 'Today agenda', ['agenda_1', 'agenda_2', 'agenda_3'], pl(1180, 82, 220, 776, 16, 766, 992, 380, 16, 836, 358, 340)),
    child('agenda_1', 'card', 'agenda', zh ? '09:30 產品同步' : '09:30 Product sync', { label: zh ? '09:30 產品同步' : '09:30 Product sync' }),
    child('agenda_2', 'card', 'agenda', zh ? '13:00 設計審查' : '13:00 Design review', { label: zh ? '13:00 設計審查' : '13:00 Design review' }),
    child('agenda_3', 'card', 'agenda', zh ? '16:30 客戶訪談' : '16:30 Customer interview', { label: zh ? '16:30 客戶訪談' : '16:30 Customer interview' }),
  ]);
}

function settings(language: Language) {
  const zh = language === 'zh-Hant';
  return appBlueprint('settings', 'settings', language, [
    container('settings_nav', 'list', zh ? '設定分類' : 'Settings navigation', ['profile_link', 'security_link', 'notifications_link', 'billing_link'], pl(280, 82, 250, 776, 244, 76, 220, 670, 16, 76, 358, 180)),
    ...([
      ['profile_link', zh ? '個人資料' : 'Profile'],
      ['security_link', zh ? '安全性' : 'Security'],
      ['notifications_link', zh ? '通知' : 'Notifications'],
      ['billing_link', zh ? '帳務' : 'Billing'],
    ] satisfies Array<[string, string]>).map(([id, label]) => child(id, 'nav_item', 'settings_nav', label, { label, action: `navigate:/settings/${id.replace('_link', '')}` })),
    container('profile_form', 'form', zh ? '個人資料' : 'Profile', ['form_title', 'name_input', 'email_input', 'timezone_select', 'bio_input', 'notification_toggle', 'form_actions'], pl(560, 82, 620, 776, 490, 76, 518, 670, 16, 276, 358, 620)),
    child('form_title', 'heading', 'profile_form', zh ? '個人資料' : 'Profile', { text: zh ? '個人資料' : 'Profile' }),
    child('name_input', 'text_input', 'profile_form', zh ? '姓名' : 'Name', { label: zh ? '姓名' : 'Name', placeholder: zh ? '輸入姓名' : 'Enter name' }),
    child('email_input', 'text_input', 'profile_form', zh ? '電子郵件' : 'Email', { label: zh ? '電子郵件' : 'Email', placeholder: 'name@example.com' }),
    child('timezone_select', 'select', 'profile_form', zh ? '時區' : 'Timezone', { label: zh ? '時區' : 'Timezone', placeholder: 'Asia/Taipei' }),
    child('bio_input', 'textarea', 'profile_form', zh ? '個人簡介' : 'Bio', { label: zh ? '個人簡介' : 'Bio', placeholder: zh ? '介紹你的工作內容' : 'Tell people what you work on' }),
    child('notification_toggle', 'toggle', 'profile_form', zh ? '產品更新通知' : 'Product updates', { label: zh ? '產品更新通知' : 'Product updates' }),
    child('form_actions', 'button_group', 'profile_form', zh ? '表單操作' : 'Form actions', undefined, ['cancel_button', 'save_button']),
    child('cancel_button', 'button', 'form_actions', zh ? '取消' : 'Cancel', { label: zh ? '取消' : 'Cancel', action: 'reset:profile' }),
    child('save_button', 'button', 'form_actions', zh ? '儲存變更' : 'Save changes', { label: zh ? '儲存變更' : 'Save changes', action: 'submit:profile' }),
    container('security_summary', 'card', zh ? '安全摘要' : 'Security summary', ['security_badge', 'security_text'], pl(1200, 82, 200, 300, 16, 766, 992, 180, 16, 916, 358, 160)),
    child('security_badge', 'badge', 'security_summary', zh ? '已啟用 2FA' : '2FA enabled', { text: zh ? '已啟用 2FA' : '2FA enabled', variant: 'success' }),
    child('security_text', 'text', 'security_summary', zh ? '上次登入：今天 08:42' : 'Last sign-in: Today 08:42', { text: zh ? '上次登入：今天 08:42' : 'Last sign-in: Today 08:42' }),
  ]);
}

function catalog(language: Language) {
  const zh = language === 'zh-Hant';
  const productCards: UINode[] = [];
  ['chair', 'lamp', 'desk', 'shelf', 'sofa', 'table'].forEach((id, index) => {
    const name = zh
      ? ['扶手椅', '桌燈', '工作桌', '層架', '雙人沙發', '餐桌'][index] ?? id
      : ['Lounge chair', 'Desk lamp', 'Work desk', 'Shelf', 'Two-seat sofa', 'Dining table'][index] ?? id;
    productCards.push(child(`product_${id}`, 'card', 'product_grid', name, { label: name }, [`product_${id}_image`, `product_${id}_name`, `product_${id}_price`]));
    productCards.push(child(`product_${id}_image`, 'image', `product_${id}`, `${name} image`, { alt: name }));
    productCards.push(child(`product_${id}_name`, 'heading', `product_${id}`, name, { text: name }));
    productCards.push(child(`product_${id}_price`, 'text', `product_${id}`, `$${[129, 89, 499, 219, 749, 599][index]}`, { text: `$${[129, 89, 499, 219, 749, 599][index]}` }));
  });
  return webBlueprint('catalog', 'commerce', language, [
    direct('catalog_title', 'heading', zh ? '為日常打造的家具' : 'Furniture for everyday living', pl(48, 96, 760, 60, 36, 88, 700, 56, 16, 86, 358, 84)),
    container('catalog_filters', 'sidebar', zh ? '商品篩選' : 'Product filters', ['category_filter', 'price_filter', 'availability_filter'], pl(48, 188, 250, 650, 36, 172, 220, 560, 16, 190, 358, 190)),
    child('category_filter', 'select', 'catalog_filters', zh ? '分類' : 'Category', { label: zh ? '分類' : 'Category', placeholder: zh ? '全部分類' : 'All categories' }),
    child('price_filter', 'slider', 'catalog_filters', zh ? '價格' : 'Price', { label: zh ? '價格範圍' : 'Price range' }),
    child('availability_filter', 'checkbox', 'catalog_filters', zh ? '僅顯示有庫存' : 'In stock only', { label: zh ? '僅顯示有庫存' : 'In stock only' }),
    container('catalog_toolbar', 'toolbar', zh ? '目錄工具' : 'Catalog tools', ['catalog_search', 'sort_select'], pl(320, 188, 1072, 64, 276, 172, 732, 64, 16, 396, 358, 120), undefined, rowLayout()),
    child('catalog_search', 'search_input', 'catalog_toolbar', zh ? '搜尋商品' : 'Search products', { placeholder: zh ? '搜尋商品' : 'Search products' }),
    child('sort_select', 'select', 'catalog_toolbar', zh ? '排序' : 'Sort', { label: zh ? '排序' : 'Sort', placeholder: zh ? '熱門商品' : 'Popular' }),
    container('product_grid', 'grid', zh ? '商品格線' : 'Product grid', productCards.filter((node) => node.parent_id === 'product_grid').map((node) => node.id), pl(320, 270, 1072, 568, 276, 252, 732, 480, 16, 536, 358, 620), undefined, { mode: 'auto', display: 'grid', grid: { columns: 3 }, gap: { x: 18, y: 18 } }),
    ...productCards,
  ]);
}

function productDetail(language: Language) {
  const zh = language === 'zh-Hant';
  return webBlueprint('product-detail', 'commerce', language, [
    container('gallery', 'grid', zh ? '商品圖片' : 'Product gallery', ['main_image', 'thumb_1', 'thumb_2'], pl(48, 100, 720, 620, 36, 94, 480, 520, 16, 86, 358, 360), undefined, { mode: 'auto', display: 'grid', grid: { columns: 2 }, gap: { x: 12, y: 12 } }),
    child('main_image', 'image', 'gallery', zh ? '主商品圖片' : 'Main product image', { alt: zh ? '胡桃木工作桌' : 'Walnut work desk' }),
    child('thumb_1', 'image', 'gallery', zh ? '側面圖片' : 'Side view', { alt: zh ? '工作桌側面' : 'Desk side view' }),
    child('thumb_2', 'image', 'gallery', zh ? '情境圖片' : 'Room view', { alt: zh ? '工作空間情境' : 'Workspace scene' }),
    container('product_info', 'detail_panel', zh ? '商品資訊' : 'Product information', ['product_name', 'product_rating', 'product_price', 'product_description', 'finish_select', 'quantity', 'buy_actions'], pl(800, 100, 592, 620, 536, 94, 472, 520, 16, 466, 358, 520)),
    child('product_name', 'heading', 'product_info', zh ? '胡桃木工作桌' : 'Walnut work desk', { text: zh ? '胡桃木工作桌' : 'Walnut work desk' }),
    child('product_rating', 'badge', 'product_info', '4.8 · 126 reviews', { text: zh ? '4.8 · 126 則評價' : '4.8 · 126 reviews', variant: 'success' }),
    child('product_price', 'heading', 'product_info', '$499', { text: '$499' }),
    child('product_description', 'text', 'product_info', zh ? '實木桌面搭配可調整桌腳，適合居家與工作室。' : 'Solid wood surface with adjustable legs for home offices and studios.', { text: zh ? '實木桌面搭配可調整桌腳，適合居家與工作室。' : 'Solid wood surface with adjustable legs for home offices and studios.' }),
    child('finish_select', 'select', 'product_info', zh ? '表面處理' : 'Finish', { label: zh ? '表面處理' : 'Finish', placeholder: zh ? '自然胡桃木' : 'Natural walnut' }),
    child('quantity', 'slider', 'product_info', zh ? '數量' : 'Quantity', { label: zh ? '數量' : 'Quantity', value: '1' }),
    child('buy_actions', 'button_group', 'product_info', zh ? '購買操作' : 'Purchase actions', undefined, ['cart_button', 'buy_button']),
    child('cart_button', 'button', 'buy_actions', zh ? '加入購物車' : 'Add to cart', { label: zh ? '加入購物車' : 'Add to cart', action: 'add:cart', variant: 'secondary' }),
    child('buy_button', 'button', 'buy_actions', zh ? '立即購買' : 'Buy now', { label: zh ? '立即購買' : 'Buy now', action: 'navigate:/checkout', variant: 'primary' }),
    container('product_tabs', 'tabs', zh ? '商品說明' : 'Product details', ['details_tab', 'shipping_tab', 'reviews_tab'], pl(48, 744, 1344, 110, 36, 634, 972, 110, 16, 1006, 358, 140)),
    child('details_tab', 'nav_item', 'product_tabs', zh ? '詳細規格' : 'Details', { label: zh ? '詳細規格' : 'Details', action: 'select:details' }),
    child('shipping_tab', 'nav_item', 'product_tabs', zh ? '配送' : 'Shipping', { label: zh ? '配送' : 'Shipping', action: 'select:shipping' }),
    child('reviews_tab', 'nav_item', 'product_tabs', zh ? '評價' : 'Reviews', { label: zh ? '評價' : 'Reviews', action: 'select:reviews' }),
  ]);
}

function checkout(language: Language) {
  const zh = language === 'zh-Hant';
  return webBlueprint('checkout', 'form', language, [
    container('checkout_steps', 'stepper', zh ? '結帳步驟' : 'Checkout steps', ['step_cart', 'step_delivery', 'step_payment'], pl(160, 84, 1120, 72, 80, 80, 864, 72, 16, 76, 358, 120), undefined, rowLayout()),
    child('step_cart', 'nav_item', 'checkout_steps', zh ? '1 購物車' : '1 Cart', { label: zh ? '1 購物車' : '1 Cart' }),
    child('step_delivery', 'nav_item', 'checkout_steps', zh ? '2 配送' : '2 Delivery', { label: zh ? '2 配送' : '2 Delivery' }),
    child('step_payment', 'nav_item', 'checkout_steps', zh ? '3 付款' : '3 Payment', { label: zh ? '3 付款' : '3 Payment' }),
    container('checkout_form', 'form', zh ? '配送與付款' : 'Delivery and payment', ['checkout_title', 'email', 'address', 'city', 'country', 'card_number', 'expiry', 'save_payment'], pl(160, 180, 720, 650, 80, 170, 560, 570, 16, 216, 358, 600)),
    child('checkout_title', 'heading', 'checkout_form', zh ? '配送與付款' : 'Delivery and payment', { text: zh ? '配送與付款' : 'Delivery and payment' }),
    child('email', 'text_input', 'checkout_form', zh ? '電子郵件' : 'Email', { label: zh ? '電子郵件' : 'Email', placeholder: 'name@example.com' }),
    child('address', 'text_input', 'checkout_form', zh ? '地址' : 'Address', { label: zh ? '地址' : 'Address', placeholder: zh ? '街道與門牌' : 'Street address' }),
    child('city', 'text_input', 'checkout_form', zh ? '城市' : 'City', { label: zh ? '城市' : 'City' }),
    child('country', 'select', 'checkout_form', zh ? '國家／地區' : 'Country or region', { label: zh ? '國家／地區' : 'Country or region', placeholder: zh ? '台灣' : 'Taiwan' }),
    child('card_number', 'text_input', 'checkout_form', zh ? '卡號' : 'Card number', { label: zh ? '卡號' : 'Card number', placeholder: '4242 4242 4242 4242' }),
    child('expiry', 'text_input', 'checkout_form', zh ? '到期日與安全碼' : 'Expiry and CVC', { label: zh ? '到期日與安全碼' : 'Expiry and CVC', placeholder: 'MM/YY · CVC' }),
    child('save_payment', 'checkbox', 'checkout_form', zh ? '儲存付款方式' : 'Save payment method', { label: zh ? '儲存付款方式' : 'Save payment method' }),
    container('order_summary', 'card', zh ? '訂單摘要' : 'Order summary', ['summary_title', 'summary_item', 'summary_total', 'place_order'], pl(920, 180, 360, 500, 670, 170, 274, 430, 16, 836, 358, 300)),
    child('summary_title', 'heading', 'order_summary', zh ? '訂單摘要' : 'Order summary', { text: zh ? '訂單摘要' : 'Order summary' }),
    child('summary_item', 'text', 'order_summary', zh ? '胡桃木工作桌 × 1' : 'Walnut work desk × 1', { text: zh ? '胡桃木工作桌 × 1' : 'Walnut work desk × 1' }),
    child('summary_total', 'heading', 'order_summary', zh ? '總計 $548' : 'Total $548', { text: zh ? '總計 $548' : 'Total $548' }),
    child('place_order', 'button', 'order_summary', zh ? '確認下單' : 'Place order', { label: zh ? '確認下單' : 'Place order', action: 'submit:checkout' }),
  ]);
}

function feed(language: Language) {
  const zh = language === 'zh-Hant';
  return webBlueprint('feed', 'content', language, [
    container('feed_nav', 'sidebar', zh ? '主要導覽' : 'Primary navigation', ['feed_home', 'feed_explore', 'feed_saved'], pl(48, 92, 220, 760, 36, 86, 190, 650, 16, 76, 358, 150)),
    child('feed_home', 'nav_item', 'feed_nav', zh ? '首頁' : 'Home', { label: zh ? '首頁' : 'Home', action: 'navigate:/home' }),
    child('feed_explore', 'nav_item', 'feed_nav', zh ? '探索' : 'Explore', { label: zh ? '探索' : 'Explore', action: 'navigate:/explore' }),
    child('feed_saved', 'nav_item', 'feed_nav', zh ? '已儲存' : 'Saved', { label: zh ? '已儲存' : 'Saved', action: 'navigate:/saved' }),
    container('composer', 'card', zh ? '建立貼文' : 'Create post', ['composer_avatar', 'composer_input', 'publish_button'], pl(300, 92, 720, 160, 246, 86, 540, 160, 16, 246, 358, 180)),
    child('composer_avatar', 'avatar', 'composer', zh ? '你的頭像' : 'Your avatar', { alt: zh ? '你的頭像' : 'Your avatar' }),
    child('composer_input', 'textarea', 'composer', zh ? '分享近況' : 'Share an update', { placeholder: zh ? '分享你的近況...' : 'Share an update...' }),
    child('publish_button', 'button', 'composer', zh ? '發布' : 'Publish', { label: zh ? '發布' : 'Publish', action: 'submit:post' }),
    container('feed_list', 'activity_feed', zh ? '動態串' : 'Feed', ['post_1', 'post_2'], pl(300, 272, 720, 580, 246, 266, 540, 470, 16, 446, 358, 520)),
    child('post_1', 'card', 'feed_list', zh ? '設計團隊更新' : 'Design team update', { label: zh ? '設計團隊更新' : 'Design team update' }, ['post_1_author', 'post_1_text', 'post_1_image']),
    child('post_1_author', 'heading', 'post_1', zh ? '林子晴' : 'Alex Lin', { text: zh ? '林子晴' : 'Alex Lin' }),
    child('post_1_text', 'text', 'post_1', zh ? '新的元件庫已經完成，歡迎留言回饋。' : 'The new component library is ready. Feedback is welcome.', { text: zh ? '新的元件庫已經完成，歡迎留言回饋。' : 'The new component library is ready. Feedback is welcome.' }),
    child('post_1_image', 'image', 'post_1', zh ? '元件庫預覽' : 'Component library preview', { alt: zh ? '元件庫預覽' : 'Component library preview' }),
    child('post_2', 'card', 'feed_list', zh ? '產品里程碑' : 'Product milestone', { label: zh ? '產品里程碑' : 'Product milestone' }, ['post_2_text']),
    child('post_2_text', 'text', 'post_2', zh ? '本週完成自由畫布第一輪測試。' : 'Completed the first freeform canvas test this week.', { text: zh ? '本週完成自由畫布第一輪測試。' : 'Completed the first freeform canvas test this week.' }),
    container('trending', 'detail_panel', zh ? '熱門話題' : 'Trending', ['trend_1', 'trend_2', 'trend_3'], pl(1050, 92, 342, 420, 806, 86, 202, 420, 16, 986, 358, 180)),
    ...['#ui-design', '#product', '#build-in-public'].map((label, index) => child(`trend_${index + 1}`, 'tag', 'trending', label, { text: label })),
  ]);
}

function booking(language: Language) {
  const zh = language === 'zh-Hant';
  return webBlueprint('booking', 'commerce', language, [
    direct('booking_title', 'heading', zh ? '尋找下一段旅程' : 'Find your next stay', pl(48, 90, 720, 60, 36, 84, 660, 56, 16, 82, 358, 70)),
    container('search_form', 'form', zh ? '搜尋住宿' : 'Search stays', ['destination', 'dates', 'guests', 'search_button'], pl(48, 170, 1344, 118, 36, 160, 972, 118, 16, 168, 358, 280), undefined, rowLayout()),
    child('destination', 'search_input', 'search_form', zh ? '目的地' : 'Destination', { label: zh ? '目的地' : 'Destination', placeholder: zh ? '城市或景點' : 'City or landmark' }),
    child('dates', 'date_picker', 'search_form', zh ? '日期' : 'Dates', { label: zh ? '日期' : 'Dates', placeholder: zh ? '選擇日期' : 'Choose dates' }),
    child('guests', 'select', 'search_form', zh ? '旅客' : 'Guests', { label: zh ? '旅客' : 'Guests', placeholder: zh ? '2 位旅客' : '2 guests' }),
    child('search_button', 'button', 'search_form', zh ? '搜尋' : 'Search', { label: zh ? '搜尋' : 'Search', action: 'submit:booking_search' }),
    container('booking_filters', 'sidebar', zh ? '篩選條件' : 'Filters', ['price_slider', 'type_select', 'rating_filter'], pl(48, 316, 250, 530, 36, 296, 220, 440, 16, 468, 358, 180)),
    child('price_slider', 'slider', 'booking_filters', zh ? '每晚價格' : 'Price per night', { label: zh ? '每晚價格' : 'Price per night' }),
    child('type_select', 'select', 'booking_filters', zh ? '住宿類型' : 'Property type', { label: zh ? '住宿類型' : 'Property type', placeholder: zh ? '全部類型' : 'All types' }),
    child('rating_filter', 'checkbox', 'booking_filters', zh ? '評分 4.5 以上' : 'Rating 4.5+', { label: zh ? '評分 4.5 以上' : 'Rating 4.5+' }),
    container('booking_results', 'list', zh ? '搜尋結果' : 'Search results', ['stay_1', 'stay_2', 'stay_3'], pl(320, 316, 560, 530, 276, 296, 450, 440, 16, 668, 358, 480)),
    ...['河畔設計旅店', '山景木屋', '市中心公寓'].map((name, index) => {
      const localized = zh ? name : ['Riverside design hotel', 'Mountain cabin', 'City center apartment'][index] ?? name;
      return child(`stay_${index + 1}`, 'card', 'booking_results', localized, { label: localized });
    }),
    direct('booking_map', 'image', zh ? '地圖' : 'Map', pl(900, 316, 492, 530, 746, 296, 262, 440, 16, 1168, 358, 260), { alt: zh ? '住宿位置地圖' : 'Map of available stays' }),
  ]);
}

function landing(language: Language) {
  const zh = language === 'zh-Hant';
  return webBlueprint('landing', 'landing', language, [
    direct('hero_eyebrow', 'badge', zh ? '為產品團隊打造' : 'Built for product teams', pl(88, 128, 190, 30, 56, 116, 190, 30, 16, 96, 190, 30), { text: zh ? '為產品團隊打造' : 'Built for product teams', variant: 'success' }),
    direct('hero_title', 'heading', zh ? '把 UI 想法變成可交付的藍圖' : 'Turn UI ideas into implementation-ready blueprints', pl(88, 180, 660, 150, 56, 166, 580, 140, 16, 146, 358, 170)),
    direct('hero_copy', 'text', zh ? '自由拖曳、精確佈局，並輸出 coding agent 能理解與驗證的 JSON。' : 'Compose freely, preserve exact layout, and export JSON coding agents can understand and verify.', pl(88, 346, 600, 86, 56, 318, 540, 86, 16, 330, 358, 110)),
    container('hero_actions', 'button_group', zh ? '主行動' : 'Hero actions', ['start_button', 'demo_button'], pl(88, 452, 390, 56, 56, 420, 390, 56, 16, 458, 358, 56), undefined, rowLayout()),
    child('start_button', 'button', 'hero_actions', zh ? '開始建立' : 'Start building', { label: zh ? '開始建立' : 'Start building', action: 'navigate:/new' }),
    child('demo_button', 'button', 'hero_actions', zh ? '查看範例' : 'View examples', { label: zh ? '查看範例' : 'View examples', action: 'navigate:#examples', variant: 'secondary' }),
    direct('hero_image', 'image', zh ? '編輯器預覽' : 'Editor preview', pl(790, 112, 560, 430, 650, 106, 358, 390, 16, 540, 358, 250), { alt: zh ? '自由畫布編輯器預覽' : 'Freeform editor preview' }),
    ...featureCards(language),
    direct('proof_text', 'text', zh ? '讓設計意圖、響應式規則與驗收條件一起交付。' : 'Ship design intent, responsive rules, and acceptance criteria together.', pl(320, 792, 800, 54, 160, 706, 704, 54, 16, 1340, 358, 80)),
  ]);
}

function pricing(language: Language) {
  const zh = language === 'zh-Hant';
  return webBlueprint('pricing', 'landing', language, [
    direct('pricing_title', 'heading', zh ? '選擇適合團隊的方案' : 'Choose the right plan for your team', pl(320, 92, 800, 70, 160, 88, 704, 68, 16, 82, 358, 90)),
    direct('pricing_copy', 'text', zh ? '所有方案都包含自由畫布、JSON 匯出和版本紀錄。' : 'Every plan includes freeform canvas, JSON export, and version history.', pl(380, 170, 680, 48, 190, 166, 644, 48, 16, 182, 358, 70)),
    container('billing_toggle', 'button_group', zh ? '計費週期' : 'Billing cycle', ['monthly', 'yearly'], pl(560, 234, 320, 48, 352, 228, 320, 48, 54, 270, 282, 48), undefined, rowLayout()),
    child('monthly', 'button', 'billing_toggle', zh ? '月繳' : 'Monthly', { label: zh ? '月繳' : 'Monthly', action: 'select:monthly' }),
    child('yearly', 'button', 'billing_toggle', zh ? '年繳省 20%' : 'Yearly · Save 20%', { label: zh ? '年繳省 20%' : 'Yearly · Save 20%', action: 'select:yearly' }),
    ...pricingCards(language),
    container('pricing_faq', 'list', zh ? '常見問題' : 'Frequently asked questions', ['faq_1', 'faq_2', 'faq_3'], pl(220, 720, 1000, 160, 110, 670, 804, 160, 16, 1120, 358, 260)),
    child('faq_1', 'text', 'pricing_faq', zh ? '可以隨時更換方案嗎？可以，變更會在下個週期生效。' : 'Can I change plans? Yes, changes apply next cycle.', { text: zh ? '可以隨時更換方案嗎？可以，變更會在下個週期生效。' : 'Can I change plans? Yes, changes apply next cycle.' }),
    child('faq_2', 'text', 'pricing_faq', zh ? '是否支援私有部署？企業方案提供。' : 'Is private deployment available? It is included with Enterprise.', { text: zh ? '是否支援私有部署？企業方案提供。' : 'Is private deployment available? It is included with Enterprise.' }),
    child('faq_3', 'text', 'pricing_faq', zh ? '匯出的 JSON 有限制嗎？沒有。' : 'Are JSON exports limited? No.', { text: zh ? '匯出的 JSON 有限制嗎？沒有。' : 'Are JSON exports limited? No.' }),
  ]);
}

function onboarding(language: Language) {
  const zh = language === 'zh-Hant';
  return webBlueprint('onboarding', 'onboarding', language, [
    container('onboarding_steps', 'stepper', zh ? '設定進度' : 'Setup progress', ['account_step', 'workspace_step', 'invite_step'], pl(280, 70, 880, 64, 120, 66, 784, 64, 16, 60, 358, 110), undefined, rowLayout()),
    child('account_step', 'nav_item', 'onboarding_steps', zh ? '1 帳號' : '1 Account', { label: zh ? '1 帳號' : '1 Account' }),
    child('workspace_step', 'nav_item', 'onboarding_steps', zh ? '2 工作區' : '2 Workspace', { label: zh ? '2 工作區' : '2 Workspace' }),
    child('invite_step', 'nav_item', 'onboarding_steps', zh ? '3 邀請成員' : '3 Invite team', { label: zh ? '3 邀請成員' : '3 Invite team' }),
    container('signup_form', 'form', zh ? '建立工作區' : 'Create your workspace', ['signup_title', 'workspace_name', 'workspace_type', 'team_size', 'invite_emails', 'finish_button'], pl(220, 170, 560, 620, 90, 160, 500, 560, 16, 190, 358, 580)),
    child('signup_title', 'heading', 'signup_form', zh ? '建立你的工作區' : 'Create your workspace', { text: zh ? '建立你的工作區' : 'Create your workspace' }),
    child('workspace_name', 'text_input', 'signup_form', zh ? '工作區名稱' : 'Workspace name', { label: zh ? '工作區名稱' : 'Workspace name', placeholder: zh ? '例如：產品團隊' : 'Example: Product team' }),
    child('workspace_type', 'select', 'signup_form', zh ? '使用情境' : 'Primary use', { label: zh ? '使用情境' : 'Primary use', placeholder: zh ? '產品設計與開發' : 'Product design and development' }),
    child('team_size', 'radio_group', 'signup_form', zh ? '團隊人數' : 'Team size', { label: zh ? '團隊人數' : 'Team size', items: [{ id: 'small', label: '1–10' }, { id: 'medium', label: '11–50' }, { id: 'large', label: '51+' }] }),
    child('invite_emails', 'textarea', 'signup_form', zh ? '邀請成員' : 'Invite teammates', { label: zh ? '邀請成員' : 'Invite teammates', placeholder: zh ? '每行輸入一個電子郵件' : 'One email per line' }),
    child('finish_button', 'button', 'signup_form', zh ? '完成設定' : 'Finish setup', { label: zh ? '完成設定' : 'Finish setup', action: 'submit:onboarding' }),
    container('onboarding_help', 'card', zh ? '設定說明' : 'Setup guidance', ['help_image', 'help_title', 'help_text', 'help_checklist'], pl(820, 170, 400, 500, 620, 160, 284, 500, 16, 790, 358, 300)),
    child('help_image', 'image', 'onboarding_help', zh ? '工作區預覽' : 'Workspace preview', { alt: zh ? '工作區預覽' : 'Workspace preview' }),
    child('help_title', 'heading', 'onboarding_help', zh ? '三分鐘完成設定' : 'Set up in three minutes', { text: zh ? '三分鐘完成設定' : 'Set up in three minutes' }),
    child('help_text', 'text', 'onboarding_help', zh ? '你之後仍可在設定頁調整名稱、成員和權限。' : 'You can change the name, members, and permissions later.', { text: zh ? '你之後仍可在設定頁調整名稱、成員和權限。' : 'You can change the name, members, and permissions later.' }),
    child('help_checklist', 'list', 'onboarding_help', zh ? '設定清單' : 'Setup checklist', { items: [{ id: 'profile', label: zh ? '完成個人資料' : 'Complete profile' }, { id: 'workspace', label: zh ? '建立工作區' : 'Create workspace' }, { id: 'invite', label: zh ? '邀請成員' : 'Invite team' }] }),
  ]);
}

function appBlueprint(id: TemplateId, type: Blueprint['screen']['type'], language: Language, contentNodes: UINode[]) {
  const zh = language === 'zh-Hant';
  const nav = [
    child('nav_home', 'nav_item', 'sidebar', zh ? '首頁' : 'Home', { label: zh ? '首頁' : 'Home', action: 'navigate:/home' }),
    child('nav_workspace', 'nav_item', 'sidebar', zh ? '工作區' : 'Workspace', { label: zh ? '工作區' : 'Workspace', action: 'navigate:/workspace' }),
    child('nav_reports', 'nav_item', 'sidebar', zh ? '報表' : 'Reports', { label: zh ? '報表' : 'Reports', action: 'navigate:/reports' }),
    child('nav_settings', 'nav_item', 'sidebar', zh ? '設定' : 'Settings', { label: zh ? '設定' : 'Settings', action: 'navigate:/settings' }),
  ];
  const chrome = [
    container(
      'sidebar',
      'sidebar',
      zh ? '應用主導覽' : 'App navigation',
      nav.map((node) => node.id),
      mobileLayer(pl(0, 0, 240, 900, 0, 0, 220, 768, 0, 780, 390, 64), 10),
      { label: templateLabel(language, id) }
    ),
    ...nav,
    container('top_bar', 'top_bar', zh ? '頂部工具列' : 'Top toolbar', ['global_search', 'account_avatar'], pl(240, 0, 1200, 64, 220, 0, 804, 64, 0, 0, 390, 60), undefined, rowLayout()),
    child('global_search', 'search_input', 'top_bar', zh ? '全域搜尋' : 'Global search', { label: zh ? '搜尋' : 'Search', placeholder: zh ? '搜尋...' : 'Search...', action: 'search:global' }),
    child('account_avatar', 'avatar', 'top_bar', zh ? '目前使用者' : 'Current user', { alt: zh ? '目前使用者' : 'Current user' }),
  ];
  return blueprint(id, type, language, 'app_shell', [...chrome, ...contentNodes]);
}

function webBlueprint(id: TemplateId, type: Blueprint['screen']['type'], language: Language, contentNodes: UINode[]) {
  const zh = language === 'zh-Hant';
  const header = container('site_header', 'top_bar', zh ? '網站導覽' : 'Site navigation', ['brand', 'nav_product', 'nav_resources', 'nav_login'], pl(0, 0, 1440, 64, 0, 0, 1024, 64, 0, 0, 390, 60), undefined, rowLayout());
  const chrome = [
    header,
    child('brand', 'heading', 'site_header', templateLabel(language, id), { text: 'AUB' }),
    child('nav_product', 'link', 'site_header', zh ? '產品' : 'Product', { text: zh ? '產品' : 'Product', action: 'navigate:#product' }),
    child('nav_resources', 'link', 'site_header', zh ? '資源' : 'Resources', { text: zh ? '資源' : 'Resources', action: 'navigate:#resources' }),
    child('nav_login', 'button', 'site_header', zh ? '登入' : 'Log in', { label: zh ? '登入' : 'Log in', action: 'navigate:/login', variant: 'secondary' }),
  ];
  return blueprint(id, type, language, 'page', [...chrome, ...contentNodes]);
}

function blueprint(id: TemplateId, type: Blueprint['screen']['type'], language: Language, rootType: 'app_shell' | 'page', nodes: UINode[]): Blueprint {
  const rootChildren = nodes.filter((node) => node.parent_id === 'root').map((node) => node.id);
  const designSystem = defaultDesignSystem();
  designSystem.name = 'AUB Product Neutral';
  designSystem.colors = {
    ...designSystem.colors,
    'surface.canvas': '#f8fafc',
    'surface.panel': '#ffffff',
    'action.primary': ['#2563eb', '#0f766e', '#7c3aed'][TEMPLATE_IDS.indexOf(id) % 3] ?? '#2563eb',
  };
  return {
    version: '0.3.0',
    screen: {
      id: `template.${id}`,
      name: templateLabel(language, id),
      type,
      platform: 'web',
      primary_user_goal: templateDescription(language, id),
      notes: language === 'zh-Hant'
        ? '版型參考常見產品資訊架構，不使用任何第三方品牌資產。'
        : 'The template references common product information architecture without third-party brand assets.',
    },
    viewports: [
      { id: 'desktop', width: 1440, height: 900 },
      { id: 'tablet', width: 1024, height: 768 },
      { id: 'mobile', width: 390, height: 844 },
    ],
    design_system: designSystem,
    nodes: [{
      id: 'root',
      type: rootType,
      name: templateLabel(language, id),
      role: language === 'zh-Hant' ? '畫面的自由佈局根容器。' : 'Freeform root container for the screen.',
      parent_id: null,
      children: rootChildren,
      layout: { mode: 'freeform' },
      style: { background: 'surface.canvas', foreground: 'text.primary' },
    }, ...nodes],
    interactions: interactions(nodes, language),
    responsive: [
      { viewport: 'tablet', rule: 'keep', target_node_id: 'root', changes: { geometry: 'placements.tablet' } },
      { viewport: 'mobile', rule: 'stack', target_node_id: 'root', changes: { geometry: 'placements.mobile' } },
    ],
    acceptance: acceptance(language),
  };
}

function direct(
  id: string,
  type: ComponentType,
  name: string,
  placements: UINode['placements'],
  content?: UINode['content'],
  layout?: UINode['layout'],
  children?: string[]
): UINode {
  return {
    id,
    type,
    name,
    role: `Render ${name} as the ${type.replaceAll('_', ' ')} region.`,
    parent_id: 'root',
    ...(children ? { children } : {}),
    ...(layout ?? defaultLayoutForType(type) ? { layout: layout ?? defaultLayoutForType(type) } : {}),
    placements,
    ...(content ? { content } : {}),
    style: defaultStyle(type),
  };
}

function container(
  id: string,
  type: ComponentType,
  name: string,
  children: string[],
  placements: UINode['placements'],
  content?: UINode['content'],
  layout?: UINode['layout']
) {
  return direct(id, type, name, placements, content, layout ?? defaultLayoutForType(type), children);
}

function child(
  id: string,
  type: ComponentType,
  parentId: string,
  name: string,
  content?: UINode['content'],
  children?: string[]
): UINode {
  return {
    id,
    type,
    name,
    role: `Use ${name} within ${parentId}.`,
    parent_id: parentId,
    ...(children ? { children } : {}),
    ...(defaultLayoutForType(type) ? { layout: defaultLayoutForType(type) } : {}),
    ...(content ? { content } : {}),
    style: defaultStyle(type),
  };
}

function defaultStyle(type: ComponentType): UINode['style'] {
  if (type === 'heading') return { typography: 'heading.section', foreground: 'text.primary' };
  if (type === 'text') return { typography: 'body.default', foreground: 'text.secondary' };
  if (type === 'button') return { background: 'action.primary', foreground: 'action.primary.text', radius: 'radius.control' };
  if (['card', 'detail_panel', 'form'].includes(type)) return { background: 'surface.panel', border: 'border.default', radius: 'radius.panel', shadow: 'shadow.panel' };
  return undefined;
}

function pl(
  dx: number, dy: number, dw: number, dh: number,
  tx: number, ty: number, tw: number, th: number,
  mx: number, my: number, mw: number, mh: number
): UINode['placements'] {
  return {
    desktop: { x: dx, y: dy, width: dw, height: dh, z_index: 1 },
    tablet: { x: tx, y: ty, width: tw, height: th, z_index: 1 },
    mobile: { x: mx, y: my, width: mw, height: mh, z_index: 1 },
  };
}

function mobileLayer(placements: UINode['placements'], zIndex: number): UINode['placements'] {
  if (!placements?.mobile) return placements;
  return {
    ...placements,
    mobile: { ...placements.mobile, z_index: zIndex },
  };
}

function rowLayout(): UINode['layout'] {
  return { mode: 'auto', display: 'flex', direction: 'row', wrap: true, align: 'center', gap: { x: 10, y: 10 } };
}

function metricRow(language: Language) {
  const zh = language === 'zh-Hant';
  const labels = zh ? ['營收', '訂單', '新客戶', '轉換率'] : ['Revenue', 'Orders', 'New customers', 'Conversion'];
  const values = ['$128k', '1,284', '326', '4.8%'];
  return labels.map((label, index) => direct(
    `metric_${index + 1}`,
    'metric_card',
    label,
    pl(280 + index * 280, 196, 260, 116, 244 + (index % 2) * 382, 194 + Math.floor(index / 2) * 102, 366, 90, 16 + (index % 2) * 187, 188 + Math.floor(index / 2) * 122, 171, 106),
    { label, value: values[index], data_binding: `metrics.${index}` }
  ));
}

function featureCards(language: Language) {
  const zh = language === 'zh-Hant';
  const items: Array<[string, string]> = [
    [zh ? '自由畫布' : 'Freeform canvas', zh ? '拖曳、縮放、吸附與多選。' : 'Drag, resize, snap, and multi-select.'],
    [zh ? '結構化輸出' : 'Structured output', zh ? '幾何、語意和互動都保存在 JSON。' : 'Geometry, semantics, and interactions in JSON.'],
    [zh ? '可驗證交付' : 'Verifiable handoff', zh ? '截圖、驗收條件和雜湊一起封裝。' : 'Screenshots, acceptance criteria, and hashes included.'],
  ];
  return items.flatMap(([title, copy], index) => [
    container(`feature_${index}`, 'card', title, [`feature_${index}_title`, `feature_${index}_copy`], pl(88 + index * 430, 590, 400, 170, 56 + index * 316, 540, 292, 150, 16, 810 + index * 176, 358, 156)),
    child(`feature_${index}_title`, 'heading', `feature_${index}`, title, { text: title }),
    child(`feature_${index}_copy`, 'text', `feature_${index}`, copy, { text: copy }),
  ]);
}

function pricingCards(language: Language) {
  const zh = language === 'zh-Hant';
  const items: Array<[string, string, string]> = [
    [zh ? '個人' : 'Solo', '$0', zh ? '1 個專案' : '1 project'],
    [zh ? '團隊' : 'Team', '$19', zh ? '無限專案與協作' : 'Unlimited projects and collaboration'],
    [zh ? '企業' : 'Enterprise', zh ? '洽詢' : 'Contact', zh ? '私有部署與治理' : 'Private deployment and governance'],
  ];
  return items.flatMap(([name, price, copy], index) => [
    container(`plan_${index}`, 'card', name, [`plan_${index}_name`, `plan_${index}_price`, `plan_${index}_copy`, `plan_${index}_button`], pl(180 + index * 370, 320, 340, 350, 60 + index * 318, 310, 296, 330, 16, 338 + index * 250, 358, 230)),
    child(`plan_${index}_name`, 'heading', `plan_${index}`, name, { text: name }),
    child(`plan_${index}_price`, 'heading', `plan_${index}`, price, { text: price }),
    child(`plan_${index}_copy`, 'text', `plan_${index}`, copy, { text: copy }),
    child(`plan_${index}_button`, 'button', `plan_${index}`, zh ? '選擇方案' : 'Choose plan', { label: zh ? '選擇方案' : 'Choose plan', action: `select:plan_${index}` }),
  ]);
}

function tableContent(language: Language): UINode['content'] {
  const zh = language === 'zh-Hant';
  return {
    label: zh ? '近期訂單' : 'Recent orders',
    data_binding: 'orders.recent',
    columns: [
      { id: 'order', header: zh ? '訂單' : 'Order', sortable: true },
      { id: 'customer', header: zh ? '客戶' : 'Customer' },
      { id: 'amount', header: zh ? '金額' : 'Amount', sortable: true },
      { id: 'status', header: zh ? '狀態' : 'Status', filterable: true },
    ],
  };
}

function interactions(nodes: UINode[], language: Language): Interaction[] {
  return scaffoldInteractions({ nodes, interactions: [] }, { language }).interactions as Interaction[];
}

function acceptance(language: Language): Acceptance[] {
  const zh = language === 'zh-Hant';
  return [
    { id: 'acc_layout', type: 'layout', statement: zh ? '桌面版所有主要區域的位置與尺寸符合 placement。' : 'All major desktop regions match their placements.', target: 'desktop', priority: 'blocker', verification_method: 'screenshot_diff' },
    { id: 'acc_interaction', type: 'interaction', statement: zh ? '所有主要按鈕與導覽操作都有明確 action。' : 'Primary buttons and navigation items declare actions.', target: '*', priority: 'must', verification_method: 'interaction_replay' },
    { id: 'acc_tablet', type: 'responsive', statement: zh ? '平板版使用獨立 placement 且不水平溢出。' : 'Tablet uses dedicated placements without horizontal overflow.', target: 'tablet', priority: 'must', verification_method: 'screenshot_diff' },
    { id: 'acc_mobile', type: 'responsive', statement: zh ? '手機版內容以單欄順序閱讀。' : 'Mobile content reads in a single-column sequence.', target: 'mobile', priority: 'must', verification_method: 'screenshot_diff' },
    { id: 'acc_a11y', type: 'a11y', statement: zh ? '互動元件具備可理解的文字標籤。' : 'Interactive controls have understandable text labels.', target: '*', priority: 'must', verification_method: 'axe_audit' },
    { id: 'acc_content', type: 'content', statement: zh ? '每個主要區域的名稱與內容能說明用途。' : 'Names and content explain the purpose of each major region.', target: '*', priority: 'should', verification_method: 'manual_ia_review' },
  ];
}
