import { canProposeWorkshopAssignment, normalizeSolicitudState } from './solicitud-assign';

describe('solicitud-assign', () => {
  it('normaliza estados', () => {
    expect(normalizeSolicitudState(' en_camino ')).toBe('EN_CAMINO');
    expect(normalizeSolicitudState(null)).toBe('');
  });

  it('permite proponer asignación solo en estados iniciales', () => {
    expect(
      canProposeWorkshopAssignment({ estadoNombre: 'REGISTRADA', tecnicoId: null, clienteAprobada: null })
    ).toBeTrue();

    expect(
      canProposeWorkshopAssignment({ estadoNombre: 'ASIGNADA', tecnicoId: null, clienteAprobada: false })
    ).toBeTrue();

    expect(
      canProposeWorkshopAssignment({ estadoNombre: 'EN_CAMINO', tecnicoId: 10, clienteAprobada: true })
    ).toBeFalse();

    expect(
      canProposeWorkshopAssignment({ estadoNombre: 'ASIGNADA', tecnicoId: 10, clienteAprobada: false })
    ).toBeFalse();

    expect(
      canProposeWorkshopAssignment({ estadoNombre: 'REGISTRADA', tecnicoId: null, clienteAprobada: true })
    ).toBeFalse();
  });
});

