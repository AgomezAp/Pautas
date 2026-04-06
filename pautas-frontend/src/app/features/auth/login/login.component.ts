import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Usuario</mat-label>
        <input matInput formControlName="username" autocomplete="username">
        <mat-icon matSuffix>person</mat-icon>
        @if (loginForm.get('username')?.hasError('required') && loginForm.get('username')?.touched) {
          <mat-error>El usuario es requerido</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Contraseña</mat-label>
        <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password" autocomplete="current-password">
        <button mat-icon-button matSuffix (click)="hidePassword = !hidePassword" type="button">
          <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        @if (loginForm.get('password')?.hasError('required') && loginForm.get('password')?.touched) {
          <mat-error>La contraseña es requerida</mat-error>
        }
      </mat-form-field>

      @if (errorMessage) {
        <div class="error-msg">{{ errorMessage }}</div>
      }

      <button mat-raised-button color="primary" type="submit" class="full-width login-btn"
              [disabled]="loginForm.invalid || isLoading">
        {{ isLoading ? 'Ingresando...' : 'Ingresar' }}
      </button>
    </form>
  `,
  styles: [`
    .full-width { width: 100%; }
    mat-form-field { margin-bottom: var(--space-2); }
    .login-btn {
      margin-top: var(--space-4);
      height: 48px;
      font-size: var(--text-md);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.3px;
    }
    .error-msg {
      color: var(--danger-dark);
      font-size: var(--text-sm);
      text-align: center;
      margin: var(--space-2) 0;
      padding: var(--space-2) var(--space-3);
      background: var(--danger-subtle);
      border: 1px solid var(--danger-light);
      border-radius: var(--radius-md);
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService,
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });

    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.authService.getRedirectUrl()]);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { username, password } = this.loginForm.value;
    this.authService.login(username, password).subscribe({
      next: () => {
        this.isLoading = false;
        this.notification.success('Bienvenido');
        this.router.navigate([this.authService.getRedirectUrl()]);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error?.message || 'Error al iniciar sesión';
      },
    });
  }
}
