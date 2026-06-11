# AUB Workspace Loop 사용자 매뉴얼

Languages: [English](./workspace-loop-user-manual.md) · [繁體中文](./workspace-loop-user-manual.zh-Hant.md) · [简体中文](./workspace-loop-user-manual.zh-Hans.md) · [日本語](./workspace-loop-user-manual.ja.md) · **한국어**

이 문서는 AUB 를 기존 프로젝트에 사용하는 방법을 설명합니다.

- Agent 가 기존 routes 와 components 를 scan 합니다.
- AUB Editor 가 수정 가능한 workspace templates 를 생성합니다.
- 사용자가 UI 에서 화면을 조정합니다.
- Agent 가 같은 AUB files 를 읽고 실제 app 에 구현합니다.
- AUB 안에서 실제 app route 를 preview 합니다.

한 문장으로 말하면:

> AUB 는 사용자와 Agent 가 공유하는 UI workbench 입니다. 사용자는 AUB Editor 에서 화면을 조정하고, Agent 는 MCP 로 같은 files 를 읽은 뒤 실제 project 를 수정합니다.

---

## 1. 필요한 것

일반 사용자는 기존 product project directory 하나만 있으면 됩니다.

```text
/your-path/your-app     # 기존 product project
```

`npx aub-workspace` 가 local 에서 AUB Editor 와 MCP server 를 시작하므로 Node.js 24 이상이 필요합니다.

AUB repo 를 먼저 clone 할 필요는 없습니다. AUB 자체를 개발하거나 debug 하거나 source code 를 수정할 때만 clone 하면 됩니다.

---

## 2. AUB Workspace 한 번에 시작하기

기존 project root directory 에서 실행합니다.

```bash
cd /your-path/your-app
npx aub-workspace init
npx aub-workspace
```

성공하면 다음과 비슷하게 표시됩니다.

```text
AUB Workspace is running
Workspace: /your-path/your-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

Browser 가 AUB Editor 를 자동으로 열고 workspace 에 연결된 상태가 됩니다.

`init` 은 AUB config, GitHub issue templates, Copilot instructions, PR workflow 를 만듭니다. app source 는 수정하지 않습니다. 생성 대상이 이미 있으면 `--force` 를 붙이지 않는 한 덮어쓰지 않습니다.

---

## 3. AUB 가 project 안에 만들 수 있는 files

`aub-workspace` 를 통해 AUB Editor 와 Agent 는 기존 project 안의 AUB files 를 읽고 쓸 수 있습니다.

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
.aub/ci.json
.github/workflows/aub-contracts.yml
aub.registry.json
screens/*.ui.json
```

AUB 는 실제 app source code 를 자동으로 수정하지 않습니다. 실제 code 변경은 Agent 가 수행합니다.

---

## 4. Editor onboarding checklist 따르기

Editor 연결 후 **First workspace loop** checklist 가 표시됩니다.

순서대로 진행합니다.

1. Scan project
2. Route 를 선택하고 template 생성
3. Custom component candidates review
4. UI Blueprint 조정
5. Workspace 에 save
6. Agent instruction copy

---

## 5. 기존 project scan

AUB Editor 에서 클릭합니다.

```text
Scan project
```

Editor 는 MCP tool 을 호출합니다.

```text
scan_project_ui
```

이 작업은 다음을 수행합니다.

1. React/Next, Vue/Nuxt, Angular project structure scan.
2. route/page/component/layout/design token/storybook 단서 탐지.
3. Project-specific custom component 탐지.
4. Candidate file 생성.

```text
.aub/component-candidates.json
```

중요한 규칙:

> Scan 된 custom component 는 formal registry 에 바로 들어가지 않습니다. 먼저 candidate list 에 들어가고 user review 를 기다립니다.

---

## 6. 기존 screen 에서 AUB template 생성

Scan 후 Editor 는 감지된 routes 를 표시합니다.

Route 를 선택하고 클릭합니다.

```text
Generate template
```

Editor 는 MCP tool 을 호출합니다.

```text
generate_template_from_source
```

Agent 에게 맡기려면 이렇게 말할 수 있습니다.

```text
app/settings/page.tsx 에서 AUB candidate template 를 생성하세요. Custom components 는 component candidates 에 넣고 자동 approve 하지 마세요.
```

Template 는 다음에 저장됩니다.

```text
.aub/templates/<slug>.aub.template.json
```

처음에는 candidate 입니다.

```json
{
  "status": "candidate"
}
```

즉 user review 가 필요합니다.

---

## 7. Workspace Templates 열기

AUB Editor 로 돌아갑니다.

Template area 에서 찾습니다.

```text
Workspace templates
```

Workspace 에서 생성된 candidate templates 가 표시됩니다.

```text
Settings
Dashboard
Customer Search
```

Template 를 선택하면 수정 가능한 screen 으로 로드됩니다.

조정할 수 있는 항목:

- Layout positions
- Component sizes
- Canvas resolution
- Desktop/tablet/mobile placements
- Text and content
- Component hierarchy
- Interactions and acceptance criteria

---

## 8. Custom Component Candidates review

Scan 으로 다음과 같은 custom components 를 찾으면:

```text
InsightCard
CustomerSearchPanel
RiskSummaryTable
```

다음 영역에 표시됩니다.

```text
Component Candidates
```

일반적으로 세 가지 선택지가 있습니다.

### 8.1 Core type 으로 map

Card, button, form, data table 과 사실상 같다면 선택합니다.

```text
Map core
```

예:

```text
InsightCard -> card
CustomerTable -> data_table
```

### 8.2 Namespaced extension type 만들기

Project 고유 component 라면 선택합니다.

```text
Create extension
```

예:

```text
webapp:insight_card
acme:risk_summary_table
```

승인 후에만 formal registry 에 기록됩니다.

```text
aub.registry.json
```

### 8.3 Ignore

UI component 가 아니거나 아직 AUB 에 넣지 않을 경우 선택합니다.

```text
Ignore
```

---

## 9. 조정한 screen 저장

AUB Editor 에서 조정이 끝나면 클릭합니다.

```text
Save to workspace
```

예:

```text
screens/settings.ui.json
```

Editor 는 다음도 업데이트합니다.

```text
.aub/session.json
```

Session 은 active Blueprint, target route, preview dev server URL, last saved time 을 기록합니다.

Checklist 의 다음 기능도 사용할 수 있습니다.

```text
Copy agent instruction
```

생성된 instruction 을 Codex, Claude Code, Copilot 또는 MCP 지원 Agent 에 붙여넣습니다.

---

## 10. Agent 가 실제 app 을 구현하게 하기

Agent 에게 이렇게 말합니다.

```text
AUB Editor 에서 조정이 끝났습니다. AUB session 과 current Blueprint 를 읽고 screen contract 에 따라 실제 app 을 업데이트한 뒤 implementation report 를 작성하세요.
```

Agent 가 해야 할 일:

1. `.aub/session.json` 읽기
2. Active Blueprint 찾기
3. `.ui.json` 읽기
4. `aub.registry.json` 읽기
5. Component mappings 해결
6. 실제 app code 수정
7. 필요한 tests 또는 build 실행
8. Implementation report 작성

Agent 는 screenshot 이나 prose 만 보고 추측하면 안 됩니다. `.ui.json` 이 source of truth 입니다.

구현 후 실제 route 에 대해 local evidence 를 capture 할 수 있습니다.

```bash
pnpm report:capture -- --workspace /your-path/your-app --blueprint screens/settings.ui.json --url http://localhost:3000/settings
pnpm report:verify screens/settings.ui.json .aub/reports/workspace.settings.implementation-report.json --require-evidence
```

이렇게 하면 viewport screenshots, DOM checks, overflow checks, acceptance evidence 가 implementation report 에 기록되어 PR gate 가 Agent 자기 보고에만 의존하지 않습니다.

---

## 11. 실제 app route preview

기존 app dev server 가 다음으로 시작된다고 가정합니다.

```bash
cd /your-path/your-app
pnpm dev
```

URL:

```text
http://localhost:3000
```

AUB Editor 의 **Implementation Preview** 에 입력합니다.

```text
Dev server URL: http://localhost:3000
Route: /settings
```

클릭:

```text
Apply preview
```

`X-Frame-Options` 또는 CSP 때문에 iframe 이 보이지 않으면 다음을 사용합니다.

```text
Open preview
```

---

## 12. 매일 쓰는 최단 flow

### Terminal 1: AUB Workspace 시작

```bash
cd /your-path/your-app
npx aub-workspace init
npx aub-workspace
```

### Terminal 2: 실제 app 시작

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
AUB Editor 에서 조정이 끝났습니다...
```

AUB 자체를 개발하는 경우에만 developer command 를 사용합니다.

```bash
cd /your-path/AUB
pnpm workspace:start -- --workspace /your-path/your-app
```

---

## 13. FAQ

### Q1. AUB repo 를 pull 해야 하나요?

일반 사용에는 필요 없습니다.

```bash
npx aub-workspace init
npx aub-workspace
```

AUB 자체를 개발하거나 source code 를 수정하거나 debug 하거나 repo checks 를 실행할 때만 clone 합니다.

### Q2. GitHub Pages 버전을 사용할 수 있나요?

Demo, import, export 용도로 사용할 수 있습니다.

Full workspace loop 는 local project files 를 읽고 써야 하므로 local editor 와 local MCP server 가 필요합니다. `npx aub-workspace init` 으로 설정을 만든 뒤 `npx aub-workspace` 가 둘을 함께 시작합니다.

### Q3. AUB 가 실제 app code 를 자동 수정하나요?

아니요. AUB 는 UI contract 를 만들고, 실제 code 는 Agent 가 수정합니다.

### Q4. Scan 된 custom components 가 registry 를 오염시키나요?

아니요. Scan results 는 먼저 `.aub/component-candidates.json` 에 들어가며, Editor 에서 **Create extension** 을 승인한 경우에만 `aub.registry.json` 에 기록됩니다.

### Q5. Agent 는 내가 어떤 file 을 편집했는지 어떻게 알 수 있나요?

Editor 가 `.aub/session.json` 을 업데이트합니다. Agent 는 `get_aub_session` 을 호출해 active Blueprint, target route, preview settings 를 읽습니다.

---

## 14. Agent 용 standard instructions

### 기존 project scan

```text
AUB MCP 로 current workspace UI 를 scan 하세요. routes, pages, components, layouts, design tokens 를 찾고 component candidates 와 main routes 의 candidate workspace templates 를 생성하세요. aub.registry.json 에는 직접 쓰지 마세요.
```

### 특정 page template 생성

```text
app/settings/page.tsx 의 AUB workspace template 를 생성하세요. Custom components 는 component candidates 에 넣고 자동 approve 하지 마세요.
```

### 사용자가 편집을 마친 후

```text
AUB Editor 에서 조정이 끝났습니다. get_aub_session 을 읽고 active Blueprint 를 찾은 뒤 .ui.json 과 aub.registry.json 에 따라 실제 app code 를 수정하고 마지막에 implementation report 를 작성하세요.
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

> 사용자가 screen 을 결정하고, AUB 가 검증 가능한 contract 를 저장하며, Agent 가 실제 code 에 구현합니다.
