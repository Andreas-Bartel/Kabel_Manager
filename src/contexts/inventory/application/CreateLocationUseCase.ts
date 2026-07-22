import { ILocationRepository } from '../domain/repositories';
import { StorageLocation } from '../domain/types';

export class CreateLocationUseCase {
  constructor(private locationRepository: ILocationRepository) {}

  async execute(name: string, parentLocationId?: string, description?: string): Promise<StorageLocation> {
    if (!name.trim()) {
      throw new Error("Lagerort-Name darf nicht leer sein.");
    }

    if (parentLocationId) {
      const parent = await this.locationRepository.getLocationById(parentLocationId);
      if (!parent) {
        throw new Error(`Eltern-Lagerort mit ID ${parentLocationId} existiert nicht.`);
      }
    }

    const newLocation: StorageLocation = {
      id: crypto.randomUUID(), // Generiert eine UUID (standardmäßig in modernen Browsern/Node.js vorhanden)
      name: name.trim(),
      parentLocationId: parentLocationId || undefined,
      description: description?.trim() || undefined
    };

    await this.locationRepository.saveLocation(newLocation);
    return newLocation;
  }
}
