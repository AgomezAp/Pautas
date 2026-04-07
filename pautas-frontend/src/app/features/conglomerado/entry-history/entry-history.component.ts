import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ConglomeradoService } from '../conglomerado.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-entry-history',
  imports: [CommonModule, IconComponent],
  templateUrl: './entry-history.component.html',
  styleUrl: './entry-history.component.scss',
})
export class EntryHistoryComponent implements OnInit {
  displayedColumns = ['entry_date', 'clientes', 'clientes_efectivos', 'menores', 'iso_week', 'soporte'];
  entries: any[] = [];

  fullImageUrl: string | null = null;
  private backendBase: string;

  constructor(
    private conglomeradoService: ConglomeradoService,
    private authService: AuthService,
  ) {
    this.backendBase = environment.apiUrl.replace('/api/v1', '');
  }

  ngOnInit(): void {
    this.conglomeradoService.getEntries().subscribe(res => {
      this.entries = res.data;
    });
  }

  getImageUrl(imagePath: string): string {
    const token = this.authService.getToken();
    return `${this.backendBase}/${imagePath}?token=${token}`;
  }

  openImage(imagePath: string): void {
    this.fullImageUrl = this.getImageUrl(imagePath);
  }

  closeImage(): void {
    this.fullImageUrl = null;
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
