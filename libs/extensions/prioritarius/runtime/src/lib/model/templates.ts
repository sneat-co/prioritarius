import { addNode, PrioritariusNode, Workspace } from '@sneat/prioritarius-core';

/**
 * First-run starter templates (founder decision, 2026-09-02): the empty
 * workspace offers "enter your goal" as the primary control plus a compact,
 * always-visible preview of each template's goals — never applied sight
 * unseen. Everything a template creates is ordinary goal nodes, identical
 * to hand-entered ones (no template mode, nothing undeletable).
 */
export interface WorkspaceTemplate {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly goalTitles: readonly string[];
}

export const WORKSPACE_TEMPLATES: readonly WorkspaceTemplate[] = [
  {
    id: 'personal',
    label: 'Personal',
    description: 'Everyday goals for your own life.',
    goalTitles: ['Get fit', 'Learn a new skill', 'Read more books'],
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Shared goals for your household.',
    goalTitles: [
      'Plan a family trip',
      'Home improvement',
      'Quality time each week',
    ],
  },
  {
    id: 'work',
    label: 'Work',
    description: 'Goals for your job or business.',
    goalTitles: ['Ship the MVP', 'Grow the team', 'Improve processes'],
  },
];

export interface ApplyTemplatePlan {
  readonly workspace: Workspace;
  readonly created: ReadonlyArray<{
    readonly id: string;
    readonly node: PrioritariusNode;
  }>;
}

/**
 * Applies a template's goal titles via the core's own `addNode` (never
 * duplicating its defaulting rules), one goal per title. `idGenerator` is
 * injected so this stays a pure, seedable function for tests; the store
 * supplies a real id generator.
 */
export function planApplyTemplate(
  workspace: Workspace,
  template: WorkspaceTemplate,
  idGenerator: () => string,
): ApplyTemplatePlan {
  let next = workspace;
  const created: Array<{ id: string; node: PrioritariusNode }> = [];
  for (const title of template.goalTitles) {
    const id = idGenerator();
    next = addNode(next, { id, kind: 'goal', title });
    const node = next.nodes.get(id);
    if (node) {
      created.push({ id, node });
    }
  }
  return { workspace: next, created };
}
