/**
 * TEXT as RFC 5545 defines it.
 *
 * A bare `;` is read as a parameter break, and a bare CR starts a new line.
 * Either one turns a title into a property the calendar app did not expect.
 */
export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}
