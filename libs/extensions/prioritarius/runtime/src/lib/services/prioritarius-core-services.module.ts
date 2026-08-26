import { NgModule } from '@angular/core';
import {
  IPrioritariusAppStateService,
  PrioritariusAppStateService,
} from './prioritarius-app-state.service';

// Provides the template UI-state service. The concrete ListService is no longer
// provided here — it is bound to the PRIORITARIUS_SERVICE contract token by
// providePrioritarius() at app bootstrap (the app is the composition root).
@NgModule({
  providers: [
    {
      provide: IPrioritariusAppStateService,
      useClass: PrioritariusAppStateService,
    },
  ],
})
export class PrioritariusCoreServicesModule {}
