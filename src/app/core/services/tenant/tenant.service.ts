import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly storageKey = 'tenant_key';
  readonly tenantKey = signal<string>(this.getStoredTenant());

  setTenant(key: string) {
    const value = (key || '').trim() || 'default';
    // El marcador "*" es solo del super-admin durante su sesión activa;
    // si por algún motivo intenta persistirse, lo reemplazamos por
    // 'default' — guardarlo significaría que cualquier request normal
    // mandaría `X-Tenant: *` y el backend lo rechazaría como mismatch.
    const safe = value === '*' ? 'default' : value;
    localStorage.setItem(this.storageKey, safe);
    this.tenantKey.set(safe);
  }

  /** Reset al valor por defecto. Se llama en logout para que la próxima
   *  sesión NO arrastre el tenant del usuario anterior. Sin esto, un
   *  super-admin → operador hereda el `*` viejo y rompe las requests. */
  reset(): void {
    localStorage.removeItem(this.storageKey);
    this.tenantKey.set('default');
  }

  getTenant(): string {
    return this.tenantKey();
  }

  private getStoredTenant(): string {
    const raw = localStorage.getItem(this.storageKey);
    const value = (raw || '').trim() || 'default';
    // Migration de tokens viejos: si encontramos "*" persistido (bug
    // pre-fix), lo normalizamos a 'default'. Quien necesite re-elegir
    // tenant lo hará al loguearse — el backend manda el tenant_key
    // correcto en el response.
    const safe = value === '*' ? 'default' : value;
    // Auto-sanación: si lo que había guardado era inválido ("*"), lo
    // reescribimos limpio AHORA. Sin esto, el localStorage conserva el
    // "*" viejo aunque el signal en memoria sea 'default' — y cualquier
    // lectura directa (o un re-boot raro) podría volver a leer basura.
    // Así el usuario NO necesita limpiar localStorage a mano: con solo
    // recargar la página con el código nuevo, el "*" queda eliminado.
    if (safe !== value) {
      localStorage.setItem(this.storageKey, safe);
    }
    return safe;
  }
}

