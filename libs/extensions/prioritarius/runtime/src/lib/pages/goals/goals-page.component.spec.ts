import { TestBed } from '@angular/core/testing';
import { GoalsPageComponent } from './goals-page.component';

describe('GoalsPageComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [GoalsPageComponent],
    }),
  );

  it('renders the "No goals yet" empty state', () => {
    const fixture = TestBed.createComponent(GoalsPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain('No goals yet');
  });
});
