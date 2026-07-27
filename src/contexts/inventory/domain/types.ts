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
  requiredVoltage?: number; // Benötigte Spannung in Volt (V)
  requiredAmperage?: number; // Benötigte Stromstärke in Ampere (A)
  requiredConnectorType?: string;
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
  | { status: 'VOLTAGE_MISMATCH'; message: string }
  | { status: 'AMPERAGE_TOO_LOW'; message: string }
  | { status: 'CONNECTOR_MISMATCH'; message: string }
  | { status: 'NO_SPECIFICATION'; message: string };

export function checkPowerCompatibility(cable: Cable, device: Device): CompatibilityResult {
  const reqVolts = device.requiredVoltage;
  const reqAmps = device.requiredAmperage;
  
  if (reqVolts === undefined || reqAmps === undefined) {
    if (device.requiredConnectorType && cable.connectorType !== device.requiredConnectorType) {
      return { 
        status: 'CONNECTOR_MISMATCH', 
        message: `Stecker-Typ passt nicht: Kabel hat ${cable.connectorType}, Gerät braucht ${device.requiredConnectorType}.` 
      };
    }
    return { 
      status: 'NO_SPECIFICATION', 
      message: 'Keine genauen elektrischen Leistungsdaten am Gerät hinterlegt. Stecker passt.' 
    };
  }

  const outputs: PowerOutput[] = cable.powerOutputs && cable.powerOutputs.length > 0
    ? cable.powerOutputs
    : [{
        voltage: 5,
        amperage: 1, 
        wattage: 5,
        portType: cable.connectorType as any
      }];

  const errors: string[] = [];
  let hasConnectorMatch = false;

  for (const output of outputs) {
    const connectorMatch = device.requiredConnectorType 
      ? output.portType === device.requiredConnectorType || 
        (output.portType === 'USB-A' && device.requiredConnectorType === 'Micro-USB') ||
        (output.portType === 'USB-C' && device.requiredConnectorType === 'USB-C')
      : true;

    if (!connectorMatch) {
      continue;
    }
    hasConnectorMatch = true;

    if (output.voltage !== reqVolts) {
      errors.push(`Port ${output.portType}: Netzteil hat ${output.voltage}V, Gerät benötigt ${reqVolts}V.`);
      continue;
    }

    if (output.amperage < reqAmps) {
      errors.push(`Port ${output.portType}: Netzteil liefert ${output.amperage}A, Gerät benötigt ${reqAmps}A.`);
      continue;
    }

    return {
      status: 'COMPATIBLE',
      matchingPort: output
    };
  }

  if (!hasConnectorMatch) {
    return {
      status: 'CONNECTOR_MISMATCH',
      message: `Kein physikalisch passender Port am Netzteil gefunden. Benötigt: ${device.requiredConnectorType || 'keine Angabe'}.`
    };
  }

  if (errors.length > 0) {
    const isVoltageIssue = errors.some(e => e.includes('V, Gerät benötigt'));
    if (isVoltageIssue) {
      return { status: 'VOLTAGE_MISMATCH', message: errors.join(' | ') };
    }
    return { status: 'AMPERAGE_TOO_LOW', message: errors.join(' | ') };
  }

  return {
    status: 'CONNECTOR_MISMATCH',
    message: 'Keine kompatible Stromverbindung möglich.'
  };
}


