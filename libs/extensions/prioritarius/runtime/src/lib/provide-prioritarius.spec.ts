import { PRIORITARIUS_SERVICE } from '@sneat/extension-prioritarius-contract';
import { ListService } from './services';
import { providePrioritarius } from './provide-prioritarius';

describe('providePrioritarius', () => {
  it('provides ListService and binds it to PRIORITARIUS_SERVICE', () => {
    const providers = providePrioritarius();
    expect(providers).toContain(ListService);
    expect(providers).toContainEqual({
      provide: PRIORITARIUS_SERVICE,
      useExisting: ListService,
    });
  });
});
