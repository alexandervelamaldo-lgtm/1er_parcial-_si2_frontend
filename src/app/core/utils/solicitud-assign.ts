export function normalizeSolicitudState(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

export function canProposeWorkshopAssignment(params: {
  estadoNombre: string | null | undefined;
  tecnicoId?: number | null;
  clienteAprobada?: boolean | null;
}): boolean {
  const estado = normalizeSolicitudState(params.estadoNombre);
  const clienteAprobada = params.clienteAprobada;
  if (clienteAprobada === true) return false;
  if (estado === 'EN_CAMINO' || estado === 'EN_ATENCION' || estado === 'COMPLETADA' || estado === 'CANCELADA') {
    return false;
  }
  if (estado !== 'REGISTRADA' && estado !== 'ASIGNADA') return false;
  if (estado === 'ASIGNADA' && params.tecnicoId) return false;
  return true;
}

