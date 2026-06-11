# AUB Workspace Loop ユーザーマニュアル

Languages: [English](./workspace-loop-user-manual.md) · [繁體中文](./workspace-loop-user-manual.zh-Hant.md) · [简体中文](./workspace-loop-user-manual.zh-Hans.md) · **日本語** · [한국어](./workspace-loop-user-manual.ko.md)

この手順書は、AUB を既存プロジェクトで使う方法を説明します。

- Agent が既存の route と component を scan する。
- AUB Editor が編集可能な workspace template を生成する。
- ユーザーが UI 上で画面を調整する。
- Agent が同じ AUB files を読み、実際の app に実装する。
- AUB 内で実際の app route を preview する。

一言でいうと：

> AUB は、あなたと Agent が共有する UI workbench です。AUB Editor で画面を調整し、Agent は MCP 経由で同じ files を読んで実際の project を変更します。

---

## 1. 必要なもの

通常のユーザーに必要なのは既存 product project の directory だけです。

```text
/your-path/your-app     # 既存の product project
```

`npx aub-workspace` は local で AUB Editor と MCP server を起動するため、Node.js 24 以降が必要です。

AUB repo を先に clone する必要はありません。AUB 自体を開発、debug、source code を変更する場合だけ clone します。

---

## 2. AUB Workspace を一発で起動する

既存 project の root directory で実行します。

```bash
cd /your-path/your-app
npx aub-workspace
```

成功すると次のように表示されます。

```text
AUB Workspace is running
Workspace: /your-path/your-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

Browser が AUB Editor を自動で開き、workspace に接続済みの状態になります。

---

## 3. AUB が project 内に作る可能性がある files

`aub-workspace` により、AUB Editor と Agent は既存 project 内の AUB files を読み書きできます。

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
aub.registry.json
screens/*.ui.json
```

AUB は実際の app source code を自動変更しません。実際の code 変更は Agent が行います。

---

## 4. Editor の onboarding checklist に従う

Editor の接続後、**First workspace loop** checklist が表示されます。

順番に実行します。

1. Scan project
2. Route を選んで template を生成
3. Custom component candidates を review
4. UI Blueprint を調整
5. Workspace に save
6. Agent instruction を copy

---

## 5. 既存 project を scan する

AUB Editor で次をクリックします。

```text
Scan project
```

Editor は MCP tool を呼び出します。

```text
scan_project_ui
```

これは次を行います。

1. React/Next、Vue/Nuxt、Angular の project structure を scan。
2. route/page/component/layout/design token/storybook の手がかりを検出。
3. Project-specific custom component を検出。
4. Candidate file を生成。

```text
.aub/component-candidates.json
```

重要なルール：

> Scan された custom component は formal registry に直接入りません。まず candidate list に入り、ユーザー review を待ちます。

---

## 6. 既存 screen から AUB template を生成する

Scan 後、Editor は検出した routes を表示します。

Route を選んでクリックします。

```text
Generate template
```

Editor は MCP tool を呼び出します。

```text
generate_template_from_source
```

Agent に依頼する場合は、次のように言えます。

```text
app/settings/page.tsx から AUB candidate template を生成してください。Custom components は component candidates に入れ、自動 approve しないでください。
```

Template は次に保存されます。

```text
.aub/templates/<slug>.aub.template.json
```

最初は candidate です。

```json
{
  "status": "candidate"
}
```

つまり、ユーザー review が必要です。

---

## 7. Workspace Templates を開く

AUB Editor に戻ります。

Template area で次を探します。

```text
Workspace templates
```

Workspace から生成された candidate templates が表示されます。

```text
Settings
Dashboard
Customer Search
```

Template を選ぶと、編集可能な screen として読み込まれます。

調整できるもの：

- Layout positions
- Component sizes
- Canvas resolution
- Desktop/tablet/mobile placements
- Text and content
- Component hierarchy
- Interactions and acceptance criteria

---

## 8. Custom Component Candidates を review する

Scan で次のような custom components が見つかった場合：

```text
InsightCard
CustomerSearchPanel
RiskSummaryTable
```

次の欄に表示されます。

```text
Component Candidates
```

通常は 3 つの選択肢があります。

### 8.1 Core type に map

Card、button、form、data table と同等なら次を選びます。

```text
Map core
```

例：

```text
InsightCard -> card
CustomerTable -> data_table
```

### 8.2 Namespaced extension type を作る

Project 固有 component なら次を選びます。

```text
Create extension
```

例：

```text
webapp:insight_card
acme:risk_summary_table
```

承認後にだけ formal registry に書き込まれます。

```text
aub.registry.json
```

### 8.3 Ignore

UI component ではない、またはまだ AUB に入れたくない場合は次を選びます。

```text
Ignore
```

---

## 9. 調整した screen を save する

AUB Editor で調整が終わったらクリックします。

```text
Save to workspace
```

例：

```text
screens/settings.ui.json
```

Editor は次も更新します。

```text
.aub/session.json
```

Session は active Blueprint、target route、preview dev server URL、last saved time を記録します。

Checklist の次も使えます。

```text
Copy agent instruction
```

生成された instruction を Codex、Claude Code、Copilot、または MCP 対応 Agent に貼り付けます。

---

## 10. Agent に実際の app を実装させる

Agent には次のように伝えます。

```text
AUB Editor で調整が終わりました。AUB session と current Blueprint を読み、screen contract に従って実際の app を更新し、implementation report を作成してください。
```

Agent が行うこと：

1. `.aub/session.json` を読む
2. Active Blueprint を特定する
3. `.ui.json` を読む
4. `aub.registry.json` を読む
5. Component mappings を解決する
6. 実際の app code を変更する
7. 必要な tests または build を実行する
8. Implementation report を作る

Agent は screenshot や prose だけで推測すべきではありません。`.ui.json` が source of truth です。

---

## 11. 実際の app route を preview する

既存 app の dev server が次で起動するとします。

```bash
cd /your-path/your-app
pnpm dev
```

URL：

```text
http://localhost:3000
```

AUB Editor の **Implementation Preview** に入力します。

```text
Dev server URL: http://localhost:3000
Route: /settings
```

クリック：

```text
Apply preview
```

`X-Frame-Options` や CSP により iframe が表示できない場合は、次を使います。

```text
Open preview
```

---

## 12. 毎日の最短 flow

### Terminal 1: AUB Workspace を起動

```bash
cd /your-path/your-app
npx aub-workspace
```

### Terminal 2: 実際の app を起動

```bash
cd /your-path/your-app
pnpm dev
```

### AUB Editor

```text
Scan project -> Generate template -> Review candidates -> Save to workspace -> Copy agent instruction
```

### Agent

```text
AUB Editor で調整が終わりました...
```

AUB 自体を開発している場合だけ、developer command を使います。

```bash
cd /your-path/AUB
pnpm workspace:start -- --workspace /your-path/your-app
```

---

## 13. FAQ

### Q1. AUB repo を pull する必要がありますか？

通常利用では不要です。

```bash
npx aub-workspace
```

AUB 自体を開発、source code を変更、debug、repo checks を実行する場合だけ clone します。

### Q2. GitHub Pages 版は使えますか？

Demo、import、export には使えます。

Full workspace loop は local project files を読み書きするため、local editor と local MCP server が必要です。`npx aub-workspace` がそれらをまとめて起動します。

### Q3. AUB は実際の app code を自動変更しますか？

いいえ。AUB は UI contract を作ります。実際の code を変更するのは Agent です。

### Q4. Scan された custom components は registry を汚しませんか？

汚しません。Scan results はまず `.aub/component-candidates.json` に入り、Editor で **Create extension** を承認した場合だけ `aub.registry.json` に書き込まれます。

### Q5. Agent はどの file を編集したかどうやって知りますか？

Editor が `.aub/session.json` を更新します。Agent は `get_aub_session` を呼び、active Blueprint、target route、preview settings を読みます。

---

## 14. Agent 向け standard instructions

### 既存 project を scan

```text
AUB MCP で current workspace UI を scan してください。routes、pages、components、layouts、design tokens を見つけ、component candidates と main routes の candidate workspace templates を生成してください。aub.registry.json には直接書き込まないでください。
```

### 指定 page の template を生成

```text
app/settings/page.tsx の AUB workspace template を生成してください。Custom components は component candidates に入れ、自動 approve しないでください。
```

### ユーザーの編集後

```text
AUB Editor で調整が終わりました。get_aub_session を読み、active Blueprint を取得し、.ui.json と aub.registry.json に従って実際の app code を変更し、最後に implementation report を作成してください。
```

---

## 15. Complete Flow Summary

```text
Existing project
  ↓
AUB MCP scan
  ↓
.aub/component-candidates.json
.aub/templates/*.aub.template.json
  ↓
AUB Editor reviews templates and custom components
  ↓
User adjusts UI
  ↓
Save to screens/*.ui.json
Update .aub/session.json
  ↓
Agent reads session + blueprint + registry
  ↓
Agent modifies the real app
  ↓
AUB Editor previews the real route
```

Core goal:

> ユーザーが screen を決め、AUB が検証可能な contract を保存し、Agent が実際の code に実装します。
