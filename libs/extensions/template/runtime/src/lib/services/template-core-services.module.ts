import { NgModule } from '@angular/core';
import {
  ITemplateAppStateService,
  TemplateAppStateService,
} from './template-app-state.service';

// Provides the template UI-state service. The concrete ListService is no longer
// provided here — it is bound to the TEMPLATE_SERVICE contract token by
// provideTemplate() at app bootstrap (the app is the composition root).
@NgModule({
  providers: [
    {
      provide: ITemplateAppStateService,
      useClass: TemplateAppStateService,
    },
  ],
})
export class TemplateCoreServicesModule {}
