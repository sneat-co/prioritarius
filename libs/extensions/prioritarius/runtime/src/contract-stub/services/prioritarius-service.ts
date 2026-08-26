import { InjectionToken } from '@angular/core';
import { ISpaceContext } from '@sneat/space-models';
import { Observable } from 'rxjs';
import { IListContext } from '../contexts';
import { ListType } from '../dto';
import {
  ICreateListRequest,
  IDeleteListItemsRequest,
  IListItemResult,
  IListItemsCommandParams,
  IReorderListItemsRequest,
  ISetListItemsIsComplete,
} from './interfaces';

// IPrioritariusService is the runtime-light contract the prioritarius pages and components
// depend on. Members mirror the concrete ListService public surface used by the
// UI; the implementation lives in the internal lib and is provided via the
// PRIORITARIUS_SERVICE token below. The shared BaseListPage additionally needs the
// inherited ModuleSpaceItemService surface, so it types the injected token as
// an intersection with ModuleSpaceItemService<IListBrief, IListDbo>.
export interface IPrioritariusService {
  createList(request: ICreateListRequest): Observable<IListContext>;
  deleteList(space: ISpaceContext, listId: string): Observable<void>;
  reorderListItems(request: IReorderListItemsRequest): Observable<void>;
  createListItems(
    params: IListItemsCommandParams,
  ): Observable<IListItemResult>;
  setListItemsIsCompleted(
    request: ISetListItemsIsComplete,
  ): Observable<void>;
  deleteListItems(request: IDeleteListItemsRequest): Observable<void>;
  getListById(
    space: ISpaceContext,
    listType: ListType,
    listID: string,
  ): Observable<IListContext>;
}

export const PRIORITARIUS_SERVICE = new InjectionToken<IPrioritariusService>(
  'PrioritariusService',
);
