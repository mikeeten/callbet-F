import { Component, Input, Output, EventEmitter, inject, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-map-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    @if (isOpen) {
      <div class="map-modal-overlay" (click)="onBackdropClick($event)">
        <div class="map-modal-dialog" (click)="$event.stopPropagation()">
          <!-- Modal Header -->
          <div class="map-modal-header">
            <div class="header-info">
              <div class="icon-bubble">
                <mat-icon>pin_drop</mat-icon>
              </div>
              <div>
                <h3 class="modal-title">{{ title || 'Location Map' }}</h3>
                @if (subtitle) {
                  <p class="modal-subtitle">{{ subtitle }}</p>
                }
              </div>
            </div>
            <button type="button" class="close-btn" (click)="onClose()" title="Close map">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Interactive Google Map Iframe -->
          <div class="map-frame-container">
            @if (safeMapUrl) {
              <iframe
                [src]="safeMapUrl"
                class="google-map-iframe"
                loading="lazy"
                allowfullscreen
                referrerpolicy="no-referrer-when-downgrade"
                title="Google Map View"
              ></iframe>
            } @else {
              <div class="no-coords">
                <mat-icon>location_off</mat-icon>
                <p>Coordinates not available for this location.</p>
              </div>
            }
          </div>

          <!-- Modal Footer & External Redirect -->
          <div class="map-modal-footer">
            <div class="coords-tag">
              <mat-icon>my_location</mat-icon>
              <span>{{ latitude?.toFixed(6) }}, {{ longitude?.toFixed(6) }}</span>
            </div>

            <div class="footer-actions">
              <button
                type="button"
                mat-stroked-button
                (click)="copyCoordinates()"
                class="copy-btn"
              >
                <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
                <span>{{ copied ? 'Copied!' : 'Copy Coords' }}</span>
              </button>

              <a
                [href]="googleMapsRedirectUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="redirect-btn"
                mat-raised-button
                color="primary"
              >
                <mat-icon>open_in_new</mat-icon>
                <span>Open in Google Maps</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .map-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(6px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.2s ease-out;
    }

    .map-modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 780px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .map-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;

      .header-info {
        display: flex;
        align-items: center;
        gap: 0.85rem;

        .icon-bubble {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #e0e7ff;
          color: #4338ca;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .modal-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
        }

        .modal-subtitle {
          margin: 2px 0 0;
          font-size: 0.82rem;
          color: #64748b;
        }
      }

      .close-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        transition: all 0.15s;

        &:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
      }
    }

    .map-frame-container {
      width: 100%;
      height: 420px;
      position: relative;
      background: #e2e8f0;

      .google-map-iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }

      .no-coords {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #64748b;
        gap: 0.5rem;

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #94a3b8;
        }
      }
    }

    .map-modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      flex-wrap: wrap;
      gap: 0.75rem;

      .coords-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0.35rem 0.75rem;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.82rem;
        font-family: monospace;
        font-weight: 600;
        color: #334155;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #4f46e5;
        }
      }

      .footer-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .copy-btn {
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .redirect-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          border-radius: 8px;
          padding: 0 1rem;
          height: 38px;
          text-decoration: none;
          background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);

          &:hover {
            opacity: 0.95;
            box-shadow: 0 6px 12px -2px rgba(79, 70, 229, 0.3);
          }
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (max-width: 640px) {
      .map-frame-container {
        height: 320px;
      }
      .map-modal-footer {
        flex-direction: column;
        align-items: stretch;

        .footer-actions {
          justify-content: flex-end;
        }
      }
    }
  `]
})
export class MapModalComponent implements OnChanges {
  private sanitizer = inject(DomSanitizer);

  @Input() isOpen = false;
  @Input() latitude?: number | null;
  @Input() longitude?: number | null;
  @Input() title = 'Location Map';
  @Input() subtitle = '';

  @Output() close = new EventEmitter<void>();

  safeMapUrl: SafeResourceUrl | null = null;
  copied = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['latitude'] || changes['longitude'] || changes['isOpen']) {
      this.updateMapUrl();
    }
  }

  private updateMapUrl(): void {
    if (this.latitude !== undefined && this.latitude !== null && this.longitude !== undefined && this.longitude !== null) {
      const url = `https://maps.google.com/maps?q=${this.latitude},${this.longitude}&hl=en&z=16&output=embed`;
      this.safeMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    } else {
      this.safeMapUrl = null;
    }
  }

  get googleMapsRedirectUrl(): string {
    if (this.latitude !== undefined && this.latitude !== null && this.longitude !== undefined && this.longitude !== null) {
      return `https://www.google.com/maps/search/?api=1&query=${this.latitude},${this.longitude}`;
    }
    return 'https://maps.google.com';
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    this.onClose();
  }

  copyCoordinates(): void {
    if (this.latitude && this.longitude) {
      const text = `${this.latitude}, ${this.longitude}`;
      navigator.clipboard.writeText(text).then(() => {
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      });
    }
  }
}
