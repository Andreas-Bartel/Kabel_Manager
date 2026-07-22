import { ILocationRepository } from '../domain/repositories';
import { StorageLocation } from '../domain/types';
import { supabase } from '../../shared/infrastructure/supabaseClient';

export class SupabaseLocationRepository implements ILocationRepository {
  async getLocationById(id: string): Promise<StorageLocation | null> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      parentLocationId: data.parent_location_id || undefined,
      description: data.description || undefined
    };
  }

  async getAllLocations(): Promise<StorageLocation[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*');

    if (error || !data) return [];
    return data.map(l => ({
      id: l.id,
      name: l.name,
      parentLocationId: l.parent_location_id || undefined,
      description: l.description || undefined
    }));
  }

  async saveLocation(location: StorageLocation): Promise<void> {
    const payload = {
      id: location.id,
      name: location.name,
      parent_location_id: location.parentLocationId || null,
      description: location.description || null
    };

    const { error } = await supabase
      .from('locations')
      .upsert(payload);

    if (error) {
      throw new Error(`Fehler beim Speichern des Lagerorts in Supabase: ${error.message}`);
    }
  }

  async deleteLocation(id: string): Promise<void> {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Fehler beim Löschen des Lagerorts in Supabase: ${error.message}`);
    }
  }
}
