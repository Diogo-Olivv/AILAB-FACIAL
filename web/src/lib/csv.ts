/**
 * Escapa um campo TEXTUAL de CSV.
 * Além das aspas, neutraliza fórmulas: planilhas executam células iniciadas por
 * = + - @ (ou tab/CR). O apóstrofo inicial faz o valor ser lido como texto.
 * Campos numéricos não passam por aqui e continuam sendo números.
 */
export function escapeCsvField(value: string): string {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
