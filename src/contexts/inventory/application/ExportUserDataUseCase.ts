import { ICableRepository, IDeviceRepository, ILocationRepository } from '../domain/repositories';
import { Cable, Device, StorageLocation } from '../domain/types';

export interface UserDataExport {
  exportedAt: string;
  userId: string;
  locations: StorageLocation[];
  cables: Cable[];
  devices: Device[];
}

export class ExportUserDataUseCase {
  constructor(
    private cableRepository: ICableRepository,
    private deviceRepository: IDeviceRepository,
    private locationRepository: ILocationRepository
  ) {}

  async execute(currentUserId: string): Promise<UserDataExport> {
    const allCables = await this.cableRepository.getAllCables();
    const allDevices = await this.deviceRepository.getAllDevices();
    const allLocations = await this.locationRepository.getAllLocations();

    // Filtere Daten nach der Benutzer-ID (falls vorhanden, um Multi-User-Integrität zu sichern)
    // Bei local/single-user Mode exportieren wir alle Datensätze.
    const userCables = allCables.filter(c => !c.userId || c.userId === currentUserId);
    const userDevices = allDevices.filter(d => !d.userId || d.userId === currentUserId);
    const userLocations = allLocations.filter(l => !l.userId || l.userId === currentUserId);

    return {
      exportedAt: new Date().toISOString(),
      userId: currentUserId,
      locations: userLocations,
      cables: userCables,
      devices: userDevices
    };
  }
}
