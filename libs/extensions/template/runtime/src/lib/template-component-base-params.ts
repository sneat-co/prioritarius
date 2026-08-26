import { Injectable, inject } from '@angular/core';
import {
  IListBrief,
  IListDbo,
  ITemplateService,
  TEMPLATE_SERVICE,
} from '@sneat/extension-template-contract';
import { SpaceComponentBaseParams } from '@sneat/space-components';
import { ModuleSpaceItemService } from '@sneat/space-services';

// The template service obtained via the contract token. BaseListPage passes it to
// the SpaceItemPageBaseComponent super constructor, which expects a concrete
// ModuleSpaceItemService<IListBrief, IListDbo>; the bound implementation extends
// exactly that, so the injected value is typed as the intersection.
export type TemplateServiceWithSpaceItem = ITemplateService &
  ModuleSpaceItemService<IListBrief, IListDbo>;

@Injectable()
export class TemplateComponentBaseParams {
  readonly spaceParams = inject(SpaceComponentBaseParams);
  readonly listService = inject<TemplateServiceWithSpaceItem>(TEMPLATE_SERVICE);
}
