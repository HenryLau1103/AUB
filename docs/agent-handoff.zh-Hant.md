# AUB Agent 交付指南

本指南提供給收到 AUB UI Blueprint 或 `.aub.zip` 交付包的編碼 Agent。

> English version: [`agent-handoff.md`](./agent-handoff.md)

## 先向使用者說明 AUB

AUB 是使用者與編碼 Agent 之間的視覺 UI 合約。使用者在 AUB 編輯器中安排畫面，再匯出結構化的版面、元件語意、互動、響應式行為、畫面截圖與可驗證的驗收條件。

第一次回覆時：

1. 使用使用者目前使用的語言。
2. 說明 AUB 定義了介面應該做什麼，以及最後如何驗收。
3. 列出找到的 AUB 檔案與輔助證據。
4. 說明這次要執行生成、規劃、實作或審查。
5. 指出尚未決定的產品問題。只有 repository 與既有證據都無法回答時才詢問使用者。

## 辨識輸入內容

AUB 交付包可能包含：

| 檔案 | 用途 | 權威性 |
|---|---|---|
| `*.ui.json` | 完整且可由機器讀取的 UI 合約 | **唯一真實來源** |
| `*.ui.md` | Blueprint 的人類與 Agent 可讀版本 | 衍生參考 |
| `screenshots/*.png` | 各 viewport 的視覺證據 | 輔助參考 |
| `*.agent.md` | Agent 中立的任務提示 | 執行指示 |
| `*.codex.md` | Codex 專用任務提示 | 執行指示 |
| `implementation-report.template.json` | 必填的節點與驗收報告 | 完成契約 |
| `implementation-report.schema.json` | 完成報告使用的 schema | 驗證契約 |
| `manifest.json` | 交付包 metadata、雜湊與入口 | 完整性資料 |

若檔案彼此衝突，依以下順序判定：

1. 通過驗證的 `*.ui.json`
2. Repository 的明確限制
3. Blueprint 內的驗收條件與響應式規則
4. 自動產生的 `*.ui.md`
5. 截圖
6. 交付包外的文字描述

不得默默自行處理衝突。必須向使用者說明，並提出具體解法。

## 選擇任務

- **生成**：把產品需求或既有畫面轉成一份通過 schema 驗證的 Blueprint。
- **規劃**：把 Blueprint 節點與 acceptance id 對應到目標 repository，不修改檔案。
- **實作**：修改目標 repository，直到符合 Blueprint 與所有驗收條件。
- **審查**：比較既有實作與 Blueprint，依嚴重程度回報不一致之處。

## 必須遵守的流程

1. 讀取目標 repository 的規則，包括適用的 `AGENTS.md`、`CLAUDE.md` 與 `.github/copilot-instructions.md`。
2. 檢查既有 route、元件、design token、依賴、測試與實作慣例。
3. 驗證 Blueprint 後才能依賴其內容。
4. 將每個 Blueprint node id 對應到既有或新建的實作元件。
5. 保留階層、語意元件類型、layout mode、各 viewport 幾何、互動、響應式規則、狀態與限制。
6. 只要符合合約，應優先使用 repository 既有元件與 token。
7. 執行涵蓋所有修改面的檢查。
8. 完成 implementation report，提供每個節點的檔案對應，以及每個 acceptance id 的證據。

## 不可妥協的規則

- `*.ui.json` 是唯一真實來源；Markdown 與截圖不得覆蓋它。
- 不得自行重新設計、降低驗收條件，或用偏好的模式取代已宣告的行為。
- 不得猜測缺少的產品行為。應記錄不確定性；若會實質影響結果，再詢問使用者。
- 除非 Blueprint 或使用者核准的衝突解法要求，不得任意互換 `auto` 與 `freeform` layout。
- 必須保留 accessible name、focus 行為、最小操作尺寸與響應式 overflow 限制。
- 必須明確回報阻塞。部分完成不得宣稱為全部完成。

## 完成時的回覆

使用使用者的語言回覆，並包含：

1. 已實作或已審查的內容。
2. 修改或檢查過的檔案。
3. 驗證命令與精確結果。
4. 每個 acceptance id 的 `pass`、`fail` 或 `needs-review`，以及具體證據。
5. 尚未解決的決策、衝突或阻塞。
6. 若任務是實作或審查，附上完成的 `implementation-report.json`。

只有在報告已對應所有節點、所有必要驗收條件都有通過證據，且沒有未解決阻塞時，才能視為完成。
