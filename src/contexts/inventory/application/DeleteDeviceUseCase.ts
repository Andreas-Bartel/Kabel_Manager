import { ICableRepository, IDeviceRepository } from '../domain/repositories';

export class DeleteDeviceUseCase {
  constructor(
    private cableRepository: ICableRepository,
    private deviceRepository: IDeviceRepository
  ) {}

  async execute(deviceId: string): Promise<void> {
    const device = await this.deviceRepository.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`Gerät mit ID ${deviceId} existiert nicht.`);
    }

    // 1. Hole alle Kabel, um Verknüpfungen aufzuheben
    const allCables = await this.cableRepository.getAllCables();

    for (const cable of allCables) {
      let needsSave = false;

      // Original-Kabel Verbindung aufheben (Orphan-Schutz)
      if (cable.originalDeviceId === deviceId) {
        cable.originalDeviceId = undefined;
        needsSave = true;
      }

      // Universal-Verknüpfung aus der Liste des Kabels löschen
      if (cable.assignedDeviceIds && cable.assignedDeviceIds.includes(deviceId)) {
        cable.assignedDeviceIds = cable.assignedDeviceIds.filter(id => id !== deviceId);
        needsSave = true;
      }

      if (needsSave) {
        await this.cableRepository.saveCable(cable);
      }
    }

    // 2. Lösche das Gerät aus dem Repository
    await this.deviceRepository.deleteDevice(deviceId);
  }
}
