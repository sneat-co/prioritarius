import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { createWorkspace } from '@sneat/prioritarius-core';
import { SpaceNavService } from '@sneat/space-services';
import { PrioritariusWorkspaceStore } from '../../workspace/prioritarius-workspace.store';
import { WORKSPACE_TEMPLATES } from '../../model/templates';
import { OutlinePageComponent } from './outline-page.component';

function fakeActivatedRoute(): ActivatedRoute {
  const parent = {
    parent: null,
    snapshot: {
      paramMap: convertToParamMap({ spaceID: 'space-1', spaceType: 'team' }),
    },
  };
  return {
    parent,
    snapshot: { paramMap: convertToParamMap({}) },
  } as unknown as ActivatedRoute;
}

describe('OutlinePageComponent', () => {
  let storeStub: {
    watchWorkspace: ReturnType<typeof vi.fn>;
    createNode: ReturnType<typeof vi.fn>;
    applyTemplate: ReturnType<typeof vi.fn>;
    deleteNode: ReturnType<typeof vi.fn>;
  };
  let navStub: { navigateForwardToSpacePage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    storeStub = {
      watchWorkspace: vi.fn().mockReturnValue(of(createWorkspace())),
      createNode: vi.fn(),
      applyTemplate: vi.fn().mockResolvedValue(createWorkspace()),
      deleteNode: vi.fn().mockResolvedValue(undefined),
    };
    navStub = { navigateForwardToSpacePage: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [OutlinePageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
        { provide: PrioritariusWorkspaceStore, useValue: storeStub },
        { provide: SpaceNavService, useValue: navStub },
      ],
    });
  });

  it('shows the "enter your goal" input and every template\'s compact preview before it can be applied', () => {
    const fixture = TestBed.createComponent(OutlinePageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host.querySelector('ion-input[placeholder="e.g. Website A live"]'),
    ).toBeTruthy();
    for (const template of WORKSPACE_TEMPLATES) {
      expect(host.textContent).toContain(template.label);
      for (const title of template.goalTitles) {
        expect(host.textContent).toContain(title);
      }
    }
  });

  it('creates a goal and navigates forward to its detail page with replaceUrl (screen-flow default)', async () => {
    storeStub.createNode.mockResolvedValue({
      id: 'new-goal-id',
      kind: 'goal',
      title: 'Website A live',
      commitment: 'exploring',
      completed: false,
    });
    const fixture = TestBed.createComponent(OutlinePageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    (component as unknown as { newGoalTitle: string }).newGoalTitle =
      'Website A live';
    await (
      component as unknown as { createGoal(): Promise<void> }
    ).createGoal();

    expect(storeStub.createNode).toHaveBeenCalledWith(
      'space-1',
      expect.objectContaining({ kind: 'goal', title: 'Website A live' }),
    );
    expect(navStub.navigateForwardToSpacePage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'space-1' }),
      'node/new-goal-id',
      { replaceUrl: true },
    );
  });
});
