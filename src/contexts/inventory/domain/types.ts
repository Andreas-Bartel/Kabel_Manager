export interface ImageAttachment {
  id: string;
  url: string;   // Base64 string of compressed image
  label: string; // User-defined label
}

export interface PowerOutput {
  voltage: number; // in Volt (V)
  amperage: number; // in Ampere (A)
  wattage: number; // in Watt (W)
  portType: 'USB-A' | 'USB-C' | 'Micro-USB' | 'Lightning' | 'DC-Jack' | 'Other';
}

export interface Cable {
  id: string; // UUID
  name: string;
  description?: string;
  imageUrl?: string;
  connectorType: 'USB-C' | 'Micro-USB' | 'Lightning' | 'HDMI' | 'DisplayPort' | 'DC-Jack' | 'Other';
  locationId?: string; // Verweis auf den Lagerort
  originalDeviceId?: string; // Verweis auf das Originalgerät, falls vorhanden
  assignedDeviceIds?: string[]; // IDs von Geräten, die dieses Kabel laden/verbinden kann
  isMultiOutput?: boolean; // Für Netzteile mit mehreren Ausgängen
  powerOutputs?: PowerOutput[]; // Spezifische Leistungsdaten für Netzteile
  userId?: string; // Eigentümer des Kabels
  createdAt: string;
  updatedAt: string;

  // Eigenschaften für Ladegeräte (Version 1.2.0)
  chargerType?: 'only_ports' | 'only_fixed_cable' | 'hybrid';
  fixedCableLength?: string;
  fixedCablePower?: string;
  fixedCableConnector?: string;

  
  // Neue Eigenschaften für Version 2 (Schritt 5)
  cableStandard1?: string;
  cableStandard2?: string;
  length?: string;
  color?: string;
  condition?: string;
  material?: string;
  dataRate?: string;
  chargingPower?: string;
  brand?: string;
  connectorType1?: string;
  connectorType2?: string;
  additionalProperties?: Record<string, string>;
  images?: ImageAttachment[];
}

export interface Device {
  id: string; // UUID
  name: string;
  manufacturer?: string;
  requiredConnectorType?: string; // z.B. "USB-C", "Micro-USB", "Lightning", "DC-Jack"
  locationId?: string; // Aufbewahrungsort des Geräts
  compatibleCableIds?: string[]; // IDs von kompatiblen Kabeln
  userId?: string; // Eigentümer des Geräts
  createdAt: string;
  images?: ImageAttachment[];
}

export interface StorageLocation {
  id: string; // UUID
  name: string; // z.B. "Kiste A", "Schublade Schreibtisch"
  parentLocationId?: string; // Hierarchische Struktur: Raum -> Möbel -> Box (Ticket 3)
  description?: string;
  userId?: string; // Eigentümer des Lagerorts
}

export function buildLocationPath(locationId: string, allLocations: StorageLocation[]): string {
  const location = allLocations.find(l => l.id === locationId);
  if (!location) return '';
  if (!location.parentLocationId) return location.name;
  
  const parentPath = buildLocationPath(location.parentLocationId, allLocations);
  return parentPath ? `${parentPath} > ${location.name}` : location.name;
}

export type CompatibilityResult = 
  | { status: 'COMPATIBLE'; matchingPort: PowerOutput }
  | { status: 'CONNECTOR_MISMATCH'; message: string }
  | { status: 'NO_SPECIFICATION'; message: string };

export function checkPowerCompatibility(cable: Cable, device: Device): CompatibilityResult {
  const reqConnector = device.requiredConnectorType;
  
  if (!reqConnector) {
    return { 
      status: 'NO_SPECIFICATION', 
      message: 'Kein Anschluss am Gerät angegeben.' 
    };
  }

  // Sammle alle Anschlüsse des Kabels / Ladegeräts
  const cableConnectors = [
    cable.connectorType,
    cable.connectorType1,
    cable.connectorType2,
    ...(cable.powerOutputs || []).map(o => o.portType)
  ].filter(Boolean);

  const isMatch = cableConnectors.some(c => c === reqConnector);

  if (isMatch) {
    const matchingPort = (cable.powerOutputs || []).find(o => o.portType === reqConnector) || {
      voltage: 5,
      amperage: 2,
      wattage: 10,
      portType: reqConnector as any
    };
    return {
      status: 'COMPATIBLE',
      matchingPort
    };
  }

  return {
    status: 'CONNECTOR_MISMATCH',
    message: `Anschluss passt nicht: Gerät benötigt ${reqConnector}, Kabel/Lader bietet ${cableConnectors.join(' / ') || 'keine Angabe'}.`
  };
}


