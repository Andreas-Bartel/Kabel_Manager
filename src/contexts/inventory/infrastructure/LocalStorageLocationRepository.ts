import { ILocationRepository } from '../domain/repositories';
import { StorageLocation } from '../domain/types';

const STORAGE_KEY = 'cable_guy_locations';

export class LocalStorageLocationRepository implements ILocationRepository {
  private getStoredLocations(): StorageLocation[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveAll(locations: StorageLocation[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  }

  async getLocationById(id: string): Promise<StorageLocation | null> {
    const locations = this.getStoredLocations();
    return locations.find(l => l.id === id) || null;
  }

  async getAllLocations(): Promise<StorageLocation[]> {
    return this.getStoredLocations();
  }

  async saveLocation(location: StorageLocation): Promise<void> {
    const locations = this.getStoredLocations();
    const index = locations.findIndex(l => l.id === location.id);
    if (index >= 0) {
      locations[index] = location;
    } else {
      locations.push(location);
    }
    this.saveAll(locations);
  }

  async deleteLocation(id: string): Promise<void> {
    const locations = this.getStoredLocations();
    const filtered = locations.filter(l => l.id !== id);
    this.saveAll(filtered);
  }
}
