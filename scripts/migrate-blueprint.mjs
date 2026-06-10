const CURRENT_VERSION = '0.3.0';

export function migrateBlueprint(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Blueprint must be an object.');
  }

  const sourceVersion = typeof input.version === 'string' ? input.version : '0.1.0';
  if (!['0.1.0', '0.2.0', CURRENT_VERSION].includes(sourceVersion)) {
    throw new Error(`Unsupported Blueprint version: ${sourceVersion}`);
  }

  const blueprint = structuredClone(input);
  blueprint.version = CURRENT_VERSION;
  blueprint.design_system ??= defaultDesignSystem();
  blueprint.nodes = Array.isArray(blueprint.nodes)
    ? blueprint.nodes.map((node) => migrateNode(node))
    : [];

  return blueprint;
}

export function defaultDesignSystem() {
  return {
    name: 'AUB Neutral',
    colors: {
      'surface.canvas': '#f8fafc',
      'surface.panel': '#ffffff',
      'surface.subtle': '#f1f5f9',
      'text.primary': '#0f172a',
      'text.secondary': '#64748b',
      'border.default': '#cbd5e1',
      'action.primary': '#2563eb',
      'action.primary.text': '#ffffff',
      'status.success': '#047857',
      'status.warning': '#b45309',
      'status.danger': '#b91c1c'
    },
    typography: {
      'heading.page': '700 28px/1.2 system-ui',
      'heading.section': '650 18px/1.3 system-ui',
      'body.default': '400 14px/1.5 system-ui',
      'body.small': '400 12px/1.4 system-ui',
      'label.default': '600 12px/1.3 system-ui'
    },
    spacing: {
      'space.1': '4px',
      'space.2': '8px',
      'space.3': '12px',
      'space.4': '16px',
      'space.5': '24px',
      'space.6': '32px'
    },
    radii: {
      'radius.control': '6px',
      'radius.panel': '8px',
      'radius.round': '999px'
    },
    shadows: {
      'shadow.panel': '0 8px 24px rgba(15, 23, 42, 0.12)',
      'shadow.overlay': '0 18px 48px rgba(15, 23, 42, 0.22)'
    }
  };
}

function migrateNode(input) {
  const node = { ...input };
  if (node.layout) {
    node.layout = {
      mode: node.layout.mode ?? 'auto',
      ...node.layout
    };
  }
  if (node.placements && typeof node.placements === 'object') {
    node.placements = Object.fromEntries(
      Object.entries(node.placements).map(([viewport, placement]) => [
        viewport,
        normalizePlacement(placement)
      ])
    );
  }
  return node;
}

function normalizePlacement(input) {
  const placement = { ...input };
  for (const key of ['x', 'y', 'width', 'height']) {
    if (typeof placement[key] !== 'number' || !Number.isFinite(placement[key])) {
      throw new Error(`Invalid placement.${key}`);
    }
  }
  return placement;
}

export { CURRENT_VERSION };
