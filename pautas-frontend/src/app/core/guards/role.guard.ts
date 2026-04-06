import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['roles'] as string[];
  const userRole = authService.userRole();

  if (userRole && allowedRoles.includes(userRole)) {
    return true;
  }

  const redirectUrl = authService.getRedirectUrl();
  router.navigate([redirectUrl]);
  return false;
};
