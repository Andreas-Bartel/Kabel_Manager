import { ILocationRepository } from '../domain/repositories';

export class DeleteLocationUseCase {
  constructor(private locationRepository: ILocationRepository) {}

  async execute(locationId: string): Promise<void> {
    const location = await this.locationRepository.getLocationById(locationId);
    if (!location) {
      throw new Error(`Lagerort mit ID ${locationId} existiert nicht.`);
    }

    const allLocations = await this.locationRepository.getAllLocations();
    const children = allLocations.filter(l => l.parentLocationId === locationId);

    // Reparent alle Kinder des gelöschten Lagerorts auf den Eltern-Ort des gelöschten Lagerorts (oder undefined)
    const newParentId = location.parentLocationId;
    for (const child of children) {
      child.parentLocationId = newParentId;
      await this.locationRepository.saveLocation(child);
    }

    // Lösche den eigentlichen Lagerort
    await this.locationRepository.deleteLocation(locationId);
  }
}
