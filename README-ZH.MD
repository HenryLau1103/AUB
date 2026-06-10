# AUB — UI Blueprint Agent（UI 藍圖代理工具）

一套給 AI 編碼代理使用的結構化規格格式。用拖拉的方式在畫布上組出 UI，匯出成 `.ui.json`（機器讀）、`.ui.yaml`（人編輯）、`.ui.md`（代理提示詞上下文）。程式代理讀了它，就知道要蓋什麼、放在哪裡、如何驗收。

> English version: [`README.md`](./README.md)

## 專案狀態

- **Phase 0** — 問題定義、失敗案例、成功條件 — **已完成**
- **Phase 1 / Milestone A** — Schema 可用 — **已完成**（Tier 1 八項條件全數通過）
- **Phase 2 / Milestone B** — 編輯器可用 — **已完成**（自由／自動佈局、拖曳、縮放、多選、內建與個人範本）
- **Phase 3 / Milestone C** — Agent 交付 — **本機流程已完成**（`.ui.md`、`.aub.zip`、各 viewport 截圖、雜湊，地端 Qwen 3.6 35B 精確讀取 22/22）
- **Milestone D/E 基礎能力** — **已完成**（Blueprint diff、Codex／Claude Code adapters、實作報告 schema 與驗證器）
- **Blueprint v0.3 匯入／生成** — **已實作**（Angular 元件檔案組、來源診斷、個人範本與 AI 生成工具包）

## 倉庫結構

```
.
├── schema/
│   ├── ui-blueprint.schema.json    # Draft 2020-12 schema（單一真實來源）
│   ├── types.ts                    # 手動同步的 TypeScript 型別
│   └── registry/components.json    # 62 個語意 component type，分 7 大類
├── examples/
│   ├── dashboard.ui.json           # SaaS 儀表板：24 nodes、6 interactions、11 acceptance
│   ├── dashboard.ui.yaml           # 同上，方便人編輯
│   ├── dashboard.ui.md             # 自動生成的代理上下文
│   ├── dashboard.ui.lock.json      # 凍結的驗收快照（含雜湊）
│   └── freeform-actions.ui.json    # 自由佈局與 AI 可讀性精簡範例
├── scripts/
│   ├── validate.mjs                # CLI：對 schema 驗證 .ui.json / .yaml
│   ├── validate-blueprint.lib.mjs  # 樹狀結構、參照與幾何語意驗證
│   ├── migrate-blueprint-cli.mjs   # CLI：將 v0.1／v0.2 升級為 v0.3
│   ├── import-angular-component.mjs # CLI：Angular HTML／SCSS／TS → Blueprint v0.3
│   ├── create-authoring-kit.mjs    # CLI：schema、registry 與生成提示工具包
│   ├── export-md.mjs               # CLI：從 .ui.json 產生 .ui.md
│   ├── export-md.lib.mjs           # 純函式（瀏覽器安全，編輯器會用到）
│   ├── lock-blueprint.mjs          # CLI：產生 .ui.lock.json 快照
│   ├── score-agent-readability.mjs # 22 項確定性 AI 可讀性評分
│   └── run-agent-readability.mjs   # 需明確授權的外部代理執行器
├── benchmarks/agent-readability/  # 代理提示詞與標準答案
├── apps/editor/                    # Vite + React + TypeScript 視覺編輯器
├── tests/                          # Schema、遷移、語意、範本與匯出測試
└── docs/
    ├── problem-statement.md
    ├── failure-cases.md
    ├── mvp-success-criteria.md
    └── schema-versioning.md
```

## 快速上手

```bash
# 1. 安裝依賴（根目錄 + 編輯器）
pnpm install
cd apps/editor && pnpm install && cd ../..

# 2. 驗證範例
pnpm validate examples/dashboard.ui.json

# 3. 重新產生 Markdown
node scripts/export-md.mjs examples/dashboard.ui.json examples/dashboard.ui.md

# 4. 升級舊版 Blueprint
pnpm migrate old.ui.json migrated.ui.json

# 5. 將設計凍結為 lock 快照
node scripts/lock-blueprint.mjs examples/dashboard.ui.json examples/dashboard.ui.lock.json

# 6. 跑全部測試
pnpm test

# 7. 型別檢查（根目錄 + 編輯器）
pnpm typecheck
(cd apps/editor && pnpm typecheck)

# 8. 評分代理輸出的精確度
pnpm score:agent path/to/agent-output.json

# 9. 匯入 Angular 元件檔案組
pnpm import:angular path/to/component-directory --entry app-example --output example.ui.json

# 10. 建立教 AI 產生 AUB 檔案的工具包
pnpm authoring:kit aub-authoring-kit.zip

# 11. 啟動編輯器
(cd apps/editor && pnpm dev)
# → 開啟 http://127.0.0.1:5173/
```

## 設計原則（出自 `ui-blueprint-agent-plan.md`）

1. **語意優先於視覺** — 每個節點都帶有已註冊的 `type`（`data_table`、`metric_card` ……），不是單純的矩形。
2. **Layout 是明確合約** — 自動容器使用 flex / grid；自由容器使用各 viewport 的 placement。Agent 不可自行替換模式。
3. **Blueprint 是唯一真實來源** — 編輯器狀態由 `.ui.json` 衍生。匯出 → 匯入的 round-trip 必須無損。
4. **驗收是 checklist、不是感覺** — 每個畫面至少 5 項可驗收的條目，涵蓋 layout、interaction、responsive、a11y。
5. **同一份 schema，多個 agent** — 核心格式對 agent 中立。各 agent 的差異寫在薄薄的 adapter 層（Phase 4+）。
6. **不准用「感覺不錯」放行** — Schema 驗證、layout diff、acceptance checklist 是唯一可用的審查訊號。

編輯器中的直接放置屬於明確的自由佈局操作：一般拖曳只會在目前父容器內移動；按住 Option／Alt 並拖到另一個容器，才會更新父子關係。從元件面板拖入自動排列容器時，編輯器會先保存既有子元件幾何，再將該容器切換為自由模式。

## Agent 可讀性基準

把 `benchmarks/agent-readability/prompt.md` 與 `examples/freeform-actions.ui.json` 交給代理，將代理輸出的純 JSON 存檔，再執行：

```bash
pnpm score:agent path/to/agent-output.json
```

評分器會精確比對 22 項資料，涵蓋階層、自由佈局幾何、layout mode、design token、互動與驗收條件。

外部 Codex／其他 CLI 的執行方式見 `benchmarks/agent-readability/README.md`。未帶 `--allow-external` 時，腳本會直接拒絕執行。

## Agent 實作精度基準

實作基準會要求 Agent 產生可執行的單檔 UI 與 implementation report，再透過本機 Chrome 驗證桌面／平板／手機的精確幾何、階層、auto layout、互動、focus 狀態、響應式溢出、computed style、截圖與 report 完整性。

```bash
pnpm benchmark:implementation qwen-local --allow-external -- \
  node scripts/run-ollama-prompt.mjs qwen3.6:35b http://100.64.168.99:11434
```

詳細操作見 `benchmarks/agent-implementation/README.md`。固定參考實作全數通過；地端 `qwen3.6:35b` 在補強交付契約後通過 420／420 項檢查。

## Agent 任務與版本差異

產生可直接交給 Agent 的生成、實作、規劃或審查任務：

```bash
pnpm prompt examples/dashboard.ui.json dashboard.codex.md --adapter codex --task implement
pnpm prompt examples/dashboard.ui.json author.codex.md --adapter codex --task author
node adapters/claude-code/export-prompt.mjs examples/dashboard.ui.json - --task review
```

比較兩版 Blueprint，列出異動節點與精確欄位：

```bash
pnpm diff before.ui.json after.ui.json
pnpm diff before.ui.json after.ui.json --json
```

Adapter 介面與能力範圍見 `docs/agent-adapter-interface.md`、`docs/capability-matrix.md`。

建立並驗證 Agent 回傳的機器可讀實作報告：

```bash
pnpm report:init examples/dashboard.ui.json implementation-report.json
pnpm report:verify examples/dashboard.ui.json implementation-report.json
```

## 這個設計防堵的失敗模式

完整內容見 `docs/failure-cases.md`，收錄 5 個具體案例。簡言之：「照 Figma 做出來」、「做成像 Notion 一樣響應式」、「加個 settings 頁」、「sidebar 弄乾淨一點」、「做一個像 Stripe 的 dashboard」這些需求，純文字描述都會失敗。Blueprint 格式強制每個維度都要明確決定。

## Schema 版本管理

見 `docs/schema-versioning.md`。採用 SemVer 2.0.0。`$id` 帶著版本號。舊 major 版本不可變更，存放在 `schema/archive/`。

## 貢獻流程

送 PR 之前：

1. `pnpm test` — 全部測試通過
2. `pnpm typecheck` 與 `(cd apps/editor && pnpm typecheck)` — 兩邊皆零錯誤
3. `(cd apps/editor && pnpm build)` — 生產建置成功
4. 若有修改 schema，跑 `pnpm validate examples/dashboard.ui.json` 確認範例仍通過
5. Commit 採 `chore:` / `feat:` / `fix:` / `docs:` / `test:` 風格，訊息主體使用繁體中文
