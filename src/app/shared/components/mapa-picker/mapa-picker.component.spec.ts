import { TestBed } from '@angular/core/testing';

import { MapaPickerComponent } from './mapa-picker.component';
import { MapboxService } from '../../../core/services/mapa/mapbox.service';

describe('MapaPickerComponent', () => {
  beforeEach(async () => {
    (window as any).IntersectionObserver = class {
      constructor(_: any) {}
      observe() {}
      disconnect() {}
    };
    (window as any).ResizeObserver = class {
      constructor(_: any) {}
      observe(_: any) {}
      disconnect() {}
    };

    await TestBed.configureTestingModule({
      imports: [MapaPickerComponent],
      providers: [
        {
          provide: MapboxService,
          useValue: {
            reverseGeocode: () => Promise.resolve(''),
            search: () => Promise.resolve([]),
            route: () => Promise.resolve({ coords: [], distanceKm: 0, durationMin: 0 })
          }
        }
      ]
    }).compileComponents();
  });

  it('actualiza el estado y emite coordenadas al seleccionar una ubicación', () => {
    const fixture = TestBed.createComponent(MapaPickerComponent);
    const component = fixture.componentInstance;

    const emitted: any[] = [];
    component.locationSelected.subscribe((value) => emitted.push(value));

    component.selectLocation(-17.7833, -63.1821);

    expect(component.selected).toBeTruthy();
    expect(component.selected!.lat).toBeCloseTo(-17.7833, 4);
    expect(component.selected!.lng).toBeCloseTo(-63.1821, 4);
    expect(emitted.length).toBe(1);
    expect(emitted[0].lat).toBeCloseTo(-17.7833, 4);
    expect(emitted[0].lng).toBeCloseTo(-63.1821, 4);
    component.ngOnDestroy();
  });

  it('ignora coordenadas inválidas', () => {
    const fixture = TestBed.createComponent(MapaPickerComponent);
    const component = fixture.componentInstance;

    const emitted: any[] = [];
    component.locationSelected.subscribe((value) => emitted.push(value));

    component.selectLocation(Number.NaN, -63.1821);
    component.selectLocation(-17.7833, Number.NaN);

    expect(component.selected).toBeNull();
    expect(emitted.length).toBe(0);
    component.ngOnDestroy();
  });
});
