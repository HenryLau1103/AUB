import type { ComponentType, NodeState, Viewport } from '../types';

export type Language = 'en' | 'zh-Hant';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh-Hant', label: '繁體中文' },
];

type MessageKey =
  | 'appTitle'
  | 'noBlueprintLoaded'
  | 'importJson'
  | 'importAngular'
  | 'importPersonalTemplate'
  | 'downloadAuthoringKit'
  | 'exportJson'
  | 'exportMarkdown'
  | 'exportPackage'
  | 'valid'
  | 'schemaValid'
  | 'schemaError'
  | 'schemaErrors'
  | 'parseJsonFailed'
  | 'language'
  | 'componentPalette'
  | 'paletteHint'
  | 'kindContainer'
  | 'kindLeaf'
  | 'properties'
  | 'selectNode'
  | 'delete'
  | 'deleteComponent'
  | 'dragComponent'
  | 'dragComponentHint'
  | 'rootCannotDelete'
  | 'selectParent'
  | 'hideProperties'
  | 'showProperties'
  | 'releaseToAdd'
  | 'id'
  | 'name'
  | 'type'
  | 'role'
  | 'layoutJson'
  | 'contentJson'
  | 'layoutControls'
  | 'layoutVertical'
  | 'layoutHorizontal'
  | 'layoutGrid'
  | 'layoutAlign'
  | 'layoutJustify'
  | 'layoutStart'
  | 'layoutCenter'
  | 'layoutEnd'
  | 'layoutStretch'
  | 'layoutBaseline'
  | 'layoutSpaceBetween'
  | 'layoutSpaceAround'
  | 'layoutSpaceEvenly'
  | 'layoutHorizontalGap'
  | 'layoutVerticalGap'
  | 'layoutColumns'
  | 'layoutWrap'
  | 'layoutHelp'
  | 'layoutFixed'
  | 'layoutAppShellHelp'
  | 'canvas'
  | 'emptyCanvas'
  | 'navigationItems'
  | 'pageSidebarItems'
  | 'appSidebarLabel'
  | 'pageSidebarLabel'
  | 'toolbarItems'
  | 'dropComponents'
  | 'enterValue'
  | 'chooseOption'
  | 'home'
  | 'row'
  | 'defaultColumnName'
  | 'defaultColumnStatus'
  | 'defaultColumnAmount'
  | 'nodes'
  | 'node'
  | 'interactions'
  | 'interaction'
  | 'acceptance'
  | 'startHint'
  | 'startTitle'
  | 'startPrompt'
  | 'startPage'
  | 'startPagePath'
  | 'startApp'
  | 'startAppPath'
  | 'startFromTemplate'
  | 'addedByEditor'
  | 'starterScreenName'
  | 'starterPrimaryGoal'
  | 'starterRootName'
  | 'starterRootRole'
  | 'starterAppScreenName'
  | 'starterAppGoal'
  | 'starterAppShellName'
  | 'starterAppShellRole'
  | 'starterSidebarName'
  | 'starterSidebarRole'
  | 'starterTopBarName'
  | 'starterTopBarRole'
  | 'starterMainPageName'
  | 'starterMainPageRole'
  | 'starterPageCreated'
  | 'starterAppCreated'
  | 'addedToContainer'
  | 'placedFreely'
  | 'movedToContainer'
  | 'createdRoot'
  | 'shellSlotPlaced'
  | 'pageSidebarPlaced'
  | 'mainDropArea'
  | 'template'
  | 'chooseTemplate'
  | 'templateDashboard'
  | 'templateLanding'
  | 'templateSettings'
  | 'templateLoaded'
  | 'zoom'
  | 'fitArtboard'
  | 'zoomOut'
  | 'zoomIn'
  | 'undo'
  | 'redo'
  | 'duplicate'
  | 'duplicateName'
  | 'bringFront'
  | 'sendBack'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignTop'
  | 'alignMiddle'
  | 'alignBottom'
  | 'distributeHorizontal'
  | 'distributeVertical'
  | 'toggleLayoutMode'
  | 'freeform'
  | 'autoLayout'
  | 'importMigrated'
  | 'imported'
  | 'preparingPackage'
  | 'packageReady'
  | 'viewportQualityBlocked'
  | 'selected'
  | 'components'
  | 'templates'
  | 'layers'
  | 'searchComponents'
  | 'container'
  | 'leaf'
  | 'noLayers'
  | 'multipleSelected'
  | 'propertyTab.content'
  | 'propertyTab.layout'
  | 'propertyTab.appearance'
  | 'propertyTab.interaction'
  | 'parentContainer'
  | 'zIndex'
  | 'contentText'
  | 'contentLabel'
  | 'placeholder'
  | 'sourceUrl'
  | 'altText'
  | 'advancedJson'
  | 'backgroundToken'
  | 'foregroundToken'
  | 'typographyToken'
  | 'radiusToken'
  | 'shadowToken'
  | 'variant'
  | 'opacity'
  | 'actionIntent'
  | 'supportedStates'
  | 'declaredInteractions'
  | 'noDeclaredInteractions';

const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  en: {
    appTitle: 'AUB Editor',
    noBlueprintLoaded: 'no blueprint loaded',
    importJson: 'Import JSON',
    importAngular: 'Import Angular component files',
    importPersonalTemplate: 'Import personal template',
    downloadAuthoringKit: 'Download AI authoring kit',
    exportJson: 'Export JSON',
    exportMarkdown: 'Export Markdown',
    exportPackage: 'Export AI handoff package',
    valid: 'valid',
    schemaValid: 'schema valid',
    schemaError: 'schema error',
    schemaErrors: 'schema errors',
    parseJsonFailed: 'Failed to parse JSON: {message}',
    language: 'Language',
    componentPalette: 'Component Palette',
    paletteHint: 'Click or drag to add. Move existing components from the handle centered on their top border.',
    kindContainer: 'Container',
    kindLeaf: 'Leaf',
    properties: 'Properties',
    selectNode: 'Select a node to edit.',
    delete: 'Delete',
    deleteComponent: 'Delete component',
    dragComponent: 'Drag {component}',
    dragComponentHint: 'Drag to move {component}. Hold Alt/Option to place it inside another container.',
    rootCannotDelete: 'Root node cannot be deleted',
    selectParent: 'Parent',
    hideProperties: 'Hide',
    showProperties: 'Show properties',
    releaseToAdd: 'Release to add {component}',
    id: 'id',
    name: 'name',
    type: 'type',
    role: 'role',
    layoutJson: 'layout (JSON)',
    contentJson: 'content (JSON)',
    layoutControls: 'Layout',
    layoutVertical: 'Vertical',
    layoutHorizontal: 'Horizontal',
    layoutGrid: 'Grid',
    layoutAlign: 'Cross-axis alignment',
    layoutJustify: 'Distribution',
    layoutStart: 'Start',
    layoutCenter: 'Center',
    layoutEnd: 'End',
    layoutStretch: 'Stretch',
    layoutBaseline: 'Baseline',
    layoutSpaceBetween: 'Space between',
    layoutSpaceAround: 'Space around',
    layoutSpaceEvenly: 'Space evenly',
    layoutHorizontalGap: 'Horizontal gap',
    layoutVerticalGap: 'Vertical gap',
    layoutColumns: 'Columns',
    layoutWrap: 'Wrap onto multiple lines',
    layoutHelp: 'This controls how every direct child is arranged inside the selected container.',
    layoutFixed: 'Fixed app layout',
    layoutAppShellHelp: 'App Shell places Sidebar, Top Bar, Page, and Bottom Nav into semantic slots. Use containers inside the Page for flexible layout.',
    canvas: 'Canvas',
    emptyCanvas: 'Drag a component here or click one in the palette to start.',
    navigationItems: 'Drop navigation items here',
    pageSidebarItems: 'Drop filters, a table of contents, or tools here',
    appSidebarLabel: 'App navigation',
    pageSidebarLabel: 'Page sidebar',
    toolbarItems: 'Toolbar items',
    dropComponents: 'Drop components',
    enterValue: 'Enter value',
    chooseOption: 'Choose option',
    home: 'Home',
    row: 'Row',
    defaultColumnName: 'Name',
    defaultColumnStatus: 'Status',
    defaultColumnAmount: 'Amount',
    nodes: 'nodes',
    node: 'node',
    interactions: 'interactions',
    interaction: 'interaction',
    acceptance: 'acceptance',
    startHint: 'Click any component in the palette to start. Drag-and-drop also works.',
    startTitle: 'Start a new UI',
    startPrompt: 'Choose the structure that matches the screen you are building.',
    startPage: 'Single page',
    startPagePath: 'Page → Section / Stack / Grid → Components',
    startApp: 'Application',
    startAppPath: 'App Shell → Sidebar + Top Bar + Page → Components',
    startFromTemplate: 'Or start from a template',
    addedByEditor: '{type} added by editor',
    starterScreenName: 'New Screen',
    starterPrimaryGoal: 'Describe what the user accomplishes here.',
    starterRootName: 'Page',
    starterRootRole: 'Root container. Children added from the palette appear here.',
    starterAppScreenName: 'New Application',
    starterAppGoal: 'Build an application screen with navigation, a top bar, and a main content page.',
    starterAppShellName: 'App Shell',
    starterAppShellRole: 'Fixed application layout containing navigation, top bar, and the main page.',
    starterSidebarName: 'Sidebar',
    starterSidebarRole: 'Primary application navigation.',
    starterTopBarName: 'Top Bar',
    starterTopBarRole: 'Application-level search and actions.',
    starterMainPageName: 'Main Page',
    starterMainPageRole: 'Main content area. Add sections, stacks, grids, and components here.',
    starterPageCreated: 'Created a single-page UI. Add a container or component to the Page.',
    starterAppCreated: 'Created an application structure. The Main Page is selected.',
    addedToContainer: 'Added {component} to {container}.',
    placedFreely: 'Placed {component} freely in {container}. Existing components kept their positions.',
    movedToContainer: 'Moved {component} into {container}.',
    createdRoot: 'Created {component} as the root container.',
    shellSlotPlaced: 'Created an App Shell and placed {component} in its semantic slot. The original page remains as main content.',
    pageSidebarPlaced: 'Added a page sidebar to {container} and switched the container to horizontal layout.',
    mainDropArea: 'Main drop area',
    template: 'Template',
    chooseTemplate: 'Choose template...',
    templateDashboard: 'Dashboard app',
    templateLanding: 'Product landing page',
    templateSettings: 'Settings form',
    templateLoaded: 'Loaded template: {template}.',
    zoom: 'Zoom',
    fitArtboard: 'Fit artboard',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    undo: 'Undo',
    redo: 'Redo',
    duplicate: 'Duplicate',
    duplicateName: '{name} Copy',
    bringFront: 'Bring to front',
    sendBack: 'Send to back',
    alignLeft: 'Align left',
    alignCenter: 'Align horizontal center',
    alignRight: 'Align right',
    alignTop: 'Align top',
    alignMiddle: 'Align vertical center',
    alignBottom: 'Align bottom',
    distributeHorizontal: 'Distribute horizontally',
    distributeVertical: 'Distribute vertically',
    toggleLayoutMode: 'Switch auto/freeform layout',
    freeform: 'Freeform',
    autoLayout: 'Auto',
    importMigrated: 'Imported and migrated the Blueprint to v0.3.',
    imported: 'Blueprint imported.',
    preparingPackage: 'Preparing AI handoff package...',
    packageReady: 'AI handoff package exported.',
    viewportQualityBlocked: 'AI handoff blocked by {count} viewport layout issue(s).',
    selected: 'selected',
    components: 'Components',
    templates: 'Templates',
    layers: 'Layers',
    searchComponents: 'Search components',
    container: 'Container',
    leaf: 'Element',
    noLayers: 'Create or import a Blueprint to see layers.',
    multipleSelected: '{count} components selected.',
    'propertyTab.content': 'Content',
    'propertyTab.layout': 'Layout',
    'propertyTab.appearance': 'Appearance',
    'propertyTab.interaction': 'Interaction',
    parentContainer: 'Parent container',
    zIndex: 'Layer',
    contentText: 'Text',
    contentLabel: 'Label',
    placeholder: 'Placeholder',
    sourceUrl: 'Source URL',
    altText: 'Alternative text',
    advancedJson: 'Advanced JSON',
    backgroundToken: 'Background token',
    foregroundToken: 'Foreground token',
    typographyToken: 'Typography token',
    radiusToken: 'Radius token',
    shadowToken: 'Shadow token',
    variant: 'Variant',
    opacity: 'Opacity',
    actionIntent: 'Action intent',
    supportedStates: 'Supported states',
    declaredInteractions: 'Declared interactions',
    noDeclaredInteractions: 'No interaction record uses this component as its source.',
  },
  'zh-Hant': {
    appTitle: 'AUB 編輯器',
    noBlueprintLoaded: '尚未載入藍圖',
    importJson: '匯入 JSON',
    importAngular: '匯入 Angular 元件檔案',
    importPersonalTemplate: '匯入個人範本',
    downloadAuthoringKit: '下載 AI 建圖規格包',
    exportJson: '匯出 JSON',
    exportMarkdown: '匯出 Markdown',
    exportPackage: '匯出 AI 交付包',
    valid: '有效',
    schemaValid: '結構有效',
    schemaError: '個結構錯誤',
    schemaErrors: '個結構錯誤',
    parseJsonFailed: 'JSON 解析失敗：{message}',
    language: '語言',
    componentPalette: '元件面板',
    paletteHint: '點擊或拖曳可新增元件；既有元件請從上方邊框中央的把手移動。',
    kindContainer: '容器',
    kindLeaf: '單一元件',
    properties: '屬性',
    selectNode: '選取一個元件來編輯。',
    delete: '刪除',
    deleteComponent: '刪除元件',
    dragComponent: '拖曳「{component}」',
    dragComponentHint: '拖曳以移動「{component}」；按住 Option／Alt 可將它放入另一個容器。',
    rootCannotDelete: '根節點不能刪除',
    selectParent: '選取父容器',
    hideProperties: '隱藏',
    showProperties: '顯示屬性',
    releaseToAdd: '放開以新增「{component}」',
    id: '識別碼',
    name: '名稱',
    type: '類型',
    role: '用途',
    layoutJson: '版面設定（JSON）',
    contentJson: '內容設定（JSON）',
    layoutControls: '容器排列',
    layoutVertical: '垂直',
    layoutHorizontal: '水平',
    layoutGrid: '格線',
    layoutAlign: '交叉軸對齊',
    layoutJustify: '主軸分布',
    layoutStart: '起點',
    layoutCenter: '置中',
    layoutEnd: '終點',
    layoutStretch: '撐滿',
    layoutBaseline: '文字基線',
    layoutSpaceBetween: '兩端對齊',
    layoutSpaceAround: '等距環繞',
    layoutSpaceEvenly: '平均分布',
    layoutHorizontalGap: '水平間距',
    layoutVerticalGap: '垂直間距',
    layoutColumns: '欄數',
    layoutWrap: '空間不足時換行',
    layoutHelp: '這些設定會控制目前容器內所有第一層子元件的排列方式。',
    layoutFixed: '固定應用版面',
    layoutAppShellHelp: '應用框架會把側邊欄、頂部列、頁面與底部導覽放入固定語意槽位；需要自由排列時，請在頁面內加入容器。',
    canvas: '畫布',
    emptyCanvas: '把元件拖到這裡，或點擊元件面板開始。',
    navigationItems: '將「導覽項目」拖到這裡',
    pageSidebarItems: '將篩選、目錄或工具元件拖到這裡',
    appSidebarLabel: '應用主導覽',
    pageSidebarLabel: '頁面側欄',
    toolbarItems: '工具列項目',
    dropComponents: '拖放元件',
    enterValue: '輸入內容',
    chooseOption: '選擇選項',
    home: '首頁',
    row: '列',
    defaultColumnName: '名稱',
    defaultColumnStatus: '狀態',
    defaultColumnAmount: '金額',
    nodes: '個節點',
    node: '個節點',
    interactions: '個互動',
    interaction: '個互動',
    acceptance: '個驗收項目',
    startHint: '點擊元件面板中的元件開始，也可以拖曳新增。',
    startTitle: '建立新的 UI',
    startPrompt: '先選擇符合這個畫面的基本結構。',
    startPage: '單一頁面',
    startPagePath: '頁面 → 區段／堆疊／格線 → 元件',
    startApp: '應用程式',
    startAppPath: '應用框架 → 側邊欄＋頂部列＋頁面 → 元件',
    startFromTemplate: '或直接使用範本',
    addedByEditor: '由編輯器新增的{type}',
    starterScreenName: '新畫面',
    starterPrimaryGoal: '描述使用者在這個畫面要完成的目標。',
    starterRootName: '頁面',
    starterRootRole: '根容器。從元件面板新增的子元件會放在這裡。',
    starterAppScreenName: '新應用程式',
    starterAppGoal: '建立包含導覽、頂部列與主內容頁面的應用程式畫面。',
    starterAppShellName: '應用框架',
    starterAppShellRole: '固定的應用版面，包含導覽、頂部列與主頁面。',
    starterSidebarName: '側邊欄',
    starterSidebarRole: '應用程式的主要導覽。',
    starterTopBarName: '頂部列',
    starterTopBarRole: '放置應用層級的搜尋與操作。',
    starterMainPageName: '主頁面',
    starterMainPageRole: '主要內容區。請在這裡加入區段、堆疊、格線與其他元件。',
    starterPageCreated: '已建立單一頁面，可在「頁面」內加入容器或元件。',
    starterAppCreated: '已建立應用程式骨架，並選取「主頁面」。',
    addedToContainer: '已將「{component}」新增到「{container}」。',
    placedFreely: '已將「{component}」自由放置於「{container}」，並保留既有元件位置。',
    movedToContainer: '已將「{component}」移入「{container}」。',
    createdRoot: '已建立「{component}」作為根容器。',
    shellSlotPlaced: '已建立應用框架，並將「{component}」放入固定位置；原頁面保留為主內容。',
    pageSidebarPlaced: '已將頁面側欄加入「{container}」，並切換為水平排列。',
    mainDropArea: '主內容暫放區',
    template: '範本',
    chooseTemplate: '選擇範本...',
    templateDashboard: '後台儀表板',
    templateLanding: '產品 Landing 頁',
    templateSettings: '設定表單',
    templateLoaded: '已載入範本：「{template}」。',
    zoom: '縮放',
    fitArtboard: '適應畫板',
    zoomOut: '縮小',
    zoomIn: '放大',
    undo: '復原',
    redo: '重做',
    duplicate: '複製',
    duplicateName: '{name} 副本',
    bringFront: '移到最上層',
    sendBack: '移到最下層',
    alignLeft: '靠左對齊',
    alignCenter: '水平置中',
    alignRight: '靠右對齊',
    alignTop: '靠上對齊',
    alignMiddle: '垂直置中',
    alignBottom: '靠下對齊',
    distributeHorizontal: '水平平均分布',
    distributeVertical: '垂直平均分布',
    toggleLayoutMode: '切換自動／自由佈局',
    freeform: '自由',
    autoLayout: '自動',
    importMigrated: '已匯入並升級為 v0.3 藍圖。',
    imported: '已匯入藍圖。',
    preparingPackage: '正在準備 AI 交付包...',
    packageReady: '已匯出 AI 交付包。',
    viewportQualityBlocked: '偵測到 {count} 個裝置版面問題，已停止 AI 交付。',
    selected: '個已選取',
    components: '元件',
    templates: '範本',
    layers: '圖層',
    searchComponents: '搜尋元件',
    container: '容器',
    leaf: '元件',
    noLayers: '建立或匯入藍圖後即可查看圖層。',
    multipleSelected: '已選取 {count} 個元件。',
    'propertyTab.content': '內容',
    'propertyTab.layout': '佈局',
    'propertyTab.appearance': '外觀',
    'propertyTab.interaction': '互動',
    parentContainer: '父容器',
    zIndex: '圖層順序',
    contentText: '文字內容',
    contentLabel: '標籤',
    placeholder: '提示文字',
    sourceUrl: '來源網址',
    altText: '替代文字',
    advancedJson: '進階 JSON',
    backgroundToken: '背景 token',
    foregroundToken: '前景 token',
    typographyToken: '字體 token',
    radiusToken: '圓角 token',
    shadowToken: '陰影 token',
    variant: '樣式變體',
    opacity: '透明度',
    actionIntent: '動作意圖',
    supportedStates: '支援狀態',
    declaredInteractions: '已宣告互動',
    noDeclaredInteractions: '目前沒有互動紀錄以這個元件作為來源。',
  },
};

const LANGUAGE_OPTION_LABELS: Record<Language, Record<Language, string>> = {
  en: {
    en: 'English',
    'zh-Hant': 'Traditional Chinese',
  },
  'zh-Hant': {
    en: '英文',
    'zh-Hant': '繁體中文',
  },
};

const CATEGORY_LABELS: Record<Language, Record<string, string>> = {
  en: {},
  'zh-Hant': {
    layout: '版面',
    visual: '視覺',
    data: '資料',
    form: '表單',
    action: '操作',
    feedback: '回饋',
    navigation: '導覽',
  },
};

const CATEGORY_DESCRIPTIONS: Record<Language, Record<string, string>> = {
  en: {},
  'zh-Hant': {
    layout: '容器與結構元件，用 flex/grid 排列子元件。',
    visual: '標題、文字、圖片、卡片與其他視覺內容元件。',
    data: '資料顯示元件，用於集合、彙總與資料來源綁定。',
    form: '表單容器與輸入元件。',
    action: '觸發操作的元件，需具備動作意圖。',
    feedback: '訊息、對話框、提示與狀態佔位。',
    navigation: '導覽元件，連到目標畫面或錨點。',
  },
};

const TYPE_LABELS: Record<Language, Record<ComponentType, string>> = {
  en: {} as Record<ComponentType, string>,
  'zh-Hant': {
    app_shell: '應用框架',
    page: '頁面',
    section: '區段',
    header: '頁首',
    sidebar: '側邊欄',
    top_bar: '頂部列',
    bottom_nav: '底部導覽',
    stack: '堆疊容器',
    grid: '格線',
    split_pane: '分割窗格',
    scroll_area: '捲動區域',
    metric_card: '指標卡片',
    data_table: '資料表格',
    list: '清單',
    detail_panel: '詳細面板',
    chart_placeholder: '圖表佔位',
    timeline: '時間軸',
    activity_feed: '活動動態',
    form: '表單',
    field_group: '欄位群組',
    text_input: '文字輸入',
    select: '下拉選單',
    checkbox: '核取方塊',
    radio_group: '單選群組',
    toggle: '切換開關',
    slider: '滑桿',
    date_picker: '日期選擇器',
    file_upload: '檔案上傳',
    button: '按鈕',
    icon_button: '圖示按鈕',
    button_group: '按鈕群組',
    menu: '選單',
    toolbar: '工具列',
    command_palette: '命令面板',
    modal: '彈出視窗',
    drawer: '抽屜面板',
    toast: '提示訊息',
    alert: '警示訊息',
    empty_state: '空狀態',
    loading_state: '載入狀態',
    error_state: '錯誤狀態',
    tabs: '分頁',
    breadcrumb: '麵包屑',
    pagination: '分頁控制',
    stepper: '步驟器',
    nav_item: '導覽項目',
    heading: '標題',
    text: '文字',
    card: '卡片',
    image: '圖片',
    icon: '圖示',
    avatar: '頭像',
    badge: '徽章',
    tag: '標籤',
    divider: '分隔線',
    link: '連結',
    textarea: '多行文字',
    search_input: '搜尋輸入',
    calendar: '行事曆',
    kanban_board: '看板',
    kanban_column: '看板欄',
    rich_text_editor: '富文字編輯器',
  },
};

const TYPE_DESCRIPTIONS: Record<Language, Partial<Record<ComponentType, string>>> = {
  en: {},
  'zh-Hant': {
    app_shell: '最上層的應用版面容器。',
    page: '完整畫面的可捲動內容區。',
    section: '把相關元件分組的區塊。',
    header: '畫面上方區域，通常包含標題與操作。',
    sidebar: '側欄容器；放在應用框架中是主導覽，放在頁面或區段中則是篩選、目錄或工具側欄。',
    top_bar: '水平頂部列，包含標誌、搜尋與使用者操作。',
    bottom_nav: '行動優先的底部水平導覽。',
    stack: '通用 flex 容器，預設直向排列。',
    grid: '以 CSS grid 排列的容器。',
    split_pane: '主從或列表詳細的雙窗格版面。',
    scroll_area: '具固定尺寸的可捲動區域。',
    metric_card: '顯示單一 KPI、標籤、數值與變化。',
    data_table: '具欄位、排序與篩選的表格資料。',
    list: '垂直排列的項目集合。',
    detail_panel: '顯示資料列或紀錄細節的面板。',
    chart_placeholder: '提供圖表函式庫替換的顯示位置。',
    timeline: '依時間排序的事件清單。',
    activity_feed: '反向時間排序的活動串流。',
    form: '具提交動作的表單容器。',
    field_group: '具共同標籤或圖例的欄位群組。',
    text_input: '單行文字輸入欄位。',
    select: '下拉式選擇器。',
    checkbox: '具標籤的布林勾選元件。',
    radio_group: '從一組選項中單選。',
    toggle: '具標籤的開關元件。',
    slider: '數值範圍輸入元件。',
    date_picker: '以月曆選擇日期的輸入元件。',
    file_upload: '拖放或瀏覽檔案的上傳元件。',
    button: '主要操作按鈕，需要宣告動作意圖。',
    icon_button: '只有圖示的按鈕，需要無障礙標籤。',
    button_group: '一組相關按鈕。',
    menu: '動作下拉選單。',
    toolbar: '水平操作工具列。',
    command_palette: '類似 Cmd-K 的可搜尋命令清單。',
    modal: '置中的阻塞式對話框。',
    drawer: '從側邊滑出的面板。',
    toast: '短暫顯示的回饋訊息。',
    alert: '頁面內訊息，例如資訊、警告或錯誤。',
    empty_state: '集合沒有資料時的佔位狀態。',
    loading_state: '資料載入中的佔位狀態。',
    error_state: '資料取得失敗時的佔位狀態。',
    tabs: '分頁檢視選擇器。',
    breadcrumb: '階層式位置指示。',
    pagination: '集合資料的頁碼導覽。',
    stepper: '多步驟流程指示器。',
    nav_item: '側邊欄或頂部導覽中的單一連結。',
    heading: '具語意層級與字體 token 的標題。',
    text: '段落、說明或輔助文字。',
    card: '框住一組相關內容與操作的容器。',
    image: '具來源與替代文字的圖片。',
    icon: '以名稱指定的介面圖示。',
    avatar: '使用者或實體的頭像。',
    badge: '顯示狀態或數量的徽章。',
    tag: '精簡的分類標籤。',
    divider: '分隔內容群組的線條。',
    link: '行內導覽操作。',
    textarea: '多行文字輸入欄位。',
    search_input: '具搜尋意圖的輸入欄位。',
    calendar: '月、週或議程行事曆。',
    kanban_board: '包含工作流程欄的橫向看板。',
    kanban_column: '包含任務卡的工作流程階段。',
    rich_text_editor: '包含工具列與文件內容的編輯器。',
  },
};

const VIEWPORT_LABELS: Record<Language, Record<Viewport['id'], string>> = {
  en: {
    desktop: 'desktop',
    tablet: 'tablet',
    mobile: 'mobile',
    wide: 'wide',
  },
  'zh-Hant': {
    desktop: '桌面',
    tablet: '平板',
    mobile: '手機',
    wide: '寬螢幕',
  },
};

const STATE_LABELS: Record<Language, Record<NodeState, string>> = {
  en: {
    default: 'Default',
    hover: 'Hover',
    focus: 'Focus',
    active: 'Active',
    disabled: 'Disabled',
    loading: 'Loading',
    empty: 'Empty',
    error: 'Error',
    selected: 'Selected',
  },
  'zh-Hant': {
    default: '預設',
    hover: '游標停留',
    focus: '聚焦',
    active: '作用中',
    disabled: '停用',
    loading: '載入中',
    empty: '空狀態',
    error: '錯誤',
    selected: '已選取',
  },
};

export function t(language: Language, key: MessageKey, vars: Record<string, string | number> = {}): string {
  let message = MESSAGES[language][key] ?? MESSAGES.en[key];
  for (const [name, value] of Object.entries(vars)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

export function languageOptionLabel(currentLanguage: Language, optionLanguage: Language): string {
  return LANGUAGE_OPTION_LABELS[currentLanguage][optionLanguage];
}

export function categoryLabel(language: Language, id: string, fallback: string): string {
  return CATEGORY_LABELS[language][id] ?? fallback;
}

export function categoryDescription(language: Language, id: string, fallback: string): string {
  return CATEGORY_DESCRIPTIONS[language][id] ?? fallback;
}

export function componentLabel(language: Language, type: ComponentType, fallback: string = type): string {
  return TYPE_LABELS[language][type] ?? fallback;
}

export function componentDescription(language: Language, type: ComponentType, fallback: string): string {
  return TYPE_DESCRIPTIONS[language][type] ?? fallback;
}

export function viewportLabel(language: Language, id: Viewport['id']): string {
  return VIEWPORT_LABELS[language][id] ?? id;
}

export function stateLabel(language: Language, state: NodeState): string {
  return STATE_LABELS[language][state] ?? state;
}
