import { ActivatedRoute } from '@angular/router';
import { SpaceType } from '@sneat/core';
import { ISpaceContext } from '@sneat/space-models';

/**
 * Walks the route's own ancestor chain for a param — robust regardless of
 * the router's `paramsInheritanceStrategy` (the app default, 'emptyOnly',
 * only merges an ancestor's params into a child whose OWN path is empty;
 * 'outline'/'node/:id' are non-empty, so `ActivatedRoute.paramMap` on those
 * pages would not otherwise see the parent's `spaceID`/`spaceType`).
 */
function ancestorParam(route: ActivatedRoute, name: string): string | null {
  let current: ActivatedRoute | null = route;
  while (current) {
    const value = current.snapshot.paramMap.get(name);
    if (value) {
      return value;
    }
    current = current.parent;
  }
  return null;
}

/** A minimal `ISpaceContext` (id/type only — `brief`/`dbo` are optional on
 * the interface and unused by this extension's own pages) built straight
 * from the route, for `SpaceNavService` and `spacePageUrl`. */
export function spaceContextFromRoute(route: ActivatedRoute): ISpaceContext {
  return {
    id: ancestorParam(route, 'spaceID') ?? '',
    type: (ancestorParam(route, 'spaceType') ?? undefined) as
      SpaceType | undefined,
  };
}
