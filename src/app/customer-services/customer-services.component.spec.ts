import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerServicesComponent } from './customer-services.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('CustomerServicesComponent', () => {
  let component: CustomerServicesComponent;
  let fixture: ComponentFixture<CustomerServicesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerServicesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
