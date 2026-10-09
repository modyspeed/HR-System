/**
 * Guard for user-supplied documents: validates that the file content actually
 * matches its extension (magic bytes) so a renamed executable or spoofed file
 * cannot be stored or previewed. Pure module — no Electron imports, unit-testable.
 */
import path from 'path'
import { ApiError } from '../../shared/types'

const MAGIC: Record<string, (data: Buffer) => boolean> = {
  '.pdf': (data) => hasAsciiPrefix(data, '%PDF-'),
  '.xlsx': isZip,
  '.xlsm': isZip,
  '.xls': (data) => hasHexPrefix(data, 'd0cf11e0a1b11ae1'),
  '.png': (data) => hasHexPrefix(data, '89504e470d0a1a0a'),
  '.jpg': (data) => hasHexPrefix(data, 'ffd8ff'),
  '.jpeg': (data) => hasHexPrefix(data, 'ffd8ff'),
  '.webp': (data) => hasHexPrefix(data, '52494646') && data.subarray(8, 12).toString('ascii') === 'WEBP',
  '.gif': (data) => hasAsciiPrefix(data, 'GIF87a') || hasAsciiPrefix(data, 'GIF89a'),
  '.bmp': (data) => hasAsciiPrefix(data, 'BM'),
  '.csv': (data) => isPlainText(data)
}

function hasAsciiPrefix(data: Buffer, text: string): boolean {
  return data.length >= text.length && data.subarray(0, text.length).toString('ascii') === text
}

function hasHexPrefix(data: Buffer, hex: string): boolean {
  return data.length >= hex.length / 2 && data.subarray(0, hex.length / 2).toString('hex') === hex
}

function isZip(data: Buffer): boolean {
  return hasHexPrefix(data, '504b0304')
}

/** CSV is plain text: no NUL bytes in the sample window. */
function isPlainText(data: Buffer): boolean {
  const sample = data.subarray(0, 1024)
  for (const byte of sample) {
    if (byte === 0) return false
  }
  return true
}

/**
 * Throws when the extension is allowed but the content does not match it.
 * Call this AFTER the extension check so unknown extensions never reach here.
 */
export function assertFileSignature(originalName: string, data: Buffer): void {
  const ext = path.extname(originalName).toLowerCase()
  const matcher = MAGIC[ext]
  if (matcher && data.byteLength > 0 && !matcher(data)) {
    throw new ApiError('VALIDATION', 'The file content does not match its extension')
  }
}
