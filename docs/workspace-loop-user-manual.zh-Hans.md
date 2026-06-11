# AUB Workspace Loop 操作手册

语言： [English](./workspace-loop-user-manual.md) · [繁體中文](./workspace-loop-user-manual.zh-Hant.md) · **简体中文** · [日本語](./workspace-loop-user-manual.ja.md) · [한국어](./workspace-loop-user-manual.ko.md)

这份手册说明如何把 AUB 用在「既有项目」上：

- 让 Agent 扫描既有项目页面与组件。
- 让 AUB Editor 生成可调整的画面模板。
- 让用户在 UI 中调整画面。
- 让 Agent 读取同一份 AUB 文件后，实作回真实项目。
- 在 AUB 中预览真实 app route。

一句话理解：

> AUB 是你和 Agent 共用的 UI 工作台。你在 AUB Editor 调整画面，Agent 通过 MCP 读取同一份文件，再去修改你的真实项目。

---

## 1. 需要准备什么

一般用户只需要一个既有产品项目目录：

```text
/your-path/your-app     # 你的既有产品项目
```

你的电脑需要 Node.js 24 或更新版本，因为 `npx aub-workspace` 会在本机启动 AUB Editor 和 MCP server。

你不需要先 clone AUB repo。只有在开发 AUB 本身、除错或修改源码时才需要 clone AUB。

---

## 2. 一键启动 AUB Workspace

在你的既有项目根目录执行：

```bash
cd /your-path/your-app
npx aub-workspace init
npx aub-workspace
```

看到类似这段代表成功：

```text
AUB Workspace is running
Workspace: /your-path/your-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

浏览器会自动打开 AUB Editor，并且已经连到你的 workspace。

`init` 会创建 AUB 配置、GitHub issue templates、Copilot instructions 和 PR workflow。它不会修改你的 app source。若目标文件已存在，默认不会覆盖，除非加上 `--force`。

---

## 3. AUB 会在项目里建立哪些文件

`aub-workspace` 会让 AUB Editor 和 Agent 可以读写你的既有项目内的 AUB 文件，例如：

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
.aub/ci.json
.github/workflows/aub-contracts.yml
aub.registry.json
screens/*.ui.json
```

AUB 不会自动修改你的真实 app 源码。真正修改 app 的仍然是 Agent。

---

## 4. 在 Editor 中按照 onboarding checklist 操作

Editor 连线成功后，你会看到 **第一次使用流程**。

按顺序完成：

1. 扫描项目
2. 选择 route 生成模板
3. 审核自定义组件候选
4. 调整 UI Blueprint
5. 存回 workspace
6. 复制 Agent 指令

---

## 5. 扫描既有项目

你可以直接在 AUB Editor 按：

```text
扫描项目
```

Editor 会通过 MCP tool 执行：

```text
scan_project_ui
```

它会做几件事：

1. 扫描 React/Next、Vue/Nuxt、Angular 项目结构。
2. 找出 route/page/component/layout/design token/storybook 等线索。
3. 找出项目自定义组件。
4. 生成候选文件：

```text
.aub/component-candidates.json
```

重要规则：

> 扫描到的自定义组件不会直接写入正式 registry。它们会先进入 candidate list，等待你在 UI 中确认。

---

## 6. 从既有页面生成 AUB 模板

扫描完成后，Editor 会列出侦测到的 routes。

你可以选择一个 route，按：

```text
生成模板
```

Editor 会通过 MCP tool 执行：

```text
generate_template_from_source
```

如果你想让 Agent 协助，也可以对 Agent 说：

```text
请针对 app/settings/page.tsx 生成 AUB candidate template。自定义组件请放入 component candidates，不要自动 approve。
```

生成的模板会放在：

```text
.aub/templates/<slug>.aub.template.json
```

这些模板一开始会是：

```json
{
  "status": "candidate"
}
```

代表它是候选模板，需要你审核。

---

## 7. 打开 Workspace Templates

回到 AUB Editor。

在模板区找到：

```text
Workspace templates
```

你会看到 Agent 生成的候选模板，例如：

```text
Settings
Dashboard
Customer Search
```

点选模板后，AUB Editor 会把它载入成可编辑画面。

你可以在 Editor 中调整：

- 版面位置
- 组件大小
- 分辨率
- desktop/tablet/mobile placement
- 文字与内容
- 组件层级
- interaction 与 acceptance criteria

---

## 8. 审核自定义组件候选

如果扫描到项目自定义组件，例如：

```text
InsightCard
CustomerSearchPanel
RiskSummaryTable
```

它们会出现在：

```text
Component Candidates
```

每个候选组件通常有三种处理方式。

### 8.1 映射到 core type

如果这个组件本质上就是 card、button、form、data table，可以选择：

```text
映射 core type
```

例如：

```text
InsightCard -> card
CustomerTable -> data_table
```

这代表 AUB 可以用既有语义类型理解它，不需要新增 extension type。

### 8.2 建立 namespaced extension type

如果这是你项目特有组件，可以选择：

```text
建立 extension
```

例如：

```text
webapp:insight_card
acme:risk_summary_table
```

确认后才会写入正式 registry：

```text
aub.registry.json
```

### 8.3 忽略

如果它不是 UI 组件，或暂时不需要纳入 AUB，可以选择：

```text
忽略
```

---

## 9. 保存调整后的画面

你在 AUB Editor 调整完成后，按：

```text
存回 workspace
```

可以保存成：

```text
screens/settings.ui.json
```

Editor 也会同步更新：

```text
.aub/session.json
```

session 会记录：

- 目前正在编辑哪个 Blueprint
- 目前 target route
- preview dev server URL
- 最后保存时间

你也可以直接按 onboarding checklist 里的：

```text
复制 Agent 指令
```

贴给 Codex、Claude Code、Copilot 或其他支持 MCP 的 Agent。

---

## 10. 让 Agent 实作回真实项目

你可以对 Agent 说：

```text
我已经在 AUB Editor 调整好了。请读取 AUB session 和目前 Blueprint，依照画面规格修改真实项目代码，并生成 implementation report。
```

Agent 应该做：

1. 读 `.aub/session.json`
2. 找到 active Blueprint
3. 读取 `.ui.json`
4. 读取 `aub.registry.json`
5. 对照 component mapping
6. 修改真实项目代码
7. 跑项目测试或 build
8. 生成 implementation report

Agent 不应该只看截图或口头描述猜画面。它应该以 `.ui.json` 为 source of truth。

实作完成后，可针对真实 route 捕捉本地验证证据：

```bash
pnpm report:capture -- --workspace /your-path/your-app --blueprint screens/settings.ui.json --url http://localhost:3000/settings
pnpm report:verify screens/settings.ui.json .aub/reports/workspace.settings.implementation-report.json --require-evidence
```

这会把 viewport 截图、DOM 检查、overflow 检查与 acceptance evidence 写入 implementation report，避免 PR gate 只依赖 Agent 自述。

---

## 11. 在 AUB Editor 预览真实 app route

假设你的既有项目 dev server 是：

```bash
cd /your-path/your-app
pnpm dev
```

并且跑在：

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
套用预览
```

如果你的 app 有 `X-Frame-Options` 或 CSP 限制，iframe 可能无法显示。这时可以按：

```text
另开预览
```

直接在新分页查看。

---

## 12. 每天使用时的最短流程

### Terminal 1：启动 AUB Workspace

```bash
cd /your-path/your-app
npx aub-workspace init
npx aub-workspace
```

### Terminal 2：启动真实 app

```bash
cd /your-path/your-app
pnpm dev
```

### AUB Editor：完成第一次使用流程

```text
扫描项目 -> 生成模板 -> 审核候选 -> 存回 workspace -> 复制 Agent 指令
```

### Agent：贴上指令

```text
我已经在 AUB Editor 调整好了...
```

如果你正在开发 AUB 本身，才需要使用开发指令：

```bash
cd /your-path/AUB
pnpm workspace:start -- --workspace /your-path/your-app
```

---

## 13. 常见问题

### Q1. 我一定要 pull AUB 项目吗？

一般用户不需要。请在既有项目根目录执行：

```bash
npx aub-workspace init
npx aub-workspace
```

只有在开发 AUB 本身、修改源码、除错或跑 repo checks 时，才需要 clone AUB。

### Q2. GitHub Pages 版可以用吗？

可以用于 demo、import、export。

完整 workspace loop 需要读写本机项目文件，因此需要本机 editor 与本机 MCP server。一般用户可以先执行 `npx aub-workspace init` 建立配置，再用 `npx aub-workspace` 启动这两者。

### Q3. AUB 会自动修改我的真实项目代码吗？

不会。AUB 负责建立清楚的 UI contract，真正改代码的是 Agent。

### Q4. 扫描到的自定义组件会不会污染 registry？

不会。扫描结果会先写到 `.aub/component-candidates.json`，只有你在 Editor 中确认「建立 extension」后，才会写入 `aub.registry.json`。

### Q5. 我调整完画面后，Agent 怎么知道我调了哪个文件？

因为 Editor 保存时会更新 `.aub/session.json`。Agent 调用 `get_aub_session` 就能知道目前 active Blueprint、target route、preview 设置。

---

## 14. 建议给 Agent 的标准指令

### 扫描既有项目

```text
请通过 AUB MCP 扫描目前 workspace 的 UI。请找出 routes、pages、components、layouts、design tokens，生成 component candidates，并针对主要 route 生成 candidate workspace templates。不要直接写 aub.registry.json。
```

### 生成指定页面的模板

```text
请针对 app/settings/page.tsx 生成 AUB workspace template。自定义组件请放入 component candidates，不要自动 approve。
```

### 用户调整完成后

```text
我已经在 AUB Editor 调整好了。请读 get_aub_session，取得 active Blueprint，依照 .ui.json 和 aub.registry.json 修改真实项目代码，最后生成 implementation report。
```

---

## 15. 完整流程总结

```text
既有项目
  ↓
AUB MCP 扫描
  ↓
.aub/component-candidates.json
.aub/templates/*.aub.template.json
  ↓
AUB Editor 审核模板与自定义组件
  ↓
用户调整 UI
  ↓
存回 screens/*.ui.json
更新 .aub/session.json
  ↓
Agent 读 session + blueprint + registry
  ↓
Agent 修改真实项目
  ↓
AUB Editor preview 真实 route
```

核心目标：

> 用户负责决定画面，AUB 负责保存可验证规格，Agent 负责实作到真实代码。
