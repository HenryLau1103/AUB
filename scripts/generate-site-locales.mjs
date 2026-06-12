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
    title: 'AUB — Safe Existing UI Changes for Coding Agents',
    description:
      'Let coding agents safely modify existing product UI without rebuilding your components from scratch.',
    ogDescription:
      'Scan an existing route, edit an AUB contract, reuse production components, and gate the pull request on evidence.',
    navEditor: 'Editor',
    navWorkflow: 'Workflow',
    navIntegrations: 'Integrations',
    navGitHub: 'GitHub',
    languageNav: 'Language',
    eyebrow: 'Existing product UI changes',
    headline: ['Let agents change UI.', 'Keep real components.', 'Verify the PR.'],
    lede:
      'AUB is the local-first workbench for coding agents working on real apps. Scan an existing route, turn it into an editable Blueprint, review custom component candidates, then hand Codex, Claude Code, Copilot, or another agent a contract it can implement and prove.',
    openEditor: 'Use with an existing app',
    viewGitHub: 'Open demo mode',
    note: 'Apache-2.0 · local-first · agent-neutral · demo mode keeps MCP setup separate',
    editorAria: 'Open the AUB editor',
    editorAlt: 'AUB visual editor composing a responsive screen',
    capabilitiesAria: 'Product capabilities',
    proof: [
      ['62', 'semantic component types'],
      ['18', 'responsive starting templates'],
      ['23', 'MCP tools for agents'],
      ['4', 'acceptance categories'],
    ],
    workflowKicker: 'Golden path',
    workflowTitle: 'Five minutes from existing route to agent-ready PR',
    steps: [
      ['Start in your app', 'Run npx aub-workspace from the existing project root. No AUB clone is required.'],
      ['Scan and template', 'Detect routes, components, layout hints, and custom component candidates.'],
      ['Review the contract', 'Open the candidate template, approve mappings, and adjust the Blueprint.'],
      ['Hand off to an agent', 'Copy one instruction with the active Blueprint, route, preview URL, and MCP tools.'],
      ['Gate the PR', 'The AUB GitHub Action rejects drift, missing mappings, failed criteria, and unresolved work.'],
    ],
    whyKicker: 'Designed for implementation',
    whyTitle: 'Not another app builder. A control layer for real codebases.',
    whyLede:
      'AI app builders optimize speed. AUB protects existing product UI when agents edit a real repository with real components, existing routes, and reviewable acceptance evidence.',
    whyCards: [
      ['Versioned source of truth', 'JSON Schema, semantic validation, migration, diff, and lock snapshots.'],
      ['Production reuse', 'Map semantic types to existing framework components instead of recreating them.'],
      ['Agent-neutral execution', 'Codex, Claude Code, Copilot, and generic agents receive the same contract.'],
      ['Evidence, not confidence', 'Implementation reports and PR checks make incomplete work visible.'],
    ],
    beforeAfterKicker: 'Before and after',
    beforeAfterTitle: 'The difference shows up in pull request review',
    beforeAfterCards: [
      ['Without AUB', 'A vague issue asks an agent to improve a page. The PR may look plausible, but reviewers still have to guess whether the agent reused real components, preserved responsive behavior, or broke interactions.'],
      ['With AUB', 'The issue references a Blueprint, approved component mappings, preview URL, acceptance ids, evidence, and a PR Safety Score comment with an evidence matrix. Review shifts from taste to verifiable risk.'],
    ],
    comparisonKicker: 'Competitive focus',
    comparisonTitle: 'AUB should not compete as another app builder',
    comparisonCards: [
      ['App builders are faster at new apps', 'v0, Lovable, and Bolt are better for blank-canvas generation. AUB wins only when an existing repository must preserve real routes and components.'],
      ['Coding agents still need contracts', 'Codex, Copilot, and Claude Code can edit code, but prose alone does not prove reuse, responsive safety, or acceptance coverage.'],
      ['Design tools do not close the PR loop', 'Figma is excellent for design collaboration. AUB is the source-controlled bridge from UI intent to implementation evidence.'],
    ],
    integrationKicker: 'Integration contract',
    integrationTitle: 'Do not let agents invent your design system',
    integrationBody:
      'Custom registry entries can identify a production package, exported symbol, source file, Storybook story, documentation, and the exact Blueprint-to-prop mapping.',
    integrationList: [
      'Prevent bespoke lookalike components',
      'Keep repository-native tokens and behavior',
      'Support multiple framework implementations',
    ],
    handoffKicker: 'Connect and verify',
    handoffTitle: 'GitHub issues become agent-ready UI work orders',
    handoffBody:
      'Use AUB issue templates to define the route, Blueprint, component reuse rules, preview URL, and acceptance criteria. Copilot, Codex, or another agent can implement against the same contract and return evidence in the PR Safety Score comment.',
    commandNote: 'Validates contracts and implementation evidence',
    links: ['Workspace loop guide', 'AUB vs app builders', 'GitHub agent workflow', 'MCP server', 'Production mappings', 'GitHub CI gate', 'Blueprint schema'],
    footer: 'safe existing UI changes for coding agents',
  },
  'zh-hant': {
    path: 'zh-hant',
    label: '繁體中文',
    shortLabel: '繁中',
    htmlLang: 'zh-Hant',
    ogLocale: 'zh_TW',
    title: 'AUB — 讓編碼 Agent 安全修改既有 UI',
    description: '讓編碼 Agent 安全修改既有產品畫面，不重做正式元件，並用驗收證據把關 Pull Request。',
    ogDescription: '掃描既有 route、編輯 AUB 合約、重用正式元件，並以證據驗收 PR。',
    navEditor: '編輯器',
    navWorkflow: '流程',
    navIntegrations: '整合',
    navGitHub: 'GitHub',
    languageNav: '語言',
    eyebrow: '既有產品 UI 修改',
    headline: ['讓 Agent 改 UI。', '保留正式元件。', '用證據驗收 PR。'],
    lede:
      'AUB 是給 coding agent 修改真實 app 的 local-first 工作台。掃描既有 route、轉成可編輯 Blueprint、審核自訂元件候選，再把可實作且可驗證的合約交給 Codex、Claude Code、Copilot 或其他 Agent。',
    openEditor: '用在既有專案',
    viewGitHub: '開啟 demo mode',
    note: 'Apache-2.0 · local-first · agent-neutral · demo mode 會把 MCP 設定分開',
    editorAria: '開啟 AUB 編輯器',
    editorAlt: 'AUB 視覺編輯器正在組合響應式畫面',
    capabilitiesAria: '產品能力',
    proof: [
      ['62', '種語意元件類型'],
      ['18', '個響應式起始範本'],
      ['23', '個 Agent MCP 工具'],
      ['4', '類驗收條件'],
    ],
    workflowKicker: '黃金流程',
    workflowTitle: '五分鐘從既有 route 到可交給 Agent 的 PR 工作',
    steps: [
      ['從你的 app 啟動', '在既有專案根目錄執行 npx aub-workspace，不需要 clone AUB。'],
      ['掃描並產範本', '偵測 routes、components、layout 線索與自訂元件候選。'],
      ['審核合約', '打開 candidate template，確認 mapping，調整 Blueprint。'],
      ['交給 Agent', '複製包含 active Blueprint、route、preview URL 與 MCP tools 的指令。'],
      ['把關 PR', 'AUB GitHub Action 會拒絕漂移、遺漏 mapping、驗收失敗與未解決事項。'],
    ],
    whyKicker: '為實作而設計',
    whyTitle: '不是另一套 app builder，而是真實 codebase 的控制層',
    whyLede: 'AI app builder 最佳化速度；AUB 保護既有產品 UI，讓 Agent 在真實 repo、正式元件、既有 route 與可審查驗收證據之間工作。',
    whyCards: [
      ['可版本化的唯一真實來源', 'JSON Schema、語意驗證、migration、diff 與 lock snapshot。'],
      ['重用正式元件', '將語意類型對應到既有 framework 元件，而不是重新製作相似品。'],
      ['Agent-neutral 執行', 'Codex、Claude Code、Copilot 與通用 Agent 取得相同合約。'],
      ['需要證據，不靠信心', 'Implementation report 與 PR check 會讓未完成工作清楚可見。'],
    ],
    beforeAfterKicker: 'Before / After',
    beforeAfterTitle: '差異會直接出現在 PR review',
    beforeAfterCards: [
      ['沒有 AUB', 'Issue 只叫 Agent 改善某個頁面。PR 也許看起來合理，但 reviewer 仍要猜它有沒有重用正式元件、有沒有保留響應式行為、有沒有破壞互動。'],
      ['有 AUB', 'Issue 會引用 Blueprint、已核准 component mapping、preview URL、acceptance id、evidence，以及含 evidence matrix 的 PR Safety Score comment。Review 從主觀喜好變成可驗證風險。'],
    ],
    comparisonKicker: '競品定位',
    comparisonTitle: 'AUB 不應該去當另一套 app builder',
    comparisonCards: [
      ['App builder 更適合新專案', 'v0、Lovable、Bolt 更適合空白生成。AUB 只有在既有 repo 需要保留正式 route 與元件時才有優勢。'],
      ['Coding agent 仍需要合約', 'Codex、Copilot、Claude Code 能改程式，但純文字無法證明元件重用、響應式安全與驗收覆蓋。'],
      ['設計工具不會關閉 PR loop', 'Figma 很適合設計協作。AUB 的位置是把 UI 意圖帶到 source control 與實作證據。'],
    ],
    integrationKicker: '整合合約',
    integrationTitle: '不要讓 Agent 發明你的 design system',
    integrationBody: '自訂 registry 可指定正式 package、export symbol、source file、Storybook、文件，以及精確的 Blueprint-to-prop mapping。',
    integrationList: ['避免建立相似但不同的元件', '保留 repository 原生 token 與行為', '支援多種 framework 實作'],
    handoffKicker: '連接並驗證',
    handoffTitle: 'GitHub issue 變成可交給 Agent 的 UI 工單',
    handoffBody:
      '使用 AUB issue template 定義 route、Blueprint、元件重用規則、preview URL 與 acceptance criteria。Copilot、Codex 或其他 Agent 依同一份合約實作，並把 evidence 回寫到 PR Safety Score comment。',
    commandNote: '驗證合約與實作證據',
    links: ['Workspace loop 指南', 'AUB vs app builders', 'GitHub agent workflow', 'MCP server', '正式元件對應', 'GitHub CI 閘門', 'Blueprint schema'],
    footer: '讓編碼 Agent 安全修改既有 UI',
  },
  'zh-hans': {
    path: 'zh-hans',
    label: '简体中文',
    shortLabel: '简中',
    htmlLang: 'zh-Hans',
    ogLocale: 'zh_CN',
    title: 'AUB — 让编码 Agent 安全修改既有 UI',
    description: '让编码 Agent 安全修改既有产品界面，不重做生产组件，并用验收证据管控 Pull Request。',
    ogDescription: '扫描既有 route、编辑 AUB 契约、复用生产组件，并用证据验收 PR。',
    navEditor: '编辑器',
    navWorkflow: '流程',
    navIntegrations: '集成',
    navGitHub: 'GitHub',
    languageNav: '语言',
    eyebrow: '既有产品 UI 修改',
    headline: ['让 Agent 改 UI。', '保留生产组件。', '用证据验收 PR。'],
    lede:
      'AUB 是给 coding agent 修改真实 app 的 local-first 工作台。扫描既有 route、转换成可编辑 Blueprint、审核自定义组件候选，再把可实现且可验证的契约交给 Codex、Claude Code、Copilot 或其他 Agent。',
    openEditor: '用于既有项目',
    viewGitHub: '打开 demo mode',
    note: 'Apache-2.0 · local-first · agent-neutral · demo mode 会把 MCP 设置分开',
    editorAria: '打开 AUB 编辑器',
    editorAlt: 'AUB 可视化编辑器正在编排响应式页面',
    capabilitiesAria: '产品能力',
    proof: [
      ['62', '种语义组件类型'],
      ['18', '个响应式起始模板'],
      ['23', '个 Agent MCP 工具'],
      ['4', '类验收条件'],
    ],
    workflowKicker: '黄金路径',
    workflowTitle: '五分钟从既有 route 到可交给 Agent 的 PR 工作',
    steps: [
      ['从你的 app 启动', '在既有项目根目录执行 npx aub-workspace，不需要 clone AUB。'],
      ['扫描并生成模板', '检测 routes、components、layout 线索与自定义组件候选。'],
      ['审核契约', '打开 candidate template，确认 mapping，调整 Blueprint。'],
      ['交给 Agent', '复制包含 active Blueprint、route、preview URL 与 MCP tools 的指令。'],
      ['管控 PR', 'AUB GitHub Action 会拒绝漂移、缺失 mapping、验收失败和未解决事项。'],
    ],
    whyKicker: '为实现而设计',
    whyTitle: '不是另一套 app builder，而是真实 codebase 的控制层',
    whyLede: 'AI app builder 优化速度；AUB 保护既有产品 UI，让 Agent 在真实 repo、生产组件、既有 route 与可评审验收证据之间工作。',
    whyCards: [
      ['可版本化的唯一事实来源', 'JSON Schema、语义验证、migration、diff 与 lock snapshot。'],
      ['复用生产组件', '把语义类型映射到现有 framework 组件，而不是重新创建相似组件。'],
      ['Agent-neutral 执行', 'Codex、Claude Code、Copilot 与通用 Agent 获得相同契约。'],
      ['需要证据，而非信心', 'Implementation report 与 PR check 会让未完成工作清晰可见。'],
    ],
    beforeAfterKicker: 'Before / After',
    beforeAfterTitle: '差异会直接出现在 PR review',
    beforeAfterCards: [
      ['没有 AUB', 'Issue 只让 Agent 改善某个页面。PR 也许看起来合理，但 reviewer 仍要猜它有没有复用生产组件、保留响应式行为、或破坏交互。'],
      ['有 AUB', 'Issue 会引用 Blueprint、已批准 component mapping、preview URL、acceptance id、evidence，以及包含 evidence matrix 的 PR Safety Score comment。Review 从主观喜好变成可验证风险。'],
    ],
    comparisonKicker: '竞品定位',
    comparisonTitle: 'AUB 不应该去做另一套 app builder',
    comparisonCards: [
      ['App builder 更适合新项目', 'v0、Lovable、Bolt 更适合空白生成。AUB 只有在既有 repo 需要保留真实 route 与组件时才有优势。'],
      ['Coding agent 仍需要契约', 'Codex、Copilot、Claude Code 能改代码，但纯文字无法证明组件复用、响应式安全和验收覆盖。'],
      ['设计工具不会关闭 PR loop', 'Figma 很适合设计协作。AUB 的位置是把 UI 意图带到 source control 和实现证据。'],
    ],
    integrationKicker: '集成契约',
    integrationTitle: '不要让 Agent 发明你的 design system',
    integrationBody: '自定义 registry 可以指定生产 package、export symbol、source file、Storybook、文档，以及精确的 Blueprint-to-prop mapping。',
    integrationList: ['避免创建相似但不一致的组件', '保留 repository 原生 token 与行为', '支持多种 framework 实现'],
    handoffKicker: '连接并验证',
    handoffTitle: 'GitHub issue 变成可交给 Agent 的 UI 工单',
    handoffBody:
      '使用 AUB issue template 定义 route、Blueprint、组件复用规则、preview URL 与 acceptance criteria。Copilot、Codex 或其他 Agent 根据同一份契约实现，并把 evidence 写回 PR Safety Score comment。',
    commandNote: '验证契约与实现证据',
    links: ['Workspace loop 指南', 'AUB vs app builders', 'GitHub agent workflow', 'MCP server', '生产组件映射', 'GitHub CI 门禁', 'Blueprint schema'],
    footer: '让编码 Agent 安全修改既有 UI',
  },
  ja: {
    path: 'ja',
    label: '日本語',
    shortLabel: '日本語',
    htmlLang: 'ja',
    ogLocale: 'ja_JP',
    title: 'AUB — コーディング Agent に既存 UI を安全に変更させる',
    description: 'コーディング Agent が既存プロダクト UI を安全に変更し、本番コンポーネントを作り直さず、証拠で Pull Request を検証できるようにします。',
    ogDescription: '既存 route をスキャンし、AUB 契約を編集し、本番コンポーネントを再利用し、証拠で PR を検証します。',
    navEditor: 'エディター',
    navWorkflow: 'ワークフロー',
    navIntegrations: '連携',
    navGitHub: 'GitHub',
    languageNav: '言語',
    eyebrow: '既存プロダクト UI の変更',
    headline: ['Agent に UI を変更させる。', '本番コンポーネントを守る。', '証拠で PR を検証する。'],
    lede:
      'AUB は、コーディング Agent が実際の app を変更するための local-first ワークベンチです。既存 route をスキャンし、編集可能な Blueprint に変換し、カスタムコンポーネント候補を確認して、実装可能で検証可能な契約を Codex、Claude Code、Copilot などに渡します。',
    openEditor: '既存プロジェクトで使う',
    viewGitHub: 'demo mode を開く',
    note: 'Apache-2.0 · local-first · agent-neutral · demo mode は MCP 設定を分離します',
    editorAria: 'AUB エディターを開く',
    editorAlt: 'レスポンシブ画面を構成する AUB ビジュアルエディター',
    capabilitiesAria: '製品機能',
    proof: [
      ['62', '種類のセマンティックコンポーネント'],
      ['18', '種類のレスポンシブテンプレート'],
      ['23', '個の Agent 向け MCP ツール'],
      ['4', '種類の受け入れカテゴリ'],
    ],
    workflowKicker: 'ゴールデンパス',
    workflowTitle: '既存 route から Agent-ready PR まで 5 分で進める',
    steps: [
      ['自分の app から開始', '既存プロジェクトの root で npx aub-workspace を実行します。AUB の clone は不要です。'],
      ['スキャンしてテンプレート化', 'routes、components、layout の手がかり、カスタムコンポーネント候補を検出します。'],
      ['契約をレビュー', 'candidate template を開き、mapping を確認し、Blueprint を調整します。'],
      ['Agent に渡す', 'active Blueprint、route、preview URL、MCP tools を含む指示をコピーします。'],
      ['PR をゲートする', 'AUB GitHub Action が差異、mapping 漏れ、受け入れ失敗、未解決項目を拒否します。'],
    ],
    whyKicker: '実装のための設計',
    whyTitle: '別の app builder ではなく、実コードベースの制御レイヤーです',
    whyLede: 'AI app builder は速度を最適化します。AUB は既存プロダクト UI を守り、Agent が実 repo、本番コンポーネント、既存 route、レビュー可能な受け入れ証拠の中で作業できるようにします。',
    whyCards: [
      ['バージョン管理できる信頼できる情報源', 'JSON Schema、セマンティック検証、migration、diff、lock snapshot。'],
      ['本番資産の再利用', 'セマンティック型を既存 framework コンポーネントへ紐付けます。'],
      ['Agent-neutral な実行', 'Codex、Claude Code、Copilot、汎用 Agent が同じ契約を受け取ります。'],
      ['信頼ではなく証拠', 'Implementation report と PR check が未完了作業を可視化します。'],
    ],
    beforeAfterKicker: 'Before / After',
    beforeAfterTitle: '違いは PR review に現れます',
    beforeAfterCards: [
      ['AUB なし', 'Issue が Agent にページ改善を曖昧に依頼します。PR はもっともらしく見えても、本番コンポーネント再利用、レスポンシブ挙動、既存インタラクションを reviewer が確認し直す必要があります。'],
      ['AUB あり', 'Issue は Blueprint、承認済み component mapping、preview URL、acceptance id、evidence、evidence matrix 付き PR Safety Score comment を参照します。Review は好みではなく検証可能なリスクになります。'],
    ],
    comparisonKicker: '競合上の焦点',
    comparisonTitle: 'AUB は別の app builder として戦うべきではありません',
    comparisonCards: [
      ['App builder は新規作成が速い', 'v0、Lovable、Bolt は blank canvas 生成に強いです。AUB が勝てるのは既存 repo の route と component を守る場面です。'],
      ['Coding agent には契約が必要', 'Codex、Copilot、Claude Code はコードを編集できますが、prose だけでは再利用、responsive safety、acceptance coverage を証明できません。'],
      ['Design tool は PR loop を閉じない', 'Figma は設計協業に優れています。AUB は UI intent を source control と実装証拠へつなぐ役割です。'],
    ],
    integrationKicker: '連携契約',
    integrationTitle: 'Agent に design system を発明させない',
    integrationBody: 'カスタム registry で、本番 package、export symbol、source file、Storybook、ドキュメント、正確な Blueprint-to-prop mapping を指定できます。',
    integrationList: ['似ているだけの独自コンポーネントを防ぐ', 'repository 固有の token と動作を維持する', '複数 framework の実装を支援する'],
    handoffKicker: '接続して検証',
    handoffTitle: 'GitHub issue を Agent-ready な UI 作業票にする',
    handoffBody:
      'AUB issue template で route、Blueprint、コンポーネント再利用ルール、preview URL、acceptance criteria を定義します。Copilot、Codex、その他の Agent は同じ契約に沿って実装し、evidence を PR Safety Score comment に返します。',
    commandNote: '契約と実装証拠を検証',
    links: ['Workspace loop ガイド', 'AUB vs app builders', 'GitHub agent workflow', 'MCP server', '本番 mapping', 'GitHub CI ゲート', 'Blueprint schema'],
    footer: 'コーディング Agent に既存 UI を安全に変更させる',
  },
  ko: {
    path: 'ko',
    label: '한국어',
    shortLabel: '한국어',
    htmlLang: 'ko',
    ogLocale: 'ko_KR',
    title: 'AUB — 코딩 Agent가 기존 UI를 안전하게 바꾸도록 돕기',
    description: '코딩 Agent가 기존 제품 UI를 안전하게 수정하고, 프로덕션 컴포넌트를 다시 만들지 않으며, 인수 증거로 Pull Request를 검증하게 합니다.',
    ogDescription: '기존 route를 스캔하고, AUB 계약을 편집하고, 프로덕션 컴포넌트를 재사용하며, 증거로 PR을 검증합니다.',
    navEditor: '에디터',
    navWorkflow: '워크플로',
    navIntegrations: '통합',
    navGitHub: 'GitHub',
    languageNav: '언어',
    eyebrow: '기존 제품 UI 변경',
    headline: ['Agent가 UI를 바꿉니다.', '프로덕션 컴포넌트를 지킵니다.', '증거로 PR을 검증합니다.'],
    lede:
      'AUB는 코딩 Agent가 실제 app을 수정할 때 쓰는 local-first 워크벤치입니다. 기존 route를 스캔해 편집 가능한 Blueprint로 만들고, 사용자 정의 컴포넌트 후보를 검토한 뒤, 구현 가능하고 검증 가능한 계약을 Codex, Claude Code, Copilot 또는 다른 Agent에 전달합니다.',
    openEditor: '기존 프로젝트에서 사용',
    viewGitHub: 'demo mode 열기',
    note: 'Apache-2.0 · local-first · agent-neutral · demo mode 는 MCP 설정을 분리합니다',
    editorAria: 'AUB 에디터 열기',
    editorAlt: '반응형 화면을 구성하는 AUB 비주얼 에디터',
    capabilitiesAria: '제품 기능',
    proof: [
      ['62', '가지 시맨틱 컴포넌트 유형'],
      ['18', '가지 반응형 시작 템플릿'],
      ['23', '개의 Agent용 MCP 도구'],
      ['4', '가지 인수 카테고리'],
    ],
    workflowKicker: '골든 패스',
    workflowTitle: '기존 route에서 Agent-ready PR까지 5분',
    steps: [
      ['내 app에서 시작', '기존 프로젝트 root에서 npx aub-workspace를 실행합니다. AUB clone은 필요 없습니다.'],
      ['스캔하고 템플릿 생성', 'routes, components, layout 단서와 사용자 정의 컴포넌트 후보를 감지합니다.'],
      ['계약 검토', 'candidate template을 열고 mapping을 확인한 뒤 Blueprint를 조정합니다.'],
      ['Agent에게 전달', 'active Blueprint, route, preview URL, MCP tools가 포함된 지시를 복사합니다.'],
      ['PR 게이트', 'AUB GitHub Action이 드리프트, 누락된 mapping, 인수 실패와 미해결 작업을 거부합니다.'],
    ],
    whyKicker: '구현을 위한 설계',
    whyTitle: '또 하나의 app builder가 아니라 실제 codebase의 제어 계층입니다',
    whyLede: 'AI app builder는 속도를 최적화합니다. AUB는 기존 제품 UI를 보호하고, Agent가 실제 repo, 프로덕션 컴포넌트, 기존 route, 검토 가능한 인수 증거 안에서 작업하게 합니다.',
    whyCards: [
      ['버전 관리 가능한 단일 기준', 'JSON Schema, 시맨틱 검증, migration, diff, lock snapshot.'],
      ['프로덕션 자산 재사용', '시맨틱 유형을 기존 framework 컴포넌트에 연결해 재구현을 방지합니다.'],
      ['Agent-neutral 실행', 'Codex, Claude Code, Copilot과 범용 Agent가 동일한 계약을 받습니다.'],
      ['신뢰가 아닌 증거', 'Implementation report와 PR check가 미완료 작업을 드러냅니다.'],
    ],
    beforeAfterKicker: 'Before / After',
    beforeAfterTitle: '차이는 PR review에서 드러납니다',
    beforeAfterCards: [
      ['AUB 없음', 'Issue가 Agent에게 페이지 개선을 모호하게 요청합니다. PR이 그럴듯해 보여도 reviewer는 프로덕션 컴포넌트 재사용, 반응형 동작, 기존 인터랙션 보존을 다시 확인해야 합니다.'],
      ['AUB 있음', 'Issue는 Blueprint, 승인된 component mapping, preview URL, acceptance id, evidence, evidence matrix가 있는 PR Safety Score comment를 참조합니다. Review는 취향이 아니라 검증 가능한 위험 평가가 됩니다.'],
    ],
    comparisonKicker: '경쟁 포지션',
    comparisonTitle: 'AUB는 또 하나의 app builder로 경쟁하면 안 됩니다',
    comparisonCards: [
      ['App builder는 새 앱 생성이 빠릅니다', 'v0, Lovable, Bolt는 빈 화면 생성에 강합니다. AUB는 기존 repo의 route와 component를 보존해야 할 때만 이깁니다.'],
      ['Coding agent에는 계약이 필요합니다', 'Codex, Copilot, Claude Code는 코드를 편집할 수 있지만 prose만으로는 재사용, responsive safety, acceptance coverage를 증명할 수 없습니다.'],
      ['Design tool은 PR loop를 닫지 않습니다', 'Figma는 디자인 협업에 뛰어납니다. AUB는 UI intent를 source control과 구현 증거로 연결합니다.'],
    ],
    integrationKicker: '통합 계약',
    integrationTitle: 'Agent가 design system을 발명하지 못하게 합니다',
    integrationBody: '사용자 정의 registry에 프로덕션 package, export symbol, source file, Storybook, 문서와 정확한 Blueprint-to-prop mapping을 지정할 수 있습니다.',
    integrationList: ['비슷하게만 생긴 별도 컴포넌트 방지', 'repository 고유 token과 동작 유지', '여러 framework 구현 지원'],
    handoffKicker: '연결 및 검증',
    handoffTitle: 'GitHub issue를 Agent-ready UI 작업표로 만듭니다',
    handoffBody:
      'AUB issue template으로 route, Blueprint, 컴포넌트 재사용 규칙, preview URL, acceptance criteria를 정의합니다. Copilot, Codex 또는 다른 Agent가 같은 계약에 맞춰 구현하고 evidence를 PR Safety Score comment로 반환할 수 있습니다.',
    commandNote: '계약과 구현 증거 검증',
    links: ['Workspace loop 가이드', 'AUB vs app builders', 'GitHub agent workflow', 'MCP server', '프로덕션 mapping', 'GitHub CI 게이트', 'Blueprint schema'],
    footer: '코딩 Agent가 기존 UI를 안전하게 바꾸도록 돕기',
  },
};

const linkTargets = [
  'docs/workspace-loop-user-manual.md',
  'docs/comparison-app-builders.md',
  'docs/github-agent-workflow.md',
  'apps/mcp-server/README.md',
  'docs/custom-components.md',
  'docs/github-ci.md',
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
  const beforeAfterCards = locale.beforeAfterCards
    .map(
      ([title, body]) => `          <div class="card">
            <h3>${title}</h3>
            <p>${body}</p>
          </div>`
    )
    .join('\n');
  const comparisonCards = locale.comparisonCards
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
            <a class="btn btn-primary" href="https://github.com/HenryLau1103/AUB#fastest-path-for-an-existing-project">${locale.openEditor}</a>
            <a class="btn btn-ghost" href="${base}editor/">${locale.viewGitHub}</a>
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

      <section class="before-after">
        <p class="section-kicker">${locale.beforeAfterKicker}</p>
        <h2>${locale.beforeAfterTitle}</h2>
        <div class="why-grid">
${beforeAfterCards}
        </div>
      </section>

      <section class="why">
        <p class="section-kicker">${locale.comparisonKicker}</p>
        <h2>${locale.comparisonTitle}</h2>
        <div class="why-grid">
${comparisonCards}
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
