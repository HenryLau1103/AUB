# AUB Workspace Loop 操作步驟手冊

語言： [English](./workspace-loop-user-manual.md) · **繁體中文** · [简体中文](./workspace-loop-user-manual.zh-Hans.md) · [日本語](./workspace-loop-user-manual.ja.md) · [한국어](./workspace-loop-user-manual.ko.md)

這份手冊說明如何把 AUB 用在「既有專案」上：

- 讓 Agent 掃描既有專案頁面與元件。
- 讓 AUB Editor 產生可調整的畫面範本。
- 讓使用者在 UI 裡調整畫面。
- 讓 Agent 讀取同一份 AUB 檔案後，實作回真實專案。
- 在 AUB 裡預覽真實 app route。

一句話理解：

> AUB 是你和 Agent 共用的 UI 工作桌。你在 AUB Editor 調整畫面，Agent 透過 MCP 讀同一份檔案，再去修改你的真實專案。

---

## 1. 你需要準備什麼

一般使用者只需要一個既有產品專案資料夾：

```text
/your-path/your-app     # 你既有的產品專案
```

你的電腦需要 Node.js 24 或更新版本，因為 `npx aub-workspace` 會在本機啟動 AUB Editor 和 MCP server。

你不需要先 clone AUB repo。AUB repo 只在你要開發 AUB 本身、除錯或修改原始碼時才需要。

---

## 2. 一鍵啟動 AUB Workspace

在你的既有專案根目錄執行：

```bash
cd /your-path/your-app
npx aub-workspace
```

看到類似這段代表成功：

```text
AUB Workspace is running
Workspace: /your-path/your-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

瀏覽器會自動打開 AUB Editor，並且已經連到你的 workspace。

---

## 3. AUB 會在你的專案裡建立哪些檔案

`aub-workspace` 會讓 AUB Editor 和 Agent 可以讀寫你的既有專案內的 AUB 檔案，例如：

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
aub.registry.json
screens/*.ui.json
```

AUB 不會自動修改你的真實 app 程式碼。真正修改 app 的仍然是 Agent。

---

## 4. 在 Editor 裡照 onboarding checklist 操作

Editor 連線成功後，你會看到 **第一次使用流程**。

照順序完成：

1. 掃描專案
2. 選擇 route 產生範本
3. 審核自訂元件候選
4. 調整 UI Blueprint
5. 存回 workspace
6. 複製 Agent 指令

---

## 5. 請 Agent 掃描既有專案

你可以直接在 AUB Editor 按：

```text
掃描專案
```

Editor 會透過 MCP tool 執行：

```text
scan_project_ui
```

它會做幾件事：

1. 掃描 React/Next、Vue/Nuxt、Angular 專案結構。
2. 找出 route/page/component/layout/design token/storybook 等線索。
3. 找出專案自訂元件。
4. 產生候選檔：

```text
.aub/component-candidates.json
```

重要規則：

> 掃描到的自訂元件不會直接寫入正式 registry。它們會先進 candidate list，等你在 UI 裡確認。

---

## 6. 請 Agent 從既有頁面產生 AUB 範本

掃描完成後，Editor 會列出偵測到的 routes。

你可以選一個 route，按：

```text
產生範本
```

Editor 會透過 MCP tool 執行：

```text
generate_template_from_source
```

如果你想讓 Agent 協助，也可以對 Agent 說：

```text
請針對 app/settings/page.tsx 產生 AUB candidate template。自訂元件請放入 component candidates，不要自動 approve。
```

產生的範本會放在：

```text
.aub/templates/<slug>.aub.template.json
```

這些範本一開始會是：

```json
{
  "status": "candidate"
}
```

代表它是候選範本，需要你審核。

---

## 7. 在 AUB Editor 打開 Workspace Templates

回到 AUB Editor。

在範本區找到：

```text
Workspace templates
```

你會看到 Agent 產生的候選範本，例如：

```text
Settings
Dashboard
Customer Search
```

點選範本後，AUB Editor 會把它載入成可編輯畫面。

你可以在 Editor 裡調整：

- 版面位置
- 元件大小
- 解析度
- desktop/tablet/mobile placement
- 文字與內容
- 元件階層
- interaction 與 acceptance criteria

---

## 8. 審核自訂元件候選

如果掃描到專案自訂元件，例如：

```text
InsightCard
CustomerSearchPanel
RiskSummaryTable
```

它們會出現在：

```text
Component Candidates
```

每個候選元件通常有三種處理方式。

### 8.1 映射到 core type

如果這個元件其實就是一般 card、button、form、data table，可以選：

```text
映射 core type
```

例如：

```text
InsightCard -> card
CustomerTable -> data_table
```

這代表 AUB 可以用既有語意類型理解它，不需要新增 extension type。

### 8.2 建立 namespaced extension type

如果這是你專案特有元件，可以選：

```text
建立 extension
```

例如：

```text
webapp:insight_card
acme:risk_summary_table
```

確認後才會寫入正式 registry：

```text
aub.registry.json
```

### 8.3 忽略

如果它不是 UI 元件，或暫時不需要納入 AUB，可以選：

```text
忽略
```

---

## 9. 儲存你調整後的畫面

你在 AUB Editor 調整完成後，按：

```text
存回 workspace
```

可以儲存成：

```text
screens/settings.ui.json
```

Editor 也會同步更新：

```text
.aub/session.json
```

session 會記錄：

- 目前正在編輯哪個 Blueprint
- 目前 target route
- preview dev server URL
- 最後儲存時間

這一步很重要。

因為你之後只要對 Agent 說：

```text
我調整好了，請依照 AUB session 實作到真實專案。
```

或直接按 onboarding checklist 裡的：

```text
複製 Agent 指令
```

貼給 Codex、Claude Code、Copilot 或其他支援 MCP 的 Agent。

Agent 就可以透過 MCP 讀：

```text
get_aub_session
get_blueprint
resolve_component
```

知道你剛剛改的是哪個畫面。

---

## 10. 讓 Agent 實作回真實專案

你可以對 Agent 說：

```text
我調整好了。請讀取 AUB session 和目前 Blueprint，依照畫面規格修改真實專案程式碼，並產生 implementation report。
```

Agent 應該做：

1. 讀 `.aub/session.json`
2. 找到 active Blueprint
3. 讀取 `.ui.json`
4. 讀取 `aub.registry.json`
5. 對照 component mapping
6. 修改真實專案程式碼
7. 跑專案測試或 build
8. 產生 implementation report

Agent 不應該只看截圖或口頭描述猜畫面。

它應該以 `.ui.json` 為 source of truth。

---

## 11. 在 AUB Editor 預覽真實 app route

假設你的既有專案 dev server 是：

```bash
cd /your-path/your-app
pnpm dev
```

並且跑在：

```text
http://localhost:3000
```

回到 AUB Editor 的 **Implementation Preview**。

填入：

```text
Dev server URL: http://localhost:3000
Route: /settings
```

按：

```text
套用預覽
```

AUB Editor 會用 iframe 顯示：

```text
http://localhost:3000/settings
```

如果你的 app 有 `X-Frame-Options` 或 CSP 限制，iframe 可能無法顯示。

這不是 AUB 壞掉，而是瀏覽器安全限制。

這時你可以按：

```text
另開預覽
```

直接在新分頁查看。

---

## 12. 每天使用時的最短流程

每天通常只要做這些：

### Terminal 1：啟動 AUB Workspace

```bash
cd /your-path/your-app
npx aub-workspace
```

### Terminal 2：啟動你的真實 app

```bash
cd /your-path/your-app
pnpm dev
```

### Browser：使用 AUB Editor

```text
瀏覽器會由 npx aub-workspace 自動打開。
```

### AUB Editor：完成第一次使用流程

```text
掃描專案 -> 產生範本 -> 審核候選 -> 存回 workspace -> 複製 Agent 指令
```

### Agent：貼上指令

```text
我已經在 AUB Editor 調整好了...
```

如果你正在開發 AUB 本身，才需要使用舊的手動流程：

```bash
cd /your-path/AUB
pnpm workspace:start -- --workspace /your-path/your-app
```

---

## 13. 常見問題

### Q1. 我一定要 pull AUB 專案嗎？

一般使用者不需要。

請在既有專案根目錄執行：

```bash
npx aub-workspace
```

只有在你要開發 AUB 本身、修改原始碼、除錯或跑 repo checks 時，才需要 clone AUB。

---

### Q2. GitHub Pages 版可以用嗎？

可以用於 demo、import、export。

但完整流程，也就是：

- 直接連本機 workspace
- 掃描既有專案
- 寫 `.aub/session.json`
- 寫 `.aub/templates`
- 寫 `.ui.json`
- 寫 `aub.registry.json`

需要本機 AUB + 本機 MCP server。

一般使用者可以用 `npx aub-workspace` 一次啟動這兩者，不需要手動 clone AUB。

---

### Q3. AUB 會自動修改我的真實專案程式碼嗎？

不會。

AUB 負責建立清楚的 UI contract。

真正改程式碼的是 Agent。

AUB 的價值是讓 Agent 不用猜：

- 要改哪個畫面
- 要用哪個元件
- 自訂元件如何映射
- desktop/tablet/mobile 怎麼呈現
- 驗收標準是什麼

---

### Q4. 掃描到的自訂元件會不會污染 registry？

不會。

掃描結果會先寫到：

```text
.aub/component-candidates.json
```

只有你在 Editor 裡確認「建立 extension」後，才會寫入：

```text
aub.registry.json
```

---

### Q5. 我調整完畫面後，Agent 怎麼知道我調了哪個檔案？

因為 Editor 儲存時會更新：

```text
.aub/session.json
```

Agent 讀：

```text
get_aub_session
```

就能知道目前 active Blueprint、target route、preview 設定。

---

### Q6. 解析度切換後，元件會跟著縮放嗎？

會。

Editor 的解析度切換會更新 active viewport 的尺寸，並依比例調整該 viewport 的 placements。

例如 desktop 從：

```text
1440 × 900
```

切到：

```text
1920 × 1080
```

該 viewport 的元件位置與尺寸會按比例更新。

其他 viewport，例如 tablet、mobile，不會被偷偷改動。

---

## 14. 建議給 Agent 的標準指令

### 掃描既有專案

```text
請透過 AUB MCP 掃描目前 workspace 的 UI。請找出 routes、pages、components、layouts、design tokens，產生 component candidates，並針對主要 route 產生 candidate workspace templates。不要直接寫 aub.registry.json。
```

### 產生指定頁面的範本

```text
請針對 app/settings/page.tsx 產生 AUB workspace template。自訂元件請放入 component candidates，不要自動 approve。
```

### 使用者調整完成後

```text
我已經在 AUB Editor 調整好了。請讀 get_aub_session，取得 active Blueprint，依照 .ui.json 和 aub.registry.json 修改真實專案程式碼，最後產生 implementation report。
```

### 要求 Agent 不要亂猜

```text
請以 .ui.json 為 source of truth。不要用口頭描述覆蓋 Blueprint。若 component mapping 或 route 不清楚，請先回報 blocker。
```

---

## 15. 完整流程總結

```text
既有專案
  ↓
AUB MCP 掃描
  ↓
.aub/component-candidates.json
.aub/templates/*.aub.template.json
  ↓
AUB Editor 審核範本與自訂元件
  ↓
使用者調整 UI
  ↓
存回 screens/*.ui.json
更新 .aub/session.json
  ↓
Agent 讀 session + blueprint + registry
  ↓
Agent 修改真實專案
  ↓
AUB Editor preview 真實 route
```

這個流程的核心目標是：

> 使用者負責決定畫面，AUB 負責保存可驗證規格，Agent 負責實作到真實程式碼。
