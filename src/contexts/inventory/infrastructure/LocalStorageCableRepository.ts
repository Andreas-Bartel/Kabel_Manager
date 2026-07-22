import { ICableRepository } from '../domain/repositories';
import { Cable } from '../domain/types';

const STORAGE_KEY = 'cable_guy_cables';

export class LocalStorageCableRepository implements ICableRepository {
  private getStoredCables(): Cable[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveAll(cables: Cable[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cables));
  }

  async getCableById(id: string): Promise<Cable | null> {
    const cables = this.getStoredCables();
    return cables.find(c => c.id === id) || null;
  }

  async getAllCables(): Promise<Cable[]> {
    return this.getStoredCables();
  }

  async saveCable(cable: Cable): Promise<void> {
    const cables = this.getStoredCables();
    const index = cables.findIndex(c => c.id === cable.id);
    if (index >= 0) {
      cables[index] = { ...cable, updatedAt: new Date().toISOString() };
    } else {
      cables.push({
        ...cable,
        createdAt: cable.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    this.saveAll(cables);
  }

  async deleteCable(id: string): Promise<void> {
    const cables = this.getStoredCables();
    const filtered = cables.filter(c => c.id !== id);
    this.saveAll(filtered);
  }
}
