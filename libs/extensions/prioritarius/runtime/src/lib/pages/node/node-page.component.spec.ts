import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  addNode,
  CycleError,
  createWorkspace,
  formatPath,
} from '@sneat/prioritarius-core';
import { SpaceNavService } from '@sneat/space-services';
import { PrioritariusWorkspaceStore } from '../../workspace/prioritarius-workspace.store';
import { NodePageComponent } from './node-page.component';

function fakeActivatedRoute(nodeId: string): ActivatedRoute {
  const parent = {
    parent: null,
    snapshot: {
      paramMap: convertToParamMap({ spaceID: 'space-1', spaceType: 'team' }),
    },
  };
  return {
    parent,
    snapshot: { paramMap: convertToParamMap({ id: nodeId }) },
  } as unknown as ActivatedRoute;
}

describe('NodePageComponent', () => {
  let workspace: ReturnType<typeof createWorkspace>;
  let storeStub: {
    watchWorkspace: ReturnType<typeof vi.fn>;
    connectEdge: ReturnType<typeof vi.fn>;
    deleteNode: ReturnType<typeof vi.fn>;
  };
  let navStub: { navigateBackToSpacePage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    workspace = addNode(createWorkspace(), {
      id: 'goal-1',
      kind: 'goal',
      title: 'Website A live',
    });
    storeStub = {
      watchWorkspace: vi.fn().mockReturnValue(of(workspace)),
      connectEdge: vi.fn(),
      deleteNode: vi.fn().mockResolvedValue(undefined),
    };
    navStub = { navigateBackToSpacePage: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [NodePageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: fakeActivatedRoute('goal-1') },
        { provide: PrioritariusWorkspaceStore, useValue: storeStub },
        { provide: SpaceNavService, useValue: navStub },
      ],
    });
  });

  it('renders the node title from the loaded workspace', () => {
    const fixture = TestBed.createComponent(NodePageComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Website A live',
    );
  });

  it('surfaces a cycle-rejected edge connection as a visible error, never a silent failure', async () => {
    const attempted = { from: 'goal-1', to: 'x' };
    const path = ['x', 'y', 'goal-1'];
    const cycleError: CycleError = {
      kind: 'cycle-rejected',
      edgeType: 'contributes_to',
      attempted,
      path,
      message: `Adding "${attempted.from}" -contributes_to-> "${attempted.to}" would close a cycle via the existing path ${formatPath(path)}`,
    };
    storeStub.connectEdge.mockResolvedValue({
      kind: 'cycle-rejected',
      error: cycleError,
    });

    const fixture = TestBed.createComponent(NodePageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    (component as unknown as { connectTargetId: string }).connectTargetId = 'x';
    await (
      component as unknown as { connectEdge(type: string): Promise<void> }
    ).connectEdge('contributes_to');

    const errorMessage = (
      component as unknown as { $errorMessage: () => string | undefined }
    ).$errorMessage;
    expect(errorMessage()).toBe(cycleError.message);
  });

  it('confirms, deletes, and navigates back to the outline with replaceUrl', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(NodePageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    await (
      component as unknown as { deleteNode(): Promise<void> }
    ).deleteNode();

    expect(storeStub.deleteNode).toHaveBeenCalledWith(
      'space-1',
      workspace,
      'goal-1',
    );
    expect(navStub.navigateBackToSpacePage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'space-1' }),
      'outline',
      { replaceUrl: true },
    );
  });
});
