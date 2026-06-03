# AUB — UI Blueprint Agent（UI 藍圖代理工具）

一套給 AI 編碼代理使用的結構化規格格式。用拖拉的方式在畫布上組出 UI，匯出成 `.ui.json`（機器讀）、`.ui.yaml`（人編輯）、`.ui.md`（代理提示詞上下文）。程式代理讀了它，就知道要蓋什麼、放在哪裡、如何驗收。

> English version: [`README.md`](./README.md)

## 專案狀態

- **Phase 0** — 問題定義、失敗案例、成功條件 — **已完成**
- **Phase 1 / Milestone A** — Schema 可用 — **已完成**（Tier 1 八項條件全數通過）
- **Phase 2 / Milestone B** — 編輯器可用 — **已完成**（原型，點選新增；拖拉功能列於 v1.1）
- **Phase 3+** — Markdown / agent-context exporter、Codex 適配器、前端橋接、驗收 CLI — 排程中

## 倉庫結構

```
.
├── schema/
│   ├── ui-blueprint.schema.json    # Draft 2020-12 schema（單一真實來源）
│   ├── types.ts                    # 手動同步的 TypeScript 型別
│   └── registry/components.json    # 45 個語意 component type，分 6 大類
├── examples/
│   ├── dashboard.ui.json           # SaaS 儀表板：24 nodes、6 interactions、11 acceptance
│   ├── dashboard.ui.yaml           # 同上，方便人編輯
│   ├── dashboard.ui.md             # 自動生成的代理上下文
│   └── dashboard.ui.lock.json      # 凍結的驗收快照（含雜湊）
├── scripts/
│   ├── validate.mjs                # CLI：對 schema 驗證 .ui.json / .yaml
│   ├── export-md.mjs               # CLI：從 .ui.json 產生 .ui.md
│   ├── export-md.lib.mjs           # 純函式（瀏覽器安全，編輯器會用到）
│   └── lock-blueprint.mjs          # CLI：產生 .ui.lock.json 快照
├── apps/editor/                    # Vite + React + TypeScript 視覺編輯器
├── tests/                          # 45 個 node:test case，分散在 4 個檔案
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

# 4. 將設計凍結為 lock 快照
node scripts/lock-blueprint.mjs examples/dashboard.ui.json examples/dashboard.ui.lock.json

# 5. 跑全部測試
node --test tests/*.test.mjs

# 6. 型別檢查（根目錄 + 編輯器）
pnpm typecheck
(cd apps/editor && pnpm typecheck)

# 7. 啟動編輯器
(cd apps/editor && pnpm dev)
# → 開啟 http://127.0.0.1:5173/
```

## 設計原則（出自 `ui-blueprint-agent-plan.md`）

1. **語意優先於視覺** — 每個節點都帶有已註冊的 `type`（`data_table`、`metric_card` ……），不是單純的矩形。
2. **Layout 是合約、不是像素** — 只用 flex / grid。Schema 明確禁止絕對座標。
3. **Blueprint 是唯一真實來源** — 編輯器狀態由 `.ui.json` 衍生。匯出 → 匯入的 round-trip 必須無損。
4. **驗收是 checklist、不是感覺** — 每個畫面至少 5 項可驗收的條目，涵蓋 layout、interaction、responsive、a11y。
5. **同一份 schema，多個 agent** — 核心格式對 agent 中立。各 agent 的差異寫在薄薄的 adapter 層（Phase 4+）。
6. **不准用「感覺不錯」放行** — Schema 驗證、layout diff、acceptance checklist 是唯一可用的審查訊號。

## 這個設計防堵的失敗模式

完整內容見 `docs/failure-cases.md`，收錄 5 個具體案例。簡言之：「照 Figma 做出來」、「做成像 Notion 一樣響應式」、「加個 settings 頁」、「sidebar 弄乾淨一點」、「做一個像 Stripe 的 dashboard」這些需求，純文字描述都會失敗。Blueprint 格式強制每個維度都要明確決定。

## Schema 版本管理

見 `docs/schema-versioning.md`。採用 SemVer 2.0.0。`$id` 帶著版本號。舊 major 版本不可變更，存放在 `schema/archive/`。

## 貢獻流程

送 PR 之前：

1. `node --test tests/*.test.mjs` — 全部 45 個測試通過
2. `pnpm typecheck` 與 `(cd apps/editor && pnpm typecheck)` — 兩邊皆零錯誤
3. `(cd apps/editor && pnpm build)` — 生產建置成功
4. 若有修改 schema，跑 `pnpm validate examples/dashboard.ui.json` 確認範例仍通過
5. Commit 採 `chore:` / `feat:` / `fix:` / `docs:` / `test:` 風格，訊息主體使用繁體中文
