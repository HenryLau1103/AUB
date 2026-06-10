import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { scoreImplementationBenchmark } from '../scripts/agent-implementation-benchmark.lib.mjs';
import { createImplementationReportTemplate } from '../scripts/implementation-report.lib.mjs';

const blueprint = JSON.parse(await readFile(new URL('../examples/freeform-actions.ui.json', import.meta.url), 'utf8'));

test('implementation benchmark scores exact geometry, interactions, styles, and report', () => {
  const measurement = makeMeasurement();
  const report = createImplementationReportTemplate(blueprint);
  report.implementation = { framework: 'standalone-html', route: '/', files: ['index.html'] };
  report.node_mappings = report.node_mappings.map((item) => ({
    ...item,
    status: 'mapped',
    file: 'index.html',
  }));
  report.acceptance_results = report.acceptance_results.map((item) => ({
    ...item,
    status: 'pass',
    evidence: [{ type: 'dom', reference: 'benchmark measurement' }],
  }));

  const result = scoreImplementationBenchmark(blueprint, measurement, measurement, report);
  assert.equal(result.ready, true);
  assert.equal(result.score, 100);
  assert.ok(result.total > 100);
});

test('implementation benchmark fails moved geometry and missing interaction', () => {
  const measurement = makeMeasurement();
  const candidate = structuredClone(measurement);
  candidate.viewports.mobile.nodes.primary_cta.rect.x += 20;
  delete candidate.interactions.primary_cta;
  const report = createImplementationReportTemplate(blueprint);

  const result = scoreImplementationBenchmark(blueprint, candidate, measurement, report);
  assert.equal(result.ready, false);
  assert.ok(result.checks.some((check) => check.path === 'mobile.geometry.primary_cta.x' && !check.pass));
  assert.ok(result.checks.some((check) => check.path === 'interaction.interaction_start' && !check.pass));
  assert.ok(result.checks.some((check) => check.path === 'implementation_report.ready' && !check.pass));
});

function makeMeasurement() {
  const viewports = {};
  for (const viewport of blueprint.viewports) {
    const nodes = {};
    for (const node of blueprint.nodes) {
      const placement = node.placements?.[viewport.id];
      nodes[node.id] = {
        text: node.content?.text ?? node.content?.label ?? '',
        parent_node_id: node.parent_id,
        rect: placement
          ? { ...placement }
          : { x: 0, y: 0, width: 100, height: 20, z_index: 0 },
        styles: {
          position: node.parent_id === 'root' ? 'absolute' : 'static',
          display: node.id === 'stats_card' ? 'flex' : 'block',
          flexDirection: node.id === 'stats_card' ? 'column' : 'row',
          rowGap: node.id === 'stats_card' ? '8px' : 'normal',
          columnGap: node.id === 'stats_card' ? '8px' : 'normal',
          paddingTop: node.id === 'stats_card' ? '20px' : '0px',
          paddingRight: node.id === 'stats_card' ? '20px' : '0px',
          paddingBottom: node.id === 'stats_card' ? '20px' : '0px',
          paddingLeft: node.id === 'stats_card' ? '20px' : '0px',
          marginTop: '0px',
          marginRight: '0px',
          marginBottom: '0px',
          marginLeft: '0px',
          backgroundColor: 'rgb(255, 255, 255)',
          color: 'rgb(15, 23, 42)',
          borderRadius: '6px',
          boxShadow: 'none',
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontWeight: '400',
          lineHeight: '21px',
        },
      };
    }
    viewports[viewport.id] = {
      nodes,
      root_children: ['hero_heading', 'primary_cta', 'secondary_cta', 'stats_card'],
      horizontal_overflow: false,
      screenshot_bytes: 10000,
    };
  }
  return {
    viewports,
    interactions: {
      primary_cta: 'navigate:/signup',
      secondary_cta: 'navigate:/examples',
    },
    has_focus_visible: true,
  };
}
