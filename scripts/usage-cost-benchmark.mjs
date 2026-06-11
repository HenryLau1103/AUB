#!/usr/bin/env node

const DEFAULT_OUTPUT_DIR = 'benchmarks/usage-cost/results';
const DEFAULT_BASELINE_MODEL_ID = 'qwen3.6-35b-local';
const DEFAULT_MODELS = [
  {
    id: 'qwen3.6-35b-local',
    displayName: 'Qwen 3.6 35B (Ollama Local)',
    provider: 'ollama',
    model: 'qwen3.6:35b',
    baseUrl: 'http://100.64.168.99:11434',
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    enabled: true,
  },
];

const DEFAULT_SCENARIOS = [
  {
    id: 'blueprint_summary',
    name: 'Dashboard blueprint summary',
    prompt:
      '請你只輸出 JSON，內容必須含有 key: purpose, keyComponents, risks, recommendations。\n\n情境：AUB 目標是讓 AI agent 產生可實作的 UI Blueprint。\n請用 120 字以內整理重點，並保持輸出穩定。',
    maxOutputTokens: 180,
  },
  {
    id: 'acceptance_checklist',
    name: 'Acceptance checklist draft',
    prompt:
      '請你只輸出 JSON，內容為字串陣列 checklist，描述這個需求的 5 條可驗收項目（含可量化條件）。\n\n需求：使用者需要一個可讓訪客快速查看平台核心指標與兩個 CTA 按鈕的 Hero 區塊。',
    maxOutputTokens: 220,
  },
  {
    id: 'api_design_contract',
    name: 'API contract draft',
    prompt:
      '請你只輸出 JSON，請給出欄位: endpoint, method, requestFields, responseFields, sampleResponse, edgeCases。\n\n任務：為一個取得 dashboard 顯示數據的介面產生簡短 API 設計。',
    maxOutputTokens: 260,
  },
  {
    id: 'cost_estimation_note',
    name: '成本估算說明',
    prompt:
      '請你只輸出 JSON，含 fields: scenario, assumptions, caveats, costImpact。\n\n任務：用最保守角度估算若每日 10,000 次同樣請求會有的成本風險。',
    maxOutputTokens: 200,
  },
];

const DEFAULT_PRICING_NOTE =
  'cost 估算需搭配 provider 官方最新價格；此欄位預設 0，無法自動抓取即時價格。';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage: node scripts/usage-cost-benchmark.mjs [options]\n\nOptions:\n  --iterations <n>      每個場景每個模型執行次數（預設 1）\n  --output <dir>        結果輸出目錄（預設 ${DEFAULT_OUTPUT_DIR}）\n  --baseline <model-id> 基準模型 id（預設 ${DEFAULT_BASELINE_MODEL_ID}）\n  --models <file>       可選模型設定 JSON 檔\n  --scenarios <file>    可選場景設定 JSON 檔\n  --skip-missing        無法取得 token 的模型仍強制中止（預設跳過）\n  --help                顯示此訊息`);
  process.exit(0);
}

const iterations = Number(args.iterations || 1);
const outputDir = args.output || DEFAULT_OUTPUT_DIR;
const baselineModelId = args.baseline || DEFAULT_BASELINE_MODEL_ID;
const skipMissing = args['skip-missing'] !== false;

const models = await loadJsonArgOrDefault(args.models, DEFAULT_MODELS, 'models');
const scenarios = await loadJsonArgOrDefault(args.scenarios, DEFAULT_SCENARIOS, 'scenarios');

if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error(`--iterations 必須為正整數，收到: ${args.iterations}`);
}

const enabledModels = models.filter((model) => {
  if (model.enabled === false) {
    return false;
  }
  if (model.provider === 'openai') {
    return Boolean(model.apiKeyEnv && process.env[model.apiKeyEnv]);
  }
  if (model.provider === 'anthropic') {
    return Boolean(model.apiKeyEnv && process.env[model.apiKeyEnv]);
  }
  return true;
});

const missing = models.filter((model) => !enabledModels.includes(model));
for (const model of missing) {
  console.log(`Skip model ${model.id} (${model.displayName || 'no name'})，未啟用或缺少憑證`);
}

if (!enabledModels.length) {
  throw new Error('沒有可用模型可執行測試。請設定 provider 憑證或更新 models 設定。');
}

const results = {
  executedAt: new Date().toISOString(),
  iterations,
  outputDir,
  baselineModelId,
  pricingNote: DEFAULT_PRICING_NOTE,
  scenarioRuns: [],
};

for (const scenario of scenarios) {
  console.log(`\n# Scenario: ${scenario.id} (${scenario.name})`);
  for (const model of enabledModels) {
    const runEntries = [];
    for (let run = 1; run <= iterations; run += 1) {
      const start = Date.now();
      const usage = await runSingleRequest(model, scenario, run);
      const latencyMs = Date.now() - start;
      const tokens = normalizeTokenCounts(usage.tokenInfo);
      const cost = computeCost(model, tokens);
      runEntries.push({
        modelId: model.id,
        scenarioId: scenario.id,
        run,
        status: usage.status,
        latencyMs,
        responseTextPreview: usage.responseText.slice(0, 160),
        responseLength: usage.responseText.length,
        responseValidJson: usage.validJson,
        usage: {
          provider: usage.provider,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          totalTokens: tokens.totalTokens,
          raw: usage.tokenInfo,
        },
        estimateCostUsd: cost,
      });

      const tokenSummary = tokens.totalTokens == null ? 'N/A' : `${tokens.totalTokens}`;
      console.log(`  - ${model.id} run #${run}: status=${usage.status}, tokens=${tokenSummary}, cost=$${cost === null ? 'N/A' : cost.toFixed(6)}`);
      if (usage.status === 'error') {
        console.log(`    ${usage.error}`);
      }
    }

    const aggregate = aggregateRuns(runEntries);
    results.scenarioRuns.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      modelId: model.id,
      modelName: model.displayName || model.id,
      runs: runEntries,
      aggregate,
    });

    if (usageHasMissingTokens(runEntries) && !skipMissing) {
      throw new Error(`模型 ${model.id} 缺少可計費 token 記錄且未設定 --skip-missing=false`);
    }
  }
}

const summary = buildSummary(results.scenarioRuns, baselineModelId);
results.summary = summary;

await ensureDir(outputDir);
const timestamp = new Date().toISOString().replace(/:/g, '-');
const jsonPath = `${outputDir}/usage-cost-benchmark-${timestamp}.json`;
const csvPath = `${outputDir}/usage-cost-benchmark-${timestamp}.csv`;

await writeFile(jsonPath, JSON.stringify(results, null, 2));
await writeFile(csvPath, toCsv(results.scenarioRuns));

console.log('\n--- Benchmark completed ---');
console.log(`Results JSON: ${jsonPath}`);
console.log(`Results CSV: ${csvPath}`);
console.log(`\n${summaryText(summary)}`);

function usageHasMissingTokens(runs) {
  return runs.some((run) => run.usage.inputTokens == null || run.usage.outputTokens == null);
}

function aggregateRuns(runs) {
  const statusCounts = runs.reduce((acc, run) => {
    acc[run.status] = (acc[run.status] || 0) + 1;
    return acc;
  }, {});

  const validRuns = runs.filter((run) => run.status === 'ok');
  const metrics = {
    totalRuns: runs.length,
    successRate: runs.length > 0 ? validRuns.length / runs.length : 0,
    avgLatencyMs: round(avg(validRuns.map((r) => r.latencyMs)), 3),
    avgInputTokens: round(avg(validRuns.map((r) => r.usage.inputTokens).filter((v) => typeof v === 'number')),
    2),
    avgOutputTokens: round(avg(validRuns.map((r) => r.usage.outputTokens).filter((v) => typeof v === 'number')),
    2),
    avgTotalTokens: round(avg(validRuns.map((r) => r.usage.totalTokens).filter((v) => typeof v === 'number')),
    2),
    validRunCount: validRuns.length,
    jsonSuccessRate: validRuns.length === 0 ? 0 : validRuns.filter((run) => run.responseValidJson).length / validRuns.length,
    avgEstimatedCostUsd: avg(validRuns.map((r) => r.estimateCostUsd).filter((v) => typeof v === 'number')),
    statusCounts,
  };

  return metrics;
}

function buildSummary(scenarioRuns, baselineModelId) {
  const byScenario = Object.groupBy(scenarioRuns, (item) => item.scenarioId);
  const summaryRows = [];

  for (const [scenarioId, entries] of Object.entries(byScenario)) {
    const baseline = entries.find((entry) => entry.modelId === baselineModelId);
    const baselineMetrics = baseline?.aggregate || null;

    for (const entry of entries) {
      const costRatio =
        baseline && baselineMetrics?.avgTotalTokens && entry.aggregate.avgTotalTokens != null
          ? entry.aggregate.avgTotalTokens / baselineMetrics.avgTotalTokens
          : null;

      summaryRows.push({
        scenarioId,
        modelId: entry.modelId,
        modelName: entry.modelName,
        successRate: entry.aggregate.successRate,
        avgInputTokens: entry.aggregate.avgInputTokens,
        avgOutputTokens: entry.aggregate.avgOutputTokens,
        avgTotalTokens: entry.aggregate.avgTotalTokens,
        avgEstimatedCostUsd: entry.aggregate.avgEstimatedCostUsd,
        costRatioToBaseline: costRatio,
      });
    }
  }

  const rankedByScenario = summaryRows
    .slice()
    .sort((a, b) => {
      if (a.scenarioId === b.scenarioId) {
        return a.modelId.localeCompare(b.modelId);
      }
      return a.scenarioId.localeCompare(b.scenarioId);
    });

  const header = [
    'scenarioId',
    'modelId',
    'modelName',
    'successRate',
    'avgInputTokens',
    'avgOutputTokens',
    'avgTotalTokens',
    'avgEstimatedCostUsd',
    'costRatioToBaseline',
  ];

  return {
    header,
    rows: rankedByScenario,
    baselineModelId,
    missingPriceModels: uniqueModelsWithMissingPrice(scenarioRuns),
  };
}

function uniqueModelsWithMissingPrice(scenarioRuns) {
  const seen = new Set();
  for (const run of scenarioRuns) {
    const model = DEFAULT_MODELS.find((candidate) => candidate.id === run.modelId);
    if (!model) {
      continue;
    }
    const missing =
      typeof model.inputPricePerMillion !== 'number' || typeof model.outputPricePerMillion !== 'number';
    if (missing) {
      seen.add(model.id);
    }
  }
  return [...seen];
}

function summaryText(summary) {
  const lines = ['\n比較摘要（平均每場景）:'];
  for (const row of summary.rows) {
    const costText = row.avgEstimatedCostUsd == null ? 'N/A' : `$${row.avgEstimatedCostUsd.toFixed(6)}`;
    const ratioText =
      row.costRatioToBaseline == null
        ? 'N/A'
        : `${row.costRatioToBaseline.toFixed(3)}x（vs ${summary.baselineModelId}）`;
    lines.push(
      `- [${row.scenarioId}] ${row.modelId}: 成功率 ${Math.round(row.successRate * 100)}%，` +
        `平均 Input ${formatNum(row.avgInputTokens)} / Output ${formatNum(row.avgOutputTokens)} / Total ${formatNum(
          row.avgTotalTokens,
        )}，成本 ${costText}，成本倍數 ${ratioText}`
    );
  }
  if (summary.missingPriceModels.length) {
    lines.push(`\n未設定價格（輸出為 N/A）: ${summary.missingPriceModels.join(', ')}`);
    lines.push(DEFAULT_PRICING_NOTE);
  }
  return lines.join('\n');
}

function formatNum(value) {
  return value == null ? 'N/A' : `${Math.round(value)}`;
}

async function runSingleRequest(model, scenario, run) {
  const payload = {
    temperature: 0,
    maxTokens: scenario.maxOutputTokens || 256,
    prompt: scenario.prompt + `\n\nRun Index: ${run}`,
  };

  try {
    if (model.provider === 'ollama') {
      return await runOllamaRequest(model, payload);
    }
    if (model.provider === 'openai') {
      return await runOpenAiRequest(model, payload);
    }
    if (model.provider === 'anthropic') {
      return await runAnthropicRequest(model, payload);
    }
    throw new Error(`Unsupported provider: ${model.provider}`);
  } catch (error) {
    return {
      provider: model.provider,
      status: 'error',
      responseText: '',
      validJson: false,
      tokenInfo: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      },
      error: String(error?.message || error),
      estimateCostUsd: null,
    };
  }
}

async function runOllamaRequest(model, payload) {
  const response = await fetch(normalizeUrl(model.baseUrl).replace(/\/$/, '') + '/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: model.model || model.id,
      prompt: payload.prompt,
      stream: false,
      think: false,
      format: 'json',
      options: {
        temperature: payload.temperature,
        num_predict: payload.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const responseText = typeof result.response === 'string' ? result.response : JSON.stringify(result);
  const validJson = isValidJson(responseText);
  return {
    provider: 'ollama',
    status: result.done === false ? 'error' : 'ok',
    responseText,
    validJson,
    tokenInfo: {
      inputTokens: typeof result.prompt_eval_count === 'number' ? result.prompt_eval_count : null,
      outputTokens: typeof result.eval_count === 'number' ? result.eval_count : null,
      totalTokens: typeof result.eval_count === 'number' && typeof result.prompt_eval_count === 'number'
        ? result.eval_count + result.prompt_eval_count
        : null,
      raw: result,
    },
    error: null,
  };
}

async function runOpenAiRequest(model, payload) {
  const baseUrl = normalizeUrl(model.baseUrl || 'https://api.openai.com/v1');
  const apiKey = process.env[model.apiKeyEnv || 'OPENAI_API_KEY'];
  const response = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      temperature: payload.temperature,
      max_tokens: payload.maxTokens,
      messages: [{ role: 'user', content: payload.prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const responseText =
    result.choices?.[0]?.message?.content ?? result.choices?.[0]?.message?.[0]?.text ?? '';
  const validJson = isValidJson(responseText);

  return {
    provider: 'openai',
    status: responseText ? 'ok' : 'error',
    responseText: String(responseText || ''),
    validJson,
    tokenInfo: {
      inputTokens: result.usage?.prompt_tokens ?? null,
      outputTokens: result.usage?.completion_tokens ?? null,
      totalTokens: result.usage?.total_tokens ?? null,
      raw: result.usage ?? null,
    },
    error: null,
  };
}

async function runAnthropicRequest(model, payload) {
  const baseUrl = normalizeUrl(model.baseUrl || 'https://api.anthropic.com');
  const apiKey = process.env[model.apiKeyEnv || 'ANTHROPIC_API_KEY'];
  const response = await fetch(baseUrl + '/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model.model,
      max_tokens: payload.maxTokens,
      temperature: payload.temperature,
      messages: [{ role: 'user', content: payload.prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const responseText = Array.isArray(result.content)
    ? result.content.map((part) => part.text || '').join('')
    : '';

  return {
    provider: 'anthropic',
    status: responseText ? 'ok' : 'error',
    responseText,
    validJson: isValidJson(responseText),
    tokenInfo: {
      inputTokens: result.usage?.input_tokens ?? null,
      outputTokens: result.usage?.output_tokens ?? null,
      totalTokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0) || null,
      raw: result.usage ?? null,
    },
    error: null,
  };
}

function normalizeTokenCounts(tokenInfo) {
  return {
    inputTokens: typeof tokenInfo.inputTokens === 'number' ? tokenInfo.inputTokens : null,
    outputTokens: typeof tokenInfo.outputTokens === 'number' ? tokenInfo.outputTokens : null,
    totalTokens: typeof tokenInfo.totalTokens === 'number' ? tokenInfo.totalTokens : null,
  };
}

function computeCost(model, tokens) {
  if (typeof tokens.inputTokens !== 'number' || typeof tokens.outputTokens !== 'number') {
    return null;
  }

  const inputPrice = model.inputPricePerMillion;
  const outputPrice = model.outputPricePerMillion;

  if (typeof inputPrice !== 'number' || typeof outputPrice !== 'number') {
    return null;
  }

  return ((tokens.inputTokens * inputPrice) / 1_000_000) + ((tokens.outputTokens * outputPrice) / 1_000_000);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.replace(/^--/, '');
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function loadJsonArgOrDefault(argValue, fallback, type) {
  if (!argValue) {
    return fallback;
  }

  const filePath = String(argValue);
  const content = await readText(filePath);
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error(`${type} JSON 內容必須是陣列`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`無法讀取 ${type} 設定檔 ${filePath}: ${error.message}`);
  }
}

async function ensureDir(dirPath) {
  const file = await import('node:fs/promises');
  await file.mkdir(dirPath, { recursive: true });
}

async function writeFile(filePath, content) {
  const { writeFile: write } = await import('node:fs/promises');
  await write(filePath, content, 'utf8');
}

async function readText(filePath) {
  const { readFile } = await import('node:fs/promises');
  return readFile(filePath, 'utf8');
}

function isValidJson(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function avg(values) {
  const list = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!list.length) {
    return null;
  }
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function round(value, precision = 2) {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeUrl(value = '') {
  return String(value).replace(/\/+$/, '');
}

function toCsv(scenarioRuns) {
  const rows = [['scenario_id', 'model_id', 'run', 'status', 'latency_ms', 'input_tokens', 'output_tokens', 'total_tokens', 'cost_usd', 'json_ok', 'response_preview']];

  for (const runGroup of scenarioRuns) {
    for (const run of runGroup.runs) {
      rows.push([
        run.scenarioId,
        run.modelId,
        String(run.run),
        run.status,
        String(run.latencyMs),
        valueOrEmpty(run.usage.inputTokens),
        valueOrEmpty(run.usage.outputTokens),
        valueOrEmpty(run.usage.totalTokens),
        run.estimateCostUsd == null ? '' : String(run.estimateCostUsd),
        run.responseValidJson ? '1' : '0',
        quoteCsv(run.responseTextPreview || ''),
      ]);
    }
  }

  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell == null) {
            return '';
          }
          const asText = String(cell).replace(/\r\n/g, ' ');
          if (/[",\n]/.test(asText)) {
            return `"${asText.replace(/"/g, '""')}"`;
          }
          return asText;
        })
        .join(',')
    )
    .join('\n');
}

function valueOrEmpty(value) {
  return value == null ? '' : String(value);
}

function quoteCsv(value) {
  return String(value || '').replace(/\n/g, ' ');
}
