import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface Neighborhood {
  id: number;
  subCityId: number;
  subCityName?: string;
  name: string;
}

export interface SubCity {
  id: number;
  name: string;
  neighborhoodsCount?: number;
  neighborhoods?: Neighborhood[];
}

export interface Address {
  id?: string;
  userId?: string;
  neighborhoodId: number;
  subCityId?: number;
  subCityName?: string;
  neighborhoodName?: string;
  label?: string;            // 'Home', 'Office', 'Site'
  landmark?: string;         // 'Green gate behind bakery'
  primaryPhone?: string;     // '+251 91 123 4567'
  street?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);
  private locationApi = 'http://localhost:5189/api/location';
  private customerApi = 'http://localhost:5189/api/customer';

  // Reactive state for SubCities and user's saved addresses
  subCities = signal<SubCity[]>([]);
  myAddresses = signal<Address[]>([]);
  loading = signal<boolean>(false);

  // 1. Fetch all 11 SubCities with nested neighborhoods
  loadSubCities(): Observable<SubCity[]> {
    return this.http.get<SubCity[]>(`${this.locationApi}/subcities`).pipe(
      tap((data) => this.subCities.set(data))
    );
  }

  // 2. Fetch Neighborhoods by SubCity ID
  getNeighborhoodsBySubCity(subCityId: number): Observable<Neighborhood[]> {
    return this.http.get<Neighborhood[]>(`${this.locationApi}/subcities/${subCityId}/neighborhoods`);
  }

  // 3. User Address CRUD
  loadMyAddresses(): Observable<Address[]> {
    this.loading.set(true);
    return this.http.get<Address[]>(`${this.customerApi}/addresses`).pipe(
      tap({
        next: (addresses) => {
          this.myAddresses.set(addresses || []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      })
    );
  }

  addAddress(address: Partial<Address>): Observable<{ message: string; id: string }> {
    return this.http.post<{ message: string; id: string }>(`${this.customerApi}/address`, address).pipe(
      tap(() => this.loadMyAddresses().subscribe())
    );
  }

  updateAddress(id: string, address: Partial<Address>): Observable<any> {
    return this.http.put(`${this.customerApi}/address/${id}`, address).pipe(
      tap(() => this.loadMyAddresses().subscribe())
    );
  }

  deleteAddress(id: string): Observable<any> {
    return this.http.delete(`${this.customerApi}/address/${id}`).pipe(
      tap(() => this.loadMyAddresses().subscribe())
    );
  }

  // 4. GPS / Geolocation Helper
  getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    });
  }
}
