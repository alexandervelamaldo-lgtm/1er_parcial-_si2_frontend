export type VoiceReportFormat = 'pdf' | 'excel' | 'txt';

export type VoiceReportCommand = {
  period: 'today';
  format: VoiceReportFormat;
  narrate: boolean;
};

// Parser offline de comandos ("reporte hoy pdf/excel") con normalización y matching tolerante a errores.
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function tokenMatchesAny(token: string, candidates: string[], maxDistance: number): boolean {
  for (const c of candidates) {
    if (token === c) return true;
    if (levenshtein(token, c) <= maxDistance) return true;
  }
  return false;
}

export function parseVoiceReportCommand(transcriptRaw: string): VoiceReportCommand | null {
  const transcript = normalizeText(transcriptRaw || '');
  if (!transcript) return null;

  const tokens = transcript.split(' ').filter(Boolean);

  // Palabras que indican intención de generar un reporte (ampliado para lenguaje natural)
  const reportKeywords = [
    'reporte', 'informe', 'generar', 'genera', 'generame', 'dame',
    'crea', 'crear', 'exportar', 'exporta', 'hazme', 'haz',
    'mostrar', 'muestra', 'necesito', 'quiero', 'hacer'
  ];
  const todayKeywords = ['hoy', 'diario', 'actual', 'dia', 'fecha'];
  const pdfKeywords = ['pdf'];
  const excelKeywords = ['excel', 'exel', 'xlsx'];
  const txtKeywords = ['txt', 'texto', 'text'];
  const voiceKeywords = ['voz', 'audio', 'narrar', 'leer'];

  const hasReport =
    transcript.includes('reporte') ||
    transcript.includes('informe') ||
    transcript.includes('generar') ||
    transcript.includes('generame') ||
    transcript.includes('genera') ||
    transcript.includes('exportar') ||
    transcript.includes('exporta') ||
    transcript.includes('hazme') ||
    transcript.includes('dame') ||
    tokens.some((t) => tokenMatchesAny(t, reportKeywords, 1));

  const hasToday =
    transcript.includes('hoy') ||
    transcript.includes('de hoy') ||
    transcript.includes('del dia') ||
    transcript.includes('hoy dia') ||
    transcript.includes('de hoy dia') ||
    tokens.some((t) => tokenMatchesAny(t, todayKeywords, 1));

  const wantsPdf = tokens.some((t) => tokenMatchesAny(t, pdfKeywords, 1)) || transcript.includes(' pdf') || transcript.includes('pdf ');
  const wantsExcel =
    tokens.some((t) => tokenMatchesAny(t, excelKeywords, 1)) ||
    transcript.includes(' excel') ||
    transcript.includes(' xlsx');
  const wantsTxt =
    tokens.some((t) => tokenMatchesAny(t, txtKeywords, 1)) ||
    transcript.includes(' txt') ||
    transcript.includes(' texto');
  const wantsNarration =
    tokens.some((t) => tokenMatchesAny(t, voiceKeywords, 1)) ||
    transcript.includes(' con voz') ||
    transcript.includes(' narrar') ||
    transcript.includes(' leer');

  // Si se especifica un formato claramente (pdf/excel/txt) con referencia al día,
  // es suficiente aunque no se diga "reporte" explícitamente.
  const hasFormat = wantsPdf || wantsExcel || wantsTxt;
  if ((!hasReport && !hasFormat) || !hasToday) return null;

  if (wantsPdf) return { period: 'today', format: 'pdf', narrate: wantsNarration };
  if (wantsExcel) return { period: 'today', format: 'excel', narrate: wantsNarration };
  if (wantsTxt) return { period: 'today', format: 'txt', narrate: wantsNarration };
  return null;
}
