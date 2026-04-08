/**
 * Converts an absolute filesystem image path to a relative path starting with "uploads/".
 * This ensures image URLs work correctly with the Express static file server.
 *
 * Examples:
 *   "C:/Users/.../uploads/soporte/2026/04/08/file.jpg" -> "uploads/soporte/2026/04/08/file.jpg"
 *   "uploads/soporte/2026/04/08/file.jpg" -> "uploads/soporte/2026/04/08/file.jpg" (already relative)
 */
export function toRelativeImagePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  if (idx !== -1) return normalized.substring(idx);
  return normalized;
}
