import { ICableRepository, IDeviceRepository } from '../domain/repositories';
import { checkPowerCompatibility, CompatibilityResult } from '../domain/types';

export class CheckCompatibilityUseCase {
  constructor(
    private cableRepository: ICableRepository,
    private deviceRepository: IDeviceRepository
  ) {}

  async execute(cableId: string, deviceId: string): Promise<CompatibilityResult> {
    const cable = await this.cableRepository.getCableById(cableId);
    if (!cable) {
      throw new Error(`Kabel/Netzteil mit ID ${cableId} nicht gefunden.`);
    }

    const device = await this.deviceRepository.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`Gerät mit ID ${deviceId} nicht gefunden.`);
    }

    return checkPowerCompatibility(cable, device);
  }
}
