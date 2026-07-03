import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { environment } from '../../../../environments/environment';
import { EmergencyApiService } from '../gestion-solicitudes/emergency-api.service';

type PermissionStateLocal = 'granted' | 'denied' | 'default';

@Injectable({ providedIn: 'root' })
export class FcmNotificationsService {
  private readonly api = inject(EmergencyApiService);
  private readonly router = inject(Router);

  private readonly storagePermissionKey = 'fcm.permission.state';
  private readonly storagePrePromptKey = 'fcm.permission.preprompt.shown';
  private readonly storageTokenKey = 'fcm.token';

  private appInitialized = false;
  private foregroundBound = false;

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window &&
      typeof Notification.requestPermission === 'function'
    );
  }

  getBrowserPermission(): PermissionStateLocal {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  private getStoredPermission(): PermissionStateLocal | null {
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

  private ensureFirebaseInit(): void {
    if (this.appInitialized) return;
    const cfg = environment.firebase;
    if (!cfg?.apiKey || !cfg?.projectId || !cfg?.messagingSenderId || !cfg?.appId) {
      throw new Error('Falta configurar Firebase (environment.firebase).');
    }
    initializeApp(cfg);
    this.appInitialized = true;
  }

  async enable(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.isSupported()) {
      return { ok: false, reason: 'El navegador no soporta notificaciones.' };
    }

    const canUseFcm = await isSupported().catch(() => false);
    if (!canUseFcm) {
      return { ok: false, reason: 'FCM no está soportado en este navegador.' };
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
          'Activar notificaciones te permite recibir alertas críticas de nuevas incidencias incluso con la app en segundo plano.\n\n¿Querés habilitarlas ahora?'
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
    } catch (e: any) {
      return { ok: false, reason: typeof e?.message === 'string' ? e.message : 'No se pudo habilitar FCM.' };
    }
  }

  async disable(): Promise<void> {
    const token = localStorage.getItem(this.storageTokenKey);
    localStorage.removeItem(this.storageTokenKey);
    if (token) {
      await firstValueFrom(this.api.unregisterDeviceToken(token));
    }
  }

  async ensureSubscribed(): Promise<void> {
    this.ensureFirebaseInit();

    if (!environment.firebaseVapidKey) {
      throw new Error('Falta firebaseVapidKey en environments.');
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging();

    const token =
      localStorage.getItem(this.storageTokenKey) ||
      (await getToken(messaging, {
        vapidKey: environment.firebaseVapidKey,
        serviceWorkerRegistration: registration
      }));

    if (!token) throw new Error('No se pudo obtener token FCM.');
    localStorage.setItem(this.storageTokenKey, token);
    await firstValueFrom(this.api.registrarDeviceToken(token, 'web'));

    this.bindForegroundNotifications();
  }

  private bindForegroundNotifications(): void {
    if (this.foregroundBound) return;
    this.foregroundBound = true;

    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      if (!this.isSupported()) return;
      if (Notification.permission !== 'granted') return;

      const title = payload?.notification?.title || 'Alerta de emergencia';
      const body =
        payload?.notification?.body ||
        ((payload?.data as any)?.['body'] as string | undefined) ||
        'Nueva incidencia registrada.';
      const url = (payload?.data as any)?.url || '/';

      const n = new Notification(title, {
        body,
        icon: '/alert-icon.svg',
        badge: '/alert-icon.svg',
        tag: 'emergency',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url }
      } as NotificationOptions);

      n.onclick = () => {
        const targetUrl = (n as any).data?.url;
        if (typeof targetUrl === 'string') {
          void this.router.navigateByUrl(targetUrl);
        }
      };
    });
  }
}
