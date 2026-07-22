import { ICableRepository } from '../domain/repositories';
import { Cable } from '../domain/types';
import { supabase } from '../../shared/infrastructure/supabaseClient';

export class SupabaseCableRepository implements ICableRepository {
  async getCableById(id: string): Promise<Cable | null> {
    const { data: cabData, error: cabError } = await supabase
      .from('cables')
      .select('*')
      .eq('id', id)
      .single();

    if (cabError || !cabData) return null;

    // Hole zugeordnete Geräte aus dem Link-Table
    const { data: linkData } = await supabase
      .from('cable_device_links')
      .select('device_id')
      .eq('cable_id', id);

    const assignedDeviceIds = linkData ? linkData.map(l => l.device_id) : [];

    return {
      id: cabData.id,
      name: cabData.name,
      connectorType: cabData.connector_type as any,
      locationId: cabData.location_id || undefined,
      isMultiOutput: cabData.is_multi_output,
      powerOutputs: cabData.power_outputs || undefined,
      assignedDeviceIds,
      createdAt: cabData.created_at,
      updatedAt: cabData.updated_at
    };
  }

  async getAllCables(): Promise<Cable[]> {
    const { data: cables, error } = await supabase
      .from('cables')
      .select('*');

    if (error || !cables) return [];

    const { data: links } = await supabase
      .from('cable_device_links')
      .select('*');

    return cables.map(c => {
      const assignedDeviceIds = links
        ? links.filter(l => l.cable_id === c.id).map(l => l.device_id)
        : [];

      return {
        id: c.id,
        name: c.name,
        connectorType: c.connector_type as any,
        locationId: c.location_id || undefined,
        isMultiOutput: c.is_multi_output,
        powerOutputs: c.power_outputs || undefined,
        assignedDeviceIds,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      };
    });
  }

  async saveCable(cable: Cable): Promise<void> {
    const payload = {
      id: cable.id,
      name: cable.name,
      connector_type: cable.connectorType,
      location_id: cable.locationId || null,
      is_multi_output: cable.isMultiOutput || false,
      power_outputs: cable.powerOutputs || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('cables')
      .upsert(payload);

    if (error) {
      throw new Error(`Fehler beim Speichern des Kabels in Supabase: ${error.message}`);
    }

    // Mappings aktualisieren
    await supabase
      .from('cable_device_links')
      .delete()
      .eq('cable_id', cable.id);

    if (cable.assignedDeviceIds && cable.assignedDeviceIds.length > 0) {
      const linksPayload = cable.assignedDeviceIds.map(deviceId => ({
        cable_id: cable.id,
        device_id: deviceId
      }));

      const { error: linkError } = await supabase
        .from('cable_device_links')
        .insert(linksPayload);

      if (linkError) {
        throw new Error(`Fehler beim Speichern der Geräte-Verknüpfungen: ${linkError.message}`);
      }
    }
  }

  async deleteCable(id: string): Promise<void> {
    const { error } = await supabase
      .from('cables')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Fehler beim Löschen des Kabels in Supabase: ${error.message}`);
    }
  }
}
