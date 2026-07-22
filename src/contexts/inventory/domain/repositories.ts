import { Cable, Device, StorageLocation } from './types';

export interface ICableRepository {
  getCableById(id: string): Promise<Cable | null>;
  getAllCables(): Promise<Cable[]>;
  saveCable(cable: Cable): Promise<void>;
  deleteCable(id: string): Promise<void>;
}

export interface IDeviceRepository {
  getDeviceById(id: string): Promise<Device | null>;
  getAllDevices(): Promise<Device[]>;
  saveDevice(device: Device): Promise<void>;
  deleteDevice(id: string): Promise<void>;
}

export interface ILocationRepository {
  getLocationById(id: string): Promise<StorageLocation | null>;
  getAllLocations(): Promise<StorageLocation[]>;
  saveLocation(location: StorageLocation): Promise<void>;
  deleteLocation(id: string): Promise<void>;
}
