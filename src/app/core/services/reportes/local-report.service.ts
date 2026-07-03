import { Injectable } from '@angular/core';

import { EmergencyReportRow, formatDateYmd } from './sample-emergencies';

// Genera y descarga reportes locales (sin backend) usando importación lazy para no inflar el bundle inicial.
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

@Injectable({ providedIn: 'root' })
export class LocalReportService {
  async exportEmergenciesPdf(rows: EmergencyReportRow[], now = new Date()): Promise<void> {
    const ymd = formatDateYmd(now);
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const marginX = 40;
    let y = 48;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Plataforma Inteligente de Atención de Emergencias Vehiculares', marginX, y);

    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Reporte de emergencias (hoy) · ${ymd}`, marginX, y);

    y += 18;
    doc.setDrawColor(220);
    doc.line(marginX, y, 555, y);

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    const headers = ['Fecha/hora', 'Tipo', 'Unidad', 'Estado', 'Ubicación'];
    const colX = [marginX, 150, 265, 350, 430];
    headers.forEach((h, i) => doc.text(h, colX[i], y));

    y += 10;
    doc.setDrawColor(235);
    doc.line(marginX, y, 555, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const pageBottom = 770;
    for (const r of rows) {
      const row = [r.fechaHora, r.tipoIncidente, r.unidadGrua, r.estadoServicio, r.ubicacion];

      const wrapped = row.map((cell, idx) => {
        const maxW = idx === 0 ? 95 : idx === 1 ? 110 : idx === 2 ? 80 : idx === 3 ? 70 : 120;
        return doc.splitTextToSize(String(cell), maxW);
      });
      const rowHeight = Math.max(...wrapped.map((w) => w.length)) * 12;

      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = 48;
      }

      wrapped.forEach((w, i) => doc.text(w, colX[i], y));
      y += rowHeight;
      doc.setDrawColor(245);
      doc.line(marginX, y, 555, y);
      y += 10;
    }

    const blob = doc.output('blob');
    downloadBlob(blob, `reporte_emergencias_${ymd}.pdf`);
  }

  async exportEmergenciesXlsx(rows: EmergencyReportRow[], now = new Date()): Promise<void> {
    const ymd = formatDateYmd(now);
    const XLSX = await import('xlsx');

    const data = rows.map((r) => ({
      'Fecha y hora': r.fechaHora,
      'Tipo de incidente': r.tipoIncidente,
      'Unidad asignada': r.unidadGrua,
      'Estado del servicio': r.estadoServicio,
      'Ubicación del siniestro': r.ubicacion
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Emergencias');

    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    downloadBlob(blob, `reporte_emergencias_${ymd}.xlsx`);
  }

  async exportEmergenciesTxt(rows: EmergencyReportRow[], now = new Date()): Promise<void> {
    const ymd = formatDateYmd(now);
    const lines: string[] = [];
    lines.push('Plataforma Inteligente de Atención de Emergencias Vehiculares');
    lines.push(`Reporte de emergencias (hoy) · ${ymd}`);
    lines.push('');
    lines.push('Fecha/hora\tTipo\tUnidad\tEstado\tUbicación');
    for (const r of rows) {
      lines.push([r.fechaHora, r.tipoIncidente, r.unidadGrua, r.estadoServicio, r.ubicacion].join('\t'));
    }
    lines.push('');
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `reporte_emergencias_${ymd}.txt`);
  }
}
