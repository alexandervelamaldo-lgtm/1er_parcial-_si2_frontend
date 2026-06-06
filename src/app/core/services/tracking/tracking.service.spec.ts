import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { TrackingService } from './tracking.service';
import { AuthService } from '../autenticacion-acceso/auth.service';
import { TenantService } from '../tenant/tenant.service';

describe('TrackingService', () => {
  const originalWebSocket = (window as any).WebSocket;

  class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    static readonly OPEN = 1;
    static readonly CLOSING = 2;

    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((_: MessageEvent) => void) | null = null;

    readyState = 0;
    sentMessages: string[] = [];
    constructor(public readonly url: string) {
      FakeWebSocket.instances.push(this);
    }

    open() {
      this.readyState = 1;
      this.onopen?.();
    }

    close() {
      this.readyState = 3;
      this.onclose?.();
    }

    send(message: string) {
      this.sentMessages.push(message);
    }
  }

  beforeEach(async () => {
    FakeWebSocket.instances = [];
    (window as any).WebSocket = FakeWebSocket as any;

    await TestBed.configureTestingModule({
      providers: [
        TrackingService,
        {
          provide: AuthService,
          useValue: {
            getToken: () => 'test-token'
          }
        },
        {
          provide: TenantService,
          useValue: {
            getTenant: () => 'default'
          }
        }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    (window as any).WebSocket = originalWebSocket;
  });

  it('no reintenta reconectar tras un disconnect explícito', () => {
    const setTimeoutSpy = spyOn(window, 'setTimeout').and.callThrough();
    const service = TestBed.inject(TrackingService);

    service.connect();
    expect(FakeWebSocket.instances.length).toBe(1);

    service.disconnect();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('permite reconectar después de volver a llamar connect()', () => {
    const service = TestBed.inject(TrackingService);

    service.connect();
    service.disconnect();
    service.connect();

    expect(FakeWebSocket.instances.length).toBe(2);
  });

  it('expone eventos realtime de solicitud y KPI para refrescar la web', () => {
    const service = TestBed.inject(TrackingService);

    service.connect();
    const ws = FakeWebSocket.instances[0];

    ws.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'solicitud_update',
          solicitud_id: 7,
          estado: 'EN_CAMINO',
          taller_id: 3,
          tecnico_id: 9
        })
      })
    );
    ws.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'kpi_refresh'
        })
      })
    );

    expect(service.solicitudUpdate()).toEqual(
      jasmine.objectContaining({
        solicitud_id: 7,
        estado: 'EN_CAMINO',
        taller_id: 3,
        tecnico_id: 9
      })
    );
    expect(service.notificationRefreshVersion()).toBe(1);
    expect(service.kpiRefreshVersion()).toBe(1);
  });

  it('expone eventos de notificación dirigidos por usuario', () => {
    const service = TestBed.inject(TrackingService);

    service.connect();
    const ws = FakeWebSocket.instances[0];

    ws.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'notification_event',
          titulo: 'Pago confirmado',
          mensaje: 'La solicitud #15 ya fue pagada.',
          notification_type: 'PAGO_CONFIRMADO',
          url: '/solicitudes/15'
        })
      })
    );

    expect(service.notificationEvent()).toEqual(
      jasmine.objectContaining({
        titulo: 'Pago confirmado',
        notification_type: 'PAGO_CONFIRMADO',
        url: '/solicitudes/15'
      })
    );
    expect(service.notificationRefreshVersion()).toBe(1);
  });

  it('envia ping y espera pong para mantener la conexión viva', fakeAsync(() => {
    const service = TestBed.inject(TrackingService);

    service.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();

    tick(20_000);

    expect(ws.sentMessages.length).toBe(1);
    expect(JSON.parse(ws.sentMessages[0])).toEqual({ type: 'ping' });

    ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'pong' }) }));
    tick(10_000);

    expect(service.connected()).toBeTrue();
  }));
});
