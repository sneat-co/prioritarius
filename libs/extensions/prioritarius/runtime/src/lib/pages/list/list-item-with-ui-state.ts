import { UiState } from '@sneat/dto';
import { IListItemBrief } from '@sneat/extension-prioritarius-contract';

export interface IListItemUiState extends UiState {
  readonly isChangingIsDone?: boolean;
}

export interface IListItemWithUiState {
  readonly brief: IListItemBrief;
  readonly state: IListItemUiState;
}
