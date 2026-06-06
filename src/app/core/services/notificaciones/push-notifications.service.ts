import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EmergencyApiService } from '../gestion-solicitudes/emergency-api.service';


type PermissionStateLocal = 'granted' | 'denied' | 'default';


@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly api = inject(EmergencyApiService);
  private readonly router = inject(Router);

  private readonly storagePermissionKey = 'push.permission.state';
  private readonly storagePrePromptKey = 'push.permission.preprompt.shown';
  private readonly storageVapidKey = 'push.vapid.public_key';

  // #region debug-point A:web-push-client-report
  private debugReport(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
    fetch('http://127.0.0.1:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'web-push-missing',
        runId: 'pre-fix',
        hypothesisId,
        location,
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now()
      })
    }).catch(() => undefined);
  }
  // #endregion

  constructor() {
    if (this.getBrowserPermission() === 'granted') {
      void this.ensureSubscribed().catch(() => undefined);
    }
    window.addEventListener('online', this.handleOnline);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  getBrowserPermission(): PermissionStateLocal {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  getStoredPermission(): PermissionStateLocal | null {
    const raw = localStorage.getItem(this.storagePermissionKey);
    if (raw === 'granted' || raw === 'denied' || raw === 'default') return raw;
    return null;
  }

  private setStoredPermission(value: PermissionStateLocal) {
    localStorage.setItem(this.storagePermissionKey, value);
  }

  private hasShownPrePrompt(): boolean {
    return localStorage.getItem(this.storagePrePromptKey) === '1';
  }

  private markPrePromptShown() {
    localStorage.setItem(this.storagePrePromptKey, '1');
  }

  private getStoredVapidKey(): string | null {
    return localStorage.getItem(this.storageVapidKey);
  }

  private setStoredVapidKey(value: string) {
    localStorage.setItem(this.storageVapidKey, value);
  }

  private clearStoredVapidKey() {
    localStorage.removeItem(this.storageVapidKey);
  }

  async enable(): Promise<{ ok: boolean; reason?: string }> {
    // #region debug-point A:enable-entry
    this.debugReport('A', 'push-notifications.service.ts:enable', 'enable called', {
      supported: this.isSupported(),
      browserPermission: this.getBrowserPermission(),
      storedPermission: this.getStoredPermission()
    });
    // #endregion
    if (!this.isSupported()) {
      return { ok: false, reason: 'El navegador no soporta notificaciones push.' };
    }

    const currentPermission = this.getBrowserPermission();
    if (currentPermission === 'denied') {
      this.setStoredPermission('denied');
      return { ok: false, reason: 'Permiso denegado en el navegador.' };
    }

    if (currentPermission !== 'granted') {
      if (!this.hasShownPrePrompt()) {
        this.markPrePromptShown();
        const accepted = window.confirm(
          'Activar notificaciones te permite recibir alertas de solicitudes, asignaciones y pagos incluso con la app en segundo plano.\n\n¿Querés habilitarlas ahora?'
        );
        if (!accepted) {
          this.setStoredPermission('default');
          return { ok: false, reason: 'El usuario canceló la solicitud de permiso.' };
        }
      }

      const permission = await Notification.requestPermission();
      this.setStoredPermission(permission);
      if (permission !== 'granted') {
        return { ok: false, reason: 'Permiso no concedido.' };
      }
    } else {
      this.setStoredPermission('granted');
    }

    try {
      await this.ensureSubscribed();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: this.describeSubscriptionError(err) };
    }
  }

  async disable(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      await this.unsubscribeFromBrowser();
    } finally {
      this.clearStoredVapidKey();
      await firstValueFrom(this.api.unsubscribeWebPush());
    }
  }

  async ensureSubscribed(): Promise<void> {
    const keyResponse = await firstValueFrom(this.api.getWebPushPublicKey());
    const currentVapidKey = keyResponse.publicKey;
    const registration = await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const storedVapidKey = this.getStoredVapidKey();
    // #region debug-point A:ensure-state
    this.debugReport('A', 'push-notifications.service.ts:ensureSubscribed', 'ensure subscribed state evaluated', {
      hasExistingSubscription: Boolean(existing),
      storedVapidKey: storedVapidKey ? `${storedVapidKey.slice(0, 12)}...` : null,
      currentVapidKey: currentVapidKey ? `${currentVapidKey.slice(0, 12)}...` : null,
      permission: this.getBrowserPermission()
    });
    // #endregion

    if (existing && storedVapidKey === currentVapidKey) {
      await this.sendSubscription(existing);
      return;
    }

    if (existing) {
      await existing.unsubscribe();
    }

    const applicationServerKey = this.urlBase64ToUint8Array(currentVapidKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    await this.sendSubscription(subscription);
    this.setStoredVapidKey(currentVapidKey);
  }

  async notifyInForeground(title: string, body: string, url?: string) {
    if (!this.isSupported()) return;
    if (Notification.permission !== 'granted') return;
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      data: { url: url || '/' }
    } as NotificationOptions);
    notification.onclick = () => {
      const targetUrl = (notification as any).data?.url;
      if (typeof targetUrl === 'string') {
        void this.router.navigateByUrl(targetUrl);
      }
    };
  }

  private async unsubscribeFromBrowser(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await subscription.unsubscribe();
  }

  private async sendSubscription(subscription: PushSubscription) {
    const json = subscription.toJSON();
    const payload = {
      endpoint: json.endpoint as string,
      expirationTime: json.expirationTime ? String(json.expirationTime) : null,
      keys: {
        p256dh: (json.keys as any)?.p256dh as string,
        auth: (json.keys as any)?.auth as string
      },
      userAgent: navigator.userAgent
    };
    // #region debug-point A:send-subscription
    this.debugReport('A', 'push-notifications.service.ts:sendSubscription', 'sending web push subscription to backend', {
      endpointSuffix: payload.endpoint ? payload.endpoint.slice(-24) : '',
      hasP256dh: Boolean(payload.keys.p256dh),
      hasAuth: Boolean(payload.keys.auth),
      userAgent: payload.userAgent
    });
    // #endregion
    await firstValueFrom(this.api.subscribeWebPush(payload));
  }

  private describeSubscriptionError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const detail =
        typeof err.error?.detail === 'string'
          ? err.error.detail
          : typeof err.error === 'string'
            ? err.error
            : null;
      if (detail) {
        return `No se pudo registrar la suscripción: ${detail}`;
      }
      return `No se pudo registrar la suscripción (HTTP ${err.status || 0}).`;
    }
    if (err instanceof Error && err.message.trim()) {
      return `No se pudo registrar la suscripción: ${err.message}`;
    }
    return 'No se pudo registrar la suscripción.';
  }

  private readonly handleOnline = () => {
    if (this.getBrowserPermission() === 'granted') {
      void this.ensureSubscribed().catch(() => undefined);
    }
  };

  private readonly handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    if (this.getBrowserPermission() === 'granted') {
      void this.ensureSubscribed().catch(() => undefined);
    }
  };

  private urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
