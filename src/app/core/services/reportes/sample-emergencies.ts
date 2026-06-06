export type EmergencyReportRow = {
  fechaHora: string;
  tipoIncidente: string;
  unidadGrua: string;
  estadoServicio: string;
  ubicacion: string;
};

function pad2(v: number): string {
  return String(v).padStart(2, '0');
}

export function formatDateYmd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTime(date: Date): string {
  return `${formatDateYmd(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function seededRandom(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
}

export function buildTodayEmergencyDataset(now = new Date()): EmergencyReportRow[] {
  const seed = Number(`${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`);
  const rand = seededRandom(seed);

  const tipos = ['Accidente', 'Falla mecánica', 'Robo', 'Pinchazo', 'Batería descargada', 'Choque leve'];
  const estados = ['En curso', 'Finalizado', 'Pendiente'];
  const unidades = ['Grúa A-12', 'Grúa B-07', 'Ambulancia M-03', 'Grúa C-21'];
  const ubicaciones = [
    'Santa Cruz: Av. Grigotá',
    'Santa Cruz: 2do Anillo',
    'Santa Cruz: Doble Vía La Guardia',
    'Santa Cruz: Av. Banzer',
    'Santa Cruz: Equipetrol',
    'Santa Cruz: Plan 3000'
  ];

  const rows: EmergencyReportRow[] = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(now);
    d.setHours(7 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0);
    rows.push({
      fechaHora: formatDateTime(d),
      tipoIncidente: tipos[Math.floor(rand() * tipos.length)],
      unidadGrua: unidades[Math.floor(rand() * unidades.length)],
      estadoServicio: estados[Math.floor(rand() * estados.length)],
      ubicacion: ubicaciones[Math.floor(rand() * ubicaciones.length)]
    });
  }
  return rows.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
}

