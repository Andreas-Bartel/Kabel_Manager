import { ICableRepository, IDeviceRepository } from '../domain/repositories';

export class UnlinkCableFromDeviceUseCase {
  constructor(
    private cableRepository: ICableRepository,
    private deviceRepository: IDeviceRepository
  ) {}

  async execute(cableId: string, deviceId: string): Promise<void> {
    const cable = await this.cableRepository.getCableById(cableId);
    const device = await this.deviceRepository.getDeviceById(deviceId);

    // 1. Verknüpfung im Kabel aufheben (falls Kabel existiert)
    if (cable && cable.assignedDeviceIds) {
      cable.assignedDeviceIds = cable.assignedDeviceIds.filter(id => id !== deviceId);
      await this.cableRepository.saveCable(cable);
    }

    // 2. Verknüpfung im Gerät aufheben (falls Gerät existiert)
    if (device && device.compatibleCableIds) {
      device.compatibleCableIds = device.compatibleCableIds.filter(id => id !== cableId);
      await this.deviceRepository.saveDevice(device);
    }
  }
}
