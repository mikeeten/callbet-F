import { TestBed } from '@angular/core/testing';

import { ProfessionalService } from './professional-profile.service';

describe('ProfessionalProfileService', () => {
  let service: ProfessionalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfessionalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
