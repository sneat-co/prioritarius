import { TestBed } from '@angular/core/testing';
import { MapsPageComponent } from './maps-page.component';

describe('MapsPageComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [MapsPageComponent],
    }),
  );

  it('renders the "No goals maps yet" empty state', () => {
    const fixture = TestBed.createComponent(MapsPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain(
      'No goals maps yet',
    );
  });
});
