import { IDeviceRepository } from '../domain/repositories';
import { Device } from '../domain/types';
import { supabase } from '../../shared/infrastructure/supabaseClient';

export class SupabaseDeviceRepository implements IDeviceRepository {
  async getDeviceById(id: string): Promise<Device | null> {
    const { data: devData, error: devError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', id)
      .single();

    if (devError || !devData) return null;

    // Hole zugeordnete Kabel aus dem Link-Table
    const { data: linkData } = await supabase
      .from('cable_device_links')
      .select('cable_id')
      .eq('device_id', id);

    const compatibleCableIds = linkData ? linkData.map(l => l.cable_id) : [];

    return {
      id: devData.id,
      name: devData.name,
      manufacturer: devData.manufacturer || undefined,
      requiredVoltage: devData.required_voltage ? Number(devData.required_voltage) : undefined,
      requiredAmperage: devData.required_amperage ? Number(devData.required_amperage) : undefined,
      requiredConnectorType: devData.required_connector_type || undefined,
      locationId: devData.location_id || undefined,
      compatibleCableIds,
      createdAt: devData.created_at
    };
  }

  async getAllDevices(): Promise<Device[]> {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*');

    if (error || !devices) return [];

    const { data: links } = await supabase
      .from('cable_device_links')
      .select('*');

    return devices.map(d => {
      const compatibleCableIds = links
        ? links.filter(l => l.device_id === d.id).map(l => l.cable_id)
        : [];

      return {
        id: d.id,
        name: d.name,
        manufacturer: d.manufacturer || undefined,
        requiredVoltage: d.required_voltage ? Number(d.required_voltage) : undefined,
        requiredAmperage: d.required_amperage ? Number(d.required_amperage) : undefined,
        requiredConnectorType: d.required_connector_type || undefined,
        locationId: d.location_id || undefined,
        compatibleCableIds,
        createdAt: d.created_at
      };
    });
  }

  async saveDevice(device: Device): Promise<void> {
    const payload = {
      id: device.id,
      name: device.name,
      manufacturer: device.manufacturer || null,
      required_voltage: device.requiredVoltage || null,
      required_amperage: device.requiredAmperage || null,
      required_connector_type: device.requiredConnectorType || null,
      location_id: device.locationId || null
    };

    const { error } = await supabase
      .from('devices')
      .upsert(payload);

    if (error) {
      throw new Error(`Fehler beim Speichern des Geräts in Supabase: ${error.message}`);
    }

    // Beziehungen aktualisieren: Lösche alte und füge neue Links hinzu
    await supabase
      .from('cable_device_links')
      .delete()
      .eq('device_id', device.id);

    if (device.compatibleCableIds && device.compatibleCableIds.length > 0) {
      const linksPayload = device.compatibleCableIds.map(cableId => ({
        cable_id: cableId,
        device_id: device.id
      }));

      const { error: linkError } = await supabase
        .from('cable_device_links')
        .insert(linksPayload);

      if (linkError) {
        throw new Error(`Fehler beim Speichern der Kabel-Verknüpfungen: ${linkError.message}`);
      }
    }
  }

  async deleteDevice(id: string): Promise<void> {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Fehler beim Löschen des Geräts in Supabase: ${error.message}`);
    }
  }
}
