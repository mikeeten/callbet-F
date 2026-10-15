import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminServiceZonesComponent } from './admin-service-zones.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('AdminServiceZonesComponent', () => {
  let component: AdminServiceZonesComponent;
  let fixture: ComponentFixture<AdminServiceZonesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminServiceZonesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminServiceZonesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
