import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directDragMode } from '../apps/editor/src/lib/drag-intent.mjs';

test('D1: direct drag stays in the current parent by default', () => {
  assert.equal(directDragMode({
    altKey: false,
    currentParentId: 'page',
    destinationId: 'button_group',
  }), 'move');
});

test('D2: Alt/Option drag explicitly reparents into another container', () => {
  assert.equal(directDragMode({
    altKey: true,
    currentParentId: 'page',
    destinationId: 'button_group',
  }), 'reparent');
});

test('D3: Alt/Option drag over the current parent remains a move', () => {
  assert.equal(directDragMode({
    altKey: true,
    currentParentId: 'page',
    destinationId: 'page',
  }), 'move');
});
