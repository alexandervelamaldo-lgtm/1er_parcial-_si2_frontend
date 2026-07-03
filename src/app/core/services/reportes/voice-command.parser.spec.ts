import { parseVoiceReportCommand } from './voice-command.parser';

describe('parseVoiceReportCommand', () => {
  it('detecta reporte hoy pdf', () => {
    const cmd = parseVoiceReportCommand('reporte hoy pdf');
    expect(cmd).toEqual({ period: 'today', format: 'pdf', narrate: false });
  });

  it('detecta informe de hoy excel', () => {
    const cmd = parseVoiceReportCommand('informe de hoy excel');
    expect(cmd).toEqual({ period: 'today', format: 'excel', narrate: false });
  });

  it('tolera errores menores (exel)', () => {
    const cmd = parseVoiceReportCommand('reporte hoy exel');
    expect(cmd).toEqual({ period: 'today', format: 'excel', narrate: false });
  });

  it('no activa si falta formato', () => {
    const cmd = parseVoiceReportCommand('reporte hoy');
    expect(cmd).toBeNull();
  });
});
