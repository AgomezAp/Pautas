import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        notification.error('No se puede conectar con el servidor');
      } else if (error.status === 403) {
        notification.error('No tiene permisos para realizar esta acción');
      } else if (error.status === 429) {
        notification.error('Demasiadas solicitudes. Intente de nuevo en un momento.');
      } else if (error.status >= 500) {
        notification.error('Error interno del servidor. Intente más tarde.');
      }
      return throwError(() => error);
    })
  );
};
