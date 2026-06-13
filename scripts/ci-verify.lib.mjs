import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import { buildKnownTypes } from './registry.lib.mjs';
import { validateBlueprintSemantics } from './validate-blueprint.lib.mjs';
import { loadProject, validateProjectSemantics } from './project.lib.mjs';
import { verifyImplementationReport } from './implementation-report.lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function verifyWorkspace({
  workspace = process.cwd(),
  configPath = '.aub/ci.json',
  requireReports = false,
  requireEvidence = false,
  minSafetyScore = null,
} = {}) {
  const root = resolve(workspace);
  const absoluteConfig = resolve(root, configPath);
  const validators = await loadValidators();
  const failures = [];
  const checks = [];
  let config;

  if (existsSync(absoluteConfig)) {
    config = JSON.parse(await readFile(absoluteConfig, 'utf8'));
    if (!validators.validateConfig(config)) {
      for (const error of formatAjvErrors(validators.validateConfig)) {
        failures.push({ path: relativePath(root, absoluteConfig), message: `CI config: ${error}` });
      }
      return summarize({ root, configPath, checks, failures });
    }
  } else {
    const discovered = await discoverAubFiles(root);
    config = {
      version: '1.0.0',
      blueprints: discovered.blueprints,
      projects: discovered.projects,
      reports: [],
    };
  }

  const discovered = config.discover ? await discoverAubFiles(root) : { blueprints: [], projects: [] };
  const blueprintRefs = uniqueRefs([...(config.blueprints ?? []), ...discovered.blueprints]);
  const projectRefs = uniqueRefs([...(config.projects ?? []), ...discovered.projects]);
  const reportRefs = config.reports ?? [];
  const reportTargets = new Set(reportRefs.map((entry) => normalizeRef(entry.blueprint)));
  const configuredMinSafetyScore = normalizeSafetyScoreThreshold(minSafetyScore ?? config.min_safety_score);

  if (blueprintRefs.length === 0 && projectRefs.length === 0) {
    if (!config.discover) {
      failures.push({ path: configPath, message: 'No Blueprint or project files were configured or discovered.' });
    }
  }

  for (const ref of blueprintRefs) {
    const result = await verifyBlueprintFile(root, ref, validators);
    checks.push(result);
    failures.push(...result.failures);
    if (requireReports && !reportTargets.has(normalizeRef(ref))) {
      failures.push({ path: ref, message: 'No implementation report is configured for this Blueprint.' });
    }
  }

  for (const ref of projectRefs) {
    const result = await verifyProjectFile(root, ref, validators);
    checks.push(result);
    failures.push(...result.failures);
  }

  for (const entry of reportRefs) {
    const result = await verifyReportFile(root, entry, validators, {
      requireEvidence,
      minSafetyScore: configuredMinSafetyScore,
    });
    checks.push(result);
    failures.push(...result.failures);
  }

  return summarize({ root, configPath: existsSync(absoluteConfig) ? configPath : null, checks, failures });
}

async function loadValidators() {
  const [blueprint, project, report, config] = await Promise.all([
    readJson(join(ROOT, 'schema', 'ui-blueprint.schema.json')),
    readJson(join(ROOT, 'schema', 'ui-project.schema.json')),
    readJson(join(ROOT, 'schema', 'implementation-report.schema.json')),
    readJson(join(ROOT, 'schema', 'aub-ci.schema.json')),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return {
    validateBlueprint: ajv.compile(blueprint),
    validateProject: ajv.compile(project),
    validateReport: ajv.compile(report),
    validateConfig: ajv.compile(config),
  };
}

async function verifyBlueprintFile(root, ref, validators) {
  const path = resolveRef(root, ref);
  const failures = [];
  try {
    const blueprint = await readDocument(path);
    const schemaOk = validators.validateBlueprint(blueprint);
    if (!schemaOk) {
      for (const error of formatAjvErrors(validators.validateBlueprint)) {
        failures.push({ path: ref, message: `Blueprint schema: ${error}` });
      }
    } else {
      try {
        const { knownTypes } = await buildKnownTypes({ startDir: dirname(path) });
        for (const error of validateBlueprintSemantics(blueprint, { knownTypes })) {
          failures.push({ path: ref, message: `Blueprint semantics: ${error}` });
        }
      } catch (error) {
        failures.push({ path: ref, message: `Component registry: ${error.message}` });
      }
    }
  } catch (error) {
    failures.push({ path: ref, message: error.message });
  }
  return { kind: 'blueprint', path: ref, passed: failures.length === 0, failures };
}

async function verifyProjectFile(root, ref, validators) {
  const path = resolveRef(root, ref);
  const failures = [];
  try {
    const loaded = await loadProject(path, { workspaceRoot: root });
    if (!validators.validateProject(loaded.project)) {
      for (const error of formatAjvErrors(validators.validateProject)) {
        failures.push({ path: ref, message: `Project schema: ${error}` });
      }
    }
    for (const error of validateProjectSemantics(loaded.project, { screensById: loaded.screensById })) {
      failures.push({ path: ref, message: `Project semantics: ${error}` });
    }
    for (const error of loaded.errors) failures.push({ path: ref, message: error });
    for (const screen of loaded.screens) {
      if (!screen.blueprint) continue;
      const screenRef = relativePath(root, screen.path);
      if (!validators.validateBlueprint(screen.blueprint)) {
        for (const error of formatAjvErrors(validators.validateBlueprint)) {
          failures.push({ path: screenRef, message: `Blueprint schema: ${error}` });
        }
        continue;
      }
      try {
        const { knownTypes } = await buildKnownTypes({ startDir: dirname(screen.path) });
        for (const error of validateBlueprintSemantics(screen.blueprint, { knownTypes })) {
          failures.push({ path: screenRef, message: `Blueprint semantics: ${error}` });
        }
      } catch (error) {
        failures.push({ path: screenRef, message: `Component registry: ${error.message}` });
      }
    }
  } catch (error) {
    failures.push({ path: ref, message: error.message });
  }
  return { kind: 'project', path: ref, passed: failures.length === 0, failures };
}

async function verifyReportFile(root, entry, validators, options = {}) {
  const failures = [];
  let safetyScore = null;
  let reportSummary = null;
  try {
    const [blueprint, report] = await Promise.all([
      readDocument(resolveRef(root, entry.blueprint)),
      readJson(resolveRef(root, entry.report)),
    ]);
    if (!validators.validateReport(report)) {
      for (const error of formatAjvErrors(validators.validateReport)) {
        failures.push({ path: entry.report, message: `Report schema: ${error}` });
      }
    } else {
      const result = verifyImplementationReport(blueprint, report, options);
      safetyScore = result.summary.safety_score;
      reportSummary = result.summary;
      for (const error of result.errors) {
        failures.push({ path: entry.report, message: `Implementation report: ${error}` });
      }
      if (Number.isInteger(options.minSafetyScore) && safetyScore.overall < options.minSafetyScore) {
        failures.push({
          path: entry.report,
          message: `Implementation safety score ${safetyScore.overall} is below required minimum ${options.minSafetyScore}.`,
        });
      }
    }
  } catch (error) {
    failures.push({ path: entry.report, message: error.message });
  }
  return {
    kind: 'report',
    path: entry.report,
    blueprint: entry.blueprint,
    safetyScore,
    reportSummary,
    passed: failures.length === 0,
    failures,
  };
}

async function discoverAubFiles(root) {
  const blueprints = [];
  const projects = [];
  await walk(root, async (path) => {
    const rel = relativePath(root, path);
    if (/\.aub\.project\.(json|ya?ml)$/i.test(path)) projects.push(rel);
    else if (/\.ui\.(json|ya?ml)$/i.test(path)) blueprints.push(rel);
  });
  return { blueprints: blueprints.sort(), projects: projects.sort() };
}

async function walk(dir, visit) {
  const { readdir } = await import('node:fs/promises');
  const ignored = new Set(['node_modules', 'dist', '.git', '.pnpm-store', '_site']);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.aub') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) await walk(path, visit);
    } else if (entry.isFile()) {
      await visit(path);
    }
  }
}

function summarize({ root, configPath, checks, failures }) {
  return {
    valid: failures.length === 0,
    workspace: root,
    configPath,
    summary: {
      checks: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
      failures: failures.length,
    },
    checks,
    failures,
  };
}

function resolveRef(root, ref) {
  return isAbsolute(ref) ? ref : resolve(root, ref);
}

function normalizeRef(ref) {
  return ref.replaceAll('\\', '/').replace(/^\.\//, '');
}

function normalizeSafetyScoreThreshold(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100) {
    throw new Error(`min_safety_score must be an integer from 0 to 100: ${value}`);
  }
  return number;
}

function uniqueRefs(refs) {
  return [...new Set(refs.map(normalizeRef))].sort();
}

function relativePath(root, path) {
  return relative(root, path).split(sep).join('/');
}

function formatAjvErrors(validate) {
  return (validate.errors ?? []).map((error) => {
    const path = error.instancePath || '(root)';
    return `${path} ${error.message ?? 'invalid'}`;
  });
}

async function readDocument(path) {
  const text = await readFile(path, 'utf8');
  const extension = extname(path).toLowerCase();
  return extension === '.yaml' || extension === '.yml' ? yaml.load(text) : JSON.parse(text);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
