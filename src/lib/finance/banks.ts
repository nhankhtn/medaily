/**
 * Napas member codes, the six digits a VietQR payload names the bank by.
 * Only the ones likely to come up — the field takes a typed code too, so a
 * bank missing here is an inconvenience rather than a wall.
 */
export const BANKS = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970431', name: 'Eximbank' },
  { bin: '970443', name: 'SHB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970426', name: 'MSB' },
  { bin: '970454', name: 'VietCapital Bank' },
  { bin: '970448', name: 'OCB' },
  { bin: '970429', name: 'SCB' },
] as const

export function bankName(bin: string | null | undefined): string | null {
  if (!bin) return null
  return BANKS.find((bank) => bank.bin === bin)?.name ?? null
}

/** Whether a code names a bank this app can build a QR for. */
export function isSupportedBank(bin: string | null | undefined): boolean {
  return Boolean(bin) && BANKS.some((bank) => bank.bin === bin)
}
