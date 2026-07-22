import { ICableRepository } from '../domain/repositories';
import { Cable } from '../domain/types';
import { base64UrlToUuid } from '../../labels/domain/types';

export class GetCableByQrPayloadUseCase {
  constructor(private cableRepository: ICableRepository) {}

  async execute(b64Payload: string, currentUserId: string): Promise<Cable> {
    let uuid: string;
    try {
      uuid = base64UrlToUuid(b64Payload);
    } catch {
      throw new Error("Ungültiges QR-Code-Format.");
    }

    const cable = await this.cableRepository.getCableById(uuid);
    if (!cable) {
      throw new Error("Kabel nicht gefunden.");
    }

    // Zugriffsschutz-Prüfung (Schritt 8)
    // Wenn das Kabel einem anderen Benutzer gehört, werfen wir einen Fehler.
    if (cable.userId && cable.userId !== currentUserId) {
      throw new Error("Zugriff verweigert: Du bist nicht der Besitzer dieses Kabels.");
    }

    return cable;
  }
}
