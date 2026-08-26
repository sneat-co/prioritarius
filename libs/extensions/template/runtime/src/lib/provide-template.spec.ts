import { TEMPLATE_SERVICE } from '@sneat/extension-template-contract';
import { ListService } from './services';
import { provideTemplate } from './provide-template';

describe('provideTemplate', () => {
  it('provides ListService and binds it to TEMPLATE_SERVICE', () => {
    const providers = provideTemplate();
    expect(providers).toContain(ListService);
    expect(providers).toContainEqual({
      provide: TEMPLATE_SERVICE,
      useExisting: ListService,
    });
  });
});
