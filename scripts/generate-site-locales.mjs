#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CHECK = process.argv.includes('--check');

const locales = {
  en: {
    path: '',
    label: 'English',
    shortLabel: 'EN',
    htmlLang: 'en',
    ogLocale: 'en_US',
    title: 'AUB — UI Contracts for Coding Agents',
    description:
      'Define a versioned UI implementation contract, map it to production components, hand it to any coding agent, and gate the pull request on acceptance evidence.',
    ogDescription:
      'From design intent to verified implementation: semantic Blueprints, production components, MCP, and PR acceptance gates.',
    navEditor: 'Editor',
    navWorkflow: 'Workflow',
    navIntegrations: 'Integrations',
    navGitHub: 'GitHub',
    languageNav: 'Language',
    eyebrow: 'UI implementation contracts',
    headline: ['Define the intent.', 'Reuse real components.', 'Gate the PR on evidence.'],
    lede:
      'AUB is the open contract layer between product intent and coding agents. Compose a semantic Blueprint, map it to production components, hand the same source of truth to Codex, Claude Code, Copilot, or another agent, then verify every acceptance id in CI.',
    openEditor: 'Open the live editor',
    viewGitHub: 'View on GitHub',
    note: 'Apache-2.0 · local-first · agent-neutral · the editor uploads nothing',
    editorAria: 'Open the AUB editor',
    editorAlt: 'AUB visual editor composing a responsive screen',
    capabilitiesAria: 'Product capabilities',
    proof: [
      ['62', 'semantic component types'],
      ['18', 'responsive starting templates'],
      ['16', 'MCP tools for agents'],
      ['4', 'acceptance categories'],
    ],
    workflowKicker: 'Golden path',
    workflowTitle: 'One contract from intent to pull request',
    steps: [
      ['Compose or import', 'Build one screen, import a Figma/Penpot bridge, or compose a navigable multi-screen project.'],
      ['Bind real components', 'Resolve custom types to production modules, exports, source files, Storybook, and props.'],
      ['Hand off once', 'Use a portable package or MCP. The core contract stays identical across agents.'],
      ['Return evidence', 'The agent maps every node and reports pass, fail, or needs-review for every acceptance id.'],
      ['Gate the PR', 'The AUB GitHub Action rejects drift, missing mappings, failed criteria, and unresolved work.'],
    ],
    whyKicker: 'Designed for implementation',
    whyTitle: 'Not another design canvas or one-shot code generator',
    whyLede:
      'Design tools optimize creation. Code generators optimize speed. AUB protects intent across tools, agents, revisions, and reviews with a format that Git and CI can understand.',
    whyCards: [
      ['Versioned source of truth', 'JSON Schema, semantic validation, migration, diff, and lock snapshots.'],
      ['Production reuse', 'Map semantic types to existing framework components instead of recreating them.'],
      ['Agent-neutral execution', 'Codex, Claude Code, Copilot, and generic agents receive the same contract.'],
      ['Evidence, not confidence', 'Implementation reports and PR checks make incomplete work visible.'],
    ],
    integrationKicker: 'Integration contract',
    integrationTitle: 'Point agents at the component you already ship',
    integrationBody:
      'Custom registry entries can identify a production package, exported symbol, source file, Storybook story, documentation, and the exact Blueprint-to-prop mapping.',
    integrationList: [
      'Prevent bespoke lookalike components',
      'Keep repository-native tokens and behavior',
      'Support multiple framework implementations',
    ],
    handoffKicker: 'Connect and verify',
    handoffTitle: 'Files when you need portability. MCP when agents need live access.',
    handoffBody:
      'Export an <code>.aub.zip</code>, or let MCP-capable agents over stdio or HTTP import, write, package, resolve, validate, scaffold, diff, migrate, lock, and report against Blueprints and multi-screen projects. Add the bundled GitHub Action to turn those contracts into a pull-request gate.',
    commandNote: 'Validates contracts and implementation evidence',
    links: ['Agent handoff guide', 'MCP server', 'GitHub CI gate', 'Production mappings', 'Figma/Penpot bridge', 'Blueprint schema'],
    footer: 'UI contracts for coding agents',
  },
  'zh-hant': {
    path: 'zh-hant',
    label: '繁體中文',
    shortLabel: '繁中',
    htmlLang: 'zh-Hant',
    ogLocale: 'zh_TW',
    title: 'AUB — 編碼 Agent 的 UI 實作合約',
    description: '定義可版本化的 UI 實作合約、對應正式元件、交付給任何編碼 Agent，並以驗收證據把關 Pull Request。',
    ogDescription: '從設計意圖到可驗證實作：語意化 Blueprint、正式元件、MCP 與 PR 驗收閘門。',
    navEditor: '編輯器',
    navWorkflow: '流程',
    navIntegrations: '整合',
    navGitHub: 'GitHub',
    languageNav: '語言',
    eyebrow: 'UI 實作合約',
    headline: ['定義產品意圖。', '重用正式元件。', '以證據把關 PR。'],
    lede:
      'AUB 是產品意圖與編碼 Agent 之間的開放合約層。建立語意化 Blueprint、對應正式元件，將同一份唯一真實來源交給 Codex、Claude Code、Copilot 或其他 Agent，再於 CI 逐項驗證 acceptance id。',
    openEditor: '開啟線上編輯器',
    viewGitHub: '前往 GitHub',
    note: 'Apache-2.0 · local-first · agent-neutral · 編輯器不會上傳資料',
    editorAria: '開啟 AUB 編輯器',
    editorAlt: 'AUB 視覺編輯器正在組合響應式畫面',
    capabilitiesAria: '產品能力',
    proof: [
      ['62', '種語意元件類型'],
      ['18', '個響應式起始範本'],
      ['16', '個 Agent MCP 工具'],
      ['4', '類驗收條件'],
    ],
    workflowKicker: '黃金流程',
    workflowTitle: '從產品意圖到 Pull Request，只用一份合約',
    steps: [
      ['組合或匯入', '建立單一畫面、匯入 Figma／Penpot bridge，或組成可導覽的多畫面專案。'],
      ['綁定正式元件', '將自訂類型對應到正式 module、export、source、Storybook 與 props。'],
      ['一次交付', '使用可攜式交付包或 MCP；不同 Agent 仍共享同一份核心合約。'],
      ['回報證據', 'Agent 對應每個節點，並為每個 acceptance id 回報 pass、fail 或 needs-review。'],
      ['把關 PR', 'AUB GitHub Action 會拒絕漂移、遺漏 mapping、驗收失敗與未解決事項。'],
    ],
    whyKicker: '為實作而設計',
    whyTitle: '不是另一套設計畫布，也不是一次性程式碼生成器',
    whyLede: '設計工具最佳化創作，程式碼生成器最佳化速度；AUB 用 Git 與 CI 能理解的格式，跨工具、Agent、版本與審查保護產品意圖。',
    whyCards: [
      ['可版本化的唯一真實來源', 'JSON Schema、語意驗證、migration、diff 與 lock snapshot。'],
      ['重用正式元件', '將語意類型對應到既有 framework 元件，而不是重新製作相似品。'],
      ['Agent-neutral 執行', 'Codex、Claude Code、Copilot 與通用 Agent 取得相同合約。'],
      ['需要證據，不靠信心', 'Implementation report 與 PR check 會讓未完成工作清楚可見。'],
    ],
    integrationKicker: '整合合約',
    integrationTitle: '讓 Agent 使用你已經上線的正式元件',
    integrationBody: '自訂 registry 可指定正式 package、export symbol、source file、Storybook、文件，以及精確的 Blueprint-to-prop mapping。',
    integrationList: ['避免建立相似但不同的元件', '保留 repository 原生 token 與行為', '支援多種 framework 實作'],
    handoffKicker: '連接並驗證',
    handoffTitle: '需要可攜性時用檔案；Agent 需要即時存取時用 MCP。',
    handoffBody:
      '匯出 <code>.aub.zip</code>，或讓支援 MCP 的 Agent 透過 stdio／HTTP 匯入、寫入、打包、解析、驗證、補全、diff、migrate、lock 與回報 Blueprint 和多畫面專案。再加入內建 GitHub Action，將合約變成 Pull Request 驗收閘門。',
    commandNote: '驗證合約與實作證據',
    links: ['Agent 交付指南', 'MCP server', 'GitHub CI 閘門', '正式元件對應', 'Figma／Penpot bridge', 'Blueprint schema'],
    footer: '編碼 Agent 的 UI 實作合約',
  },
  'zh-hans': {
    path: 'zh-hans',
    label: '简体中文',
    shortLabel: '简中',
    htmlLang: 'zh-Hans',
    ogLocale: 'zh_CN',
    title: 'AUB — 编码 Agent 的 UI 实现契约',
    description: '定义可版本化的 UI 实现契约、映射生产组件、交付给任意编码 Agent，并用验收证据管控 Pull Request。',
    ogDescription: '从设计意图到可验证实现：语义化 Blueprint、生产组件、MCP 与 PR 验收门禁。',
    navEditor: '编辑器',
    navWorkflow: '流程',
    navIntegrations: '集成',
    navGitHub: 'GitHub',
    languageNav: '语言',
    eyebrow: 'UI 实现契约',
    headline: ['定义产品意图。', '复用生产组件。', '用证据管控 PR。'],
    lede:
      'AUB 是产品意图与编码 Agent 之间的开放契约层。创建语义化 Blueprint、映射生产组件，把同一份唯一事实来源交给 Codex、Claude Code、Copilot 或其他 Agent，再在 CI 中逐项验证 acceptance id。',
    openEditor: '打开在线编辑器',
    viewGitHub: '前往 GitHub',
    note: 'Apache-2.0 · local-first · agent-neutral · 编辑器不会上传数据',
    editorAria: '打开 AUB 编辑器',
    editorAlt: 'AUB 可视化编辑器正在编排响应式页面',
    capabilitiesAria: '产品能力',
    proof: [
      ['62', '种语义组件类型'],
      ['18', '个响应式起始模板'],
      ['16', '个 Agent MCP 工具'],
      ['4', '类验收条件'],
    ],
    workflowKicker: '黄金路径',
    workflowTitle: '从产品意图到 Pull Request，只使用一份契约',
    steps: [
      ['编排或导入', '创建单个页面、导入 Figma／Penpot bridge，或组成可导航的多页面项目。'],
      ['绑定生产组件', '把自定义类型映射到生产 module、export、source、Storybook 与 props。'],
      ['一次交付', '使用便携交付包或 MCP；不同 Agent 始终共享同一份核心契约。'],
      ['返回证据', 'Agent 映射每个节点，并为每个 acceptance id 报告 pass、fail 或 needs-review。'],
      ['管控 PR', 'AUB GitHub Action 会拒绝漂移、缺失 mapping、验收失败和未解决事项。'],
    ],
    whyKicker: '为实现而设计',
    whyTitle: '不是另一套设计画布，也不是一次性代码生成器',
    whyLede: '设计工具优化创作，代码生成器优化速度；AUB 使用 Git 与 CI 能理解的格式，跨工具、Agent、版本和评审保护产品意图。',
    whyCards: [
      ['可版本化的唯一事实来源', 'JSON Schema、语义验证、migration、diff 与 lock snapshot。'],
      ['复用生产组件', '把语义类型映射到现有 framework 组件，而不是重新创建相似组件。'],
      ['Agent-neutral 执行', 'Codex、Claude Code、Copilot 与通用 Agent 获得相同契约。'],
      ['需要证据，而非信心', 'Implementation report 与 PR check 会让未完成工作清晰可见。'],
    ],
    integrationKicker: '集成契约',
    integrationTitle: '让 Agent 使用你已经上线的生产组件',
    integrationBody: '自定义 registry 可以指定生产 package、export symbol、source file、Storybook、文档，以及精确的 Blueprint-to-prop mapping。',
    integrationList: ['避免创建相似但不一致的组件', '保留 repository 原生 token 与行为', '支持多种 framework 实现'],
    handoffKicker: '连接并验证',
    handoffTitle: '需要便携性时使用文件；Agent 需要实时访问时使用 MCP。',
    handoffBody:
      '导出 <code>.aub.zip</code>，或让支持 MCP 的 Agent 通过 stdio／HTTP 导入、写入、打包、解析、验证、补全、diff、migrate、lock 并报告 Blueprint 和多页面项目。再加入内置 GitHub Action，把契约转为 Pull Request 验收门禁。',
    commandNote: '验证契约与实现证据',
    links: ['Agent 交付指南', 'MCP server', 'GitHub CI 门禁', '生产组件映射', 'Figma／Penpot bridge', 'Blueprint schema'],
    footer: '编码 Agent 的 UI 实现契约',
  },
  ja: {
    path: 'ja',
    label: '日本語',
    shortLabel: '日本語',
    htmlLang: 'ja',
    ogLocale: 'ja_JP',
    title: 'AUB — コーディング Agent のための UI 実装契約',
    description: 'バージョン管理可能な UI 実装契約を定義し、本番コンポーネントへ紐付け、任意のコーディング Agent に渡して、受け入れ証拠で Pull Request を検証します。',
    ogDescription: 'デザイン意図から検証可能な実装へ。セマンティック Blueprint、本番コンポーネント、MCP、PR 受け入れゲート。',
    navEditor: 'エディター',
    navWorkflow: 'ワークフロー',
    navIntegrations: '連携',
    navGitHub: 'GitHub',
    languageNav: '言語',
    eyebrow: 'UI 実装契約',
    headline: ['意図を定義する。', '本番コンポーネントを再利用する。', '証拠で PR を検証する。'],
    lede:
      'AUB は、プロダクト意図とコーディング Agent をつなぐオープンな契約レイヤーです。セマンティック Blueprint を作成し、本番コンポーネントに紐付け、同じ信頼できる情報源を Codex、Claude Code、Copilot などへ渡し、CI で各 acceptance id を検証します。',
    openEditor: 'オンラインエディターを開く',
    viewGitHub: 'GitHub を見る',
    note: 'Apache-2.0 · local-first · agent-neutral · エディターはデータを送信しません',
    editorAria: 'AUB エディターを開く',
    editorAlt: 'レスポンシブ画面を構成する AUB ビジュアルエディター',
    capabilitiesAria: '製品機能',
    proof: [
      ['62', '種類のセマンティックコンポーネント'],
      ['18', '種類のレスポンシブテンプレート'],
      ['16', '個の Agent 向け MCP ツール'],
      ['4', '種類の受け入れカテゴリ'],
    ],
    workflowKicker: 'ゴールデンパス',
    workflowTitle: '意図から Pull Request まで、一つの契約でつなぐ',
    steps: [
      ['作成またはインポート', '単一画面、Figma／Penpot bridge、または遷移可能な複数画面プロジェクトを作成します。'],
      ['本番コンポーネントを紐付け', 'カスタム型を本番 module、export、source、Storybook、props に解決します。'],
      ['一度だけ引き渡す', 'ポータブルパッケージまたは MCP を使用し、どの Agent にも同じ契約を渡します。'],
      ['証拠を返す', 'Agent は全ノードを対応付け、各 acceptance id を pass、fail、needs-review で報告します。'],
      ['PR をゲートする', 'AUB GitHub Action が差異、mapping 漏れ、受け入れ失敗、未解決項目を拒否します。'],
    ],
    whyKicker: '実装のための設計',
    whyTitle: '新しいデザインキャンバスでも、一回限りのコード生成器でもありません',
    whyLede: 'デザインツールは制作を、コード生成器は速度を最適化します。AUB は Git と CI が理解できる形式で、ツール、Agent、リビジョン、レビューをまたいで意図を守ります。',
    whyCards: [
      ['バージョン管理できる信頼できる情報源', 'JSON Schema、セマンティック検証、migration、diff、lock snapshot。'],
      ['本番資産の再利用', 'セマンティック型を既存 framework コンポーネントへ紐付けます。'],
      ['Agent-neutral な実行', 'Codex、Claude Code、Copilot、汎用 Agent が同じ契約を受け取ります。'],
      ['信頼ではなく証拠', 'Implementation report と PR check が未完了作業を可視化します。'],
    ],
    integrationKicker: '連携契約',
    integrationTitle: 'すでに提供中の本番コンポーネントを Agent に使わせる',
    integrationBody: 'カスタム registry で、本番 package、export symbol、source file、Storybook、ドキュメント、正確な Blueprint-to-prop mapping を指定できます。',
    integrationList: ['似ているだけの独自コンポーネントを防ぐ', 'repository 固有の token と動作を維持する', '複数 framework の実装を支援する'],
    handoffKicker: '接続して検証',
    handoffTitle: '持ち運びにはファイルを、Agent のライブアクセスには MCP を。',
    handoffBody:
      '<code>.aub.zip</code> を書き出すか、MCP 対応 Agent に stdio／HTTP 経由で Blueprint と複数画面プロジェクトの import、write、package、resolve、validate、scaffold、diff、migrate、lock、report を実行させます。付属の GitHub Action で契約を Pull Request ゲートにできます。',
    commandNote: '契約と実装証拠を検証',
    links: ['Agent 引き渡しガイド', 'MCP server', 'GitHub CI ゲート', '本番 mapping', 'Figma／Penpot bridge', 'Blueprint schema'],
    footer: 'コーディング Agent のための UI 実装契約',
  },
  ko: {
    path: 'ko',
    label: '한국어',
    shortLabel: '한국어',
    htmlLang: 'ko',
    ogLocale: 'ko_KR',
    title: 'AUB — 코딩 Agent를 위한 UI 구현 계약',
    description: '버전 관리 가능한 UI 구현 계약을 정의하고, 프로덕션 컴포넌트에 연결해 어떤 코딩 Agent에도 전달한 뒤 인수 증거로 Pull Request를 검증합니다.',
    ogDescription: '디자인 의도에서 검증 가능한 구현까지: 시맨틱 Blueprint, 프로덕션 컴포넌트, MCP, PR 인수 게이트.',
    navEditor: '에디터',
    navWorkflow: '워크플로',
    navIntegrations: '통합',
    navGitHub: 'GitHub',
    languageNav: '언어',
    eyebrow: 'UI 구현 계약',
    headline: ['의도를 정의합니다.', '프로덕션 컴포넌트를 재사용합니다.', '증거로 PR을 검증합니다.'],
    lede:
      'AUB는 제품 의도와 코딩 Agent 사이의 개방형 계약 계층입니다. 시맨틱 Blueprint를 만들고 프로덕션 컴포넌트에 연결한 뒤, 동일한 단일 기준을 Codex, Claude Code, Copilot 또는 다른 Agent에 전달하고 CI에서 모든 acceptance id를 검증합니다.',
    openEditor: '온라인 에디터 열기',
    viewGitHub: 'GitHub 보기',
    note: 'Apache-2.0 · local-first · agent-neutral · 에디터는 데이터를 업로드하지 않습니다',
    editorAria: 'AUB 에디터 열기',
    editorAlt: '반응형 화면을 구성하는 AUB 비주얼 에디터',
    capabilitiesAria: '제품 기능',
    proof: [
      ['62', '가지 시맨틱 컴포넌트 유형'],
      ['18', '가지 반응형 시작 템플릿'],
      ['16', '개의 Agent용 MCP 도구'],
      ['4', '가지 인수 카테고리'],
    ],
    workflowKicker: '골든 패스',
    workflowTitle: '제품 의도부터 Pull Request까지 하나의 계약으로',
    steps: [
      ['구성 또는 가져오기', '단일 화면, Figma／Penpot bridge 또는 탐색 가능한 다중 화면 프로젝트를 만듭니다.'],
      ['프로덕션 컴포넌트 연결', '사용자 정의 유형을 프로덕션 module, export, source, Storybook, props에 연결합니다.'],
      ['한 번만 전달', '휴대 가능한 패키지나 MCP를 사용하며 모든 Agent가 동일한 핵심 계약을 공유합니다.'],
      ['증거 반환', 'Agent가 모든 노드를 매핑하고 각 acceptance id를 pass, fail, needs-review로 보고합니다.'],
      ['PR 게이트', 'AUB GitHub Action이 드리프트, 누락된 mapping, 인수 실패와 미해결 작업을 거부합니다.'],
    ],
    whyKicker: '구현을 위한 설계',
    whyTitle: '또 하나의 디자인 캔버스나 일회성 코드 생성기가 아닙니다',
    whyLede: '디자인 도구는 제작을, 코드 생성기는 속도를 최적화합니다. AUB는 Git과 CI가 이해하는 형식으로 도구, Agent, 리비전과 리뷰 전반에서 의도를 보호합니다.',
    whyCards: [
      ['버전 관리 가능한 단일 기준', 'JSON Schema, 시맨틱 검증, migration, diff, lock snapshot.'],
      ['프로덕션 자산 재사용', '시맨틱 유형을 기존 framework 컴포넌트에 연결해 재구현을 방지합니다.'],
      ['Agent-neutral 실행', 'Codex, Claude Code, Copilot과 범용 Agent가 동일한 계약을 받습니다.'],
      ['신뢰가 아닌 증거', 'Implementation report와 PR check가 미완료 작업을 드러냅니다.'],
    ],
    integrationKicker: '통합 계약',
    integrationTitle: '이미 배포 중인 프로덕션 컴포넌트를 Agent가 사용하게 합니다',
    integrationBody: '사용자 정의 registry에 프로덕션 package, export symbol, source file, Storybook, 문서와 정확한 Blueprint-to-prop mapping을 지정할 수 있습니다.',
    integrationList: ['비슷하게만 생긴 별도 컴포넌트 방지', 'repository 고유 token과 동작 유지', '여러 framework 구현 지원'],
    handoffKicker: '연결 및 검증',
    handoffTitle: '이식성이 필요하면 파일을, Agent의 실시간 접근에는 MCP를 사용합니다.',
    handoffBody:
      '<code>.aub.zip</code>을 내보내거나 MCP 지원 Agent가 stdio／HTTP를 통해 Blueprint와 다중 화면 프로젝트를 import, write, package, resolve, validate, scaffold, diff, migrate, lock, report하도록 합니다. 번들 GitHub Action을 추가하면 이 계약이 Pull Request 게이트가 됩니다.',
    commandNote: '계약과 구현 증거 검증',
    links: ['Agent 전달 가이드', 'MCP server', 'GitHub CI 게이트', '프로덕션 mapping', 'Figma／Penpot bridge', 'Blueprint schema'],
    footer: '코딩 Agent를 위한 UI 구현 계약',
  },
};

const linkTargets = [
  'docs/agent-handoff.md',
  'apps/mcp-server/README.md',
  'docs/github-ci.md',
  'docs/custom-components.md',
  'docs/design-tool-bridge.md',
  'schema/ui-blueprint.schema.json',
];

function localeHref(current, target) {
  const base = current.path ? '../' : './';
  return target.path ? `${base}${target.path}/` : base;
}

function renderLanguageNav(id, locale) {
  return Object.entries(locales)
    .map(([targetId, target]) => {
      const current = targetId === id ? ' aria-current="page"' : '';
      return `<a href="${localeHref(locale, target)}" hreflang="${target.htmlLang}" lang="${target.htmlLang}"${current}>${target.shortLabel}</a>`;
    })
    .join('\n          ');
}

function renderPage(id, locale) {
  const base = locale.path ? '../' : './';
  const pageUrl = locale.path
    ? `https://henrylau1103.github.io/AUB/${locale.path}/`
    : 'https://henrylau1103.github.io/AUB/';
  const alternateLinks = Object.values(locales)
    .map((target) => {
      const href = target.path
        ? `https://henrylau1103.github.io/AUB/${target.path}/`
        : 'https://henrylau1103.github.io/AUB/';
      return `    <link rel="alternate" hreflang="${target.htmlLang}" href="${href}" />`;
    })
    .join('\n');
  const ogAlternates = Object.values(locales)
    .filter((target) => target.ogLocale !== locale.ogLocale)
    .map((target) => `    <meta property="og:locale:alternate" content="${target.ogLocale}" />`)
    .join('\n');
  const proof = locale.proof
    .map(([value, label]) => `        <div><strong>${value}</strong><span>${label}</span></div>`)
    .join('\n');
  const steps = locale.steps
    .map(
      ([title, body], index) => `          <li>
            <span class="step-num">${index + 1}</span>
            <h3>${title}</h3>
            <p>${body}</p>
          </li>`
    )
    .join('\n');
  const cards = locale.whyCards
    .map(
      ([title, body]) => `          <div class="card">
            <h3>${title}</h3>
            <p>${body}</p>
          </div>`
    )
    .join('\n');
  const featureList = locale.integrationList.map((item) => `              <li>${item}</li>`).join('\n');
  const links = locale.links
    .map(
      (label, index) =>
        `          <a href="https://github.com/HenryLau1103/AUB/blob/main/${linkTargets[index]}">${label}</a>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="${locale.htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${locale.title}</title>
    <meta name="description" content="${locale.description}" />
    <link rel="canonical" href="${pageUrl}" />
${alternateLinks}
    <link rel="alternate" hreflang="x-default" href="https://henrylau1103.github.io/AUB/" />
    <meta property="og:title" content="${locale.title}" />
    <meta property="og:description" content="${locale.ogDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:locale" content="${locale.ogLocale}" />
${ogAlternates}
    <meta property="og:image" content="${base}assets/aub-editor-en.jpg" />
    <meta name="theme-color" content="#0B1220" />
    <link rel="icon" href="${base}assets/brand/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="${base}assets/brand/favicon-32x32.png" sizes="32x32" type="image/png" />
    <link rel="mask-icon" href="${base}assets/brand/safari-pinned-tab.svg" color="#0B67F0" />
    <link rel="apple-touch-icon" href="${base}assets/brand/apple-touch-icon.png" />
    <link rel="manifest" href="${base}manifest.webmanifest" />
    <meta name="msapplication-config" content="${base}browserconfig.xml" />
    <link rel="stylesheet" href="${base}styles.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="${base}">
        <img class="brand-mark" src="${base}assets/brand/aub-logo-mark.svg" alt="" />
        <span class="brand-name">AUB</span>
      </a>
      <div class="header-actions">
        <nav class="site-nav">
          <a href="${base}editor/">${locale.navEditor}</a>
          <a href="#workflow">${locale.navWorkflow}</a>
          <a href="#integrations">${locale.navIntegrations}</a>
          <a href="https://github.com/HenryLau1103/AUB">${locale.navGitHub}</a>
        </nav>
        <nav class="language-nav" aria-label="${locale.languageNav}">
          ${renderLanguageNav(id, locale)}
        </nav>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">${locale.eyebrow}</p>
          <h1>${locale.headline.join('<br />')}</h1>
          <p class="lede">${locale.lede}</p>
          <div class="cta-row">
            <a class="btn btn-primary" href="${base}editor/">${locale.openEditor}</a>
            <a class="btn btn-ghost" href="https://github.com/HenryLau1103/AUB">${locale.viewGitHub}</a>
          </div>
          <p class="note">${locale.note}</p>
        </div>
        <a class="hero-shot" href="${base}editor/" aria-label="${locale.editorAria}">
          <img src="${base}assets/aub-editor-en.jpg" alt="${locale.editorAlt}" loading="lazy" />
        </a>
      </section>

      <section class="proof" aria-label="${locale.capabilitiesAria}">
${proof}
      </section>

      <section class="steps" id="workflow">
        <p class="section-kicker">${locale.workflowKicker}</p>
        <h2>${locale.workflowTitle}</h2>
        <ol class="step-grid step-grid-five">
${steps}
        </ol>
      </section>

      <section class="why">
        <p class="section-kicker">${locale.whyKicker}</p>
        <h2>${locale.whyTitle}</h2>
        <p class="why-lede">${locale.whyLede}</p>
        <div class="why-grid">
${cards}
        </div>
      </section>

      <section class="integrations" id="integrations">
        <p class="section-kicker">${locale.integrationKicker}</p>
        <h2>${locale.integrationTitle}</h2>
        <div class="integration-grid">
          <div>
            <p>${locale.integrationBody}</p>
            <ul class="feature-list">
${featureList}
            </ul>
          </div>
          <pre><code>{
  "name": "acme:insight_card",
  "isContainer": true,
  "implementations": [{
    "id": "react",
    "framework": "react",
    "module": "@acme/analytics-ui",
    "export": "InsightCard",
    "props": {
      "title": { "from": "content.title" }
    }
  }]
}</code></pre>
        </div>
      </section>

      <section class="handoff">
        <p class="section-kicker">${locale.handoffKicker}</p>
        <h2>${locale.handoffTitle}</h2>
        <p>${locale.handoffBody}</p>
        <div class="command-card">
          <code>uses: HenryLau1103/AUB@main</code>
          <span>${locale.commandNote}</span>
        </div>
        <div class="link-row">
${links}
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <p>
        AUB · ${locale.footer} ·
        <a href="https://github.com/HenryLau1103/AUB">github.com/HenryLau1103/AUB</a> ·
        Apache-2.0
      </p>
    </footer>
  </body>
</html>
`;
}

const stale = [];
for (const [id, locale] of Object.entries(locales)) {
  const output = resolve(ROOT, 'site', locale.path, 'index.html');
  const expected = renderPage(id, locale);
  if (CHECK) {
    let current = '';
    try {
      current = await readFile(output, 'utf8');
    } catch {
      // Report missing output below.
    }
    if (current !== expected) stale.push(output.replace(`${ROOT}/`, ''));
  } else {
    await mkdir(resolve(output, '..'), { recursive: true });
    await writeFile(output, expected, 'utf8');
  }
}

if (CHECK && stale.length > 0) {
  console.error(`Localized site output is stale:\n${stale.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}

console.log(CHECK ? 'Localized site output is up to date.' : `Generated ${Object.keys(locales).length} localized site pages.`);
