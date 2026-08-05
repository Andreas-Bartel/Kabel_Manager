import React, { useState, useEffect, useRef } from 'react';
import { Cable as CableIcon, Layers, QrCode, Search, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Plus, Trash2, Link, Link2Off, Info, Sun, Moon, Camera, Upload, Copy, RefreshCw, Printer, Settings, ArrowLeft } from 'lucide-react';
import Fuse from 'fuse.js';
import { Cable, Device, StorageLocation, buildLocationPath, checkPowerCompatibility, CompatibilityResult, ImageAttachment } from './contexts/inventory/domain/types';
import { LocalStorageCableRepository } from './contexts/inventory/infrastructure/LocalStorageCableRepository';
import { LocalStorageDeviceRepository } from './contexts/inventory/infrastructure/LocalStorageDeviceRepository';
import { LocalStorageLocationRepository } from './contexts/inventory/infrastructure/LocalStorageLocationRepository';
import { LinkCableToDeviceUseCase } from './contexts/inventory/application/LinkCableToDeviceUseCase';
import { UnlinkCableFromDeviceUseCase } from './contexts/inventory/application/UnlinkCableFromDeviceUseCase';
import { CreateLocationUseCase } from './contexts/inventory/application/CreateLocationUseCase';
import { DeleteLocationUseCase } from './contexts/inventory/application/DeleteLocationUseCase';
import { DeleteDeviceUseCase } from './contexts/inventory/application/DeleteDeviceUseCase';
import { ExportUserDataUseCase } from './contexts/inventory/application/ExportUserDataUseCase';
import { GetCableByQrPayloadUseCase } from './contexts/inventory/application/GetCableByQrPayloadUseCase';
import { compressImage } from './contexts/shared/infrastructure/imageCompressor';
import { uuidToBase64Url, base64UrlToUuid } from './contexts/labels/domain/types';
import { App as CapApp } from '@capacitor/app';

// Repositories & Use Cases initialisieren
const cableRepo = new LocalStorageCableRepository();
const deviceRepo = new LocalStorageDeviceRepository();
const locationRepo = new LocalStorageLocationRepository();

const linkUseCase = new LinkCableToDeviceUseCase(cableRepo, deviceRepo);
const unlinkUseCase = new UnlinkCableFromDeviceUseCase(cableRepo, deviceRepo);
const createLocationUseCase = new CreateLocationUseCase(locationRepo);
const deleteLocationUseCase = new DeleteLocationUseCase(locationRepo);
const deleteDeviceUseCase = new DeleteDeviceUseCase(cableRepo, deviceRepo);
const exportUseCase = new ExportUserDataUseCase(cableRepo, deviceRepo, locationRepo);
const getCableByQrUseCase = new GetCableByQrPayloadUseCase(cableRepo);

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function App() {
  // State
  const [cables, setCables] = useState<Cable[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ cables: Cable[]; devices: Device[] }>({ cables: [], devices: [] });

  // Gast Benutzer-ID
  const [currentUserId, setCurrentUserId] = useState('');

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(true);

  // Tab Navigation
  const [activeTab, setActiveTab] = useState<'home' | 'overview' | 'locations' | 'cables' | 'chargers' | 'devices' | 'scan' | 'settings'>('home');

  // Form States - Location
  const [locName, setLocName] = useState('');
  const [locParent, setLocParent] = useState('');
  const [locDesc, setLocDesc] = useState('');

  // Form States - Cable/Charger
  const [cabName, setCabName] = useState('');
  const [cabConnector, setCabConnector] = useState<'USB-C' | 'Micro-USB' | 'Lightning' | 'HDMI' | 'DisplayPort' | 'DC-Jack' | 'Other'>('USB-C');
  const [cabLocation, setCabLocation] = useState('');
  const [cabIsMulti, setCabIsMulti] = useState(false);
  const [cabImage, setCabImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [ports, setPorts] = useState<{ voltage: number; amperage: number; wattage: number; portType: string }[]>([
    { voltage: 5, amperage: 2, wattage: 10, portType: 'USB-C' }
  ]);
  const [cabChargerType, setCabChargerType] = useState<'only_ports' | 'only_fixed_cable' | 'hybrid'>('only_ports');
  const [cabFixedLength, setCabFixedLength] = useState('');
  const [cabFixedPower, setCabFixedPower] = useState('');
  const [cabFixedConnector, setCabFixedConnector] = useState('USB-C');


  // Form States - Device
  const [devName, setDevName] = useState('');
  const [devBrand, setDevBrand] = useState('');
  const [devConnector, setDevConnector] = useState('USB-C');
  const [devVoltage, setDevVoltage] = useState(5);
  const [devAmperage, setDevAmperage] = useState(2);
  const [devLocation, setDevLocation] = useState('');

  const [activeOverviewList, setActiveOverviewList] = useState<'none' | 'cables' | 'chargers' | 'devices' | 'locations'>('none');
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});

  // Form States - Cable new attributes (Schritt 5 & Eigenschaften verwalten)
  const [cabCableStandard1, setCabCableStandard1] = useState('');
  const [cabCableStandard2, setCabCableStandard2] = useState('');
  const [cabLength, setCabLength] = useState('');
  const [cabColor, setCabColor] = useState('');
  const [cabCondition, setCabCondition] = useState('');
  const [cabMaterial, setCabMaterial] = useState('');
  const [cabDataRate, setCabDataRate] = useState('');
  const [cabChargingPower, setCabChargingPower] = useState('');
  const [cabBrand, setCabBrand] = useState('');
  const [cabConnectorType1, setCabConnectorType1] = useState('USB-C');
  const [cabConnectorType2, setCabConnectorType2] = useState('USB-C');
  const [customPropValues, setCustomPropValues] = useState<Record<string, string>>({});
  
  const [cabImages, setCabImages] = useState<ImageAttachment[]>([]);
  const [devImages, setDevImages] = useState<ImageAttachment[]>([]);
  const [tempCabImageLabel, setTempCabImageLabel] = useState('Gesamtansicht');
  const [tempDevImageLabel, setTempDevImageLabel] = useState('Gesamtansicht');
  const [cabLocParentId, setCabLocParentId] = useState<string | undefined>(undefined);
  const [devLocParentId, setDevLocParentId] = useState<string | undefined>(undefined);
  const [settingsView, setSettingsView] = useState<'menu' | 'layout' | 'properties' | 'export' | 'about'>('menu');

  // Setze den Einstellungs-Tab bei Wechsel zurück auf das Hauptmenü
  useEffect(() => {
    if (activeTab !== 'settings') {
      setSettingsView('menu');
    }
  }, [activeTab]);


  // Option lists for Cable attributes
  const [cableStandardGroups, setCableStandardGroups] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('list_cable_standards_grouped');
    return saved ? JSON.parse(saved) : {
      usb: ['USB 2.0', 'USB 3.0', 'USB 3.1', 'USB 3.2', 'USB4', 'Kein USB-Standard'],
      hdmi: ['HDMI 1.4', 'HDMI 2.0', 'HDMI 2.1', 'HDMI 2.1a'],
      displayport: ['DP 1.2', 'DP 1.4', 'DP 2.0', 'DP 2.1'],
      lightning: ['Lightning MFi-Zertifiziert'],
      other: ['Kein Standard / Spezifisch']
    };
  });
  const [lengths, setLengths] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_lengths');
    return saved ? JSON.parse(saved) : ['0.25m', '0.5m', '1m', '1.5m', '2m', '3m', '5m'];
  });
  const [colors, setColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_colors');
    return saved ? JSON.parse(saved) : ['Schwarz', 'Weiß', 'Grau', 'Blau', 'Rot', 'Grün', 'Silber', 'Gold'];
  });
  const [conditions, setConditions] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_conditions');
    return saved ? JSON.parse(saved) : ['Neu', 'Sehr gut', 'Gebraucht', 'Defekt'];
  });
  const [materials, setMaterials] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_materials');
    return saved ? JSON.parse(saved) : ['Kunststoff', 'Nylon geflochten', 'Gummi', 'Textil'];
  });
  const [dataRates, setDataRates] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_data_rates');
    return saved ? JSON.parse(saved) : ['480 Mbps', '5 Gbps', '10 Gbps', '20 Gbps', '40 Gbps', 'Nur Laden'];
  });
  const [chargingPowers, setChargingPowers] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_charging_powers');
    return saved ? JSON.parse(saved) : ['15W', '60W', '100W', '240W', 'Keine'];
  });
  const [brands, setBrands] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_brands');
    return saved ? JSON.parse(saved) : ['Belkin', 'Anker', 'Apple', 'Samsung', 'Ugreen', 'Generisch'];
  });
  const [connectors, setConnectors] = useState<string[]>(() => {
    const saved = localStorage.getItem('list_connectors');
    return saved ? JSON.parse(saved) : ['USB-C', 'USB-A', 'Micro-USB', 'Lightning', 'HDMI', 'DisplayPort', 'DC-Jack', 'Klinke (3.5mm)'];
  });

  // Custom properties definitions
  const [customProperties, setCustomProperties] = useState<{ id: string; label: string; values: string[] }[]>(() => {
    const saved = localStorage.getItem('list_custom_properties');
    return saved ? JSON.parse(saved) : [];
  });

  // Helper to determine active group for connector standards
  const getConnectorFamily = (conn: string): string => {
    const c = conn.toLowerCase();
    if (c.includes('usb')) return 'usb';
    if (c.includes('hdmi')) return 'hdmi';
    if (c.includes('displayport') || c.includes('dp')) return 'displayport';
    if (c.includes('lightning')) return 'lightning';
    return 'other';
  };

  const handleSelectChange = (
    field: string, 
    value: string, 
    optionsList: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>, 
    storageKey: string,
    setFormValue: (v: string) => void
  ) => {
    if (value === '__ADD_NEW__') {
      const newValue = prompt(`Neuen Wert für "${field}" eingeben:`);
      if (newValue && newValue.trim()) {
        const trimmed = newValue.trim();
        if (!optionsList.includes(trimmed)) {
          const updated = [...optionsList, trimmed];
          setList(updated);
          localStorage.setItem(storageKey, JSON.stringify(updated));
          setFormValue(trimmed);
        } else {
          setFormValue(trimmed);
        }
      } else {
        setFormValue(''); // Reset if cancelled
      }
    } else {
      setFormValue(value);
    }
  };

  const handleCableStandardSelect = (index: 1 | 2, val: string) => {
    const conn = index === 1 ? cabConnectorType1 : cabConnectorType2;
    const family = getConnectorFamily(conn);
    const setCabCableStandard = index === 1 ? setCabCableStandard1 : setCabCableStandard2;
    
    if (val === '__ADD_NEW__') {
      const newVal = prompt(`Neuen Kabel-Standard für Steckerfamilie "${family.toUpperCase()}" eingeben:`);
      if (newVal && newVal.trim()) {
        const trimmed = newVal.trim();
        const currentGroup = cableStandardGroups[family] || [];
        if (!currentGroup.includes(trimmed)) {
          const updated = {
            ...cableStandardGroups,
            [family]: [...currentGroup, trimmed]
          };
          setCableStandardGroups(updated);
          localStorage.setItem('list_cable_standards_grouped', JSON.stringify(updated));
          setCabCableStandard(trimmed);
        } else {
          setCabCableStandard(trimmed);
        }
      } else {
        setCabCableStandard('');
      }
    } else {
      setCabCableStandard(val);
    }
  };

  const [selectedCableDetails, setSelectedCableDetails] = useState<Cable | null>(null);
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<Device | null>(null);

  // Handhabung des Android-Zurück-Buttons (Hardware Back Button)
  useEffect(() => {
    const handler = CapApp.addListener('backButton', () => {
      if (selectedCableDetails) {
        setSelectedCableDetails(null);
      } else if (selectedDeviceDetails) {
        setSelectedDeviceDetails(null);
      } else if (activeTab === 'settings' && settingsView !== 'menu') {
        setSettingsView('menu');
      } else if (activeTab !== 'overview') {
        setActiveTab('overview');
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [selectedCableDetails, selectedDeviceDetails, activeTab, settingsView]);

  const [newCustomPropLabel, setNewCustomPropLabel] = useState('');
  const [tempPropValues, setTempPropValues] = useState<Record<string, string>>({});

  const handleAddPropValue = (storageKey: string, currentValues: string[], setList: Function, newValue: string) => {
    if (!newValue.trim()) return;
    const trimmed = newValue.trim();
    if (!currentValues.includes(trimmed)) {
      const updated = [...currentValues, trimmed];
      setList(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  };

  const handleRemovePropValue = (storageKey: string, currentValues: string[], setList: Function, valueToRemove: string) => {
    const updated = currentValues.filter(v => v !== valueToRemove);
    setList(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleAddCableStandard = (family: string, newValue: string) => {
    if (!newValue.trim()) return;
    const trimmed = newValue.trim();
    const currentGroup = cableStandardGroups[family] || [];
    if (!currentGroup.includes(trimmed)) {
      const updated = {
        ...cableStandardGroups,
        [family]: [...currentGroup, trimmed]
      };
      setCableStandardGroups(updated);
      localStorage.setItem('list_cable_standards_grouped', JSON.stringify(updated));
    }
  };

  const handleRemoveCableStandard = (family: string, valueToRemove: string) => {
    const currentGroup = cableStandardGroups[family] || [];
    const updated = {
      ...cableStandardGroups,
      [family]: currentGroup.filter(v => v !== valueToRemove)
    };
    setCableStandardGroups(updated);
    localStorage.setItem('list_cable_standards_grouped', JSON.stringify(updated));
  };

  const handleCreateCustomProperty = () => {
    if (!newCustomPropLabel.trim()) return;
    const label = newCustomPropLabel.trim();
    const id = `custom_${Date.now()}`;
    const newProp = { id, label, values: [] };
    const updated = [...customProperties, newProp];
    setCustomProperties(updated);
    localStorage.setItem('list_custom_properties', JSON.stringify(updated));
    setNewCustomPropLabel('');
  };

  const handleDeleteCustomProperty = (id: string) => {
    if (confirm("Möchtest du diese gesamte Eigenschaftskategorie wirklich löschen?")) {
      const updated = customProperties.filter(p => p.id !== id);
      setCustomProperties(updated);
      localStorage.setItem('list_custom_properties', JSON.stringify(updated));
    }
  };

  const handleAddCustomPropValue = (propId: string, newValue: string) => {
    if (!newValue.trim()) return;
    const trimmed = newValue.trim();
    const updated = customProperties.map(p => {
      if (p.id === propId) {
        if (!p.values.includes(trimmed)) {
          return { ...p, values: [...p.values, trimmed] };
        }
      }
      return p;
    });
    setCustomProperties(updated);
    localStorage.setItem('list_custom_properties', JSON.stringify(updated));
  };

  const handleRemoveCustomPropValue = (propId: string, valueToRemove: string) => {
    const updated = customProperties.map(p => {
      if (p.id === propId) {
        return { ...p, values: p.values.filter(v => v !== valueToRemove) };
      }
      return p;
    });
    setCustomProperties(updated);
    localStorage.setItem('list_custom_properties', JSON.stringify(updated));
  };

  // Form States - Compatibility Check
  const [selectedCableId, setSelectedCableId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [compatResult, setCompatResult] = useState<CompatibilityResult | null>(null);

  // QR-Scanner & Dauer-Scan (Schritt 17)
  const [cameraActive, setCameraActive] = useState(false);
  const [scanResultCable, setScanResultCable] = useState<Cable | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isContinuousScan, setIsContinuousScan] = useState(false);
  const [continuousScanHistory, setContinuousScanHistory] = useState<Cable[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sticker Ummanning (Schritt 19)
  const [reassigningCableId, setReassigningCableId] = useState<string | null>(null);

  // Register PWA Service Worker (Schritt 18) - Im DEV-Modus deaktivieren, um Caching-Konflikte zu vermeiden
  useEffect(() => {
    if (import.meta.env.DEV) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log("Stale Service Worker unregistered in DEV mode.");
                window.location.reload();
              }
            });
          }
        });
      }
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    
    let anonId = localStorage.getItem('cable_guy_anon_user_id');
    if (!anonId) {
      anonId = generateUUID();
      localStorage.setItem('cable_guy_anon_user_id', anonId);
    }
    setCurrentUserId(anonId);
    refreshData();
  }, []);

  // Sync Dark Mode variables to Document Root
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.style.setProperty('--bg-primary', '#0a0b10');
      root.style.setProperty('--bg-secondary', '#121420');
      root.style.setProperty('--bg-tertiary', '#1b1e32');
      root.style.setProperty('--bg-glass', 'rgba(18, 20, 32, 0.7)');
      root.style.setProperty('--border-glass', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--text-primary', '#f3f4f6');
      root.style.setProperty('--text-secondary', '#9ca3af');
      root.style.setProperty('--icon-filter', 'invert(1)');
    } else {
      root.style.setProperty('--bg-primary', '#f9fafb');
      root.style.setProperty('--bg-secondary', '#ffffff');
      root.style.setProperty('--bg-tertiary', '#f3f4f6');
      root.style.setProperty('--bg-glass', 'rgba(255, 255, 255, 0.8)');
      root.style.setProperty('--border-glass', 'rgba(0, 0, 0, 0.06)');
      root.style.setProperty('--text-primary', '#111827');
      root.style.setProperty('--text-secondary', '#4b5563');
      root.style.setProperty('--icon-filter', 'none');
    }
  }, [darkMode]);

  const refreshData = async () => {
    const c = await cableRepo.getAllCables();
    // Migration: Bereinige normale Kabel, die fälschlicherweise mit powerOutputs gespeichert wurden
    let migrated = false;
    const cleanedCables = c.map(cable => {
      if (!cable.isMultiOutput && cable.powerOutputs !== undefined) {
        migrated = true;
        return { ...cable, powerOutputs: undefined };
      }
      return cable;
    });
    if (migrated) {
      for (const cab of cleanedCables) {
        await cableRepo.saveCable(cab);
      }
    }

    const d = await deviceRepo.getAllDevices();
    const l = await locationRepo.getAllLocations();
    setCables(cleanedCables);
    setDevices(d);
    setLocations(l);
  };

  const renderLocationTreeSelector = (
    currentParentId: string | undefined,
    setCurrentParentId: (id: string | undefined) => void,
    selectedLocationId: string,
    setSelectedLocationId: (id: string) => void,
    label: string
  ) => {
    // Top-level or current children
    const visibleLocations = locations.filter(l => 
      currentParentId === undefined 
        ? !l.parentLocationId 
        : l.parentLocationId === currentParentId
    );

    // Build path of currentParentId to show breadcrumbs
    const getPathNodes = (parentId: string | undefined): StorageLocation[] => {
      if (!parentId) return [];
      const loc = locations.find(l => l.id === parentId);
      if (!loc) return [];
      return [...getPathNodes(loc.parentLocationId), loc];
    };

    const breadcrumbs = getPathNodes(currentParentId);
    const selectedLocName = selectedLocationId ? buildLocationPath(selectedLocationId, locations) : 'Kein Ort ausgewählt';

    return (
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {label} (Baumstruktur)
        </div>
        
        {/* Selected indicator */}
        <div style={{ fontSize: '0.85rem', color: selectedLocationId ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
          Auswahl: {selectedLocName}
          {selectedLocationId && (
            <button 
              type="button" 
              onClick={() => setSelectedLocationId('')} 
              style={{ marginLeft: '0.5rem', background: 'none', color: 'var(--error)', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              (Zurücksetzen)
            </button>
          )}
        </div>

        {/* Breadcrumbs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '4px' }}>
          <span 
            onClick={() => setCurrentParentId(undefined)} 
            style={{ cursor: 'pointer', color: currentParentId === undefined ? 'var(--text-primary)' : 'var(--accent-secondary)', textDecoration: currentParentId === undefined ? 'none' : 'underline' }}
          >
            Start
          </span>
          {breadcrumbs.map((node, i) => (
            <React.Fragment key={node.id}>
              <span style={{ color: 'var(--text-muted)' }}>&gt;</span>
              <span 
                onClick={() => setCurrentParentId(node.id)} 
                style={{ cursor: 'pointer', color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--accent-secondary)', textDecoration: i === breadcrumbs.length - 1 ? 'none' : 'underline' }}
              >
                {node.name}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* List of sub-locations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '4px', padding: '0.5rem', background: 'rgba(0,0,0,0.1)' }}>
          {visibleLocations.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keine untergeordneten Orte vorhanden.</span>
          ) : (
            visibleLocations.map(loc => {
              const hasSub = locations.some(l => l.parentLocationId === loc.id);
              const isSelected = selectedLocationId === loc.id;
              return (
                <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem', borderRadius: '4px', background: isSelected ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)', border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                  <span 
                    onClick={() => hasSub && setCurrentParentId(loc.id)} 
                    style={{ fontSize: '0.85rem', cursor: hasSub ? 'pointer' : 'default', fontWeight: hasSub ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}
                  >
                    {hasSub ? '📁' : '📍'} {loc.name} {hasSub && <span style={{ fontSize: '0.7rem', color: 'var(--accent-secondary)' }}>(Öffnen)</span>}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedLocationId(loc.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '3px',
                      background: isSelected ? 'var(--success)' : 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-glass)',
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? '✓ Gewählt' : 'Wählen'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Back one level button */}
        {currentParentId !== undefined && (
          <button 
            type="button" 
            onClick={() => {
              const currentLoc = locations.find(l => l.id === currentParentId);
              setCurrentParentId(currentLoc?.parentLocationId || undefined);
            }} 
            style={{ fontSize: '0.75rem', background: 'none', color: 'var(--accent-secondary)', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            ← Eine Ebene nach oben
          </button>
        )}
      </div>
    );
  };

  const renderLocationTree = (parentId: string | undefined, depth: number): React.ReactNode => {
    const levelLocs = locations.filter(l => 
      parentId === undefined 
        ? !l.parentLocationId 
        : l.parentLocationId === parentId
    );

    if (levelLocs.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginLeft: depth > 0 ? '1rem' : 0, borderLeft: depth > 0 ? '1px dashed var(--border-glass)' : 'none', paddingLeft: depth > 0 ? '0.5rem' : 0 }}>
        {levelLocs.map(loc => {
          const hasSub = locations.some(l => l.parentLocationId === loc.id);
          const isExpanded = !!expandedLocations[loc.id];
          return (
            <div key={loc.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                <span 
                  onClick={() => {
                    if (hasSub) {
                      setExpandedLocations(prev => ({ ...prev, [loc.id]: !prev[loc.id] }));
                    }
                  }}
                  style={{ fontSize: '0.85rem', fontWeight: hasSub ? 600 : 'normal', cursor: hasSub ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}
                >
                  {hasSub ? (isExpanded ? '▼ 📁' : '▶ 📁') : '📍'} {loc.name} {loc.description && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({loc.description})</span>}
                </span>
                <button 
                  onClick={() => handleDeleteLocation(loc.id)} 
                  style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.2rem' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {hasSub && isExpanded && renderLocationTree(loc.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  // Fuzzy Search mit Fuse.js
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ cables: [], devices: [] });
      return;
    }
    const fuseCables = new Fuse(cables, { keys: ['name', 'description', 'connectorType'], threshold: 0.4 });
    const fuseDevices = new Fuse(devices, { keys: ['name', 'manufacturer', 'requiredConnectorType'], threshold: 0.4 });

    setSearchResults({
      cables: fuseCables.search(searchQuery).map(r => r.item),
      devices: fuseDevices.search(searchQuery).map(r => r.item)
    });
  }, [searchQuery, cables, devices]);

  // Actions - Location
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newLoc = await createLocationUseCase.execute(locName, locParent || undefined, locDesc);
      newLoc.userId = currentUserId;
      await locationRepo.saveLocation(newLoc);
      setLocName('');
      setLocParent('');
      setLocDesc('');
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (confirm("Lagerort wirklich löschen? Untergeordnete Orte werden eine Ebene nach oben verschoben.")) {
      await deleteLocationUseCase.execute(id);
      refreshData();
    }
  };

  // Actions - Cable & Device Images
  const handleImageAttachmentUpload = async (context: 'cable' | 'device', file: File, label: string) => {
    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      const newImage: ImageAttachment = {
        id: generateUUID(),
        url: compressed,
        label: label.trim() || 'Unbenannt'
      };
      if (context === 'cable') {
        setCabImages(prev => [...prev, newImage]);
      } else {
        setDevImages(prev => [...prev, newImage]);
      }
    } catch (err) {
      alert("Fehler bei der Bildkomprimierung.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImageAttachment = (context: 'cable' | 'device', id: string) => {
    if (context === 'cable') {
      setCabImages(prev => prev.filter(img => img.id !== id));
    } else {
      setDevImages(prev => prev.filter(img => img.id !== id));
    }
  };

  const handleCreateCable = async (e: React.FormEvent) => {
    e.preventDefault();
    const powerOutputs = cabIsMulti && (cabChargerType === 'only_ports' || cabChargerType === 'hybrid')
      ? ports.map(p => ({
          voltage: p.voltage || 5,
          amperage: p.amperage || (p.wattage / 5),
          wattage: p.wattage || (p.voltage * p.amperage),
          portType: p.portType as any
        }))
      : undefined;

    const newCable: Cable = {
      id: generateUUID(),
      name: cabName,
      connectorType: cabIsMulti 
        ? (cabChargerType === 'only_ports' 
            ? (ports[0]?.portType as any || 'Other') 
            : (cabFixedConnector as any))
        : (cabConnectorType1 as any),
      locationId: cabLocation || undefined,
      isMultiOutput: cabIsMulti,
      powerOutputs,
      imageUrl: cabImages[0]?.url || undefined,
      userId: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Eigenschaften für Ladegeräte (Version 1.2.0)
      chargerType: cabIsMulti ? cabChargerType : undefined,
      fixedCableLength: cabIsMulti && (cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') ? (cabFixedLength || undefined) : undefined,
      fixedCablePower: cabIsMulti && (cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') ? (cabFixedPower || undefined) : undefined,
      fixedCableConnector: cabIsMulti && (cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') ? (cabFixedConnector || undefined) : undefined,

      // Neue Eigenschaften (Schritt 5)
      cableStandard1: cabCableStandard1 || undefined,
      cableStandard2: cabCableStandard2 || undefined,
      length: cabLength || undefined,
      color: cabColor || undefined,
      condition: cabCondition || undefined,
      material: cabMaterial || undefined,
      dataRate: cabDataRate || undefined,
      chargingPower: cabChargingPower || undefined,
      brand: cabBrand || undefined,
      connectorType1: cabConnectorType1 || undefined,
      connectorType2: cabConnectorType2 || undefined,
      additionalProperties: Object.keys(customPropValues).length > 0 ? customPropValues : undefined,
      images: cabImages.length > 0 ? cabImages : undefined
    };

    await cableRepo.saveCable(newCable);
    setCabName('');
    setCabLocation('');
    setCabIsMulti(false);
    setCabImages([]);
    setTempCabImageLabel('Gesamtansicht');
    setCabLocParentId(undefined);
    setCabCableStandard1('');
    setCabCableStandard2('');
    setCabLength('');
    setCabColor('');
    setCabCondition('');
    setCabMaterial('');
    setCabDataRate('');
    setCabChargingPower('');
    setCabBrand('');
    setCabConnectorType1('USB-C');
    setCabConnectorType2('USB-C');
    setCustomPropValues({});
    setCabChargerType('only_ports');
    setCabFixedLength('');
    setCabFixedPower('');
    setCabFixedConnector('USB-C');
    setPorts([{ voltage: 5, amperage: 2, wattage: 10, portType: 'USB-C' }]);
    refreshData();
  };

  // Duplizier-Funktion (Schritt 20)
  const handleDuplicateCable = async (cable: Cable) => {
    const duplicatedCable: Cable = {
      ...cable,
      id: generateUUID(),
      name: `${cable.name} (Kopie)`,
      assignedDeviceIds: [], // Verknüpfungen zurücksetzen
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await cableRepo.saveCable(duplicatedCable);
    refreshData();
  };

  // Actions - Device
  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const newDevice: Device = {
      id: generateUUID(),
      name: devName,
      manufacturer: devBrand || undefined,
      requiredVoltage: devVoltage,
      requiredAmperage: devAmperage,
      requiredConnectorType: devConnector,
      locationId: devLocation || undefined,
      userId: currentUserId,
      createdAt: new Date().toISOString(),
      images: devImages.length > 0 ? devImages : undefined
    };

    await deviceRepo.saveDevice(newDevice);
    setDevName('');
    setDevBrand('');
    setDevLocation('');
    setDevImages([]);
    setTempDevImageLabel('Gesamtansicht');
    setDevLocParentId(undefined);
    refreshData();
  };

  const handleDeleteDevice = async (id: string) => {
    if (confirm("Gerät wirklich löschen? Zugehörige Kabel bleiben als 'verwaist' erhalten.")) {
      await deleteDeviceUseCase.execute(id);
      refreshData();
    }
  };

  const handleDeleteCable = async (id: string) => {
    if (confirm("Kabel wirklich löschen?")) {
      await cableRepo.deleteCable(id);
      refreshData();
    }
  };

  // Link / Unlink
  const handleLink = async (cableId: string, deviceId: string) => {
    await linkUseCase.execute(cableId, deviceId);
    refreshData();
  };

  const handleUnlink = async (cableId: string, deviceId: string) => {
    await unlinkUseCase.execute(cableId, deviceId);
    refreshData();
  };

  const handleCheckCompatibility = () => {
    const cab = cables.find(c => c.id === selectedCableId);
    const dev = devices.find(d => d.id === selectedDeviceId);
    if (cab && dev) {
      const res = checkPowerCompatibility(cab, dev);
      setCompatResult(res);
    } else {
      setCompatResult(null);
    }
  };

  // Export
  const handleExportData = async () => {
    const takeout = await exportUseCase.execute(currentUserId);
    const blob = new Blob([JSON.stringify(takeout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cable-guy-takeout-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Kamera
  const startCamera = async () => {
    setScanResultCable(null);
    setScanError(null);
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraActive(false);
      setScanError("Kamerazugriff verweigert oder nicht unterstützt. Nutze den Datei-Fallback.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  // Scan & Dauer-Scan Simulation (Schritt 17 & Schritt 19)
  const handleSimulatorScan = async (base64Payload: string) => {
    try {
      setScanError(null);

      // Falls wir uns im "Sticker ummappen" Modus befinden
      if (reassigningCableId) {
        const targetCable = await cableRepo.getCableById(reassigningCableId);
        if (!targetCable) throw new Error("Zielkabel nicht gefunden.");
        
        // Lösche alten Eintrag
        await cableRepo.deleteCable(reassigningCableId);
        
        // Speichere mit neuer ID aus dem gescannten QR-Code
        const newUuid = base64UrlToUuid(base64Payload);
        const updatedCable: Cable = {
          ...targetCable,
          id: newUuid,
          updatedAt: new Date().toISOString()
        };
        await cableRepo.saveCable(updatedCable);
        setReassigningCableId(null);
        alert("Sticker erfolgreich neu verlinkt!");
        refreshData();
        return;
      }

      const cable = await getCableByQrUseCase.execute(base64Payload, currentUserId);
      
      if (isContinuousScan) {
        setContinuousScanHistory(prev => {
          if (prev.some(c => c.id === cable.id)) return prev; // Duplikatsvermeidung in Historie
          return [cable, ...prev];
        });
      } else {
        setScanResultCable(cable);
        stopCamera();
      }
    } catch (err: any) {
      if (!isContinuousScan) {
        setScanResultCable(null);
      }
      setScanError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* CSS-Druckbogen Style (Schritt 16) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-sheet, .print-sheet * {
            visibility: visible;
          }
          .print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            height: 297mm;
            background: white !important;
            color: black !important;
            display: grid !important;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            padding: 20px;
          }
          .print-sticker {
            border: 1px dashed #666;
            border-radius: 8px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 45mm;
            text-align: center;
          }
          .print-qr-mock {
            width: 25mm;
            height: 25mm;
            border: 2px solid black;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .print-label {
            font-size: 8px;
            font-family: sans-serif;
            color: black;
          }
        }
        .tile-btn {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease;
        }
        .tile-btn:hover {
          transform: translateY(-4px);
          border-color: var(--accent-primary) !important;
          box-shadow: 0 8px 24px var(--accent-glow) !important;
        }
      `}</style>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-glass)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('home'); }}>
          <CableIcon size={24} style={{ color: 'var(--accent-primary)' }} />
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Kabel Manager</h1>
        </div>

        <button 
          onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('settings'); }}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.6rem', borderRadius: '50%', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Settings size={18} />
        </button>
      </header>

      {activeTab !== 'home' && (
        <button 
          onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('home'); }} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem', padding: 0 }}
        >
          <ArrowLeft size={16} /> Zurück
        </button>
      )}

      {/* Fuzzy Search (nur in Unterseiten anzeigen, nicht auf Home) */}
      {activeTab !== 'home' && activeTab !== 'settings' && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Search size={20} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              width: '100%',
              fontFamily: 'var(--font-sans)'
            }}
          />
        </div>
      )}

      {/* Search Results (nur in Unterseiten anzeigen) */}
      {activeTab !== 'home' && activeTab !== 'settings' && searchQuery && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Suchergebnisse</h3>
          {searchResults.cables.length === 0 && searchResults.devices.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>Keine passenden Kabel/Geräte gefunden.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {searchResults.cables.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCableDetails(c)}
                style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span>🔌 {c.name} ({c.connectorType1 && c.connectorType2 ? `${c.connectorType1} ↔ ${c.connectorType2}` : c.connectorType})</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Auswählen</span>
              </div>
            ))}
            {searchResults.devices.map(d => (
              <div 
                key={d.id} 
                onClick={() => setSelectedDeviceDetails(d)}
                style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span>📱 {d.name} ({d.manufacturer || 'Generisch'})</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>Auswählen</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOME DASHBOARD TILE GRID */}
      {activeTab === 'home' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          {/* Tile 1: Übersicht */}
          <div onClick={() => setActiveTab('overview')} className="glass-panel tile-btn" style={{ padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <img src="/icons/overview.png" alt="Übersicht" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Übersicht</span>
          </div>

          {/* Tile 2: Scan / QR */}
          <div onClick={() => { setActiveTab('scan'); startCamera(); }} className="glass-panel tile-btn" style={{ padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <img src="/icons/scan.png" alt="Scan / QR" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Scan / QR</span>
          </div>

          {/* Tile 3: Kabel */}
          <div onClick={() => setActiveTab('cables')} className="glass-panel tile-btn" style={{ padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <img src="/icons/cables.png" alt="Kabel" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Kabel</span>
          </div>

          {/* Tile 4: Ladegeräte */}
          <div onClick={() => setActiveTab('chargers')} className="glass-panel tile-btn" style={{ padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <img src="/icons/chargers.png" alt="Ladegeräte" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Ladegeräte</span>
          </div>

          {/* Tile 5: Geräte */}
          <div onClick={() => setActiveTab('devices')} className="glass-panel tile-btn" style={{ padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <img src="/icons/devices.png" alt="Geräte" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Geräte</span>
          </div>

          {/* Tile 6: Lagerorte */}
          <div onClick={() => setActiveTab('locations')} className="glass-panel tile-btn" style={{ padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <img src="/icons/locations.png" alt="Lagerorte" style={{ width: '56px', height: '56px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Lagerorte</span>
          </div>
        </div>
        </>
      )}
      
      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && !searchQuery && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="glass-panel" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Dein Kabel-Inventar</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div 
                onClick={() => setActiveOverviewList(prev => prev === 'cables' ? 'none' : 'cables')} 
                style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', cursor: 'pointer', border: activeOverviewList === 'cables' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Kabel</div>
              </div>
              
              <div 
                onClick={() => setActiveOverviewList(prev => prev === 'chargers' ? 'none' : 'chargers')} 
                style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', cursor: 'pointer', border: activeOverviewList === 'chargers' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Ladegeräte</div>
              </div>

              <div 
                onClick={() => setActiveOverviewList(prev => prev === 'devices' ? 'none' : 'devices')} 
                style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', cursor: 'pointer', border: activeOverviewList === 'devices' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>{devices.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Geräte</div>
              </div>

              <div 
                onClick={() => setActiveOverviewList(prev => prev === 'locations' ? 'none' : 'locations')} 
                style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', cursor: 'pointer', border: activeOverviewList === 'locations' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                  {locations.filter(loc => cables.some(c => c.locationId === loc.id) || devices.some(d => d.locationId === loc.id)).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Lagerorte</div>
              </div>
            </div>

            {/* Inline Kabel-Liste */}
            {activeOverviewList === 'cables' && (
              <div className="glass-panel" style={{ padding: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Registrierte Kabel</span>
                  <button onClick={() => setActiveOverviewList('none')} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Schließen</button>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)).length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keine Kabel registriert.</span>
                  ) : (
                    cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)).map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedCableDetails(c)}
                        style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}
                      >
                        <strong>🔌 {c.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {c.connectorType1 && c.connectorType2 ? `${c.connectorType1} ↔ ${c.connectorType2}` : c.connectorType}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Inline Ladegeräte-Liste */}
            {activeOverviewList === 'chargers' && (
              <div className="glass-panel" style={{ padding: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Registrierte Ladegeräte</span>
                  <button onClick={() => setActiveOverviewList('none')} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Schließen</button>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)).length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keine Ladegeräte registriert.</span>
                  ) : (
                    cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)).map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedCableDetails(c)}
                        style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}
                      >
                        <strong>🔋 {c.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {c.powerOutputs?.map(p => `${p.wattage}W`).join(', ') || c.connectorType}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Inline Geräte-Liste */}
            {activeOverviewList === 'devices' && (
              <div className="glass-panel" style={{ padding: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Registrierte Geräte</span>
                  <button onClick={() => setActiveOverviewList('none')} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Schließen</button>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {devices.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keine Geräte registriert.</span>
                  ) : (
                    devices.map(d => (
                      <div 
                        key={d.id} 
                        onClick={() => setSelectedDeviceDetails(d)}
                        style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}
                      >
                        <strong>📱 {d.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {d.manufacturer || 'Generisch'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Hierarchische Lagerort-Übersicht bei Klick auf Lagerorte */}
            {activeOverviewList === 'locations' && (
              <div className="glass-panel" style={{ padding: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Lagerorte mit zugewiesenen Komponenten</span>
                  <button 
                    onClick={() => setActiveOverviewList('none')} 
                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                  >
                    Schließen
                  </button>
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {locations.map(loc => {
                    const locCables = cables.filter(c => c.locationId === loc.id && !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0));
                    const locChargers = cables.filter(c => c.locationId === loc.id && (c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)));
                    const locDevices = devices.filter(d => d.locationId === loc.id);
                    
                    const totalItems = locCables.length + locChargers.length + locDevices.length;
                    if (totalItems === 0) return null; // Nur Lagerorte mit zugewiesenen Komponenten
                    
                    return (
                      <div key={loc.id} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.25rem' }}>
                          📍 {buildLocationPath(loc.id, locations)} ({totalItems})
                        </div>
                        
                        {/* List Cables */}
                        {locCables.length > 0 && (
                          <div style={{ paddingLeft: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Kabel:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                              {locCables.map(c => (
                                <span 
                                  key={c.id} 
                                  onClick={() => setSelectedCableDetails(c)}
                                  className="btn-primary" 
                                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', cursor: 'pointer', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '3px' }}
                                >
                                  🔌 {c.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* List Chargers */}
                        {locChargers.length > 0 && (
                          <div style={{ paddingLeft: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ladegeräte:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                              {locChargers.map(c => (
                                <span 
                                  key={c.id} 
                                  onClick={() => setSelectedCableDetails(c)}
                                  className="btn-primary" 
                                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', cursor: 'pointer', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '3px' }}
                                >
                                  🔋 {c.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* List Devices */}
                        {locDevices.length > 0 && (
                          <div style={{ paddingLeft: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Geräte:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                              {locDevices.map(d => (
                                <span 
                                  key={d.id} 
                                  onClick={() => setSelectedDeviceDetails(d)}
                                  className="btn-primary" 
                                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', cursor: 'pointer', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '3px' }}
                                >
                                  📱 {d.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!locations.some(loc => {
                    const total = cables.filter(c => c.locationId === loc.id).length + devices.filter(d => d.locationId === loc.id).length;
                    return total > 0;
                  }) && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keinen Lagerorten sind Komponenten zugewiesen.</span>
                  )}
                </div>
              </div>
            )}
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn-primary" onClick={() => { setActiveTab('scan'); startCamera(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem' }}>
              <QrCode size={20} />
              Sticker scannen (Kamera)
            </button>
            <button onClick={handleExportData} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', width: '100%', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
              <Upload size={18} />
              Datenexport (.json)
            </button>
          </section>
        </div>
      )}

      {/* TAB: SCAN / QR (Dauer-Scan, Drucken, Ummampen) */}
      {activeTab === 'scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* A4 QR-Druckbogen (Schritt 16) */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem' }}>Etikettenbögen drucken</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Drucke einen passgenauen A4-Bogen mit QR-Codes deiner Kabel aus.</p>
            </div>
            <button onClick={() => window.print()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Printer size={16} /> Drucken
            </button>
          </div>

          {/* Scanner UI */}
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <h3>
              {reassigningCableId ? "🔍 Scanne neuen Sticker zum Ummelden" : "In-App Scanner"}
            </h3>
            
            {/* Dauer-Scan Toggle (Schritt 17) */}
            {!reassigningCableId && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <input type="checkbox" id="continuous" checked={isContinuousScan} onChange={e => {
                  setIsContinuousScan(e.target.checked);
                  setContinuousScanHistory([]);
                  setScanResultCable(null);
                }} />
                <label htmlFor="continuous" style={{ fontSize: '0.85rem' }}>Dauer-Scan-Modus (Massen-Scan)</label>
              </div>
            )}

            {cameraActive ? (
              <div style={{ position: 'relative', marginTop: '1rem', background: '#000', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '240px' }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={stopCamera} style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--error)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>Kamera aus</button>
              </div>
            ) : (
              <div style={{ padding: '2rem 1rem', border: '2px dashed var(--border-glass)', borderRadius: 'var(--radius-sm)', marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={40} style={{ color: 'var(--text-secondary)' }} />
                <button onClick={startCamera} className="btn-primary">Kamera aktivieren</button>
              </div>
            )}

            {/* QR-Simulator */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
              <h4>QR-Simulator</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {cables.map(c => {
                  const b64 = uuidToBase64Url(c.id);
                  return (
                    <button key={c.id} onClick={() => handleSimulatorScan(b64)} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Simuliere Scan: {c.name}</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{b64.substring(0, 10)}...</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dauer-Scan Historie */}
          {isContinuousScan && continuousScanHistory.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4>Kisten-Scan Historie (Zuletzt gescannt)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {continuousScanHistory.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', borderLeft: '4px solid var(--success)', borderRadius: '4px', fontSize: '0.85rem' }}>
                    <span>🔌 {c.name} ({c.connectorType})</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.locationId ? 'Ort ok' : 'Kein Ort'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Einzelner Scan-Ergebnis */}
          {!isContinuousScan && scanResultCable && (
            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '6px solid var(--success)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--success)' }}>
                <CheckCircle2 size={20} />
                <h4 style={{ margin: 0 }}>Kabel erkannt</h4>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <strong>Name:</strong> {scanResultCable.name}<br />
                <strong>Stecker:</strong> {scanResultCable.connectorType}<br />
                {scanResultCable.locationId && (
                  <span><strong>Lagerort:</strong> {buildLocationPath(scanResultCable.locationId, locations)}<br /></span>
                )}
              </div>
            </div>
          )}

          {scanError && (
            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '6px solid var(--error)', color: 'var(--error)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <XCircle size={20} />
                <h4 style={{ margin: 0 }}>Scan-Fehler</h4>
              </div>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>{scanError}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB: LOCATIONS */}
      {activeTab === 'locations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <form onSubmit={handleCreateLocation} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Lagerort anlegen</h3>
            <input type="text" placeholder="Name" value={locName} onChange={e => setLocName(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} required />
            <select value={locParent} onChange={e => setLocParent(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              <option value="">-- Kein übergeordneter Ort --</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{buildLocationPath(l.id, locations)}</option>
              ))}
            </select>
            <input type="text" placeholder="Beschreibung" value={locDesc} onChange={e => setLocDesc(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            <button type="submit" className="btn-primary">Ort erstellen</button>
          </form>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Lagerorte</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {locations.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Keine Lagerorte angelegt.</span>
              ) : (
                renderLocationTree(undefined, 0)
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: CABLES (Klonen & Ummampen) */}
      {activeTab === 'cables' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <form onSubmit={handleCreateCable} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Kabel anlegen</h3>
            <input type="text" placeholder="Name" value={cabName} onChange={e => setCabName(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} required />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Marke</label>
                <select value={cabBrand} onChange={e => handleSelectChange('Marke', e.target.value, brands, setBrands, 'list_brands', setCabBrand)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
              <div>
                {/* Platzhalter */}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stecker-Typ 1 (Quelle)</label>
                <select value={cabConnectorType1} onChange={e => handleSelectChange('Stecker-Typ 1', e.target.value, connectors, setConnectors, 'list_connectors', setCabConnectorType1)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stecker-Typ 2 (Ziel)</label>
                <select value={cabConnectorType2} onChange={e => handleSelectChange('Stecker-Typ 2', e.target.value, connectors, setConnectors, 'list_connectors', setCabConnectorType2)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kabel-Standard (Stecker 1)</label>
                <select value={cabCableStandard1} onChange={e => handleCableStandardSelect(1, e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {(cableStandardGroups[getConnectorFamily(cabConnectorType1)] || []).map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kabel-Standard (Stecker 2)</label>
                <select value={cabCableStandard2} onChange={e => handleCableStandardSelect(2, e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {(cableStandardGroups[getConnectorFamily(cabConnectorType2)] || []).map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kabellänge</label>
                <select value={cabLength} onChange={e => handleSelectChange('Kabellänge', e.target.value, lengths, setLengths, 'list_lengths', setCabLength)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {lengths.map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Farbe</label>
                <select value={cabColor} onChange={e => handleSelectChange('Farbe', e.target.value, colors, setColors, 'list_colors', setCabColor)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {colors.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Zustand</label>
                <select value={cabCondition} onChange={e => handleSelectChange('Zustand', e.target.value, conditions, setConditions, 'list_conditions', setCabCondition)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Material</label>
                <select value={cabMaterial} onChange={e => handleSelectChange('Material', e.target.value, materials, setMaterials, 'list_materials', setCabMaterial)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {materials.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Datenrate</label>
                <select value={cabDataRate} onChange={e => handleSelectChange('Datenrate', e.target.value, dataRates, setDataRates, 'list_data_rates', setCabDataRate)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {dataRates.map(d => <option key={d} value={d}>{d}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ladeleistung</label>
                <select value={cabChargingPower} onChange={e => handleSelectChange('Ladeleistung', e.target.value, chargingPowers, setChargingPowers, 'list_charging_powers', setCabChargingPower)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {chargingPowers.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
            </div>

            {/* Custom Properties Fields */}
            {customProperties.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                {customProperties.map(prop => (
                  <div key={prop.id}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                    <select
                      value={customPropValues[prop.id] || ''}
                      onChange={e => handleSelectChange(
                        prop.label,
                        e.target.value,
                        prop.values,
                        (updatedValuesAction) => {
                          const updatedProps = customProperties.map(p => {
                            if (p.id === prop.id) {
                              const newValues = typeof updatedValuesAction === 'function' ? (updatedValuesAction as Function)(p.values) : updatedValuesAction;
                              return { ...p, values: newValues };
                            }
                            return p;
                          });
                          setCustomProperties(updatedProps);
                          localStorage.setItem('list_custom_properties', JSON.stringify(updatedProps));
                        },
                        `list_custom_prop_${prop.id}`,
                        (val) => setCustomPropValues(prev => ({ ...prev, [prop.id]: val }))
                      )}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Keine Angabe --</option>
                      {prop.values.map(v => <option key={v} value={v}>{v}</option>)}
                      <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Hierarchische Lagerort-Auswahl */}
            {renderLocationTreeSelector(cabLocParentId, setCabLocParentId, cabLocation, setCabLocation, 'Lagerort')}

            {/* Foto beschreiben & hinzufügen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <input 
                    type="text" 
                    placeholder="Beschreibung (z.B. Stecker 1)" 
                    value={tempCabImageLabel} 
                    onChange={e => setTempCabImageLabel(e.target.value)} 
                    style={{ padding: '0.4rem', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }} 
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="file" accept="image/*" capture={isMobile ? "environment" : undefined} onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageAttachmentUpload('cable', file, tempCabImageLabel);
                    }} style={{ display: 'none' }} id="cab-cam-upload" />
                    <label htmlFor="cab-cam-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center' }}>
                      📷 Kamera
                    </label>

                    <input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageAttachmentUpload('cable', file, tempCabImageLabel);
                    }} style={{ display: 'none' }} id="cab-gal-upload" />
                    <label htmlFor="cab-gal-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                      🖼️ Galerie
                    </label>
                  </div>
                </div>
              </div>
              <div>
                {/* Platzhalter */}
              </div>
            </div>

            {/* Preview of uploaded images in Cable Form */}
            {cabImages.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                {cabImages.map(img => (
                  <div key={img.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
                    <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.55rem', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '1px' }}>
                      {img.label}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveImageAttachment('cable', img.id)} 
                      style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(255,0,0,0.8)', border: 'none', color: 'white', fontSize: '0.7rem', width: '16px', height: '16px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isCompressing && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kompression läuft...</div>}

            <button type="submit" className="btn-primary" onClick={() => setCabIsMulti(false)}>Kabel anlegen</button>
          </form>

          {/* List Cables */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Registrierte Kabel</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)).map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedCableDetails(c)}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{c.name}</strong>
                      {c.brand && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({c.brand})</span>}
                    </div>
                    <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                      {c.connectorType1 && c.connectorType2 ? `${c.connectorType1} ↔ ${c.connectorType2}` : c.connectorType}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>

                  {/* Chips für neue Eigenschaften */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                    {c.length && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>📏 {c.length}</span>}
                    {c.color && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>🎨 {c.color}</span>}
                    {c.condition && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>✨ {c.condition}</span>}
                    {c.material && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>🧵 {c.material}</span>}
                    {c.cableStandard1 && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>💻 Std. 1: {c.cableStandard1}</span>}
                    {c.cableStandard2 && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>💻 Std. 2: {c.cableStandard2}</span>}
                    {c.dataRate && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>⚡ {c.dataRate}</span>}
                    {c.chargingPower && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>🔌 {c.chargingPower}</span>}
                    
                    {c.additionalProperties && Object.entries(c.additionalProperties).map(([propId, val]) => {
                      const propDef = customProperties.find(p => p.id === propId);
                      const label = propDef ? propDef.label : propId;
                      return val ? (
                        <span key={propId} style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                          🏷️ {label}: {val}
                        </span>
                      ) : null;
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={(e) => { e.stopPropagation(); setReassigningCableId(c.id); setActiveTab('scan'); startCamera(); }} style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <RefreshCw size={12} /> Sticker ersetzen
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDuplicateCable(c); }} style={{ background: 'none', color: 'var(--success)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <Copy size={12} /> Duplizieren
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: CHARGERS */}
      {activeTab === 'chargers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <form onSubmit={handleCreateCable} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Ladegerät anlegen</h3>
            <input type="text" placeholder="Name (z.B. Anker 65W)" value={cabName} onChange={e => setCabName(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} required />
            
            {/* Typ-Auswahl des Ladegeräts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Typ des Ladegeräts</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setCabChargerType('only_ports')}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', background: cabChargerType === 'only_ports' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  🔌 Nur Ports
                </button>
                <button 
                  type="button" 
                  onClick={() => setCabChargerType('only_fixed_cable')}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', background: cabChargerType === 'only_fixed_cable' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  🪢 Festes Kabel
                </button>
                <button 
                  type="button" 
                  onClick={() => setCabChargerType('hybrid')}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', background: cabChargerType === 'hybrid' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  🎛️ Hybrid
                </button>
              </div>
            </div>

            {/* Sektion A: Fest verbautes Kabel */}
            {(cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Eigenschaften des fest verbauten Kabels:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stecker-Typ</label>
                    <select value={cabFixedConnector} onChange={e => setCabFixedConnector(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }}>
                      <option value="USB-C">USB-C</option>
                      <option value="Micro-USB">Micro-USB</option>
                      <option value="Lightning">Lightning</option>
                      <option value="DC-Jack">DC-Jack</option>
                      <option value="Other">Andere</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Länge (z.B. 1.5m)</label>
                    <input type="text" placeholder="1.5m" value={cabFixedLength} onChange={e => setCabFixedLength(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Leistung (z.B. 65W)</label>
                    <input type="text" placeholder="65W" value={cabFixedPower} onChange={e => setCabFixedPower(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Sektion B: Leistungsausgänge (Ports) */}
            {(cabChargerType === 'only_ports' || cabChargerType === 'hybrid') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Leistungsausgänge (Ports):</span>
                {ports.map((p, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 0.8fr auto', gap: '0.4rem', alignItems: 'center' }}>
                    <select value={p.portType} onChange={e => {
                      const updated = [...ports];
                      updated[idx].portType = e.target.value;
                      setPorts(updated);
                    }} style={{ padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                      <option value="USB-C">USB-C</option>
                      <option value="USB-A">USB-A</option>
                      <option value="DC-Jack">DC-Jack</option>
                    </select>
                    
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="number" placeholder="Watt" value={p.wattage || ''} onChange={e => {
                        const w = Number(e.target.value);
                        const updated = [...ports];
                        updated[idx].wattage = w;
                        if (updated[idx].voltage > 0) {
                          updated[idx].amperage = parseFloat((w / updated[idx].voltage).toFixed(2));
                        } else {
                          updated[idx].voltage = 5;
                          updated[idx].amperage = parseFloat((w / 5).toFixed(2));
                        }
                        setPorts(updated);
                      }} style={{ width: '100%', padding: '0.4rem 1.1rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }} />
                      <span style={{ position: 'absolute', right: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>W</span>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="number" placeholder="Volt" value={p.voltage || ''} onChange={e => {
                        const v = Number(e.target.value);
                        const updated = [...ports];
                        updated[idx].voltage = v;
                        if (v > 0 && updated[idx].wattage > 0) {
                          updated[idx].amperage = parseFloat((updated[idx].wattage / v).toFixed(2));
                        }
                        setPorts(updated);
                      }} style={{ width: '100%', padding: '0.4rem 1.1rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }} />
                      <span style={{ position: 'absolute', right: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>V</span>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="number" placeholder="Ampere" step="0.1" value={p.amperage || ''} onChange={e => {
                        const a = Number(e.target.value);
                        const updated = [...ports];
                        updated[idx].amperage = a;
                        if (a > 0 && updated[idx].voltage > 0) {
                          updated[idx].wattage = parseFloat((updated[idx].voltage * a).toFixed(2));
                        }
                        setPorts(updated);
                      }} style={{ width: '100%', padding: '0.4rem 1.1rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }} />
                      <span style={{ position: 'absolute', right: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>A</span>
                    </div>

                    <button type="button" onClick={() => setPorts(ports.filter((_, i) => i !== idx))} style={{ background: 'none', color: 'var(--error)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }}>&times;</button>
                  </div>
                ))}
                <button type="button" onClick={() => setPorts([...ports, { voltage: 5, amperage: 2, wattage: 10, portType: 'USB-C' }])} style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', textAlign: 'left', marginTop: '0.25rem', border: 'none', padding: 0, cursor: 'pointer' }}>+ Weiteren Port hinzufügen</button>
              </div>
            )}

            {/* Hierarchische Lagerort-Auswahl */}
            {renderLocationTreeSelector(cabLocParentId, setCabLocParentId, cabLocation, setCabLocation, 'Lagerort')}

            {/* Foto beschreiben & hinzufügen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <input 
                    type="text" 
                    placeholder="Beschreibung (z.B. Frontansicht)" 
                    value={tempCabImageLabel} 
                    onChange={e => setTempCabImageLabel(e.target.value)} 
                    style={{ padding: '0.4rem', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }} 
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="file" accept="image/*" capture={isMobile ? "environment" : undefined} onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageAttachmentUpload('cable', file, tempCabImageLabel);
                    }} style={{ display: 'none' }} id="charger-cam-upload" />
                    <label htmlFor="charger-cam-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center' }}>
                      📷 Kamera
                    </label>

                    <input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageAttachmentUpload('cable', file, tempCabImageLabel);
                    }} style={{ display: 'none' }} id="charger-gal-upload" />
                    <label htmlFor="charger-gal-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                      🖼️ Galerie
                    </label>
                  </div>
                </div>
              </div>
              <div>
                {/* Platzhalter */}
              </div>
            </div>

            {/* Preview of uploaded images in Charger Form */}
            {cabImages.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                {cabImages.map(img => (
                  <div key={img.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
                    <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.55rem', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '1px' }}>
                      {img.label}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveImageAttachment('cable', img.id)} 
                      style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(255,0,0,0.8)', border: 'none', color: 'white', fontSize: '0.7rem', width: '16px', height: '16px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isCompressing && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kompression läuft...</div>}

            <button type="submit" className="btn-primary" onClick={() => setCabIsMulti(true)}>Ladegerät anlegen</button>
          </form>

          {/* List Chargers */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Registrierte Ladegeräte</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)).map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedCableDetails(c)}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{c.name}</strong>
                    <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                      {c.chargerType === 'only_fixed_cable' ? '🪢 Kabel-Netzteil' : c.chargerType === 'hybrid' ? '🎛️ Hybrid-Lader' : '🔌 Port-Lader'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {/* Festes Kabel */}
                    {(c.chargerType === 'only_fixed_cable' || c.chargerType === 'hybrid' || c.fixedCableConnector) && (
                      <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
                        <span>🪢</span>
                        <span>Festes Kabel: <strong>{c.fixedCableConnector || c.connectorType}</strong> ({c.fixedCableLength ? c.fixedCableLength : 'k.A.'}{c.fixedCablePower ? `, ${c.fixedCablePower}` : ''})</span>
                      </div>
                    )}
                    {/* Ports */}
                    {(c.chargerType === 'only_ports' || c.chargerType === 'hybrid' || !c.chargerType) && c.powerOutputs && c.powerOutputs.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ports:</span>
                        {c.powerOutputs.map((p, i) => (
                          <span key={i} style={{ fontSize: '0.7rem', background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            {p.portType}: {p.wattage ? `${p.wattage}W` : `${p.voltage * p.amperage}W`} ({p.voltage}V / {p.amperage}A)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={(e) => { e.stopPropagation(); setReassigningCableId(c.id); setActiveTab('scan'); startCamera(); }} style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <RefreshCw size={12} /> Sticker ersetzen
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDuplicateCable(c); }} style={{ background: 'none', color: 'var(--success)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <Copy size={12} /> Duplizieren
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: DEVICES */}
      {activeTab === 'devices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <form onSubmit={handleCreateDevice} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Gerät anlegen</h3>
            <input type="text" placeholder="Name" value={devName} onChange={e => setDevName(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} required />
            <input type="text" placeholder="Hersteller" value={devBrand} onChange={e => setDevBrand(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Anschluss</label>
                <select value={devConnector} onChange={e => setDevConnector(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                  <option value="USB-C">USB-C</option>
                  <option value="Micro-USB">Micro-USB</option>
                  <option value="Lightning">Lightning</option>
                  <option value="DC-Jack">DC-Jack</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spannung</label>
                <select value={devVoltage} onChange={e => setDevVoltage(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                  <option value="5">5 V</option>
                  <option value="9">9 V</option>
                  <option value="12">12 V</option>
                  <option value="15">15 V</option>
                  <option value="20">20 V</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Strom</label>
                <select value={devAmperage} onChange={e => setDevAmperage(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                  <option value="0.5">0.5 A</option>
                  <option value="1">1 A</option>
                  <option value="2">2 A</option>
                  <option value="3">3 A</option>
                </select>
              </div>
            </div>

            {/* Hierarchische Lagerort-Auswahl für Geräte */}
            {renderLocationTreeSelector(devLocParentId, setDevLocParentId, devLocation, setDevLocation, 'Lagerort des Geräts')}

            {/* Foto beschreiben & hinzufügen für Geräte */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <input 
                    type="text" 
                    placeholder="Beschreibung (z.B. Frontansicht)" 
                    value={tempDevImageLabel} 
                    onChange={e => setTempDevImageLabel(e.target.value)} 
                    style={{ padding: '0.4rem', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }} 
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="file" accept="image/*" capture={isMobile ? "environment" : undefined} onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageAttachmentUpload('device', file, tempDevImageLabel);
                    }} style={{ display: 'none' }} id="dev-cam-upload" />
                    <label htmlFor="dev-cam-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center' }}>
                      📷 Kamera
                    </label>

                    <input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageAttachmentUpload('device', file, tempDevImageLabel);
                    }} style={{ display: 'none' }} id="dev-gal-upload" />
                    <label htmlFor="dev-gal-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                      🖼️ Galerie
                    </label>
                  </div>
                </div>
              </div>
              <div>
                {/* Platzhalter */}
              </div>
            </div>

            {/* Preview of uploaded images in Device Form */}
            {devImages.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                {devImages.map(img => (
                  <div key={img.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
                    <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.55rem', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '1px' }}>
                      {img.label}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveImageAttachment('device', img.id)} 
                      style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(255,0,0,0.8)', border: 'none', color: 'white', fontSize: '0.7rem', width: '16px', height: '16px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isCompressing && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kompression läuft...</div>}

            <button type="submit" className="btn-primary">Hinzufügen</button>
          </form>

          {/* List Devices */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Registrierte Geräte</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {devices.map(d => (
                <div key={d.id} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{d.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>{d.requiredVoltage}V @ {d.requiredAmperage}A</span>
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                    <button onClick={() => handleDeleteDevice(d.id)} style={{ background: 'none', color: 'var(--error)', fontSize: '0.8rem' }}><Trash2 size={14} /> Löschen</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 1. MAIN SETTINGS MENU */}
          {settingsView === 'menu' && (
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3>Einstellungen</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setSettingsView('layout')}
                  className="tile-btn"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                    <Sun size={18} style={{ color: 'var(--accent-primary)' }} />
                    Layout (Theme)
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>&rarr;</span>
                </button>

                <button 
                  onClick={() => setSettingsView('properties')}
                  className="tile-btn"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                    <Layers size={18} style={{ color: 'var(--accent-secondary)' }} />
                    Eigenschaften verwalten
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>&rarr;</span>
                </button>

                <button 
                  onClick={() => setSettingsView('export')}
                  className="tile-btn"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                    <Upload size={18} style={{ color: 'var(--success)' }} />
                    Datenexport
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>&rarr;</span>
                </button>

                <button 
                  onClick={() => setSettingsView('about')}
                  className="tile-btn"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                    <Info size={18} style={{ color: 'var(--accent-primary)' }} />
                    Über die App
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>&rarr;</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. SUB-VIEW: LAYOUT */}
          {settingsView === 'layout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <button 
                onClick={() => setSettingsView('menu')} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              >
                <ArrowLeft size={16} /> Zurück zu Einstellungen
              </button>
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3>Layout (Theme)</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                  <span>Dark Theme aktivieren</span>
                  <button 
                    onClick={() => setDarkMode(!darkMode)}
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    {darkMode ? 'Aktiviert (Dunkel)' : 'Deaktiviert (Hell)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. SUB-VIEW: PROPERTIES */}
          {settingsView === 'properties' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <button 
                onClick={() => setSettingsView('menu')} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              >
                <ArrowLeft size={16} /> Zurück zu Einstellungen
              </button>
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3>Eigenschaften verwalten</h3>

                {/* Formular für neue benutzerdefinierte Eigenschaftskategorie */}
                <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="Neue Kategorie (z.B. Garantiezeit)"
                    value={newCustomPropLabel}
                    onChange={e => setNewCustomPropLabel(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                  />
                  <button onClick={handleCreateCustomProperty} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                    Kategorie anlegen
                  </button>
                </div>

                {/* Liste aller Kategorien zum Hinzufügen/Löschen von Werten */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  
                  {/* 1. Kabel-Standards (Gruppiert) */}
                  <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Kabel-Standards (Gruppiert nach Steckertyp)</strong>
                    {Object.entries(cableStandardGroups).map(([family, values]) => (
                      <div key={family} style={{ marginTop: '0.5rem', paddingLeft: '0.75rem', borderLeft: '2px solid var(--accent-primary)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-primary)' }}>{family}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                          {values.map(val => (
                            <span key={val} style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {val}
                              <button onClick={() => handleRemoveCableStandard(family, val)} style={{ background: 'none', color: 'var(--error)', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem' }}>×</button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.4rem' }}>
                          <input
                            type="text"
                            placeholder={`Standard für ${family}...`}
                            id={`input-standard-${family}`}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const inputEl = e.currentTarget;
                                handleAddCableStandard(family, inputEl.value);
                                inputEl.value = '';
                              }
                            }}
                            style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                          />
                          <button 
                            onClick={e => {
                              const inputEl = document.getElementById(`input-standard-${family}`) as HTMLInputElement;
                              if (inputEl) {
                                handleAddCableStandard(family, inputEl.value);
                                inputEl.value = '';
                              }
                            }}
                            style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', cursor: 'pointer' }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 2. Standard Eigenschaften */}
                  {[
                    { label: 'Marke', list: brands, setList: setBrands, key: 'list_brands' },
                    { label: 'Kabellänge', list: lengths, setList: setLengths, key: 'list_lengths' },
                    { label: 'Farbe', list: colors, setList: setColors, key: 'list_colors' },
                    { label: 'Zustand', list: conditions, setList: setConditions, key: 'list_conditions' },
                    { label: 'Material', list: materials, setList: setMaterials, key: 'list_materials' },
                    { label: 'Datenrate', list: dataRates, setList: setDataRates, key: 'list_data_rates' },
                    { label: 'Ladeleistung', list: chargingPowers, setList: setChargingPowers, key: 'list_charging_powers' },
                    { label: 'Stecker-Typen', list: connectors, setList: setConnectors, key: 'list_connectors' }
                  ].map(prop => (
                    <div key={prop.label} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{prop.label}</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {prop.list.map(val => (
                          <span key={val} style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {val}
                            <button onClick={() => handleRemovePropValue(prop.key, prop.list, prop.setList, val)} style={{ background: 'none', color: 'var(--error)', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem' }}>×</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.4rem' }}>
                        <input
                          type="text"
                          placeholder="Neuer Wert..."
                          id={`input-val-${prop.label}`}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const inputEl = e.currentTarget;
                              handleAddPropValue(prop.key, prop.list, prop.setList, inputEl.value);
                              inputEl.value = '';
                            }
                          }}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                        />
                        <button 
                          onClick={e => {
                            const inputEl = document.getElementById(`input-val-${prop.label}`) as HTMLInputElement;
                            if (inputEl) {
                              handleAddPropValue(prop.key, prop.list, prop.setList, inputEl.value);
                              inputEl.value = '';
                            }
                          }}
                          style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 3. Custom Eigenschaften */}
                  {customProperties.map(prop => (
                    <div key={prop.id} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)' }}>🏷️ {prop.label} (Eigene Kategorie)</strong>
                        <button onClick={() => handleDeleteCustomProperty(prop.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.75rem', cursor: 'pointer' }}>Kategorie löschen</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {prop.values.map(val => (
                          <span key={val} style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {val}
                            <button onClick={() => handleRemoveCustomPropValue(prop.id, val)} style={{ background: 'none', color: 'var(--error)', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem' }}>×</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.4rem' }}>
                        <input
                          type="text"
                          placeholder="Neuer Wert..."
                          id={`input-val-${prop.id}`}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const inputEl = e.currentTarget;
                              handleAddCustomPropValue(prop.id, inputEl.value);
                              inputEl.value = '';
                            }
                          }}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                        />
                        <button 
                          onClick={e => {
                            const inputEl = document.getElementById(`input-val-${prop.id}`) as HTMLInputElement;
                            if (inputEl) {
                              handleAddCustomPropValue(prop.id, inputEl.value);
                              inputEl.value = '';
                            }
                          }}
                          style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. SUB-VIEW: EXPORT */}
          {settingsView === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <button 
                onClick={() => setSettingsView('menu')} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              >
                <ArrowLeft size={16} /> Zurück zu Einstellungen
              </button>
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3>Datenexport</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Exportiere deine gesamten Daten (Kabel, Ladegeräte, Geräte und Lagerorte) in eine lokale JSON-Datei zur Backup-Sicherung.
                  </p>
                  <button onClick={handleExportData} className="btn-primary" style={{ width: '100%', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <Upload size={16} /> Exportieren (.json)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. SUB-VIEW: ABOUT */}
          {settingsView === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <button 
                onClick={() => setSettingsView('menu')} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              >
                <ArrowLeft size={16} /> Zurück zu Einstellungen
              </button>
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-primary)' }}>
                <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', margin: 0 }}>Über die App</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem' }}>
                  <div>
                    <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Verantwortlicher:</strong>
                    <div style={{ marginTop: '0.2rem', fontWeight: 600 }}>Andreas Bartel</div>
                  </div>
                  
                  <div>
                    <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Kontakt / Support:</strong>
                    <div style={{ marginTop: '0.2rem' }}>
                      <a 
                        href="mailto:workandbartel@gmail.com" 
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        workandbartel@gmail.com
                      </a>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div>Kabel Manager v1.2.0</div>
                    <div>Lokaler Gast-Modus aktiv</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRUCKBOGEN RENDER ELEMENT (wird per CSS @media print gesteuert und auf dem Bildschirm ausgeblendet) */}
      <div className="print-sheet" style={{ display: 'none' }}>
        {cables.map(c => {
          const b64 = uuidToBase64Url(c.id);
          return (
            <div key={c.id} className="print-sticker">
              <div className="print-qr-mock">
                [QR: {b64.substring(0, 10)}]
              </div>
              <div className="print-label">{c.name.substring(0, 20)}</div>
              <div className="print-label" style={{ fontFamily: 'monospace', fontSize: '6px' }}>{b64}</div>
            </div>
          );
        })}
      </div>

      {/* CABLE DETAILS MODAL */}
      {selectedCableDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="glass-panel" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-primary)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Kabel-Details</h3>
              <button onClick={() => setSelectedCableDetails(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>

            {/* Bildergalerie */}
            {((selectedCableDetails.images && selectedCableDetails.images.length > 0) || selectedCableDetails.imageUrl) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <strong>Fotos:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {/* Backward compatibility with old imageUrl */}
                  {selectedCableDetails.imageUrl && !selectedCableDetails.images?.some(i => i.url === selectedCableDetails.imageUrl) && (
                    <div style={{ flexShrink: 0, width: '120px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <img 
                        src={selectedCableDetails.imageUrl} 
                        alt="Hauptbild" 
                        onClick={() => window.open(selectedCableDetails.imageUrl, '_blank')}
                        style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)', cursor: 'zoom-in' }} 
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Hauptbild</span>
                    </div>
                  )}
                  {selectedCableDetails.images?.map(img => (
                    <div key={img.id} style={{ flexShrink: 0, width: '120px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <img 
                        src={img.url} 
                        alt={img.label} 
                        onClick={() => window.open(img.url, '_blank')}
                        style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)', cursor: 'zoom-in' }} 
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{img.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div><strong>Name:</strong> {selectedCableDetails.name}</div>
              
              {selectedCableDetails.isMultiOutput ? (
                // Charger Details
                <>
                  <div><strong>Typ:</strong> {selectedCableDetails.chargerType === 'only_fixed_cable' ? '🪢 Netzteil mit festem Kabel' : selectedCableDetails.chargerType === 'hybrid' ? '🎛️ Hybrid-Ladegerät' : '🔌 Netzteil mit Ports'}</div>
                  
                  {/* Fixed Cable details if present */}
                  {(selectedCableDetails.chargerType === 'only_fixed_cable' || selectedCableDetails.chargerType === 'hybrid' || selectedCableDetails.fixedCableConnector) && (
                    <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', marginTop: '0.25rem' }}>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '0.25rem' }}>🪢 Fest verbautes Kabel</strong>
                      <div><strong>Anschluss:</strong> {selectedCableDetails.fixedCableConnector || selectedCableDetails.connectorType}</div>
                      {selectedCableDetails.fixedCableLength && <div><strong>Länge:</strong> {selectedCableDetails.fixedCableLength}</div>}
                      {selectedCableDetails.fixedCablePower && <div><strong>Ladeleistung:</strong> {selectedCableDetails.fixedCablePower}</div>}
                    </div>
                  )}

                  {/* Ports details if present */}
                  {(selectedCableDetails.chargerType === 'only_ports' || selectedCableDetails.chargerType === 'hybrid' || !selectedCableDetails.chargerType) && selectedCableDetails.powerOutputs && selectedCableDetails.powerOutputs.length > 0 && (
                    <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', marginTop: '0.25rem' }}>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '0.25rem' }}>🔌 Ausgänge / Ports</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {selectedCableDetails.powerOutputs.map((p, i) => (
                          <div key={i} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', borderBottom: i < (selectedCableDetails.powerOutputs?.length || 0) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: '0.2rem' }}>
                            <span>Port {i+1} ({p.portType}):</span>
                            <strong>{p.wattage ? `${p.wattage}W` : `${p.voltage * p.amperage}W`} ({p.voltage}V @ {p.amperage}A)</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Cable Details
                <>
                  {selectedCableDetails.brand && <div><strong>Marke:</strong> {selectedCableDetails.brand}</div>}
                  <div>
                    <strong>Stecker-Typen:</strong> {selectedCableDetails.connectorType1 && selectedCableDetails.connectorType2 
                      ? `${selectedCableDetails.connectorType1} ↔ ${selectedCableDetails.connectorType2}` 
                      : selectedCableDetails.connectorType}
                  </div>
                  {selectedCableDetails.cableStandard1 && <div><strong>Kabel-Standard 1:</strong> {selectedCableDetails.cableStandard1}</div>}
                  {selectedCableDetails.cableStandard2 && <div><strong>Kabel-Standard 2:</strong> {selectedCableDetails.cableStandard2}</div>}
                  {selectedCableDetails.length && <div><strong>Kabellänge:</strong> {selectedCableDetails.length}</div>}
                  {selectedCableDetails.color && <div><strong>Farbe:</strong> {selectedCableDetails.color}</div>}
                  {selectedCableDetails.material && <div><strong>Material:</strong> {selectedCableDetails.material}</div>}
                  {selectedCableDetails.condition && <div><strong>Zustand:</strong> {selectedCableDetails.condition}</div>}
                  {selectedCableDetails.dataRate && <div><strong>Datenübertragungsrate:</strong> {selectedCableDetails.dataRate}</div>}
                  {selectedCableDetails.chargingPower && <div><strong>Ladeleistung:</strong> {selectedCableDetails.chargingPower}</div>}
                </>
              )}

              <div><strong>Lagerort:</strong> {selectedCableDetails.locationId ? buildLocationPath(selectedCableDetails.locationId, locations) : 'Kein Ort'}</div>
              
              {/* Eigene Eigenschaften anzeigen */}
              {selectedCableDetails.additionalProperties && Object.entries(selectedCableDetails.additionalProperties).map(([propId, val]) => {
                const propDef = customProperties.find(p => p.id === propId);
                const label = propDef ? propDef.label : propId;
                return val ? (
                  <div key={propId}><strong>{label}:</strong> {val}</div>
                ) : null;
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button 
                onClick={() => {
                  setReassigningCableId(selectedCableDetails.id);
                  setSelectedCableDetails(null);
                  setActiveTab('scan');
                  startCamera();
                }} 
                className="btn-primary" 
                style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <RefreshCw size={12} /> Sticker ersetzen
              </button>
              <button 
                onClick={() => {
                  handleDuplicateCable(selectedCableDetails);
                  setSelectedCableDetails(null);
                }} 
                className="btn-primary" 
                style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: 'var(--success)' }}
              >
                <Copy size={12} /> Duplizieren
              </button>
              <button 
                onClick={() => {
                  handleDeleteCable(selectedCableDetails.id);
                  setSelectedCableDetails(null);
                }} 
                className="btn-primary" 
                style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: 'var(--error)' }}
              >
                <Trash2 size={12} /> Löschen
              </button>
            </div>
            <button onClick={() => setSelectedCableDetails(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Schließen</button>
          </div>
        </div>
      )}

      {/* DEVICE DETAILS MODAL */}
      {selectedDeviceDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="glass-panel" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Geräte-Details</h3>
              <button onClick={() => setSelectedDeviceDetails(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>

            {/* Bildergalerie für Geräte */}
            {selectedDeviceDetails.images && selectedDeviceDetails.images.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <strong>Fotos:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {selectedDeviceDetails.images.map(img => (
                    <div key={img.id} style={{ flexShrink: 0, width: '120px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <img 
                        src={img.url} 
                        alt={img.label} 
                        onClick={() => window.open(img.url, '_blank')}
                        style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)', cursor: 'zoom-in' }} 
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{img.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div><strong>Name:</strong> {selectedDeviceDetails.name}</div>
              {selectedDeviceDetails.manufacturer && <div><strong>Hersteller:</strong> {selectedDeviceDetails.manufacturer}</div>}
              <div><strong>Anschluss:</strong> {selectedDeviceDetails.requiredConnectorType || 'Nicht spezifiziert'}</div>
              <div><strong>Benötigte Leistung:</strong> {selectedDeviceDetails.requiredVoltage}V @ {selectedDeviceDetails.requiredAmperage}A</div>
              <div><strong>Lagerort:</strong> {selectedDeviceDetails.locationId ? buildLocationPath(selectedDeviceDetails.locationId, locations) : 'Kein Ort'}</div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button 
                onClick={() => {
                  handleDeleteDevice(selectedDeviceDetails.id);
                  setSelectedDeviceDetails(null);
                }} 
                className="btn-primary" 
                style={{ flex: 1, background: 'var(--error)', fontSize: '0.8rem' }}
              >
                Gerät löschen
              </button>
              <button onClick={() => setSelectedDeviceDetails(null)} style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
