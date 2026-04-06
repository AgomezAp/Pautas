import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-logo">P</span>
          <h1>Pautas</h1>
          <p>Plataforma de Gestión de Campañas</p>
        </div>
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--brand-primary);
      background-image:
        radial-gradient(ellipse at 20% 50%, rgba(255,214,0,0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 50%, rgba(255,214,0,0.04) 0%, transparent 50%);
    }
    .auth-card {
      background: var(--gray-0);
      border-radius: var(--radius-xl);
      padding: var(--space-12) var(--space-10);
      width: 100%;
      max-width: 420px;
      box-shadow: var(--shadow-xl);
      border-top: 3px solid var(--brand-accent);
    }
    .auth-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: var(--space-8);
    }
    .auth-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: var(--brand-accent);
      color: var(--brand-primary);
      font-weight: var(--weight-bold);
      font-size: var(--text-xl);
      border-radius: var(--radius-lg);
      margin-bottom: var(--space-4);
    }
    .auth-header h1 {
      font-size: var(--text-2xl);
      font-weight: var(--weight-bold);
      color: var(--gray-900);
      margin: 0 0 var(--space-1);
      letter-spacing: var(--tracking-tight);
    }
    .auth-header p {
      color: var(--gray-500);
      margin: 0;
      font-size: var(--text-sm);
    }
  `]
})
export class AuthLayoutComponent {}
