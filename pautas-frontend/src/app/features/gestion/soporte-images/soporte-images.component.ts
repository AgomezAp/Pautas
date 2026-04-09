import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { GestionService } from '../gestion.service';
import { CountryService } from '../../../core/services/country.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Country } from '../../../core/models/country.model';
import { environment } from '../../../../environments/environment';
import { IconComponent } from '../../../shared/components/icon/icon.component';

interface EntryImage {
  id: number;
  image_path: string;
  original_name: string;
  thumb_path: string | null;
}

interface EntryGroup {
  entry_id: number;
  entry_date: string;
  clientes: number;
  clientes_efectivos: number;
  menores: number;
  images: EntryImage[];
}

interface MonthGroup {
  key: string;
  label: string;
  days: EntryGroup[];
}

interface UserFolder {
  user_id: number;
  full_name: string;
  username: string;
  country_name: string;
  total_images: number;
  months: MonthGroup[];
  collapsed: boolean;
}

@Component({
  selector: 'app-soporte-images',
  imports: [
    CommonModule, FormsModule, NgbCollapseModule, IconComponent,
  ],
  templateUrl: './soporte-images.component.html',
  styleUrl: './soporte-images.component.scss',
})
export class SoporteImagesComponent implements OnInit {
  users: UserFolder[] = [];
  countries: Country[] = [];
  loading = false;

  countryId: number | null = null;
  dateFrom = '';
  dateTo = '';
  search = '';

  lightboxUrl: string | null = null;
  lightboxImages: EntryImage[] = [];
  lightboxIndex = 0;
  resettingEntryId: number | null = null;

  private backendBase: string;

  constructor(
    private gestionService: GestionService,
    private countryService: CountryService,
    private authService: AuthService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {
    this.backendBase = environment.apiUrl.replace('/api/v1', '');
  }

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    const params: any = {};
    if (this.countryId) params.country_id = this.countryId;
    if (this.dateFrom) params.date_from = this.dateFrom;
    if (this.dateTo) params.date_to = this.dateTo;
    if (this.search) params.search = this.search;

    this.gestionService.getEntriesWithImages(params).subscribe({
      next: (res) => {
        this.users = (res.data || []).map((u: any) => this.buildUserFolder(u));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildUserFolder(raw: any): UserFolder {
    const entries: EntryGroup[] = raw.entries || [];
    const monthsMap = new Map<string, EntryGroup[]>();

    for (const entry of entries) {
      const d = new Date(entry.entry_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthsMap.has(key)) monthsMap.set(key, []);
      monthsMap.get(key)!.push(entry);
    }

    const months: MonthGroup[] = Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, days]) => ({
        key,
        label: this.formatMonthLabel(key),
        days: days.sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
      }));

    return {
      user_id: raw.user_id,
      full_name: raw.full_name,
      username: raw.username,
      country_name: raw.country_name,
      total_images: raw.total_images || 0,
      months,
      collapsed: true,
    };
  }

  private formatMonthLabel(key: string): string {
    const [year, month] = key.split('-');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  formatDay(dateStr: string): string {
    const d = new Date(dateStr);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()}`;
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    const token = this.authService.getToken();
    return `${this.backendBase}/${imagePath}?token=${token}`;
  }

  getThumbUrl(img: EntryImage): string {
    const path = img.thumb_path || img.image_path;
    return this.getImageUrl(path);
  }

  openLightbox(images: EntryImage[], index: number): void {
    this.lightboxImages = images;
    this.lightboxIndex = index;
    this.lightboxUrl = this.getImageUrl(images[index].image_path);
    this.cdr.detectChanges();
  }

  closeLightbox(): void {
    this.lightboxUrl = null;
    this.lightboxImages = [];
    this.lightboxIndex = 0;
    this.cdr.detectChanges();
  }

  prevImage(): void {
    if (this.lightboxIndex > 0) {
      this.lightboxIndex--;
      this.lightboxUrl = this.getImageUrl(this.lightboxImages[this.lightboxIndex].image_path);
      this.cdr.detectChanges();
    }
  }

  nextImage(): void {
    if (this.lightboxIndex < this.lightboxImages.length - 1) {
      this.lightboxIndex++;
      this.lightboxUrl = this.getImageUrl(this.lightboxImages[this.lightboxIndex].image_path);
      this.cdr.detectChanges();
    }
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4=';
  }

  applyFilters(): void {
    this.loadData();
  }

  clearFilters(): void {
    this.countryId = null;
    this.dateFrom = '';
    this.dateTo = '';
    this.search = '';
    this.loadData();
  }

  toggleUser(user: UserFolder): void {
    user.collapsed = !user.collapsed;
  }

  confirmResetEntry(day: EntryGroup, userName: string): void {
    const confirmed = confirm(
      `¿Está seguro que desea resetear la entrada del día ${this.formatDay(day.entry_date)} de "${userName}"?\n\nEsta acción eliminará la entrada y sus imágenes permanentemente. El usuario podrá volver a enviar datos para este día.`
    );
    if (confirmed) {
      this.doResetEntry(day.entry_id);
    }
  }

  private doResetEntry(entryId: number): void {
    this.resettingEntryId = entryId;
    this.cdr.detectChanges();
    this.gestionService.resetEntry(entryId).subscribe({
      next: () => {
        this.notification.success('Entrada reseteada exitosamente. El usuario puede volver a enviar sus datos.');
        this.resettingEntryId = null;
        this.loadData();
      },
      error: (err: any) => {
        this.notification.error(err.error?.error?.message || 'Error al resetear la entrada');
        this.resettingEntryId = null;
        this.cdr.detectChanges();
      },
    });
  }
}
