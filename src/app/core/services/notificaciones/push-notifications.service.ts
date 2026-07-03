import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../autenticacion-acceso/auth.service';
import { EmergencyApiService } from '../gestion-solicitudes/emergency-api.service';


type PermissionStateLocal = 'granted' | 'denied' | 'default';


@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly api = inject(EmergencyApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly storagePermissionKey = 'push.permission.state';
  private readonly storagePrePromptKey = 'push.permission.preprompt.shown';
  private readonly storageVapidKey = 'push.vapid.public_key';
  private ensureSubscribedInFlight: Promise<void> | null = null;

  // #region debug-point A:web-push-client-report
  private debugReport(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
    const debugServerUrl = this.getDebugServerUrl();
    if (!debugServerUrl) return;
    fetch(debugServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'solicitudes-runtime-errors',
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

  private getDebugServerUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('debugServerUrl')?.trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : null;
  }

  constructor() {
    // #region debug-point A:constructor-state
    this.debugReport('A', 'push-notifications.service.ts:constructor', 'push notifications service initialized', {
      hasAuthenticatedSession: this.hasAuthenticatedSession(),
      browserPermission: this.getBrowserPermission(),
      isSupported: this.isSupported()
    });
    // #endregion
    if (this.hasAuthenticatedSession() && this.getBrowserPermission() === 'granted') {
      this.ensureSubscribedQuietly('constructor');
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

  enable(): Promise<{ ok: boolean; reason?: string }> {
    // #region debug-point A:enable-entry
    this.debugReport('A', 'push-notifications.service.ts:enable', 'enable called', {
      supported: this.isSupported(),
      browserPermission: this.getBrowserPermission(),
      storedPermission: this.getStoredPermission()
    });
    // #endregion
    if (!this.isSupported()) {
      return Promise.resolve({ ok: false, reason: 'El navegador no soporta notificaciones push.' });
    }

    const currentPermission = this.getBrowserPermission();
    if (currentPermission === 'denied') {
      this.setStoredPermission('denied');
      return Promise.resolve({ ok: false, reason: 'Permiso denegado en el navegador.' });
    }

    if (currentPermission !== 'granted') {
      if (!this.hasShownPrePrompt()) {
        this.markPrePromptShown();
        const accepted = window.confirm(
          'Activar notificaciones te permite recibir alertas de solicitudes, asignaciones y pagos incluso con la app en segundo plano.\n\n¿Querés habilitarlas ahora?'
        );
        if (!accepted) {
          this.setStoredPermission('default');
          return Promise.resolve({ ok: false, reason: 'El usuario canceló la solicitud de permiso.' });
        }
      }

      return Notification.requestPermission().then((permission) => {
        this.setStoredPermission(permission);
        if (permission !== 'granted') {
          return { ok: false, reason: 'Permiso no concedido.' };
        }
        return this.ensureSubscribed()
          .then(() => ({ ok: true }))
          .catch((err) => ({ ok: false, reason: this.describeSubscriptionError(err) }));
      });
    } else {
      this.setStoredPermission('granted');
    }

    return this.ensureSubscribed()
      .then(() => ({ ok: true }))
      .catch((err) => ({ ok: false, reason: this.describeSubscriptionError(err) }));
  }

  disable(): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();
    return this.unsubscribeFromBrowser()
      .catch(() => undefined)
      .then(() => {
        this.clearStoredVapidKey();
        return firstValueFrom(this.api.unsubscribeWebPush()).catch(() => undefined);
      })
      .then(() => undefined);
  }

  ensureSubscribed(): Promise<void> {
    if (this.ensureSubscribedInFlight) {
      return this.ensureSubscribedInFlight;
    }

    this.ensureSubscribedInFlight = this.ensureSubscribedInternal().finally(() => {
      this.ensureSubscribedInFlight = null;
    });
    return this.ensureSubscribedInFlight;
  }

  private ensureSubscribedInternal(): Promise<void> {
    if (!this.hasAuthenticatedSession()) {
      // #region debug-point A:ensure-skipped
      this.debugReport('A', 'push-notifications.service.ts:ensureSubscribed', 'ensureSubscribed skipped because session is not authenticated', {
        hasAuthenticatedSession: false
      });
      // #endregion
      return Promise.resolve();
    }

    return firstValueFrom(this.api.getWebPushPublicKey())
      .then((keyResponse) => {
        const currentVapidKey = keyResponse.publicKey;
        return navigator.serviceWorker
          .register('/push-sw.js')
          .then((registration) =>
            navigator.serviceWorker.ready.then(() => ({ registration, currentVapidKey }))
          );
      })
      .then(({ registration, currentVapidKey }) =>
        registration.pushManager.getSubscription().then((existing) => ({
          registration,
          existing,
          currentVapidKey,
          storedVapidKey: this.getStoredVapidKey()
        }))
      )
      .then(({ registration, existing, currentVapidKey, storedVapidKey }) => {
        // #region debug-point A:ensure-state
        this.debugReport('A', 'push-notifications.service.ts:ensureSubscribed', 'ensure subscribed state evaluated', {
          hasExistingSubscription: Boolean(existing),
          storedVapidKey: storedVapidKey ? `${storedVapidKey.slice(0, 12)}...` : null,
          currentVapidKey: currentVapidKey ? `${currentVapidKey.slice(0, 12)}...` : null,
          permission: this.getBrowserPermission()
        });
        // #endregion

        if (existing && storedVapidKey === currentVapidKey) {
          return this.sendSubscription(existing);
        }

        const subscribe = () => {
          const applicationServerKey = this.urlBase64ToUint8Array(currentVapidKey);
          return registration.pushManager
            .subscribe({
              userVisibleOnly: true,
              applicationServerKey
            })
            .then((subscription) => this.sendSubscription(subscription))
            .then(() => {
              this.setStoredVapidKey(currentVapidKey);
              // #region debug-point A:ensure-complete
              this.debugReport('A', 'push-notifications.service.ts:ensureSubscribed', 'subscription ensured successfully', {
                storedVapidKey: currentVapidKey ? `${currentVapidKey.slice(0, 12)}...` : null
              });
              // #endregion
            });
        };

        if (!existing) {
          return subscribe();
        }

        return existing.unsubscribe().then(() => subscribe());
      });
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

  private unsubscribeFromBrowser(): Promise<void> {
    return navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      return registration.pushManager.getSubscription().then((subscription) => {
        if (!subscription) return;
        return subscription.unsubscribe().then(() => undefined);
      });
    });
  }

  private sendSubscription(subscription: PushSubscription): Promise<void> {
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
    return firstValueFrom(this.api.subscribeWebPush(payload)).then(() => undefined);
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
    if (this.hasAuthenticatedSession() && this.getBrowserPermission() === 'granted') {
      this.ensureSubscribedQuietly('online');
    }
  };

  private readonly handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    if (this.hasAuthenticatedSession() && this.getBrowserPermission() === 'granted') {
      this.ensureSubscribedQuietly('visibilitychange');
    }
  };

  private ensureSubscribedQuietly(source: string) {
    void this.ensureSubscribed().catch((err) => {
      this.debugReport('A', 'push-notifications.service.ts:ensureSubscribedQuietly', 'background ensureSubscribed failed', {
        source,
        message: err instanceof Error ? err.message : String(err ?? ''),
      });
    });
  }

  private hasAuthenticatedSession(): boolean {
    return this.auth.isAuthenticated() && !!this.auth.getToken();
  }

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
