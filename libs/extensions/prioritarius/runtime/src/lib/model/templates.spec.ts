import { createWorkspace } from '@sneat/prioritarius-core';
import { planApplyTemplate, WORKSPACE_TEMPLATES } from './templates';

describe('WORKSPACE_TEMPLATES', () => {
  it('every template carries a non-empty goal-title preview (never applied sight unseen)', () => {
    for (const template of WORKSPACE_TEMPLATES) {
      expect(template.goalTitles.length).toBeGreaterThan(0);
      expect(template.label.length).toBeGreaterThan(0);
    }
  });
});

describe('planApplyTemplate', () => {
  it('creates one ordinary, editable goal per template title using the core defaulting rules', () => {
    const template = WORKSPACE_TEMPLATES[0];
    let nextId = 0;
    const plan = planApplyTemplate(
      createWorkspace(),
      template,
      () => `id-${nextId++}`,
    );

    expect(plan.created).toHaveLength(template.goalTitles.length);
    for (const [index, title] of template.goalTitles.entries()) {
      const created = plan.created[index];
      expect(created.node.title).toBe(title);
      expect(created.node.kind).toBe('goal');
      // Ordinary content: same default commitment as a hand-entered goal —
      // no "template" mode, nothing undeletable.
      if (created.node.kind !== 'work_item') {
        expect(created.node.commitment).toBe('exploring');
      }
    }
    expect(plan.workspace.nodes.size).toBe(template.goalTitles.length);
  });
});
