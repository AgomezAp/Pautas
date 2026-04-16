import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ROLE_LABELS } from '../../core/constants/app.constants';
import { SidebarComponent, NavItem } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { routeAnimation } from '../../config/route-animation';
import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-main-layout',
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  animations: [routeAnimation],
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  navItems: NavItem[] = [];
  roleLabel = '';
  userName = '';
  sidebarCollapsed = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private wsService: WebSocketService,
  ) {
    const role = this.authService.userRole();
    this.roleLabel = role ? ROLE_LABELS[role] || role : '';
    this.userName = this.authService.user()?.fullName || '';
    this.navItems = this.getNavItems(role);
  }

  ngOnInit(): void {
    this.wsService.connect();
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
  }

  logout(): void {
    this.wsService.disconnect();
    this.authService.logout();
  }

  getRouteState(outlet: RouterOutlet): string {
    return outlet?.isActivated
      ? (outlet.activatedRouteData?.['title'] || outlet.activatedRoute?.routeConfig?.path || '')
      : '';
  }

  private getNavItems(role: string | null): NavItem[] {
    switch (role) {
      case 'admin':
        return [
          { label: 'Dashboard', route: '/admin', icon: 'dashboard' },
          { label: 'Usuarios', route: '/admin/users', icon: 'people' },
          { label: 'Google Ads', route: '/admin/google-ads', icon: 'ads_click' },
          { label: 'Entradas Conglomerado', route: '/admin/conglomerado-entries', icon: 'assignment' },
          { label: 'Alertas', route: '/admin/alertas', icon: 'notifications_active' },
          { label: 'Ranking', route: '/admin/ranking', icon: 'emoji_events' },
          { label: 'Países', route: '/admin/countries', icon: 'public' },
        ];
      case 'conglomerado':
        return [
          { label: 'Entrada Diaria', route: '/conglomerado', icon: 'edit_note' },
          { label: 'Historial', route: '/conglomerado/history', icon: 'history' },
          { label: 'Resumen Semanal', route: '/conglomerado/weekly', icon: 'date_range' },
        ];
      case 'pautador':
        return [
          { label: 'Dashboard', route: '/pautadores', icon: 'dashboard' },
          { label: 'Entradas Diarias', route: '/pautadores/entries-daily', icon: 'view_list' },
          { label: 'Entradas Semanales', route: '/pautadores/entries-weekly', icon: 'date_range' },
          { label: 'Google Ads', route: '/pautadores/google-ads', icon: 'ads_click' },
          { label: 'Análisis de Datos', route: '/pautadores/google-ads-analysis', icon: 'insights' },
          { label: 'Vista Consolidada', route: '/pautadores/consolidated', icon: 'merge_type' },
          { label: 'Contraste', route: '/pautadores/conglomerado-contrast', icon: 'compare' },
          { label: 'Alertas', route: '/pautadores/alertas', icon: 'notifications_active' },
          { label: 'Ranking', route: '/pautadores/ranking', icon: 'emoji_events' },
        ];
      case 'gestion_administrativa':
        return [
          { label: 'Dashboard', route: '/gestion', icon: 'dashboard' },
          { label: 'Rotaciones', route: '/gestion/rotations', icon: 'autorenew' },
          { label: 'Registrar Conglomerado', route: '/gestion/registrar-conglomerado', icon: 'person_add' },
          { label: 'Cuentas Conglomerado', route: '/gestion/conglomerado-accounts', icon: 'link' },
          { label: 'Imágenes Soporte', route: '/gestion/soporte-images', icon: 'photo_library' },
          { label: 'Alertas', route: '/gestion/alertas', icon: 'notifications_active' },
        ];
      default:
        return [];
    }
  }
}
