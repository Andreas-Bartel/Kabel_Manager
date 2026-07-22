export interface QRCodePayload {
  id: string; // Kompakte, datensparende ID (Ticket 5)
  cableId: string; // Verweis auf das Kabel (UUID)
  createdAt: string;
}

export interface ILabelService {
  generateQRCodeUrl(payload: QRCodePayload): string;
  parseQRCodePayload(qrUrl: string): QRCodePayload | null;
}

export function uuidToBase64Url(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToUuid(b64Url: string): string {
  let base64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const binary = atob(base64);
  let hex = '';
  for (let i = 0; i < binary.length; i++) {
    const code = binary.charCodeAt(i);
    hex += code.toString(16).padStart(2, '0');
  }
  
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

