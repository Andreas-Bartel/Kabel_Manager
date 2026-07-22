import { IDeviceRepository } from '../domain/repositories';
import { Device } from '../domain/types';

const STORAGE_KEY = 'cable_guy_devices';

export class LocalStorageDeviceRepository implements IDeviceRepository {
  private getStoredDevices(): Device[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveAll(devices: Device[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  }

  async getDeviceById(id: string): Promise<Device | null> {
    const devices = this.getStoredDevices();
    return devices.find(d => d.id === id) || null;
  }

  async getAllDevices(): Promise<Device[]> {
    return this.getStoredDevices();
  }

  async saveDevice(device: Device): Promise<void> {
    const devices = this.getStoredDevices();
    const index = devices.findIndex(d => d.id === device.id);
    if (index >= 0) {
      devices[index] = device;
    } else {
      devices.push(device);
    }
    this.saveAll(devices);
  }

  async deleteDevice(id: string): Promise<void> {
    const devices = this.getStoredDevices();
    const filtered = devices.filter(d => d.id !== id);
    this.saveAll(filtered);
  }
}
