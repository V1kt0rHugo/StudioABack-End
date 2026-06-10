import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface NotificationEvent {
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

@Injectable()
export class NotificationsService {
  private readonly notification$ = new Subject<{ data: NotificationEvent }>();

  emit(notification: NotificationEvent) {
    this.notification$.next({ data: notification });
  }

  getStream(): Observable<{ data: NotificationEvent }> {
    return this.notification$.asObservable();
  }
}
