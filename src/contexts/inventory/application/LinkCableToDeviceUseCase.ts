import { ICableRepository, IDeviceRepository } from '../domain/repositories';

export class LinkCableToDeviceUseCase {
  constructor(
    private cableRepository: ICableRepository,
    private deviceRepository: IDeviceRepository
  ) {}

  async execute(cableId: string, deviceId: string): Promise<void> {
    const cable = await this.cableRepository.getCableById(cableId);
    if (!cable) {
      throw new Error(`Kabel mit ID ${cableId} nicht gefunden.`);
    }

    const device = await this.deviceRepository.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`Gerät mit ID ${deviceId} nicht gefunden.`);
    }

    // 1. Verknüpfung im Kabel aktualisieren
    const assignedDeviceIds = cable.assignedDeviceIds || [];
    if (!assignedDeviceIds.includes(deviceId)) {
      cable.assignedDeviceIds = [...assignedDeviceIds, deviceId];
      await this.cableRepository.saveCable(cable);
    }

    // 2. Verknüpfung im Gerät aktualisieren
    const compatibleCableIds = device.compatibleCableIds || [];
    if (!compatibleCableIds.includes(cableId)) {
      device.compatibleCableIds = [...compatibleCableIds, cableId];
      await this.deviceRepository.saveDevice(device);
    }
  }
}
