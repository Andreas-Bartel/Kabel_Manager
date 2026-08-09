import React, { useState, useEffect, useRef } from 'react';
import { Cable as CableIcon, Layers, QrCode, Search, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Plus, Trash2, Link, Link2Off, Info, Sun, Moon, Camera, Upload, Copy, RefreshCw, Printer, Settings, ArrowLeft, Home, Folder, Plug, Zap } from 'lucide-react';
import Fuse from 'fuse.js';
import { Cable, Device, StorageLocation, buildLocationPath, checkPowerCompatibility, CompatibilityResult, ImageAttachment, PowerOutput } from './contexts/inventory/domain/types';
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

const USBAIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" ry="1.5"/>
    <rect x="6" y="12" width="12" height="4" rx="0.5" ry="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

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

  // Responsive Width
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 800);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tab Navigation
  const [activeTab, setActiveTab] = useState<'home' | 'overview' | 'locations' | 'cables' | 'chargers' | 'devices' | 'scan' | 'settings' | 'inventory'>('home');

  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'all' | 'cables' | 'chargers' | 'devices'>('all');
  const [inventoryLocationFilter, setInventoryLocationFilter] = useState<string | null>(null);
  const [inventoryLocCurrentParentId, setInventoryLocCurrentParentId] = useState<string | undefined>(undefined);

  // Clear search on tab switch
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

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
    { voltage: 5, amperage: 0, wattage: 0, portType: '' }
  ]);
  const [cabChargerType, setCabChargerType] = useState<'only_ports' | 'only_fixed_cable' | 'hybrid'>('only_ports');
  const [cabFixedLength, setCabFixedLength] = useState('');
  const [cabFixedPower, setCabFixedPower] = useState('');
  const [cabFixedConnector, setCabFixedConnector] = useState('USB-C');

  // Form States - Device
  const [devName, setDevName] = useState('');
  const [devBrand, setDevBrand] = useState('');
  const [devConnector, setDevConnector] = useState('USB-C');
  const [devConnector2, setDevConnector2] = useState('');
  const [devLocation, setDevLocation] = useState('');

  // Form-level linking states during component creation
  const [cabFormLinks, setCabFormLinks] = useState<string[]>([]);
  const [devFormLinks, setDevFormLinks] = useState<string[]>([]);
  const [showCabLinks, setShowCabLinks] = useState(false);
  const [showDevLinks, setShowDevLinks] = useState(false);
  const [showDevPort2, setShowDevPort2] = useState(false);

  // Edit States for Cable/Charger details editing
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editConnectorType1, setEditConnectorType1] = useState('USB-C');
  const [editCableStandard1, setEditCableStandard1] = useState('');
  const [editConnectorType2, setEditConnectorType2] = useState('USB-C');
  const [editCableStandard2, setEditCableStandard2] = useState('');
  const [editLength, setEditLength] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editMaterial, setEditMaterial] = useState('');
  const [editDataRate, setEditDataRate] = useState('');
  const [editChargingPower, setEditChargingPower] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLocParentId, setEditLocParentId] = useState<string | undefined>(undefined);
  const [editImages, setEditImages] = useState<ImageAttachment[]>([]);
  const [editCustomPropValues, setEditCustomPropValues] = useState<Record<string, string>>({});
  const [editIsMulti, setEditIsMulti] = useState(false);
  const [editChargerType, setEditChargerType] = useState<'only_ports' | 'only_fixed_cable' | 'hybrid'>('only_ports');
  const [editFixedLength, setEditFixedLength] = useState('');
  const [editFixedPower, setEditFixedPower] = useState('');
  const [editFixedConnector, setEditFixedConnector] = useState('USB-C');
  const [editPorts, setEditPorts] = useState<{ voltage: number; amperage: number; wattage: number; portType: string }[]>([]);
  const [editExpandedProps, setEditExpandedProps] = useState<Record<string, boolean>>({});
  const [editShowLoc, setEditShowLoc] = useState(false);
  const [editShowPhotos, setEditShowPhotos] = useState(false);
  const [editIsEditing, setEditIsEditing] = useState(false);
  const [editDevIsEditing, setEditDevIsEditing] = useState(false);
  // Device Edit States
  const [editDevManufacturer, setEditDevManufacturer] = useState('');
  const [editDevConnector, setEditDevConnector] = useState('USB-C');
  const [editDevConnector2, setEditDevConnector2] = useState('');
  const [editDevLocation, setEditDevLocation] = useState('');
  const [editDevLocParentId, setEditDevLocParentId] = useState<string | undefined>(undefined);
  const [editDevImages, setEditDevImages] = useState<ImageAttachment[]>([]);
  const [editDevShowLoc, setEditDevShowLoc] = useState(false);
  const [editDevShowPhotos, setEditDevShowPhotos] = useState(false);
  const [editDevShowPort2, setEditDevShowPort2] = useState(false);
  const [tempEditImageLabel, setTempEditImageLabel] = useState('');
  const [tempEditDevImageLabel, setTempEditDevImageLabel] = useState('');

  // Collapse states for forms
  const [showCabLoc, setShowCabLoc] = useState(false);
  const [showCabPhotos, setShowCabPhotos] = useState(false);
  const [showChargerLoc, setShowChargerLoc] = useState(false);
  const [showChargerPhotos, setShowChargerPhotos] = useState(false);
  const [showDevLoc, setShowDevLoc] = useState(false);
  const [showDevPhotos, setShowDevPhotos] = useState(false);
  const [expandedCabProps, setExpandedCabProps] = useState<Record<string, boolean>>({});

  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});
  const [linkingSource, setLinkingSource] = useState<{ id: string; type: 'cable' | 'charger' | 'device'; name: string } | null>(null);
  const [linkingTargetCategory, setLinkingTargetCategory] = useState<'cable' | 'charger' | 'device' | null>(null);

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
  const [tempCabImageLabel, setTempCabImageLabel] = useState('');
  const [tempDevImageLabel, setTempDevImageLabel] = useState('');
  const [cabLocParentId, setCabLocParentId] = useState<string | undefined>(undefined);
  const [devLocParentId, setDevLocParentId] = useState<string | undefined>(undefined);
  const [settingsView, setSettingsView] = useState<'menu' | 'layout' | 'properties' | 'export' | 'about'>('menu');
  const [selectedPropToAssign, setSelectedPropToAssign] = useState('');

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

  const [propertyAssignments, setPropertyAssignments] = useState<Record<string, ('cable' | 'charger' | 'device')[]>>(() => {
    const saved = localStorage.getItem('property_assignments');
    return saved ? JSON.parse(saved) : {
      brand: ['cable', 'device'],
      length: ['cable'],
      color: ['cable'],
      condition: ['cable'],
      material: ['cable'],
      dataRate: ['cable'],
      chargingPower: ['cable'],
      connectors: ['cable', 'charger', 'device']
    };
  });

  const [propsActiveComponent, setPropsActiveComponent] = useState<'cable' | 'charger' | 'device'>('cable');
  const [devCustomPropValues, setDevCustomPropValues] = useState<Record<string, string>>({});
  const [expandedDevProps, setExpandedDevProps] = useState<Record<string, boolean>>({});
  const [expandedChargerProps, setExpandedChargerProps] = useState<Record<string, boolean>>({});

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

  const handleCableStandardSelect = (index: 1 | 2, val: string, isEdit?: boolean) => {
    const conn = isEdit
      ? (index === 1 ? editConnectorType1 : editConnectorType2)
      : (index === 1 ? cabConnectorType1 : cabConnectorType2);
    const family = getConnectorFamily(conn);
    const setCabCableStandard = isEdit
      ? (index === 1 ? setEditCableStandard1 : setEditCableStandard2)
      : (index === 1 ? setCabCableStandard1 : setCabCableStandard2);
    
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
  const [lightboxImage, setLightboxImage] = useState<{ url: string; label: string } | null>(null);

  // Gallery Mode State
  const [galleryImages, setGalleryImages] = useState<ImageAttachment[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);
  const [galleryZoomed, setGalleryZoomed] = useState<boolean>(false);
  const galleryTouchStartX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    galleryTouchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = galleryTouchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) {
      if (galleryImages && galleryIndex < galleryImages.length - 1) {
        setGalleryIndex(prev => prev + 1);
        setGalleryZoomed(false);
      }
    } else if (diff < -50) {
      if (galleryImages && galleryIndex > 0) {
        setGalleryIndex(prev => prev - 1);
        setGalleryZoomed(false);
      }
    }
  };

  // Handhabung des Android-Zurück-Buttons (Hardware Back Button)
  useEffect(() => {
    const handler = CapApp.addListener('backButton', () => {
      if (galleryImages) {
        setGalleryImages(null);
        setGalleryZoomed(false);
      } else if (lightboxImage) {
        setLightboxImage(null);
      } else if (linkingSource) {
        setLinkingSource(null);
        setLinkingTargetCategory(null);
      } else if (selectedCableDetails) {
        setSelectedCableDetails(null);
      } else if (selectedDeviceDetails) {
        setSelectedDeviceDetails(null);
      } else if (activeTab === 'settings' && settingsView !== 'menu') {
        setSettingsView('menu');
      } else if (activeTab === 'inventory') {
        if (inventoryLocationFilter) {
          setInventoryLocationFilter(null);
          setInventoryLocCurrentParentId(undefined);
        } else {
          setActiveTab('home');
        }
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [galleryImages, lightboxImage, linkingSource, selectedCableDetails, selectedDeviceDetails, activeTab, settingsView, inventoryLocationFilter]);

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

    // Automatisch der aktuell gewählten Komponente zuordnen
    const updatedAssignments = {
      ...propertyAssignments,
      [id]: [propsActiveComponent]
    };
    setPropertyAssignments(updatedAssignments);
    localStorage.setItem('property_assignments', JSON.stringify(updatedAssignments));
  };

  const handleUpdatePropertyAssignment = (propertyId: string, assigned: ('cable' | 'charger' | 'device')[]) => {
    const updated = {
      ...propertyAssignments,
      [propertyId]: assigned
    };
    setPropertyAssignments(updated);
    localStorage.setItem('property_assignments', JSON.stringify(updated));
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

  // Helper to get all child location IDs recursively
  const getSubLocationIds = (locId: string): string[] => {
    const children = locations.filter(l => l.parentLocationId === locId);
    return [locId, ...children.flatMap(c => getSubLocationIds(c.id))];
  };

  // Helper to count components at a specific location recursively
  const getComponentCountAtLocation = (locId: string): number => {
    const allLocIds = getSubLocationIds(locId);
    const cabCount = cables.filter(c => c.locationId && allLocIds.includes(c.locationId)).length;
    const devCount = devices.filter(d => d.locationId && allLocIds.includes(d.locationId)).length;
    return cabCount + devCount;
  };

  // Helper to filter any list of components by location recursively
  const filterByLocation = <T extends { locationId?: string }>(items: T[], locId: string | null): T[] => {
    if (!locId) return items;
    if (locId === 'none') return items.filter(item => !item.locationId);
    const allLocIds = getSubLocationIds(locId);
    return items.filter(item => item.locationId && allLocIds.includes(item.locationId));
  };

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

    return (
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
          Lagerort
        </div>
        
        {/* Selected indicator directly below title */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          fontSize: '0.85rem', 
          color: selectedLocationId ? 'var(--accent-primary)' : 'var(--text-secondary)', 
          fontWeight: 600, 
          background: 'rgba(0,0,0,0.15)', 
          padding: '0.5rem 0.75rem', 
          borderRadius: 'var(--radius-sm)', 
          border: '1px solid var(--border-glass)' 
        }}>
          <span>{selectedLocationId ? `📍 ${locations.find(l => l.id === selectedLocationId)?.name || 'Gewählt'}` : 'Kein Ort'}</span>
          {selectedLocationId && (
            <button 
              type="button" 
              onClick={() => { setSelectedLocationId(''); setCurrentParentId(undefined); }} 
              style={{ background: 'none', color: 'var(--error)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
              title="Lagerort zurücksetzen"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Vertical Hierarchy Path and Children */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
          {/* Top level: Home Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => setCurrentParentId(undefined)} 
              style={{
                background: currentParentId === undefined ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                border: currentParentId === undefined ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                padding: '0.4rem',
                borderRadius: '50%',
                color: currentParentId === undefined ? 'var(--accent-primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px'
              }}
            >
              <Home size={14} />
            </button>
            <span 
              onClick={() => setCurrentParentId(undefined)} 
              style={{ 
                fontSize: '0.8rem', 
                color: currentParentId === undefined ? 'var(--accent-primary)' : 'var(--text-secondary)', 
                fontWeight: currentParentId === undefined ? 'bold' : 'normal',
                cursor: 'pointer' 
              }}
            >
              Home
            </span>
          </div>

          {/* Breadcrumbs (vertical list of active path) */}
          {breadcrumbs.map((node, i) => (
            <React.Fragment key={node.id}>
              {/* Arrow connector between parent and child */}
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.65rem', margin: '-0.2rem 0', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.8rem' }}>↓</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => { setCurrentParentId(node.id); setSelectedLocationId(node.id); }} 
                  style={{
                    background: currentParentId === node.id ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                    border: currentParentId === node.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                    padding: '0.4rem',
                    borderRadius: '50%',
                    color: currentParentId === node.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px'
                  }}
                >
                  <Folder size={14} />
                </button>
                <span 
                  onClick={() => { setCurrentParentId(node.id); setSelectedLocationId(node.id); }} 
                  style={{ 
                    fontSize: '0.8rem', 
                    color: currentParentId === node.id ? 'var(--accent-primary)' : 'var(--text-secondary)', 
                    fontWeight: currentParentId === node.id ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {node.name}
                </span>
              </div>
            </React.Fragment>
          ))}

          {/* Arrow connector to the list of children at the current level */}
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.65rem', margin: '-0.2rem 0', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem' }}>↓</span>
          </div>

          {/* List of visible child locations */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.4rem', 
            maxHeight: '180px', 
            overflowY: 'auto', 
            borderLeft: '2px solid var(--accent-glow)', 
            marginLeft: '0.8rem', 
            paddingLeft: '0.75rem',
            paddingTop: '0.2rem',
            paddingBottom: '0.2rem'
          }}>
            {visibleLocations.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine untergeordneten Orte vorhanden.</span>
            ) : (
              visibleLocations.map(loc => {
                const isSelected = selectedLocationId === loc.id;
                const hasChildren = locations.some(l => l.parentLocationId === loc.id);
                return (
                  <div 
                    key={loc.id} 
                    onClick={() => {
                      setCurrentParentId(loc.id);
                      setSelectedLocationId(loc.id);
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '0.35rem 0.5rem', 
                      borderRadius: 'var(--radius-sm)', 
                      background: isSelected ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)', 
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      <Folder size={12} style={{ color: 'var(--accent-secondary)' }} /> {loc.name}
                    </span>
                    {hasChildren && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>&gt;</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick create location directly within the feature */}
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem' }}>
          <input 
            type="text" 
            placeholder="Neuen Ort hier anlegen..." 
            id={`quick-loc-name-${label.replace(/\s+/g, '-')}`}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleQuickCreateLocation(e.currentTarget.value, currentParentId, setSelectedLocationId, setCurrentParentId);
                e.currentTarget.value = '';
              }
            }}
            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
          />
          <button 
            type="button" 
            onClick={() => {
              const input = document.getElementById(`quick-loc-name-${label.replace(/\s+/g, '-')}`) as HTMLInputElement;
              if (input && input.value.trim()) {
                handleQuickCreateLocation(input.value.trim(), currentParentId, setSelectedLocationId, setCurrentParentId);
                input.value = '';
              }
            }}
            className="btn-primary" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
          >
            +
          </button>
        </div>
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

  const handleQuickCreateLocation = async (
    name: string, 
    parentId: string | undefined, 
    setSelectedId: (id: string) => void, 
    setCurrentParent: (id: string | undefined) => void
  ) => {
    if (!name.trim()) return;
    try {
      const newLoc = await createLocationUseCase.execute(name.trim(), parentId, '');
      newLoc.userId = currentUserId;
      await locationRepo.saveLocation(newLoc);
      await refreshData();
      setSelectedId(newLoc.id);
      setCurrentParent(newLoc.id);
    } catch (err: any) {
      alert("Fehler beim Erstellen des Lagerorts: " + err.message);
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
      const count = context === 'cable' ? cabImages.length : devImages.length;
      const newImage: ImageAttachment = {
        id: generateUUID(),
        url: compressed,
        label: label.trim() || `Foto ${count + 1}`
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
          voltage: 5,
          amperage: parseFloat(((p.wattage || 10) / 5).toFixed(2)),
          wattage: p.wattage || 10,
          portType: p.portType as any
        }))
      : undefined;

    const newId = generateUUID();
    const assignedDeviceIds: string[] = [];
    const assignedCableIds: string[] = [];
    for (const linkedId of cabFormLinks) {
      const dev = devices.find(d => d.id === linkedId);
      if (dev) {
        assignedDeviceIds.push(linkedId);
        const compatibleCableIds = dev.compatibleCableIds || [];
        if (!compatibleCableIds.includes(newId)) {
          dev.compatibleCableIds = [...compatibleCableIds, newId];
          await deviceRepo.saveDevice(dev);
        }
      }
      const cab = cables.find(c => c.id === linkedId);
      if (cab) {
        assignedCableIds.push(linkedId);
        const subAssigned = cab.assignedCableIds || [];
        if (!subAssigned.includes(newId)) {
          cab.assignedCableIds = [...subAssigned, newId];
          await cableRepo.saveCable(cab);
        }
      }
    }

    const newCable: Cable = {
      id: newId,
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
      
      // Eigenschaften für Ladegeräte
      chargerType: cabIsMulti ? cabChargerType : undefined,
      fixedCableLength: cabIsMulti && (cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') ? (cabFixedLength ? (cabFixedLength.trim().replace(/m$/, '') + 'm') : undefined) : undefined,
      fixedCablePower: cabIsMulti && (cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') ? (cabFixedPower ? (cabFixedPower.trim().replace(/W$/, '') + 'W') : undefined) : undefined,
      fixedCableConnector: cabIsMulti && (cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') ? (cabFixedConnector || undefined) : undefined,

      // Neue Eigenschaften
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
      images: cabImages.length > 0 ? cabImages : undefined,
      assignedDeviceIds: assignedDeviceIds.length > 0 ? assignedDeviceIds : undefined,
      assignedCableIds: assignedCableIds.length > 0 ? assignedCableIds : undefined
    };

    await cableRepo.saveCable(newCable);
    setCabName('');
    setCabLocation('');
    setCabIsMulti(false);
    setCabImages([]);
    setTempCabImageLabel('');
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
    setPorts([{ voltage: 5, amperage: 0, wattage: 0, portType: '' }]);
    setShowCabLoc(false);
    setShowCabPhotos(false);
    setShowChargerLoc(false);
    setShowChargerPhotos(false);
    setCabFormLinks([]);
    setShowCabLinks(false);
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

  const handleDuplicateDevice = async (device: Device) => {
    const duplicatedDevice: Device = {
      ...device,
      id: generateUUID(),
      name: `${device.name} (Kopie)`,
      compatibleCableIds: [], // Verknüpfungen zurücksetzen
      createdAt: new Date().toISOString()
    };
    await deviceRepo.saveDevice(duplicatedDevice);
    refreshData();
  };

  // Actions - Device
  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = generateUUID();
    const compatibleCableIds: string[] = [];
    for (const linkedId of devFormLinks) {
      const cab = cables.find(c => c.id === linkedId);
      if (cab) {
        compatibleCableIds.push(linkedId);
        const assignedDeviceIds = cab.assignedDeviceIds || [];
        if (!assignedDeviceIds.includes(newId)) {
          cab.assignedDeviceIds = [...assignedDeviceIds, newId];
          await cableRepo.saveCable(cab);
        }
      }
    }

    const newDevice: Device = {
      id: newId,
      name: devName,
      manufacturer: devBrand || undefined,
      requiredConnectorType: devConnector,
      requiredConnectorType2: devConnector2 || undefined,
      locationId: devLocation || undefined,
      userId: currentUserId,
      createdAt: new Date().toISOString(),
      images: devImages.length > 0 ? devImages : undefined,
      compatibleCableIds: compatibleCableIds.length > 0 ? compatibleCableIds : undefined,
      additionalProperties: Object.keys(devCustomPropValues).length > 0 ? devCustomPropValues : undefined
    };

    await deviceRepo.saveDevice(newDevice);
    setDevName('');
    setDevBrand('');
    setDevConnector2('');
    setDevLocation('');
    setDevImages([]);
    setTempDevImageLabel('');
    setDevLocParentId(undefined);
    setShowDevLoc(false);
    setShowDevPhotos(false);
    setDevFormLinks([]);
    setShowDevLinks(false);
    setShowDevPort2(false);
    setDevCustomPropValues({});
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

  const handleLinkComponents = async (
    type1: 'cable' | 'charger' | 'device',
    id1: string,
    type2: 'cable' | 'charger' | 'device',
    id2: string
  ) => {
    try {
      if (id1 === 'form_cable' || id1 === 'form_device') {
        if (id1 === 'form_cable') {
          setCabFormLinks(prev => [...prev, id2]);
        } else {
          setDevFormLinks(prev => [...prev, id2]);
        }
        return;
      }

      if (type1 === 'device' && (type2 === 'cable' || type2 === 'charger')) {
        await linkUseCase.execute(id2, id1);
      } else if ((type1 === 'cable' || type1 === 'charger') && type2 === 'device') {
        await linkUseCase.execute(id1, id2);
      } else if ((type1 === 'cable' || type1 === 'charger') && (type2 === 'cable' || type2 === 'charger')) {
        const cab1 = await cableRepo.getCableById(id1);
        const cab2 = await cableRepo.getCableById(id2);
        if (cab1 && cab2) {
          const list1 = cab1.assignedCableIds || [];
          if (!list1.includes(id2)) {
            cab1.assignedCableIds = [...list1, id2];
            await cableRepo.saveCable(cab1);
          }
          const list2 = cab2.assignedCableIds || [];
          if (!list2.includes(id1)) {
            cab2.assignedCableIds = [...list2, id1];
            await cableRepo.saveCable(cab2);
          }
        }
      }
      await refreshData();
      
      if (selectedCableDetails) {
        const updated = await cableRepo.getCableById(selectedCableDetails.id);
        setSelectedCableDetails(updated);
      }
      if (selectedDeviceDetails) {
        const updated = await deviceRepo.getDeviceById(selectedDeviceDetails.id);
        setSelectedDeviceDetails(updated);
      }
    } catch (err: any) {
      alert("Fehler beim Verknüpfen: " + err.message);
    }
  };

  const handleUnlinkComponents = async (
    type1: 'cable' | 'charger' | 'device',
    id1: string,
    type2: 'cable' | 'charger' | 'device',
    id2: string
  ) => {
    try {
      if (type1 === 'device' && (type2 === 'cable' || type2 === 'charger')) {
        await unlinkUseCase.execute(id2, id1);
      } else if ((type1 === 'cable' || type1 === 'charger') && type2 === 'device') {
        await unlinkUseCase.execute(id1, id2);
      } else if ((type1 === 'cable' || type1 === 'charger') && (type2 === 'cable' || type2 === 'charger')) {
        const cab1 = await cableRepo.getCableById(id1);
        const cab2 = await cableRepo.getCableById(id2);
        if (cab1 && cab2) {
          cab1.assignedCableIds = (cab1.assignedCableIds || []).filter(id => id !== id2);
          await cableRepo.saveCable(cab1);
          
          cab2.assignedCableIds = (cab2.assignedCableIds || []).filter(id => id !== id1);
          await cableRepo.saveCable(cab2);
        }
      }
      await refreshData();

      if (selectedCableDetails) {
        const updated = await cableRepo.getCableById(selectedCableDetails.id);
        setSelectedCableDetails(updated);
      }
      if (selectedDeviceDetails) {
        const updated = await deviceRepo.getDeviceById(selectedDeviceDetails.id);
        setSelectedDeviceDetails(updated);
      }
    } catch (err: any) {
      alert("Fehler beim Löschen der Verknüpfung: " + err.message);
    }
  };

  const openCableDetails = (cable: Cable) => {
    setSelectedCableDetails(cable);
    setEditIsEditing(false);
    setEditName(cable.name);
    setEditBrand(cable.brand || '');
    setEditConnectorType1(cable.connectorType1 || cable.connectorType || 'USB-C');
    setEditCableStandard1(cable.cableStandard1 || '');
    setEditConnectorType2(cable.connectorType2 || 'USB-C');
    setEditCableStandard2(cable.cableStandard2 || '');
    setEditLength(cable.length || '');
    setEditColor(cable.color || '');
    setEditCondition(cable.condition || '');
    setEditMaterial(cable.material || '');
    setEditDataRate(cable.dataRate || '');
    setEditChargingPower(cable.chargingPower || '');
    setEditLocation(cable.locationId || '');
    setEditLocParentId(cable.locationId || undefined);
    setEditImages(cable.images || (cable.imageUrl ? [{ id: generateUUID(), url: cable.imageUrl, label: 'Hauptbild' }] : []));
    setEditCustomPropValues(cable.additionalProperties || {});
    setEditIsMulti(!!cable.isMultiOutput);
    setEditChargerType(cable.chargerType || 'only_ports');
    setEditFixedLength((cable.fixedCableLength || '').replace(/m$/, ''));
    setEditFixedPower((cable.fixedCablePower || '').replace(/W$/, ''));
    setEditFixedConnector(cable.fixedCableConnector || 'USB-C');
    setEditPorts(cable.powerOutputs || []);
    
    const expanded: Record<string, boolean> = {};
    if (cable.brand) expanded.brand = true;
    if (cable.color) expanded.color = true;
    if (cable.condition) expanded.condition = true;
    if (cable.material) expanded.material = true;
    if (cable.dataRate) expanded.dataRate = true;
    if (cable.chargingPower) expanded.chargingPower = true;
    if (cable.additionalProperties) {
      Object.keys(cable.additionalProperties).forEach(k => {
        expanded[k] = true;
      });
    }
    setEditExpandedProps(expanded);
    setEditShowLoc(!!cable.locationId);
    setEditShowPhotos(!!(cable.images && cable.images.length > 0) || !!cable.imageUrl);
  };

  const openDeviceDetails = (device: Device) => {
    setSelectedDeviceDetails(device);
    setEditDevIsEditing(false);
    setEditName(device.name);
    setEditDevManufacturer(device.manufacturer || '');
    setEditDevConnector(device.requiredConnectorType || 'USB-C');
    setEditDevConnector2(device.requiredConnectorType2 || '');
    setEditDevLocation(device.locationId || '');
    setEditDevLocParentId(device.locationId || undefined);
    setEditDevImages(device.images || []);
    setEditDevShowLoc(!!device.locationId);
    setEditDevShowPhotos(!!(device.images && device.images.length > 0));
    setEditDevShowPort2(!!device.requiredConnectorType2);
    setEditCustomPropValues(device.additionalProperties || {});
    
    const expanded: Record<string, boolean> = {};
    if (device.manufacturer) expanded.brand = true;
    if (device.additionalProperties) {
      Object.keys(device.additionalProperties).forEach(k => {
        expanded[k] = true;
      });
    }
    setEditExpandedProps(expanded);
  };

  const handleImageAttachmentUploadEdit = async (context: 'cable' | 'device', file: File, label: string) => {
    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      const newImage: ImageAttachment = {
        id: generateUUID(),
        url: compressed,
        label: label.trim() || `Foto ${context === 'cable' ? editImages.length + 1 : editDevImages.length + 1}`
      };
      if (context === 'cable') {
        setEditImages(prev => [...prev, newImage]);
      } else {
        setEditDevImages(prev => [...prev, newImage]);
      }
    } catch (err) {
      alert("Fehler bei der Bildkomprimierung.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSaveCableEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCableDetails) return;
    
    const powerOutputs = editIsMulti && (editChargerType === 'only_ports' || editChargerType === 'hybrid')
      ? editPorts.map(p => ({
          voltage: 5,
          amperage: parseFloat(((p.wattage || 10) / 5).toFixed(2)),
          wattage: p.wattage || 10,
          portType: p.portType as any
        }))
      : undefined;

    const updatedCable: Cable = {
      ...selectedCableDetails,
      name: editName,
      brand: editExpandedProps.brand && editBrand ? editBrand : undefined,
      connectorType: editIsMulti 
        ? (editChargerType === 'only_ports' 
            ? (editPorts[0]?.portType as any || 'Other') 
            : (editFixedConnector as any))
        : (editConnectorType1 as any),
      connectorType1: editIsMulti ? undefined : (editConnectorType1 as any),
      connectorType2: editIsMulti ? undefined : (editConnectorType2 as any),
      cableStandard1: (!editIsMulti && editCableStandard1) ? editCableStandard1 : undefined,
      cableStandard2: (!editIsMulti && editCableStandard2) ? editCableStandard2 : undefined,
      length: (!editIsMulti && editLength) ? editLength : undefined,
      color: editExpandedProps.color && editColor ? editColor : undefined,
      condition: editExpandedProps.condition && editCondition ? editCondition : undefined,
      material: editExpandedProps.material && editMaterial ? editMaterial : undefined,
      dataRate: editExpandedProps.dataRate && editDataRate ? editDataRate : undefined,
      chargingPower: editExpandedProps.chargingPower && editChargingPower ? editChargingPower : undefined,
      locationId: editLocation || undefined,
      isMultiOutput: editIsMulti ? true : undefined,
      chargerType: editIsMulti ? editChargerType : undefined,
      fixedCableLength: editIsMulti && (editChargerType === 'only_fixed_cable' || editChargerType === 'hybrid') ? (editFixedLength ? (editFixedLength.trim().replace(/m$/, '') + 'm') : undefined) : undefined,
      fixedCablePower: editIsMulti && (editChargerType === 'only_fixed_cable' || editChargerType === 'hybrid') ? (editFixedPower ? (editFixedPower.trim().replace(/W$/, '') + 'W') : undefined) : undefined,
      fixedCableConnector: editIsMulti && (editChargerType === 'only_fixed_cable' || editChargerType === 'hybrid') ? (editFixedConnector as any) : undefined,
      powerOutputs,
      images: editImages.length > 0 ? editImages : undefined,
      imageUrl: editImages.length > 0 ? editImages[0].url : undefined,
      additionalProperties: Object.keys(editCustomPropValues).length > 0 ? editCustomPropValues : undefined
    };

    await cableRepo.saveCable(updatedCable);
    setSelectedCableDetails(null);
    refreshData();
  };

  const handleSaveDeviceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceDetails) return;

    const updatedDevice: Device = {
      ...selectedDeviceDetails,
      name: editName,
      manufacturer: editDevManufacturer || undefined,
      requiredConnectorType: editDevConnector as any,
      requiredConnectorType2: editDevShowPort2 && editDevConnector2 ? (editDevConnector2 as any) : undefined,
      locationId: editDevLocation || undefined,
      images: editDevImages.length > 0 ? editDevImages : undefined,
      additionalProperties: Object.keys(editCustomPropValues).length > 0 ? editCustomPropValues : undefined
    };

    await deviceRepo.saveDevice(updatedDevice);
    setSelectedDeviceDetails(null);
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

  // Filtered components for Inventory view
  const filteredCablesForInventory = filterByLocation(
    cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)),
    inventoryLocationFilter
  );
  
  const filteredChargersForInventory = filterByLocation(
    cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)),
    inventoryLocationFilter
  );

  const filteredDevicesForInventory = filterByLocation(
    devices,
    inventoryLocationFilter
  );

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
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', marginBottom: '0.75rem' }}>
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
          onClick={() => {
            if (activeTab === 'settings' && settingsView !== 'menu') {
              setSettingsView('menu');
            } else {
              stopCamera();
              setReassigningCableId(null);
              setActiveTab('home');
            }
          }} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem', padding: 0 }}
        >
          <ArrowLeft size={16} /> Zurück
        </button>
      )}

      {/* Fuzzy Search (auf allen Seiten außer Einstellungen anzeigen) */}
      {activeTab !== 'settings' && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
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

      {/* Search Results (auf allen Seiten außer Einstellungen anzeigen) */}
      {activeTab !== 'settings' && searchQuery && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Suchergebnisse</h3>
          {searchResults.cables.length === 0 && searchResults.devices.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>Keine passenden Kabel/Geräte gefunden.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {searchResults.cables.map(c => {
              const isCharger = c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0);
              return (
                <div 
                  key={c.id} 
                  onClick={() => { openCableDetails(c); setSearchQuery(''); }}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: 'var(--radius-xs)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img 
                        src={c.images && c.images.length > 0 ? c.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: c.images && c.images.length > 0 ? 'cover' : 'contain',
                          opacity: c.images && c.images.length > 0 ? 1 : 0.4,
                          padding: c.images && c.images.length > 0 ? 0 : '8px'
                        }} 
                      />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{c.name}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                      {isCharger ? '🔌 Netzteil' : '🔌 Kabel'}: {c.connectorType1 && c.connectorType2 ? `${c.connectorType1} ↔ ${c.connectorType2}` : c.connectorType}
                    </span>
                    {c.brand && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                        🏷️ {c.brand}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {searchResults.devices.map(d => (
              <div 
                key={d.id} 
                onClick={() => { openDeviceDetails(d); setSearchQuery(''); }}
                style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: 'var(--radius-xs)', 
                    overflow: 'hidden', 
                    border: '1px solid var(--border-glass)', 
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <img 
                      src={d.images && d.images.length > 0 ? d.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                      alt="" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: d.images && d.images.length > 0 ? 'cover' : 'contain',
                        opacity: d.images && d.images.length > 0 ? 1 : 0.4,
                        padding: d.images && d.images.length > 0 ? 0 : '8px'
                      }} 
                    />
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{d.name}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Ort: {d.locationId ? buildLocationPath(d.locationId, locations) : 'Kein Ort'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                    📱 Gerät: {d.requiredConnectorType}{d.requiredConnectorType2 ? `, ${d.requiredConnectorType2}` : ''}
                  </span>
                  {d.manufacturer && (
                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                      🏷️ {d.manufacturer}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOME DASHBOARD TILE GRID */}
      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0rem' }}>
          {/* Hero Inventar Tile */}
          <div 
            onClick={() => setActiveTab('inventory')} 
            className="glass-panel tile-btn" 
            style={{ 
              padding: '1.5rem 1.25rem', 
              textAlign: 'center', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '1.5rem', 
              borderRadius: 'var(--radius-md)', 
              position: 'relative',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}
          >
            {(cables.length + devices.length) > 0 && (
              <span style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: 'var(--accent-gradient)',
                color: 'white',
                borderRadius: '50%',
                minWidth: '32px',
                height: '32px',
                padding: '0 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.5)',
                border: '2px solid var(--bg-primary)',
                zIndex: 10
              }}>
                {cables.length + devices.length}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', borderRadius: '50%', width: '56px', height: '56px', border: '1px solid var(--border-glass)', flexShrink: 0 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" stroke-linecap="round" stroke-linejoin="round" style={{ color: 'var(--accent-primary)' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)', display: 'block' }}>Inventar</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Alle Kabel, Ladegeräte und Geräte im Überblick</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {/* Tile 1: Kabel */}
            <div 
              onClick={() => setActiveTab('cables')} 
              className="glass-panel tile-btn" 
              style={{ 
                padding: '2rem 1.25rem', 
                textAlign: 'center', 
                cursor: 'pointer', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '1rem', 
                borderRadius: 'var(--radius-md)', 
                position: 'relative' 
              }}
            >
              {cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-16px',
                  right: '-16px',
                  background: 'var(--accent-gradient)',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '40px',
                  height: '40px',
                  padding: '0 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.5)',
                  border: '3px solid var(--bg-primary)',
                  zIndex: 10
                }}>
                  {cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)).length}
                </span>
              )}
              <img src="/icons/cables.png" alt="Kabel" style={{ width: '84px', height: '84px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
              <span style={{ fontWeight: 600, fontSize: '1.4rem' }}>Kabel</span>
            </div>

            {/* Tile 2: Ladegeräte */}
            <div 
              onClick={() => setActiveTab('chargers')} 
              className="glass-panel tile-btn" 
              style={{ 
                padding: '2rem 1.25rem', 
                textAlign: 'center', 
                cursor: 'pointer', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '1rem', 
                borderRadius: 'var(--radius-md)', 
                position: 'relative' 
              }}
            >
              {cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-16px',
                  right: '-16px',
                  background: 'var(--accent-gradient)',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '40px',
                  height: '40px',
                  padding: '0 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.5)',
                  border: '3px solid var(--bg-primary)',
                  zIndex: 10
                }}>
                  {cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)).length}
                </span>
              )}
              <img src="/icons/chargers.png" alt="Ladegeräte" style={{ width: '84px', height: '84px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
              <span style={{ fontWeight: 600, fontSize: '1.4rem' }}>Ladegeräte</span>
            </div>

            {/* Tile 3: Geräte */}
            <div 
              onClick={() => setActiveTab('devices')} 
              className="glass-panel tile-btn" 
              style={{ 
                padding: '2rem 1.25rem', 
                textAlign: 'center', 
                cursor: 'pointer', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '1rem', 
                borderRadius: 'var(--radius-md)', 
                position: 'relative' 
              }}
            >
              {devices.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-16px',
                  right: '-16px',
                  background: 'var(--accent-gradient)',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '40px',
                  height: '40px',
                  padding: '0 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.5)',
                  border: '3px solid var(--bg-primary)',
                  zIndex: 10
                }}>
                  {devices.length}
                </span>
              )}
              <img src="/icons/devices.png" alt="Geräte" style={{ width: '84px', height: '84px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
              <span style={{ fontWeight: 600, fontSize: '1.4rem' }}>Geräte</span>
            </div>

            {/* Tile 4: Lagerorte */}
            <div 
              onClick={() => setActiveTab('locations')} 
              className="glass-panel tile-btn" 
              style={{ 
                padding: '2rem 1.25rem', 
                textAlign: 'center', 
                cursor: 'pointer', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '1rem', 
                borderRadius: 'var(--radius-md)', 
                position: 'relative' 
              }}
            >
              <img src="/icons/locations.png" alt="Lagerorte" style={{ width: '84px', height: '84px', objectFit: 'contain', filter: 'var(--icon-filter)' }} />
              <span style={{ fontWeight: 600, fontSize: '1.4rem' }}>Lagerorte</span>
            </div>
          </div>
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

      {/* TAB: INVENTORY */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ color: 'var(--accent-primary)' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <h3 style={{ margin: 0 }}>Inventar</h3>
            </div>
            {inventoryLocationFilter && (
              <button 
                onClick={() => { setInventoryLocationFilter(null); setInventoryLocCurrentParentId(undefined); }}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                Filter aufheben
              </button>
            )}
          </div>

          {/* Type filter segmented buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(['all', 'cables', 'chargers', 'devices'] as const).map(type => {
              const label = type === 'all' ? 'Alle' : type === 'cables' ? 'Kabel' : type === 'chargers' ? 'Ladegeräte' : 'Geräte';
              const count = type === 'all' 
                ? (filteredCablesForInventory.length + filteredChargersForInventory.length + filteredDevicesForInventory.length)
                : type === 'cables' 
                  ? filteredCablesForInventory.length 
                  : type === 'chargers' 
                    ? filteredChargersForInventory.length 
                    : filteredDevicesForInventory.length;
              const isSelected = inventoryTypeFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setInventoryTypeFilter(type)}
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '0.4rem 0.8rem', 
                    borderRadius: '20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.35rem',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                    background: isSelected ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    boxShadow: isSelected ? '0 4px 12px var(--accent-glow)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {label} <span style={{ fontSize: '0.75rem', opacity: 0.8, background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)', padding: '0.05rem 0.35rem', borderRadius: '10px', color: isSelected ? '#ffffff' : 'var(--text-secondary)' }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Hierarchical Location selector */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Lagerort-Filter
            </div>

            {/* Breadcrumbs path */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.15)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
              <span 
                onClick={() => { setInventoryLocationFilter(null); setInventoryLocCurrentParentId(undefined); }}
                style={{ cursor: 'pointer', color: !inventoryLocationFilter ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: !inventoryLocationFilter ? 'bold' : 'normal' }}
              >
                📍 Home [{cables.length + devices.length}]
              </span>
              {inventoryLocationFilter === 'none' && (
                <>
                  <span style={{ color: 'var(--text-secondary)' }}>&gt;</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                    Ohne Lagerort [{(cables.filter(c => !c.locationId).length + devices.filter(d => !d.locationId).length)}]
                  </span>
                </>
              )}
              {(() => {
                const getInventoryPathNodes = (parentId: string | undefined): StorageLocation[] => {
                  if (!parentId) return [];
                  const loc = locations.find(l => l.id === parentId);
                  if (!loc) return [];
                  return [...getInventoryPathNodes(loc.parentLocationId), loc];
                };
                const inventoryBreadcrumbs = getInventoryPathNodes(inventoryLocCurrentParentId);
                return inventoryBreadcrumbs.map((node) => {
                  const count = getComponentCountAtLocation(node.id);
                  const isActive = inventoryLocationFilter === node.id;
                  return (
                    <React.Fragment key={node.id}>
                      <span style={{ color: 'var(--text-secondary)' }}>&gt;</span>
                      <span 
                        onClick={() => { setInventoryLocationFilter(node.id); setInventoryLocCurrentParentId(node.id); }}
                        style={{ cursor: 'pointer', color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 'bold' : 'normal' }}
                      >
                        {node.name} [{count}]
                      </span>
                    </React.Fragment>
                  );
                });
              })()}
            </div>

            {/* Sub-locations list at the current parent level */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.4rem', 
              maxHeight: '180px', 
              overflowY: 'auto', 
              borderLeft: '2px solid var(--accent-glow)', 
              paddingLeft: '0.75rem', 
              marginTop: '0.25rem' 
            }}>
              {/* If current parent is undefined (Home), show "Ohne Lagerort" and top-level locations */}
              {inventoryLocCurrentParentId === undefined ? (
                <>
                  {/* Ohne Lagerort */}
                  {(() => {
                    const countNoLoc = cables.filter(c => !c.locationId).length + devices.filter(d => !d.locationId).length;
                    if (countNoLoc === 0) return null;
                    const isSelected = inventoryLocationFilter === 'none';
                    return (
                      <div 
                        onClick={() => setInventoryLocationFilter('none')}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem', 
                          borderRadius: 'var(--radius-sm)', 
                          background: isSelected ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)', 
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          📦 Ohne Lagerort
                        </span>
                        <span style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {countNoLoc}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Top level locations */}
                  {locations.filter(l => !l.parentLocationId).map(loc => {
                    const count = getComponentCountAtLocation(loc.id);
                    const isSelected = inventoryLocationFilter === loc.id;
                    const hasSub = locations.some(l => l.parentLocationId === loc.id);
                    return (
                      <div 
                        key={loc.id}
                        onClick={() => {
                          setInventoryLocationFilter(loc.id);
                          if (hasSub) {
                            setInventoryLocCurrentParentId(loc.id);
                          }
                        }}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem', 
                          borderRadius: 'var(--radius-sm)', 
                          background: isSelected ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)', 
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          📁 {loc.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            {count}
                          </span>
                          {hasSub && <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>&gt;</span>}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                // Nested sub-locations
                <>
                  {/* Back to previous level button */}
                  <div 
                    onClick={() => {
                      const currentLoc = locations.find(l => l.id === inventoryLocCurrentParentId);
                      const parentId = currentLoc ? currentLoc.parentLocationId : undefined;
                      setInventoryLocCurrentParentId(parentId);
                      setInventoryLocationFilter(parentId || null);
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      padding: '0.35rem 0.5rem', 
                      fontSize: '0.75rem', 
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <span>← Eine Ebene nach oben</span>
                  </div>

                  {locations.filter(l => l.parentLocationId === inventoryLocCurrentParentId).map(loc => {
                    const count = getComponentCountAtLocation(loc.id);
                    const isSelected = inventoryLocationFilter === loc.id;
                    const hasSub = locations.some(l => l.parentLocationId === loc.id);
                    return (
                      <div 
                        key={loc.id}
                        onClick={() => {
                          setInventoryLocationFilter(loc.id);
                          if (hasSub) {
                            setInventoryLocCurrentParentId(loc.id);
                          }
                        }}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem', 
                          borderRadius: 'var(--radius-sm)', 
                          background: isSelected ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)', 
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          📁 {loc.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            {count}
                          </span>
                          {hasSub && <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>&gt;</span>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Unified list of filtered components */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Komponenten</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {/* Cables list */}
              {(inventoryTypeFilter === 'all' || inventoryTypeFilter === 'cables') && filteredCablesForInventory.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => openCableDetails(c)}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {/* UPPER AREA: Image left, Name right */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: 'var(--radius-xs)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img 
                        src={c.images && c.images.length > 0 ? c.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: c.images && c.images.length > 0 ? 'cover' : 'contain',
                          opacity: c.images && c.images.length > 0 ? 1 : 0.4,
                          padding: c.images && c.images.length > 0 ? 0 : '8px'
                        }} 
                      />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{c.name}</strong>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>

                  {/* Chips für Eigenschaften */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                    {/* Stecker-Typ als Eigenschaft */}
                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                      🔌 {c.connectorType1 && c.connectorType2 ? `${c.connectorType1} ↔ ${c.connectorType2}` : c.connectorType}
                    </span>
                    {/* Hersteller als Eigenschaft */}
                    {c.brand && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                        🏷️ {c.brand}
                      </span>
                    )}
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
                </div>
              ))}

              {/* Chargers list */}
              {(inventoryTypeFilter === 'all' || inventoryTypeFilter === 'chargers') && filteredChargersForInventory.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => openCableDetails(c)}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {/* UPPER AREA: Image left, Name right */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: 'var(--radius-xs)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img 
                        src={c.images && c.images.length > 0 ? c.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: c.images && c.images.length > 0 ? 'cover' : 'contain',
                          opacity: c.images && c.images.length > 0 ? 1 : 0.4,
                          padding: c.images && c.images.length > 0 ? 0 : '8px'
                        }} 
                      />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{c.name}</strong>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>

                  {/* Chips für Eigenschaften */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                    {/* Ladegerät-Typ als Eigenschaft */}
                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                      🔌 {c.chargerType === 'only_fixed_cable' ? 'Kabel-Netzteil' : c.chargerType === 'hybrid' ? 'Hybrid-Lader' : 'Port-Lader'}
                    </span>
                    {/* Hersteller als Eigenschaft */}
                    {c.brand && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                        🏷️ {c.brand}
                      </span>
                    )}
                    {c.length && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>📏 {c.length}</span>}
                    {c.color && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>🎨 {c.color}</span>}
                    {c.condition && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>✨ {c.condition}</span>}
                    {c.material && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>🧵 {c.material}</span>}
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

                  {/* Ports / Festes Kabel Detail-Info */}
                  <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.4rem' }}>
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
                </div>
              ))}

              {/* Devices list */}
              {(inventoryTypeFilter === 'all' || inventoryTypeFilter === 'devices') && filteredDevicesForInventory.map(d => (
                <div 
                  key={d.id} 
                  onClick={() => openDeviceDetails(d)}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {/* UPPER AREA: Image left, Name right */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: 'var(--radius-xs)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img 
                        src={d.images && d.images.length > 0 ? d.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: d.images && d.images.length > 0 ? 'cover' : 'contain',
                          opacity: d.images && d.images.length > 0 ? 1 : 0.4,
                          padding: d.images && d.images.length > 0 ? 0 : '8px'
                        }} 
                      />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{d.name}</strong>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Ort: {d.locationId ? buildLocationPath(d.locationId, locations) : 'Kein Ort'}
                  </div>

                  {/* Chips für Eigenschaften */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                    {/* Anschluss/Port als Eigenschaft */}
                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                      🔌 {d.requiredConnectorType}{d.requiredConnectorType2 ? `, ${d.requiredConnectorType2}` : ''}
                    </span>
                    {/* Hersteller als Eigenschaft */}
                    {d.manufacturer && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                        🏷️ {d.manufacturer}
                      </span>
                    )}
                    
                    {/* Custom Properties */}
                    {d.additionalProperties && Object.entries(d.additionalProperties).map(([propId, val]) => {
                      const propDef = customProperties.find(p => p.id === propId);
                      const label = propDef ? propDef.label : propId;
                      return val ? (
                        <span key={propId} style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                          🏷️ {label}: {val}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {((inventoryTypeFilter === 'all' && filteredCablesForInventory.length === 0 && filteredChargersForInventory.length === 0 && filteredDevicesForInventory.length === 0) ||
                (inventoryTypeFilter === 'cables' && filteredCablesForInventory.length === 0) ||
                (inventoryTypeFilter === 'chargers' && filteredChargersForInventory.length === 0) ||
                (inventoryTypeFilter === 'devices' && filteredDevicesForInventory.length === 0)) && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                  Keine passenden Komponenten gefunden.
                </span>
              )}
            </div>
          </div>
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
                <option key={l.id} value={l.id}>{l.name}</option>
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
            
            {/* Haupteigenschaften */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Name</label>
              <input type="text" placeholder="Name" value={cabName} onChange={e => setCabName(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} required />
            </div>

            {/* Paar: Stecker 1 + Standard 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stecker-Typ 1</label>
                <select value={cabConnectorType1} onChange={e => handleSelectChange('Stecker-Typ 1', e.target.value, connectors, setConnectors, 'list_connectors', setCabConnectorType1)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Standard (Stecker 1)</label>
                <select value={cabCableStandard1} onChange={e => handleCableStandardSelect(1, e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {(cableStandardGroups[getConnectorFamily(cabConnectorType1)] || []).map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
            </div>

            {/* Paar: Stecker 2 + Standard 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stecker-Typ 2</label>
                <select value={cabConnectorType2} onChange={e => handleSelectChange('Stecker-Typ 2', e.target.value, connectors, setConnectors, 'list_connectors', setCabConnectorType2)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Standard (Stecker 2)</label>
                <select value={cabCableStandard2} onChange={e => handleCableStandardSelect(2, e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Keine Angabe --</option>
                  {(cableStandardGroups[getConnectorFamily(cabConnectorType2)] || []).map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                  <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                </select>
              </div>
            </div>

            {/* Kabellänge */}
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
                {/* Platzhalter */}
              </div>
            </div>

            {/* Eingeklappte optionale Eigenschaften (inline wenn aufgeklappt) */}
            {(
              (propertyAssignments.brand?.includes('cable') && expandedCabProps.brand) ||
              (propertyAssignments.color?.includes('cable') && expandedCabProps.color) ||
              (propertyAssignments.condition?.includes('cable') && expandedCabProps.condition) ||
              (propertyAssignments.material?.includes('cable') && expandedCabProps.material) ||
              (propertyAssignments.dataRate?.includes('cable') && expandedCabProps.dataRate) ||
              (propertyAssignments.chargingPower?.includes('cable') && expandedCabProps.chargingPower) ||
              customProperties.some(p => propertyAssignments[p.id]?.includes('cable') && expandedCabProps[p.id])
            ) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                {propertyAssignments.brand?.includes('cable') && expandedCabProps.brand && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Marke</label>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <select value={cabBrand} onChange={e => handleSelectChange('Marke', e.target.value, brands, setBrands, 'list_brands', setCabBrand)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        <option value="">-- Keine Angabe --</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                      </select>
                      <button type="button" onClick={() => { setExpandedCabProps(p => ({ ...p, brand: false })); setCabBrand(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                    </div>
                  </div>
                )}
                {propertyAssignments.color?.includes('cable') && expandedCabProps.color && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Farbe</label>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <select value={cabColor} onChange={e => handleSelectChange('Farbe', e.target.value, colors, setColors, 'list_colors', setCabColor)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        <option value="">-- Keine Angabe --</option>
                        {colors.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                      </select>
                      <button type="button" onClick={() => { setExpandedCabProps(p => ({ ...p, color: false })); setCabColor(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                    </div>
                  </div>
                )}
                {propertyAssignments.condition?.includes('cable') && expandedCabProps.condition && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Zustand</label>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <select value={cabCondition} onChange={e => handleSelectChange('Zustand', e.target.value, conditions, setConditions, 'list_conditions', setCabCondition)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        <option value="">-- Keine Angabe --</option>
                        {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                      </select>
                      <button type="button" onClick={() => { setExpandedCabProps(p => ({ ...p, condition: false })); setCabCondition(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                    </div>
                  </div>
                )}
                {propertyAssignments.material?.includes('cable') && expandedCabProps.material && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Material</label>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <select value={cabMaterial} onChange={e => handleSelectChange('Material', e.target.value, materials, setMaterials, 'list_materials', setCabMaterial)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        <option value="">-- Keine Angabe --</option>
                        {materials.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                      </select>
                      <button type="button" onClick={() => { setExpandedCabProps(p => ({ ...p, material: false })); setCabMaterial(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                    </div>
                  </div>
                )}
                {propertyAssignments.dataRate?.includes('cable') && expandedCabProps.dataRate && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Datenrate</label>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <select value={cabDataRate} onChange={e => handleSelectChange('Datenrate', e.target.value, dataRates, setDataRates, 'list_data_rates', setCabDataRate)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        <option value="">-- Keine Angabe --</option>
                        {dataRates.map(d => <option key={d} value={d}>{d}</option>)}
                        <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                      </select>
                      <button type="button" onClick={() => { setExpandedCabProps(p => ({ ...p, dataRate: false })); setCabDataRate(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                    </div>
                  </div>
                )}
                {propertyAssignments.chargingPower?.includes('cable') && expandedCabProps.chargingPower && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ladeleistung</label>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <select value={cabChargingPower} onChange={e => handleSelectChange('Ladeleistung', e.target.value, chargingPowers, setChargingPowers, 'list_charging_powers', setCabChargingPower)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        <option value="">-- Keine Angabe --</option>
                        {chargingPowers.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                      </select>
                      <button type="button" onClick={() => { setExpandedCabProps(p => ({ ...p, chargingPower: false })); setCabChargingPower(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                    </div>
                  </div>
                )}
                {customProperties.filter(prop => propertyAssignments[prop.id]?.includes('cable')).map(prop => {
                  if (!expandedCabProps[prop.id]) return null;
                  return (
                    <div key={prop.id}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
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
                          style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        >
                          <option value="">-- Keine Angabe --</option>
                          {prop.values.map(v => <option key={v} value={v}>{v}</option>)}
                          <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                        </select>
                        <button type="button" onClick={() => { setExpandedCabProps(p => ({ ...p, [prop.id]: false })); setCustomPropValues(prev => { const c = { ...prev }; delete c[prop.id]; return c; }); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Buttons für einklappbare Optionen */}
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', flexWrap: 'wrap' }}>
              {propertyAssignments.brand?.includes('cable') && !expandedCabProps.brand && (
                <button type="button" onClick={() => setExpandedCabProps(p => ({ ...p, brand: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Marke
                </button>
              )}
              {propertyAssignments.color?.includes('cable') && !expandedCabProps.color && (
                <button type="button" onClick={() => setExpandedCabProps(p => ({ ...p, color: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Farbe
                </button>
              )}
              {propertyAssignments.condition?.includes('cable') && !expandedCabProps.condition && (
                <button type="button" onClick={() => setExpandedCabProps(p => ({ ...p, condition: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Zustand
                </button>
              )}
              {propertyAssignments.material?.includes('cable') && !expandedCabProps.material && (
                <button type="button" onClick={() => setExpandedCabProps(p => ({ ...p, material: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Material
                </button>
              )}
              {propertyAssignments.dataRate?.includes('cable') && !expandedCabProps.dataRate && (
                <button type="button" onClick={() => setExpandedCabProps(p => ({ ...p, dataRate: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Datenrate
                </button>
              )}
              {propertyAssignments.chargingPower?.includes('cable') && !expandedCabProps.chargingPower && (
                <button type="button" onClick={() => setExpandedCabProps(p => ({ ...p, chargingPower: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Ladeleistung
                </button>
              )}
              {customProperties.filter(prop => propertyAssignments[prop.id]?.includes('cable') && !expandedCabProps[prop.id]).map(prop => (
                <button key={prop.id} type="button" onClick={() => setExpandedCabProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + {prop.label}
                </button>
              ))}
              <button 
                type="button" 
                onClick={() => setShowCabLoc(!showCabLoc)} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {cabLocation ? `Lagerort: ${locations.find(l => l.id === cabLocation)?.name || 'Gewählt'}` : '+ Lagerort'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowCabPhotos(!showCabPhotos)} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {cabImages.length > 0 ? `Fotos (${cabImages.length})` : '+ Foto'}
              </button>
              {!showCabLinks && (
                <button 
                  type="button" 
                  onClick={() => setShowCabLinks(true)} 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  + Verknüpfung
                </button>
              )}
            </div>

            {/* Vorläufige Verknüpfungen beim Anlegen */}
            {showCabLinks && (
              <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Verknüpfte Komponenten:</span>
                  <button 
                    type="button"
                    onClick={() => setLinkingSource({ id: 'form_cable', type: 'cable', name: cabName || 'Neues Kabel' })}
                    className="btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Verknüpfen
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {cabFormLinks.map(linkedId => {
                    const dev = devices.find(d => d.id === linkedId);
                    const cab = cables.find(c => c.id === linkedId);
                    const name = dev ? `📱 ${dev.name} (Gerät)` : cab ? `${cab.isMultiOutput ? '🔌' : '🔌'} ${cab.name} (${cab.isMultiOutput ? 'Ladegerät' : 'Kabel'})` : linkedId;
                    return (
                      <div key={linkedId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                        <span>{name}</span>
                        <button type="button" onClick={() => setCabFormLinks(prev => prev.filter(id => id !== linkedId))} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}>&times;</button>
                      </div>
                    );
                  })}
                  {cabFormLinks.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keine Verknüpfungen vorhanden.</span>}
                </div>
              </div>
            )}

            {/* Hierarchische Lagerort-Auswahl */}
            {showCabLoc && (
              <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                {renderLocationTreeSelector(cabLocParentId, setCabLocParentId, cabLocation, setCabLocation, 'Lagerort')}
              </div>
            )}

            {/* Foto beschreiben & hinzufügen */}
            {showCabPhotos && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <input 
                        type="text" 
                        placeholder="Beschreibung (optional, z.B. Stecker 1)" 
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
              </div>
            )}

            <button type="submit" className="btn-primary" onClick={() => setCabIsMulti(false)}>Kabel anlegen</button>
          </form>

          {/* List Cables */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Kabel</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0)).map(c => (
                <div 
                  key={c.id} 
                  onClick={() => openCableDetails(c)}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {/* UPPER AREA: Image left, Name right */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: 'var(--radius-xs)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img 
                        src={c.images && c.images.length > 0 ? c.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: c.images && c.images.length > 0 ? 'cover' : 'contain',
                          opacity: c.images && c.images.length > 0 ? 1 : 0.4,
                          padding: c.images && c.images.length > 0 ? 0 : '8px'
                        }} 
                      />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{c.name}</strong>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>

                  {/* Chips für Eigenschaften */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                    {/* Stecker-Typ als Eigenschaft */}
                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                      🔌 {c.connectorType1 && c.connectorType2 ? `${c.connectorType1} ↔ ${c.connectorType2}` : c.connectorType}
                    </span>
                    {/* Hersteller als Eigenschaft */}
                    {c.brand && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                        🏷️ {c.brand}
                      </span>
                    )}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setCabChargerType('only_ports')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem', background: cabChargerType === 'only_ports' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  <USBAIcon size={18} />
                  <span>Nur Ports</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setCabChargerType('only_fixed_cable')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem', background: cabChargerType === 'only_fixed_cable' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  <CableIcon size={18} />
                  <span>Festes Kabel</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setCabChargerType('hybrid')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem', background: cabChargerType === 'hybrid' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <USBAIcon size={16} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', lineHeight: 1 }}>+</span>
                    <CableIcon size={16} />
                  </div>
                  <span>Hybrid</span>
                </button>
                <div />
              </div>
            </div>

            {/* Sektion A: Fest verbautes Kabel */}
            {(cabChargerType === 'only_fixed_cable' || cabChargerType === 'hybrid') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Festes Kabel</span>
                <div style={{ display: 'grid', gridTemplateColumns: windowWidth < 450 ? '1fr' : '1.2fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stecker-Typ</label>
                    <select value={cabFixedConnector} onChange={e => setCabFixedConnector(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '32px' }}>
                      <option value="USB-C">USB-C</option>
                      <option value="Micro-USB">Micro-USB</option>
                      <option value="Lightning">Lightning</option>
                      <option value="DC-Jack">DC-Jack</option>
                      <option value="Other">Andere</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Länge</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="text" placeholder="z.B. 1.5" value={cabFixedLength} onChange={e => setCabFixedLength(e.target.value)} style={{ width: '100%', padding: '0.4rem 1.2rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '32px' }} />
                      <span style={{ position: 'absolute', right: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>m</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Leistung</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="text" placeholder="z.B. 65" value={cabFixedPower} onChange={e => setCabFixedPower(e.target.value)} style={{ width: '100%', padding: '0.4rem 1.2rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '32px' }} />
                      <span style={{ position: 'absolute', right: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>W</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sektion B: Leistungsausgänge (Ports) */}
            {(cabChargerType === 'only_ports' || cabChargerType === 'hybrid') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ports</span>
                {ports.map((p, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '0.4rem', alignItems: 'center' }}>
                    <select value={p.portType} onChange={e => {
                      const updated = [...ports];
                      updated[idx].portType = e.target.value;
                      setPorts(updated);
                    }} style={{ padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                      <option value="">-- Port-Typ --</option>
                      <option value="USB-C">USB-C</option>
                      <option value="USB-A">USB-A</option>
                      <option value="DC-Jack">DC-Jack</option>
                    </select>
                    
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Watt" value={p.wattage || ''} onChange={e => {
                        const w = Number(e.target.value);
                        const updated = [...ports];
                        updated[idx].wattage = w;
                        setPorts(updated);
                      }} style={{ width: '100%', padding: '0.4rem 1.1rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }} />
                      <span style={{ position: 'absolute', right: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>W</span>
                    </div>

                    {ports.length > 1 && (
                      <button type="button" onClick={() => setPorts(ports.filter((_, i) => i !== idx))} style={{ background: 'none', color: 'var(--error)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }}>&times;</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setPorts([...ports, { voltage: 5, amperage: 0, wattage: 0, portType: '' }])} style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', textAlign: 'left', marginTop: '0.25rem', border: 'none', padding: 0, cursor: 'pointer' }}>+ Weiteren Port hinzufügen</button>
              </div>
            )}

            {/* Dynamische Eigenschaften basierend auf Zuordnung für Ladegeräte */}
            {(() => {
              const assignedPropsList = [
                { id: 'brand', label: 'Marke', list: brands, setList: setBrands, key: 'list_brands', val: cabBrand, setVal: setCabBrand },
                { id: 'length', label: 'Kabellänge', list: lengths, setList: setLengths, key: 'list_lengths', val: cabLength, setVal: setCabLength },
                { id: 'color', label: 'Farbe', list: colors, setList: setColors, key: 'list_colors', val: cabColor, setVal: setCabColor },
                { id: 'condition', label: 'Zustand', list: conditions, setList: setConditions, key: 'list_conditions', val: cabCondition, setVal: setCabCondition },
                { id: 'material', label: 'Material', list: materials, setList: setMaterials, key: 'list_materials', val: cabMaterial, setVal: setCabMaterial },
                { id: 'dataRate', label: 'Datenrate', list: dataRates, setList: setDataRates, key: 'list_data_rates', val: cabDataRate, setVal: setCabDataRate },
                { id: 'chargingPower', label: 'Leistung', list: chargingPowers, setList: setChargingPowers, key: 'list_charging_powers', val: cabChargingPower, setVal: setCabChargingPower },
              ];

              const activeStandardProps = assignedPropsList.filter(p => propertyAssignments[p.id]?.includes('charger'));
              const activeCustomProps = customProperties.filter(p => propertyAssignments[p.id]?.includes('charger'));

              const hasAnyActiveProps = activeStandardProps.some(p => expandedChargerProps[p.id]) || activeCustomProps.some(p => expandedChargerProps[p.id]);
              if (!hasAnyActiveProps) return null;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  {activeStandardProps.map(prop => {
                    if (!expandedChargerProps[prop.id]) return null;
                    return (
                      <div key={prop.id}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <select value={prop.val} onChange={e => handleSelectChange(prop.label, e.target.value, prop.list, prop.setList, prop.key, prop.setVal)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                            <option value="">-- Keine Angabe --</option>
                            {prop.list.map(x => <option key={x} value={x}>{x}</option>)}
                            <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                          </select>
                          <button type="button" onClick={() => { setExpandedChargerProps(p => ({ ...p, [prop.id]: false })); prop.setVal(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom active props */}
                  {activeCustomProps.map(prop => {
                    if (!expandedChargerProps[prop.id]) return null;
                    return (
                      <div key={prop.id}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
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
                            style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                          >
                            <option value="">-- Keine Angabe --</option>
                            {prop.values.map(v => <option key={v} value={v}>{v}</option>)}
                            <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                          </select>
                          <button type="button" onClick={() => { setExpandedChargerProps(p => ({ ...p, [prop.id]: false })); setCustomPropValues(prev => { const c = { ...prev }; delete c[prop.id]; return c; }); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Buttons für einklappbare Optionen */}
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', flexWrap: 'wrap' }}>
              {[
                { id: 'brand', label: 'Marke' },
                { id: 'length', label: 'Kabellänge' },
                { id: 'color', label: 'Farbe' },
                { id: 'condition', label: 'Zustand' },
                { id: 'material', label: 'Material' },
                { id: 'dataRate', label: 'Datenrate' },
                { id: 'chargingPower', label: 'Leistung' },
              ].filter(prop => propertyAssignments[prop.id]?.includes('charger') && !expandedChargerProps[prop.id]).map(prop => (
                <button key={prop.id} type="button" onClick={() => setExpandedChargerProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + {prop.label}
                </button>
              ))}
              {customProperties.filter(prop => propertyAssignments[prop.id]?.includes('charger') && !expandedChargerProps[prop.id]).map(prop => (
                <button key={prop.id} type="button" onClick={() => setExpandedChargerProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + {prop.label}
                </button>
              ))}
              <button 
                type="button" 
                onClick={() => setShowChargerLoc(!showChargerLoc)} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {cabLocation ? `Lagerort: ${locations.find(l => l.id === cabLocation)?.name || 'Gewählt'}` : '+ Lagerort'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowChargerPhotos(!showChargerPhotos)} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {cabImages.length > 0 ? `Fotos (${cabImages.length})` : '+ Foto'}
              </button>
              {!showCabLinks && (
                <button 
                  type="button" 
                  onClick={() => setShowCabLinks(true)} 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  + Verknüpfung
                </button>
              )}
            </div>

            {/* Vorläufige Verknüpfungen beim Anlegen */}
            {showCabLinks && (
              <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Verknüpfte Komponenten:</span>
                  <button 
                    type="button"
                    onClick={() => setLinkingSource({ id: 'form_cable', type: 'charger', name: cabName || 'Neues Ladegerät' })}
                    className="btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Verknüpfen
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {cabFormLinks.map(linkedId => {
                    const dev = devices.find(d => d.id === linkedId);
                    const cab = cables.find(c => c.id === linkedId);
                    const name = dev ? `📱 ${dev.name} (Gerät)` : cab ? `${cab.isMultiOutput ? '🔌' : '🔌'} ${cab.name} (${cab.isMultiOutput ? 'Ladegerät' : 'Kabel'})` : linkedId;
                    return (
                      <div key={linkedId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                        <span>{name}</span>
                        <button type="button" onClick={() => setCabFormLinks(prev => prev.filter(id => id !== linkedId))} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}>&times;</button>
                      </div>
                    );
                  })}
                  {cabFormLinks.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keine Verknüpfungen vorhanden.</span>}
                </div>
              </div>
            )}

            {/* Hierarchische Lagerort-Auswahl */}
            {showChargerLoc && (
              <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                {renderLocationTreeSelector(cabLocParentId, setCabLocParentId, cabLocation, setCabLocation, 'Lagerort')}
              </div>
            )}

            {/* Foto beschreiben & hinzufügen */}
            {showChargerPhotos && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <input 
                        type="text" 
                        placeholder="Beschreibung (optional, z.B. Frontansicht)" 
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
              </div>
            )}

            <button type="submit" className="btn-primary" onClick={() => setCabIsMulti(true)}>Ladegerät anlegen</button>
          </form>

          {/* List Chargers */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Ladegeräte</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0)).map(c => (
                <div 
                  key={c.id} 
                  onClick={() => openCableDetails(c)}
                  style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {/* UPPER AREA: Image left, Name right */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: 'var(--radius-xs)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img 
                        src={c.images && c.images.length > 0 ? c.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: c.images && c.images.length > 0 ? 'cover' : 'contain',
                          opacity: c.images && c.images.length > 0 ? 1 : 0.4,
                          padding: c.images && c.images.length > 0 ? 0 : '8px'
                        }} 
                      />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{c.name}</strong>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>

                  {/* Chips für Eigenschaften */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                    {/* Ladegerät-Typ als Eigenschaft */}
                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                      🔌 {c.chargerType === 'only_fixed_cable' ? 'Kabel-Netzteil' : c.chargerType === 'hybrid' ? 'Hybrid-Lader' : 'Port-Lader'}
                    </span>
                    {/* Hersteller als Eigenschaft */}
                    {c.brand && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                        🏷️ {c.brand}
                      </span>
                    )}
                    {c.length && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>📏 {c.length}</span>}
                    {c.color && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>🎨 {c.color}</span>}
                    {c.condition && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>✨ {c.condition}</span>}
                    {c.material && <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>🧵 {c.material}</span>}
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

                  {/* Ports / Festes Kabel Detail-Info */}
                  <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.4rem' }}>
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
            {/* Anschlüsse */}
            <div style={{ display: 'grid', gridTemplateColumns: showDevPort2 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Anschluss (Port 1)</label>
                <select value={devConnector} onChange={e => setDevConnector(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="USB-C">USB-C</option>
                  <option value="USB-A">USB-A</option>
                  <option value="Micro-USB">Micro-USB</option>
                  <option value="Lightning">Lightning</option>
                  <option value="DC">DC</option>
                  <option value="DC-Jack">DC-Jack</option>
                  <option value="Other">Andere</option>
                </select>
              </div>
              {showDevPort2 && (
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Anschluss (Port 2, optional)</label>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <select value={devConnector2} onChange={e => setDevConnector2(e.target.value)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                      <option value="">-- Keiner --</option>
                      <option value="USB-C">USB-C</option>
                      <option value="USB-A">USB-A</option>
                      <option value="Micro-USB">Micro-USB</option>
                      <option value="Lightning">Lightning</option>
                      <option value="DC">DC</option>
                      <option value="DC-Jack">DC-Jack</option>
                      <option value="Other">Andere</option>
                    </select>
                    <button type="button" onClick={() => { setShowDevPort2(false); setDevConnector2(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamische Eigenschaften basierend auf Zuordnung */}
            {(() => {
              const assignedPropsList = [
                { id: 'brand', label: 'Hersteller', list: brands, setList: setBrands, key: 'list_brands', val: devBrand, setVal: setDevBrand },
                { id: 'length', label: 'Kabellänge', list: lengths, setList: setLengths, key: 'list_lengths', val: '', setVal: () => {} },
                { id: 'color', label: 'Farbe', list: colors, setList: setColors, key: 'list_colors', val: devCustomPropValues['color'] || '', setVal: (v: string) => setDevCustomPropValues(prev => ({ ...prev, color: v })) },
                { id: 'condition', label: 'Zustand', list: conditions, setList: setConditions, key: 'list_conditions', val: devCustomPropValues['condition'] || '', setVal: (v: string) => setDevCustomPropValues(prev => ({ ...prev, condition: v })) },
                { id: 'material', label: 'Material', list: materials, setList: setMaterials, key: 'list_materials', val: devCustomPropValues['material'] || '', setVal: (v: string) => setDevCustomPropValues(prev => ({ ...prev, material: v })) },
                { id: 'dataRate', label: 'Datenrate', list: dataRates, setList: setDataRates, key: 'list_data_rates', val: devCustomPropValues['dataRate'] || '', setVal: (v: string) => setDevCustomPropValues(prev => ({ ...prev, dataRate: v })) },
                { id: 'chargingPower', label: 'Leistung', list: chargingPowers, setList: setChargingPowers, key: 'list_charging_powers', val: devCustomPropValues['chargingPower'] || '', setVal: (v: string) => setDevCustomPropValues(prev => ({ ...prev, chargingPower: v })) },
              ];

              const activeStandardProps = assignedPropsList.filter(p => propertyAssignments[p.id]?.includes('device') && p.id !== 'brand');
              const activeCustomProps = customProperties.filter(p => propertyAssignments[p.id]?.includes('device'));

              const hasAnyActiveProps = (propertyAssignments['brand']?.includes('device') && expandedDevProps.brand) || activeStandardProps.some(p => expandedDevProps[p.id]) || activeCustomProps.some(p => expandedDevProps[p.id]);
              if (!hasAnyActiveProps) return null;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  {/* Brand / Hersteller */}
                  {propertyAssignments['brand']?.includes('device') && expandedDevProps.brand && (
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hersteller</label>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <select value={devBrand} onChange={e => handleSelectChange('Hersteller', e.target.value, brands, setBrands, 'list_brands', setDevBrand)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                          <option value="">-- Keine Angabe --</option>
                          {brands.map(b => <option key={b} value={b}>{b}</option>)}
                          <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                        </select>
                        <button type="button" onClick={() => { setExpandedDevProps(p => ({ ...p, brand: false })); setDevBrand(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                      </div>
                    </div>
                  )}

                  {/* Standard active props (color, material etc.) */}
                  {activeStandardProps.map(prop => {
                    if (!expandedDevProps[prop.id]) return null;
                    return (
                      <div key={prop.id}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <select value={prop.val} onChange={e => handleSelectChange(prop.label, e.target.value, prop.list, prop.setList, prop.key, prop.setVal)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                            <option value="">-- Keine Angabe --</option>
                            {prop.list.map(x => <option key={x} value={x}>{x}</option>)}
                            <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                          </select>
                          <button type="button" onClick={() => { setExpandedDevProps(p => ({ ...p, [prop.id]: false })); prop.setVal(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom active props */}
                  {activeCustomProps.map(prop => {
                    if (!expandedDevProps[prop.id]) return null;
                    return (
                      <div key={prop.id}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <select
                            value={devCustomPropValues[prop.id] || ''}
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
                              (val) => setDevCustomPropValues(prev => ({ ...prev, [prop.id]: val }))
                            )}
                            style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                          >
                            <option value="">-- Keine Angabe --</option>
                            {prop.values.map(v => <option key={v} value={v}>{v}</option>)}
                            <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                          </select>
                          <button type="button" onClick={() => { setExpandedDevProps(p => ({ ...p, [prop.id]: false })); setDevCustomPropValues(prev => { const c = { ...prev }; delete c[prop.id]; return c; }); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Buttons für einklappbare Optionen */}
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', flexWrap: 'wrap' }}>
              {!showDevPort2 && (
                <button type="button" onClick={() => setShowDevPort2(true)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Port
                </button>
              )}
              {propertyAssignments.brand?.includes('device') && !expandedDevProps.brand && (
                <button type="button" onClick={() => setExpandedDevProps(p => ({ ...p, brand: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + Hersteller
                </button>
              )}
              {[
                { id: 'length', label: 'Kabellänge' },
                { id: 'color', label: 'Farbe' },
                { id: 'condition', label: 'Zustand' },
                { id: 'material', label: 'Material' },
                { id: 'dataRate', label: 'Datenrate' },
                { id: 'chargingPower', label: 'Leistung' },
              ].filter(prop => propertyAssignments[prop.id]?.includes('device') && !expandedDevProps[prop.id]).map(prop => (
                <button key={prop.id} type="button" onClick={() => setExpandedDevProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + {prop.label}
                </button>
              ))}
              {customProperties.filter(prop => propertyAssignments[prop.id]?.includes('device') && !expandedDevProps[prop.id]).map(prop => (
                <button key={prop.id} type="button" onClick={() => setExpandedDevProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  + {prop.label}
                </button>
              ))}
              <button 
                type="button" 
                onClick={() => setShowDevLoc(!showDevLoc)} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {devLocation ? `Lagerort: ${locations.find(l => l.id === devLocation)?.name || 'Gewählt'}` : '+ Lagerort'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowDevPhotos(!showDevPhotos)} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {devImages.length > 0 ? `Fotos (${devImages.length})` : '+ Foto'}
              </button>
              {!showDevLinks && (
                <button 
                  type="button" 
                  onClick={() => setShowDevLinks(true)} 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  + Verknüpfung
                </button>
              )}
            </div>

            {/* Vorläufige Verknüpfungen beim Anlegen */}
            {showDevLinks && (
              <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Verknüpfte Komponenten:</span>
                  <button 
                    type="button"
                    onClick={() => setLinkingSource({ id: 'form_device', type: 'device', name: devName || 'Neues Gerät' })}
                    className="btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Verknüpfen
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {devFormLinks.map(linkedId => {
                    const cab = cables.find(c => c.id === linkedId);
                    const name = cab ? `${cab.isMultiOutput ? '🔌' : '🔌'} ${cab.name} (${cab.isMultiOutput ? 'Ladegerät' : 'Kabel'})` : linkedId;
                    return (
                      <div key={linkedId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                        <span>{name}</span>
                        <button type="button" onClick={() => setDevFormLinks(prev => prev.filter(id => id !== linkedId))} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}>&times;</button>
                      </div>
                    );
                  })}
                  {devFormLinks.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keine Verknüpfungen vorhanden.</span>}
                </div>
              </div>
            )}

            {/* Hierarchische Lagerort-Auswahl für Geräte */}
            {showDevLoc && (
              <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                {renderLocationTreeSelector(devLocParentId, setDevLocParentId, devLocation, setDevLocation, 'Lagerort')}
              </div>
            )}

            {/* Foto beschreiben & hinzufügen für Geräte */}
            {showDevPhotos && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <input 
                        type="text" 
                        placeholder="Beschreibung (optional, z.B. Frontansicht)" 
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
              </div>
            )}

            <button type="submit" className="btn-primary">Hinzufügen</button>
          </form>

          {/* List Devices */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Geräte</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {devices.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Keine Geräte registriert.</span>
              ) : (
                devices.map(d => (
                  <div 
                    key={d.id} 
                    onClick={() => openDeviceDetails(d)}
                    style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.005)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {/* UPPER AREA: Image left, Name right */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: 'var(--radius-xs)', 
                        overflow: 'hidden', 
                        border: '1px solid var(--border-glass)', 
                        background: 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <img 
                          src={d.images && d.images.length > 0 ? d.images[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                          alt="" 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: d.images && d.images.length > 0 ? 'cover' : 'contain',
                            opacity: d.images && d.images.length > 0 ? 1 : 0.4,
                            padding: d.images && d.images.length > 0 ? 0 : '8px'
                          }} 
                        />
                      </div>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{d.name}</strong>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Ort: {d.locationId ? buildLocationPath(d.locationId, locations) : 'Kein Ort'}
                    </div>

                    {/* Chips für Eigenschaften */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                      {/* Anschluss/Port als Eigenschaft */}
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                        🔌 {d.requiredConnectorType}{d.requiredConnectorType2 ? `, ${d.requiredConnectorType2}` : ''}
                      </span>
                      {/* Hersteller als Eigenschaft */}
                      {d.manufacturer && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                          🏷️ {d.manufacturer}
                        </span>
                      )}
                      
                      {/* Custom Properties */}
                      {d.additionalProperties && Object.entries(d.additionalProperties).map(([propId, val]) => {
                        const propDef = customProperties.find(p => p.id === propId);
                        const label = propDef ? propDef.label : propId;
                        return val ? (
                          <span key={propId} style={{ fontSize: '0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                            🏷️ {label}: {val}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))
              )}
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
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3>Eigenschaften verwalten</h3>

                {/* Komponentenauswahl ganz oben */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Eigenschaften verwalten für:</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['cable', 'charger', 'device'] as const).map(compType => (
                      <button
                        key={compType}
                        type="button"
                        onClick={() => {
                          setPropsActiveComponent(compType);
                          setSelectedPropToAssign('');
                        }}
                        style={{
                          flex: 1,
                          fontSize: '0.8rem',
                          padding: '0.5rem',
                          background: propsActiveComponent === compType ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
                          border: propsActiveComponent === compType ? 'none' : '1px solid var(--border-glass)',
                          color: propsActiveComponent === compType ? 'white' : 'var(--text-primary)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <img 
                          src={compType === 'cable' ? '/icons/cables.png' : compType === 'charger' ? '/icons/chargers.png' : '/icons/devices.png'} 
                          alt="" 
                          style={{ width: '18px', height: '18px', objectFit: 'contain', filter: propsActiveComponent === compType ? 'brightness(0) invert(1)' : 'var(--icon-filter)' }} 
                        />
                        {compType === 'cable' ? 'Kabel' : compType === 'charger' ? 'Ladegeräte' : 'Geräte'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vorhandene Eigenschaft zuordnen */}
                {(() => {
                  const standardPropsList = [
                    { id: 'brand', label: propsActiveComponent === 'device' ? 'Hersteller' : 'Marke' },
                    { id: 'length', label: 'Kabellänge' },
                    { id: 'color', label: 'Farbe' },
                    { id: 'condition', label: 'Zustand' },
                    { id: 'material', label: 'Material' },
                    { id: 'dataRate', label: 'Datenrate' },
                    { id: 'chargingPower', label: 'Ladeleistung' },
                    { id: 'connectors', label: 'Stecker-Typen' }
                  ];

                  const unassignedProps = [
                    ...standardPropsList,
                    ...customProperties.map(p => ({ id: p.id, label: p.label + ' (Benutzerdefiniert)' }))
                  ].filter(p => !propertyAssignments[p.id]?.includes(propsActiveComponent));

                  if (unassignedProps.length === 0) return null;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vorhandene Eigenschaft dieser Komponente zuordnen</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select
                          value={selectedPropToAssign}
                          onChange={e => setSelectedPropToAssign(e.target.value)}
                          style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        >
                          <option value="">-- Eigenschaft wählen --</option>
                          {unassignedProps.map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedPropToAssign) return;
                            const current = propertyAssignments[selectedPropToAssign] || [];
                            if (!current.includes(propsActiveComponent)) {
                              handleUpdatePropertyAssignment(selectedPropToAssign, [...current, propsActiveComponent]);
                            }
                            setSelectedPropToAssign('');
                          }}
                          className="btn-primary"
                          style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                          disabled={!selectedPropToAssign}
                        >
                          Zuordnen
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Formular für neue benutzerdefinierte Eigenschaftskategorie */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Neue benutzerdefinierte Eigenschaftskategorie für diese Komponente anlegen</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="z.B. Garantiezeit, Seriennummer"
                      value={newCustomPropLabel}
                      onChange={e => setNewCustomPropLabel(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                    />
                    <button onClick={handleCreateCustomProperty} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                      Erstellen
                    </button>
                  </div>
                </div>

                {/* Liste aller Kategorien zum Hinzufügen/Löschen von Werten */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Kabel-Standards (nur für Komponenten, die sie unterstützen, z.B. cable und charger) */}
                  {(propsActiveComponent === 'cable' || propsActiveComponent === 'charger') && (
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
                  )}

                  {/* Standard Eigenschaften, falls dieser Komponente zugeordnet */}
                  {[
                    { id: 'brand', label: propsActiveComponent === 'device' ? 'Hersteller' : 'Marke', list: brands, setList: setBrands, key: 'list_brands' },
                    { id: 'length', label: 'Kabellänge', list: lengths, setList: setLengths, key: 'list_lengths' },
                    { id: 'color', label: 'Farbe', list: colors, setList: setColors, key: 'list_colors' },
                    { id: 'condition', label: 'Zustand', list: conditions, setList: setConditions, key: 'list_conditions' },
                    { id: 'material', label: 'Material', list: materials, setList: setMaterials, key: 'list_materials' },
                    { id: 'dataRate', label: 'Datenrate', list: dataRates, setList: setDataRates, key: 'list_data_rates' },
                    { id: 'chargingPower', label: 'Ladeleistung', list: chargingPowers, setList: setChargingPowers, key: 'list_charging_powers' },
                    { id: 'connectors', label: 'Stecker-Typen', list: connectors, setList: setConnectors, key: 'list_connectors' }
                  ].filter(prop => propertyAssignments[prop.id]?.includes(propsActiveComponent)).map(prop => (
                    <div key={prop.id} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{prop.label}</strong>
                        <button
                          type="button"
                          onClick={() => {
                            const current = propertyAssignments[prop.id] || [];
                            handleUpdatePropertyAssignment(prop.id, current.filter(c => c !== propsActiveComponent));
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Zuordnung aufheben
                        </button>
                      </div>
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
                          id={`input-val-${prop.id}`}
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
                            const inputEl = document.getElementById(`input-val-${prop.id}`) as HTMLInputElement;
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

                  {/* Custom Eigenschaften, falls dieser Komponente zugeordnet */}
                  {customProperties.filter(prop => propertyAssignments[prop.id]?.includes(propsActiveComponent)).map(prop => (
                    <div key={prop.id} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)' }}>🏷️ {prop.label} (Eigene Kategorie)</strong>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const current = propertyAssignments[prop.id] || [];
                              handleUpdatePropertyAssignment(prop.id, current.filter(c => c !== propsActiveComponent));
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Zuordnung aufheben
                          </button>
                          <button onClick={() => handleDeleteCustomProperty(prop.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.75rem', cursor: 'pointer' }}>Kategorie löschen</button>
                        </div>
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'var(--bg-primary)', zIndex: 1000, overflowY: 'auto' }}>
          {!editIsEditing ? (
            // READ-ONLY VIEW
            <>
              {/* Sub-page Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button type="button" onClick={() => setSelectedCableDetails(null)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <ArrowLeft size={24} />
                </button>
                <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>{selectedCableDetails.isMultiOutput ? 'Ladegerät Details' : 'Kabel Details'}</h2>
              </div>

              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-primary)' }}>
                {/* UPPER AREA: Image left, Name right */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div 
                    onClick={() => { if (editImages.length > 0) { setGalleryImages(editImages); setGalleryIndex(0); } }}
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      borderRadius: 'var(--radius-md)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: editImages.length > 0 ? 'pointer' : 'default',
                      position: 'relative',
                      flexShrink: 0
                    }}
                  >
                    <img 
                      src={editImages.length > 0 ? editImages[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                      alt="Vorschau" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: editImages.length > 0 ? 'cover' : 'contain', 
                        opacity: editImages.length > 0 ? 1 : 0.5,
                        padding: editImages.length > 0 ? 0 : '16px'
                      }} 
                    />
                    {editImages.length > 1 && (
                      <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px' }}>
                        +{editImages.length - 1}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, wordBreak: 'break-word' }}>{selectedCableDetails.name}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      📍 Lagerort: {selectedCableDetails.locationId ? buildLocationPath(selectedCableDetails.locationId, locations) : 'Kein Lagerort'}
                    </div>
                  </div>
                </div>

                {/* Multiple Images List */}
                {editImages.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.25rem 0' }}>
                    {editImages.map((img, idx) => (
                      <div 
                        key={img.id} 
                        onClick={() => { setGalleryImages(editImages); setGalleryIndex(idx); }}
                        style={{ width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border-glass)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                      >
                        <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Properties list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  {!selectedCableDetails.isMultiOutput ? (
                    // Cable details
                    <>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Stecker-Typ 1:</span> <strong>{selectedCableDetails.connectorType1 || selectedCableDetails.connectorType || 'USB-C'}</strong></div>
                      {selectedCableDetails.cableStandard1 && <div><span style={{ color: 'var(--text-secondary)' }}>Standard 1:</span> <strong>{selectedCableDetails.cableStandard1}</strong></div>}
                      <div><span style={{ color: 'var(--text-secondary)' }}>Stecker-Typ 2:</span> <strong>{selectedCableDetails.connectorType2 || 'USB-C'}</strong></div>
                      {selectedCableDetails.cableStandard2 && <div><span style={{ color: 'var(--text-secondary)' }}>Standard 2:</span> <strong>{selectedCableDetails.cableStandard2}</strong></div>}
                      {selectedCableDetails.length && <div><span style={{ color: 'var(--text-secondary)' }}>Länge:</span> <strong>{selectedCableDetails.length}</strong></div>}
                    </>
                  ) : (
                    // Charger details
                    <>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Ladegerät-Typ:</span> <strong>{selectedCableDetails.chargerType === 'only_ports' ? 'Nur Ports' : selectedCableDetails.chargerType === 'only_fixed_cable' ? 'Festes Kabel' : 'Hybrid'}</strong></div>
                      {(selectedCableDetails.chargerType === 'only_fixed_cable' || selectedCableDetails.chargerType === 'hybrid') && (
                        <>
                          <div><span style={{ color: 'var(--text-secondary)' }}>Festes Kabel Stecker:</span> <strong>{selectedCableDetails.fixedCableConnector}</strong></div>
                          {selectedCableDetails.fixedCableLength && <div><span style={{ color: 'var(--text-secondary)' }}>Festes Kabel Länge:</span> <strong>{selectedCableDetails.fixedCableLength}</strong></div>}
                          {selectedCableDetails.fixedCablePower && <div><span style={{ color: 'var(--text-secondary)' }}>Festes Kabel Leistung:</span> <strong>{selectedCableDetails.fixedCablePower}</strong></div>}
                        </>
                      )}
                      {(selectedCableDetails.chargerType === 'only_ports' || selectedCableDetails.chargerType === 'hybrid') && selectedCableDetails.powerOutputs && selectedCableDetails.powerOutputs.length > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>Ausgänge (Ports):</span>
                          <div style={{ paddingLeft: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {selectedCableDetails.powerOutputs.map((p, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem' }}>
                                Port {idx + 1}: <strong>{p.portType} ({p.wattage}W)</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Standard details */}
                  {selectedCableDetails.brand && <div><span style={{ color: 'var(--text-secondary)' }}>Marke:</span> <strong>{selectedCableDetails.brand}</strong></div>}
                  {selectedCableDetails.color && <div><span style={{ color: 'var(--text-secondary)' }}>Farbe:</span> <strong>{selectedCableDetails.color}</strong></div>}
                  {selectedCableDetails.condition && <div><span style={{ color: 'var(--text-secondary)' }}>Zustand:</span> <strong>{selectedCableDetails.condition}</strong></div>}
                  {selectedCableDetails.material && <div><span style={{ color: 'var(--text-secondary)' }}>Material:</span> <strong>{selectedCableDetails.material}</strong></div>}
                  {selectedCableDetails.dataRate && <div><span style={{ color: 'var(--text-secondary)' }}>Datenrate:</span> <strong>{selectedCableDetails.dataRate}</strong></div>}
                  {selectedCableDetails.chargingPower && <div><span style={{ color: 'var(--text-secondary)' }}>Ladeleistung:</span> <strong>{selectedCableDetails.chargingPower}</strong></div>}
                  
                  {/* Custom properties */}
                  {selectedCableDetails.additionalProperties && Object.entries(selectedCableDetails.additionalProperties).map(([k, v]) => {
                    const propDef = customProperties.find(p => p.id === k);
                    const label = propDef ? propDef.label : k;
                    return v ? (
                      <div key={k}><span style={{ color: 'var(--text-secondary)' }}>{label}:</span> <strong>{v}</strong></div>
                    ) : null;
                  })}
                </div>

                {/* Verknüpfte Komponenten list */}
                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Verknüpfte Komponenten:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(selectedCableDetails.assignedDeviceIds || []).map(devId => {
                      const dev = devices.find(d => d.id === devId);
                      if (!dev) return null;
                      return (
                        <div key={devId} style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                          <span>📱 {dev.name} (Gerät)</span>
                        </div>
                      );
                    })}
                    {(selectedCableDetails.assignedCableIds || []).map(cabId => {
                      const cab = cables.find(c => c.id === cabId);
                      if (!cab) return null;
                      const isCharger = cab.isMultiOutput || (cab.powerOutputs && cab.powerOutputs.length > 0);
                      return (
                        <div key={cabId} style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                          <span>{isCharger ? '🔌' : '🔌'} {cab.name} ({isCharger ? 'Ladegerät' : 'Kabel'})</span>
                        </div>
                      );
                    })}
                    {(!selectedCableDetails.assignedDeviceIds || selectedCableDetails.assignedDeviceIds.length === 0) &&
                     (!selectedCableDetails.assignedCableIds || selectedCableDetails.assignedCableIds.length === 0) && (
                       <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keine Verknüpfungen vorhanden.</span>
                     )}
                  </div>
                </div>

                {/* READ-ONLY CTA BUTTONS: 2-column grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <button type="button" onClick={() => setEditIsEditing(true)} className="btn-primary" style={{ padding: '0.6rem' }}>Bearbeiten</button>
                  <button 
                    type="button" 
                    onClick={() => {
                      handleDeleteCable(selectedCableDetails.id);
                      setSelectedCableDetails(null);
                    }} 
                    className="btn-primary" 
                    style={{ background: 'var(--error)', padding: '0.6rem' }}
                  >
                    Löschen
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      handleDuplicateCable(selectedCableDetails);
                      setSelectedCableDetails(null);
                    }} 
                    className="btn-primary" 
                    style={{ background: 'var(--success)', padding: '0.6rem' }}
                  >
                    Duplizieren
                  </button>
                  <button type="button" onClick={() => setSelectedCableDetails(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Abbrechen</button>
                </div>
              </div>
            </>
          ) : (
            // EDIT VIEW
            <>
              {/* Sub-page Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button type="button" onClick={() => setEditIsEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <ArrowLeft size={24} />
                </button>
                <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>{editIsMulti ? 'Ladegerät bearbeiten' : 'Kabel bearbeiten'}</h2>
              </div>

              <form onSubmit={handleSaveCableEdit} style={{ background: 'var(--bg-primary)', border: 'none', borderRadius: 0, padding: '1rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-primary)' }}>
                
                {/* UPPER AREA: Image left, Name input right */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div 
                    onClick={() => { if (editImages.length > 0) { setGalleryImages(editImages); setGalleryIndex(0); } }}
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      borderRadius: 'var(--radius-md)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: editImages.length > 0 ? 'pointer' : 'default',
                      position: 'relative',
                      flexShrink: 0
                    }}
                  >
                    <img 
                      src={editImages.length > 0 ? editImages[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                      alt="Vorschau" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: editImages.length > 0 ? 'cover' : 'contain', 
                        opacity: editImages.length > 0 ? 1 : 0.5,
                        padding: editImages.length > 0 ? 0 : '16px'
                      }} 
                    />
                    {editImages.length > 1 && (
                      <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px' }}>
                        +{editImages.length - 1}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Name</label>
                    <input type="text" placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }} required />
                  </div>
                </div>

                {/* MIDDLE AREA: Location and Photos collapsible */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setEditShowLoc(!editShowLoc)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      📍 {editLocation ? `Lagerort: ${locations.find(l => l.id === editLocation)?.name || 'Gewählt'}` : '+ Lagerort'}
                    </button>
                    {editShowLoc && (
                      <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                        {renderLocationTreeSelector(editLocParentId, setEditLocParentId, editLocation, setEditLocation, 'Lagerort')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setEditShowPhotos(!editShowPhotos)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      📷 {editImages.length > 0 ? `Fotos (${editImages.length})` : '+ Foto'}
                    </button>
                    {editShowPhotos && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                              <input 
                                type="text" 
                                placeholder="Beschreibung (optional)" 
                                value={tempEditImageLabel || ''} 
                                onChange={e => setTempEditImageLabel(e.target.value)} 
                                style={{ padding: '0.4rem', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }} 
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="file" accept="image/*" capture={isMobile ? "environment" : undefined} onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageAttachmentUploadEdit('cable', file, tempEditImageLabel || '');
                                }} style={{ display: 'none' }} id="edit-cab-cam-upload" />
                                <label htmlFor="edit-cab-cam-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center' }}>
                                  📷 Kamera
                                </label>

                                <input type="file" accept="image/*" onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageAttachmentUploadEdit('cable', file, tempEditImageLabel || '');
                                }} style={{ display: 'none' }} id="edit-cab-gal-upload" />
                                <label htmlFor="edit-cab-gal-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                                  🖼️ Galerie
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Previews in Edit Modal */}
                        {editImages.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                            {editImages.map((img, idx) => (
                              <div key={img.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
                                <img src={img.url} alt={img.label} onClick={() => { setGalleryImages(editImages); setGalleryIndex(idx); }} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                                <span style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.55rem', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '1px' }}>
                                  {img.label}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => setEditImages(prev => prev.filter(i => i.id !== img.id))} 
                                  style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(255,0,0,0.8)', border: 'none', color: 'white', fontSize: '0.7rem', width: '16px', height: '16px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {isCompressing && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kompression läuft...</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* LOWER AREA: All properties */}
                {editIsMulti ? (
                  // Charger Fields
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Typ des Ladegeräts</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <button 
                          type="button" 
                          onClick={() => setEditChargerType('only_ports')}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem', background: editChargerType === 'only_ports' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                        >
                          <USBAIcon size={18} />
                          <span>Nur Ports</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setEditChargerType('only_fixed_cable')}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem', background: editChargerType === 'only_fixed_cable' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                        >
                          <CableIcon size={18} />
                          <span>Festes Kabel</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setEditChargerType('hybrid')}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem', background: editChargerType === 'hybrid' ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <USBAIcon size={16} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', lineHeight: 1 }}>+</span>
                            <CableIcon size={16} />
                          </div>
                          <span>Hybrid</span>
                        </button>
                        <div />
                      </div>
                    </div>

                    {(editChargerType === 'only_fixed_cable' || editChargerType === 'hybrid') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Festes Kabel</span>
                        <div style={{ display: 'grid', gridTemplateColumns: windowWidth < 450 ? '1fr' : '1.2fr 1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stecker-Typ</label>
                            <select value={editFixedConnector} onChange={e => setEditFixedConnector(e.target.value)} style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '32px' }}>
                              <option value="USB-C">USB-C</option>
                              <option value="Micro-USB">Micro-USB</option>
                              <option value="Lightning">Lightning</option>
                              <option value="DC-Jack">DC-Jack</option>
                              <option value="Other">Andere</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Länge</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input type="text" placeholder="z.B. 1.5" value={editFixedLength} onChange={e => setEditFixedLength(e.target.value)} style={{ width: '100%', padding: '0.4rem 1.2rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '32px' }} />
                              <span style={{ position: 'absolute', right: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>m</span>
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Leistung</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input type="text" placeholder="z.B. 65" value={editFixedPower} onChange={e => setEditFixedPower(e.target.value)} style={{ width: '100%', padding: '0.4rem 1.2rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '32px' }} />
                              <span style={{ position: 'absolute', right: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>W</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {(editChargerType === 'only_ports' || editChargerType === 'hybrid') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ports</span>
                        {editPorts.map((p, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '0.4rem', alignItems: 'center' }}>
                            <select value={p.portType} onChange={e => {
                              const updated = [...editPorts];
                              updated[idx].portType = e.target.value;
                              setEditPorts(updated);
                            }} style={{ padding: '0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                              <option value="">-- Port-Typ --</option>
                              <option value="USB-C">USB-C</option>
                              <option value="USB-A">USB-A</option>
                              <option value="DC-Jack">DC-Jack</option>
                            </select>
                            
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Watt" value={p.wattage || ''} onChange={e => {
                                const w = Number(e.target.value);
                                const updated = [...editPorts];
                                updated[idx].wattage = w;
                                setEditPorts(updated);
                              }} style={{ width: '100%', padding: '0.4rem 1.1rem 0.4rem 0.4rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }} />
                              <span style={{ position: 'absolute', right: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>W</span>
                            </div>

                            {editPorts.length > 1 && (
                              <button type="button" onClick={() => setEditPorts(editPorts.filter((_, i) => i !== idx))} style={{ background: 'none', color: 'var(--error)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }}>&times;</button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setEditPorts([...editPorts, { voltage: 5, amperage: 0, wattage: 0, portType: '' }])} style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', textAlign: 'left', marginTop: '0.25rem', border: 'none', padding: 0, cursor: 'pointer' }}>+ Weiteren Port hinzufügen</button>
                      </div>
                    )}
                  </>
                ) : (
                  // Cable Fields
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stecker-Typ 1</label>
                        <select value={editConnectorType1} onChange={e => handleSelectChange('Stecker-Typ 1', e.target.value, connectors, setConnectors, 'list_connectors', setEditConnectorType1)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                          {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Standard (Stecker 1)</label>
                        <select value={editCableStandard1} onChange={e => handleCableStandardSelect(1, e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                          <option value="">-- Keine Angabe --</option>
                          {(cableStandardGroups[getConnectorFamily(editConnectorType1)] || []).map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                          <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stecker-Typ 2</label>
                        <select value={editConnectorType2} onChange={e => handleSelectChange('Stecker-Typ 2', e.target.value, connectors, setConnectors, 'list_connectors', setEditConnectorType2)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                          {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Standard (Stecker 2)</label>
                        <select value={editCableStandard2} onChange={e => handleCableStandardSelect(2, e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                          <option value="">-- Keine Angabe --</option>
                          {(cableStandardGroups[getConnectorFamily(editConnectorType2)] || []).map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                          <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kabellänge</label>
                        <select value={editLength} onChange={e => handleSelectChange('Kabellänge', e.target.value, lengths, setLengths, 'list_lengths', setEditLength)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                          <option value="">-- Keine Angabe --</option>
                          {lengths.map(l => <option key={l} value={l}>{l}</option>)}
                          <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                        </select>
                      </div>
                      <div />
                    </div>
                  </>
                )}

                {/* Collapsed/Active properties (Creation Form style) */}
                {(() => {
                  const compType = editIsMulti ? 'charger' : 'cable';
                  const hasAnyActiveProps = (
                    (propertyAssignments.brand?.includes(compType) && editExpandedProps.brand) ||
                    (propertyAssignments.color?.includes(compType) && editExpandedProps.color) ||
                    (propertyAssignments.condition?.includes(compType) && editExpandedProps.condition) ||
                    (propertyAssignments.material?.includes(compType) && editExpandedProps.material) ||
                    (propertyAssignments.dataRate?.includes(compType) && editExpandedProps.dataRate) ||
                    (propertyAssignments.chargingPower?.includes(compType) && editExpandedProps.chargingPower) ||
                    customProperties.some(p => propertyAssignments[p.id]?.includes(compType) && editExpandedProps[p.id])
                  );

                  if (!hasAnyActiveProps) return null;

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                      {propertyAssignments.brand?.includes(compType) && editExpandedProps.brand && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Marke</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select value={editBrand} onChange={e => handleSelectChange('Marke', e.target.value, brands, setBrands, 'list_brands', setEditBrand)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              <option value="">-- Keine Angabe --</option>
                              {brands.map(b => <option key={b} value={b}>{b}</option>)}
                              <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                            </select>
                            <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, brand: false })); setEditBrand(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                          </div>
                        </div>
                      )}
                      {propertyAssignments.color?.includes(compType) && editExpandedProps.color && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Farbe</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select value={editColor} onChange={e => handleSelectChange('Farbe', e.target.value, colors, setColors, 'list_colors', setEditColor)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              <option value="">-- Keine Angabe --</option>
                              {colors.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                            </select>
                            <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, color: false })); setEditColor(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                          </div>
                        </div>
                      )}
                      {propertyAssignments.condition?.includes(compType) && editExpandedProps.condition && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Zustand</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select value={editCondition} onChange={e => handleSelectChange('Zustand', e.target.value, conditions, setConditions, 'list_conditions', setEditCondition)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              <option value="">-- Keine Angabe --</option>
                              {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                            </select>
                            <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, condition: false })); setEditCondition(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                          </div>
                        </div>
                      )}
                      {propertyAssignments.material?.includes(compType) && editExpandedProps.material && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Material</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select value={editMaterial} onChange={e => handleSelectChange('Material', e.target.value, materials, setMaterials, 'list_materials', setEditMaterial)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              <option value="">-- Keine Angabe --</option>
                              {materials.map(m => <option key={m} value={m}>{m}</option>)}
                              <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                            </select>
                            <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, material: false })); setEditMaterial(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                          </div>
                        </div>
                      )}
                      {propertyAssignments.dataRate?.includes(compType) && editExpandedProps.dataRate && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Datenrate</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select value={editDataRate} onChange={e => handleSelectChange('Datenrate', e.target.value, dataRates, setDataRates, 'list_data_rates', setEditDataRate)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              <option value="">-- Keine Angabe --</option>
                              {dataRates.map(r => <option key={r} value={r}>{r}</option>)}
                              <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                            </select>
                            <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, dataRate: false })); setEditDataRate(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                          </div>
                        </div>
                      )}
                      {propertyAssignments.chargingPower?.includes(compType) && editExpandedProps.chargingPower && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ladeleistung</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select value={editChargingPower} onChange={e => handleSelectChange('Ladeleistung', e.target.value, chargingPowers, setChargingPowers, 'list_charging_powers', setEditChargingPower)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              <option value="">-- Keine Angabe --</option>
                              {chargingPowers.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                            </select>
                            <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, chargingPower: false })); setEditChargingPower(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                          </div>
                        </div>
                      )}
                      {customProperties.filter(prop => propertyAssignments[prop.id]?.includes(compType)).map(prop => {
                        if (!editExpandedProps[prop.id]) return null;
                        return (
                          <div key={prop.id}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <select
                                value={editCustomPropValues[prop.id] || ''}
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
                                  (val) => setEditCustomPropValues(prev => ({ ...prev, [prop.id]: val }))
                                )}
                                style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                              >
                                <option value="">-- Keine Angabe --</option>
                                {prop.values.map(v => <option key={v} value={v}>{v}</option>)}
                                <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                              </select>
                              <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, [prop.id]: false })); setEditCustomPropValues(prev => { const c = { ...prev }; delete c[prop.id]; return c; }); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

            {/* Collapsible Trigger Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', flexWrap: 'wrap' }}>
              {(() => {
                const compType = editIsMulti ? 'charger' : 'cable';
                return (
                  <>
                    {propertyAssignments.brand?.includes(compType) && !editExpandedProps.brand && (
                      <button type="button" onClick={() => setEditExpandedProps(p => ({ ...p, brand: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        + Marke
                      </button>
                    )}
                    {propertyAssignments.color?.includes(compType) && !editExpandedProps.color && (
                      <button type="button" onClick={() => setEditExpandedProps(p => ({ ...p, color: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        + Farbe
                      </button>
                    )}
                    {propertyAssignments.condition?.includes(compType) && !editExpandedProps.condition && (
                      <button type="button" onClick={() => setEditExpandedProps(p => ({ ...p, condition: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        + Zustand
                      </button>
                    )}
                    {propertyAssignments.material?.includes(compType) && !editExpandedProps.material && (
                      <button type="button" onClick={() => setEditExpandedProps(p => ({ ...p, material: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        + Material
                      </button>
                    )}
                    {propertyAssignments.dataRate?.includes(compType) && !editExpandedProps.dataRate && (
                      <button type="button" onClick={() => setEditExpandedProps(p => ({ ...p, dataRate: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        + Datenrate
                      </button>
                    )}
                    {propertyAssignments.chargingPower?.includes(compType) && !editExpandedProps.chargingPower && (
                      <button type="button" onClick={() => setEditExpandedProps(p => ({ ...p, chargingPower: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        + Ladeleistung
                      </button>
                    )}
                    {customProperties.filter(prop => propertyAssignments[prop.id]?.includes(compType) && !editExpandedProps[prop.id]).map(prop => (
                      <button key={prop.id} type="button" onClick={() => setEditExpandedProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        + {prop.label}
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>

            {/* Verknüpfte Komponenten verwalten */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Verknüpfte Komponenten:</strong>
                <button 
                  type="button"
                  onClick={() => setLinkingSource({ id: selectedCableDetails.id, type: selectedCableDetails.isMultiOutput ? 'charger' : 'cable', name: selectedCableDetails.name })}
                  className="btn-primary" 
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  Verknüpfen
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {/* Linked Devices */}
                {(selectedCableDetails.assignedDeviceIds || []).map(devId => {
                  const dev = devices.find(d => d.id === devId);
                  if (!dev) return null;
                  return (
                    <div key={devId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                      <span>📱 {dev.name} (Gerät)</span>
                      <button 
                        type="button"
                        onClick={() => handleUnlinkComponents(selectedCableDetails.isMultiOutput ? 'charger' : 'cable', selectedCableDetails.id, 'device', devId)}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
                {/* Linked Cables/Chargers */}
                {(selectedCableDetails.assignedCableIds || []).map(cabId => {
                  const cab = cables.find(c => c.id === cabId);
                  if (!cab) return null;
                  const isCharger = cab.isMultiOutput || (cab.powerOutputs && cab.powerOutputs.length > 0);
                  return (
                    <div key={cabId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                      <span>{isCharger ? '🔌' : '🔌'} {cab.name} ({isCharger ? 'Ladegerät' : 'Kabel'})</span>
                      <button 
                        type="button"
                        onClick={() => handleUnlinkComponents(selectedCableDetails.isMultiOutput ? 'charger' : 'cable', selectedCableDetails.id, isCharger ? 'charger' : 'cable', cabId)}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
                {(!selectedCableDetails.assignedDeviceIds || selectedCableDetails.assignedDeviceIds.length === 0) &&
                 (!selectedCableDetails.assignedCableIds || selectedCableDetails.assignedCableIds.length === 0) && (
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keine Verknüpfungen vorhanden.</span>
                 )}
              </div>
            </div>

            {/* CTA Buttons in Edit view: Speichern and Abbrechen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ padding: '0.6rem' }}>Speichern</button>
              <button type="button" onClick={() => setEditIsEditing(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Abbrechen</button>
            </div>
          </form>
        </>
      )}
    </div>
  )}

      {/* DEVICE DETAILS MODAL */}
      {selectedDeviceDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'var(--bg-primary)', zIndex: 1000, overflowY: 'auto' }}>
          {!editDevIsEditing ? (
            // READ-ONLY VIEW
            <>
              {/* Sub-page Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button type="button" onClick={() => setSelectedDeviceDetails(null)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <ArrowLeft size={24} />
                </button>
                <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Gerät Details</h2>
              </div>

              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-primary)' }}>
                {/* UPPER AREA: Image left, Name right */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div 
                    onClick={() => { if (editDevImages.length > 0) { setGalleryImages(editDevImages); setGalleryIndex(0); } }}
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      borderRadius: 'var(--radius-md)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: editDevImages.length > 0 ? 'pointer' : 'default',
                      position: 'relative',
                      flexShrink: 0
                    }}
                  >
                    <img 
                      src={editDevImages.length > 0 ? editDevImages[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                      alt="Vorschau" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: editDevImages.length > 0 ? 'cover' : 'contain', 
                        opacity: editDevImages.length > 0 ? 1 : 0.5,
                        padding: editDevImages.length > 0 ? 0 : '16px'
                      }} 
                    />
                    {editDevImages.length > 1 && (
                      <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px' }}>
                        +{editDevImages.length - 1}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, wordBreak: 'break-word' }}>{selectedDeviceDetails.name}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      📍 Lagerort: {selectedDeviceDetails.locationId ? buildLocationPath(selectedDeviceDetails.locationId, locations) : 'Kein Lagerort'}
                    </div>
                  </div>
                </div>

                {/* Multiple Images List */}
                {editDevImages.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.25rem 0' }}>
                    {editDevImages.map((img, idx) => (
                      <div 
                        key={img.id} 
                        onClick={() => { setGalleryImages(editDevImages); setGalleryIndex(idx); }}
                        style={{ width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border-glass)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                      >
                        <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Properties list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Port:</span> <strong>{selectedDeviceDetails.requiredConnectorType}</strong></div>
                  {selectedDeviceDetails.requiredConnectorType2 && <div><span style={{ color: 'var(--text-secondary)' }}>Port 2:</span> <strong>{selectedDeviceDetails.requiredConnectorType2}</strong></div>}
                  {selectedDeviceDetails.manufacturer && <div><span style={{ color: 'var(--text-secondary)' }}>Hersteller:</span> <strong>{selectedDeviceDetails.manufacturer}</strong></div>}
                  
                  {/* Custom properties */}
                  {selectedDeviceDetails.additionalProperties && Object.entries(selectedDeviceDetails.additionalProperties).map(([k, v]) => {
                    const propDef = customProperties.find(p => p.id === k);
                    const label = propDef ? propDef.label : k;
                    return v ? (
                      <div key={k}><span style={{ color: 'var(--text-secondary)' }}>{label}:</span> <strong>{v}</strong></div>
                    ) : null;
                  })}
                </div>

                {/* Verknüpfte Komponenten list */}
                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Verknüpfte Komponenten:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(selectedDeviceDetails.compatibleCableIds || []).map(cabId => {
                      const cab = cables.find(c => c.id === cabId);
                      if (!cab) return null;
                      const isCharger = cab.isMultiOutput || (cab.powerOutputs && cab.powerOutputs.length > 0);
                      return (
                        <div key={cabId} style={{ background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                          <span>{isCharger ? '🔌' : '🔌'} {cab.name} ({isCharger ? 'Ladegerät' : 'Kabel'})</span>
                        </div>
                      );
                    })}
                    {(!selectedDeviceDetails.compatibleCableIds || selectedDeviceDetails.compatibleCableIds.length === 0) && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keine Verknüpfungen vorhanden.</span>
                    )}
                  </div>
                </div>

                {/* READ-ONLY CTA BUTTONS: 2-column grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <button type="button" onClick={() => setEditDevIsEditing(true)} className="btn-primary" style={{ padding: '0.6rem' }}>Bearbeiten</button>
                  <button 
                    type="button" 
                    onClick={() => {
                      handleDeleteDevice(selectedDeviceDetails.id);
                      setSelectedDeviceDetails(null);
                    }} 
                    className="btn-primary" 
                    style={{ background: 'var(--error)', padding: '0.6rem' }}
                  >
                    Löschen
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      handleDuplicateDevice(selectedDeviceDetails);
                      setSelectedDeviceDetails(null);
                    }} 
                    className="btn-primary" 
                    style={{ background: 'var(--success)', padding: '0.6rem' }}
                  >
                    Duplizieren
                  </button>
                  <button type="button" onClick={() => setSelectedDeviceDetails(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Abbrechen</button>
                </div>
              </div>
            </>
          ) : (
            // EDIT VIEW
            <>
              {/* Sub-page Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button type="button" onClick={() => setEditDevIsEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <ArrowLeft size={24} />
                </button>
                <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Gerät bearbeiten</h2>
              </div>

              <form onSubmit={handleSaveDeviceEdit} style={{ background: 'var(--bg-primary)', border: 'none', borderRadius: 0, padding: '1rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-primary)' }}>
                
                {/* UPPER AREA: Image left, Name input right */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div 
                    onClick={() => { if (editDevImages.length > 0) { setGalleryImages(editDevImages); setGalleryIndex(0); } }}
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      borderRadius: 'var(--radius-md)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-glass)', 
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: editDevImages.length > 0 ? 'pointer' : 'default',
                      position: 'relative',
                      flexShrink: 0
                    }}
                  >
                    <img 
                      src={editDevImages.length > 0 ? editDevImages[0].url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><path d='M14.5 12.5 12 10 6 16'/><path d='m21 16-4-4-4 4'/><circle cx='8.5' cy='8.5' r='1.5'/><line x1='2' x2='22' y1='2' y2='22'/></svg>"} 
                      alt="Vorschau" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: editDevImages.length > 0 ? 'cover' : 'contain', 
                        opacity: editDevImages.length > 0 ? 1 : 0.5,
                        padding: editDevImages.length > 0 ? 0 : '16px'
                      }} 
                    />
                    {editDevImages.length > 1 && (
                      <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px' }}>
                        +{editDevImages.length - 1}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Name</label>
                    <input type="text" placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }} required />
                  </div>
                </div>

                {/* MIDDLE AREA: Location and Photos collapsible */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setEditShowLoc(!editShowLoc)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      📍 {editDevLocation ? `Lagerort: ${locations.find(l => l.id === editDevLocation)?.name || 'Gewählt'}` : '+ Lagerort'}
                    </button>
                    {editShowLoc && (
                      <div style={{ border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                        {renderLocationTreeSelector(editLocParentId, setEditLocParentId, editDevLocation, setEditDevLocation, 'Lagerort')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setEditShowPhotos(!editShowPhotos)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      📷 {editDevImages.length > 0 ? `Fotos (${editDevImages.length})` : '+ Foto'}
                    </button>
                    {editShowPhotos && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px dashed var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto beschreiben & hinzufügen</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                              <input 
                                type="text" 
                                placeholder="Beschreibung (optional)" 
                                value={tempEditDevImageLabel || ''} 
                                onChange={e => setTempEditDevImageLabel(e.target.value)} 
                                style={{ padding: '0.4rem', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }} 
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="file" accept="image/*" capture={isMobile ? "environment" : undefined} onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageAttachmentUploadEdit('device', file, tempEditDevImageLabel || '');
                                }} style={{ display: 'none' }} id="edit-dev-cam-upload" />
                                <label htmlFor="edit-dev-cam-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center' }}>
                                  📷 Kamera
                                </label>

                                <input type="file" accept="image/*" onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageAttachmentUploadEdit('device', file, tempEditDevImageLabel || '');
                                }} style={{ display: 'none' }} id="edit-dev-gal-upload" />
                                <label htmlFor="edit-dev-gal-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem', flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                                  🖼️ Galerie
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Previews */}
                        {editDevImages.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                            {editDevImages.map((img, idx) => (
                              <div key={img.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
                                <img src={img.url} alt={img.label} onClick={() => { setGalleryImages(editDevImages); setGalleryIndex(idx); }} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                                <span style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.55rem', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '1px' }}>
                                  {img.label}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => setEditDevImages(prev => prev.filter(i => i.id !== img.id))} 
                                  style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(255,0,0,0.8)', border: 'none', color: 'white', fontSize: '0.7rem', width: '16px', height: '16px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {isCompressing && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kompression läuft...</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* LOWER AREA: All properties */}
                <div style={{ display: 'grid', gridTemplateColumns: windowWidth < 450 ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Port</label>
                    <select value={editDevConnector} onChange={e => setEditDevConnector(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                      {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {editDevShowPort2 && (
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Port 2</label>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <select value={editDevConnector2} onChange={e => setEditDevConnector2(e.target.value)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                          <option value="">-- Keine Angabe --</option>
                          {connectors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={() => { setEditDevShowPort2(false); setEditDevConnector2(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamische Eigenschaften basierend auf Zuordnung für Geräte */}
                {(() => {
                  const assignedPropsList = [
                    { id: 'brand', label: 'Hersteller', list: brands, setList: setBrands, key: 'list_brands', val: editDevManufacturer, setVal: setEditDevManufacturer },
                    { id: 'length', label: 'Kabellänge', list: lengths, setList: setLengths, key: 'list_lengths', val: '', setVal: () => {} },
                    { id: 'color', label: 'Farbe', list: colors, setList: setColors, key: 'list_colors', val: editCustomPropValues['color'] || '', setVal: (v: string) => setEditCustomPropValues(prev => ({ ...prev, color: v })) },
                    { id: 'condition', label: 'Zustand', list: conditions, setList: setConditions, key: 'list_conditions', val: editCustomPropValues['condition'] || '', setVal: (v: string) => setEditCustomPropValues(prev => ({ ...prev, condition: v })) },
                    { id: 'material', label: 'Material', list: materials, setList: setMaterials, key: 'list_materials', val: editCustomPropValues['material'] || '', setVal: (v: string) => setEditCustomPropValues(prev => ({ ...prev, material: v })) },
                    { id: 'dataRate', label: 'Datenrate', list: dataRates, setList: setDataRates, key: 'list_data_rates', val: editCustomPropValues['dataRate'] || '', setVal: (v: string) => setEditCustomPropValues(prev => ({ ...prev, dataRate: v })) },
                    { id: 'chargingPower', label: 'Leistung', list: chargingPowers, setList: setChargingPowers, key: 'list_charging_powers', val: editCustomPropValues['chargingPower'] || '', setVal: (v: string) => setEditCustomPropValues(prev => ({ ...prev, chargingPower: v })) },
                  ];

                  const activeStandardProps = assignedPropsList.filter(p => propertyAssignments[p.id]?.includes('device') && p.id !== 'brand');
                  const activeCustomProps = customProperties.filter(p => propertyAssignments[p.id]?.includes('device'));

                  const hasAnyActiveProps = (propertyAssignments['brand']?.includes('device') && editExpandedProps.brand) || activeStandardProps.some(p => editExpandedProps[p.id]) || activeCustomProps.some(p => editExpandedProps[p.id]);
                  if (!hasAnyActiveProps) return null;

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                      {/* Brand / Hersteller */}
                      {propertyAssignments['brand']?.includes('device') && editExpandedProps.brand && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hersteller</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <select value={editDevManufacturer} onChange={e => handleSelectChange('Hersteller', e.target.value, brands, setBrands, 'list_brands', setEditDevManufacturer)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                              <option value="">-- Keine Angabe --</option>
                              {brands.map(b => <option key={b} value={b}>{b}</option>)}
                              <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                            </select>
                            <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, brand: false })); setEditDevManufacturer(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                          </div>
                        </div>
                      )}

                      {/* Standard active props (color, material etc.) */}
                      {activeStandardProps.map(prop => {
                        if (!editExpandedProps[prop.id]) return null;
                        return (
                          <div key={prop.id}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <select value={prop.val} onChange={e => handleSelectChange(prop.label, e.target.value, prop.list, prop.setList, prop.key, prop.setVal)} style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                <option value="">-- Keine Angabe --</option>
                                {prop.list.map(x => <option key={x} value={x}>{x}</option>)}
                                <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                              </select>
                              <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, [prop.id]: false })); prop.setVal(''); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Custom active props */}
                      {activeCustomProps.map(prop => {
                        if (!editExpandedProps[prop.id]) return null;
                        return (
                          <div key={prop.id}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.label}</label>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <select
                                value={editCustomPropValues[prop.id] || ''}
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
                                  (val) => setEditCustomPropValues(prev => ({ ...prev, [prop.id]: val }))
                                )}
                                style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                              >
                                <option value="">-- Keine Angabe --</option>
                                {prop.values.map(v => <option key={v} value={v}>{v}</option>)}
                                <option value="__ADD_NEW__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Neuen Wert hinzufügen...</option>
                              </select>
                              <button type="button" onClick={() => { setEditExpandedProps(p => ({ ...p, [prop.id]: false })); setEditCustomPropValues(prev => { const c = { ...prev }; delete c[prop.id]; return c; }); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Collapsible Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', flexWrap: 'wrap' }}>
                  {!editDevShowPort2 && (
                    <button type="button" onClick={() => setEditDevShowPort2(true)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      + Port
                    </button>
                  )}
                  {propertyAssignments.brand?.includes('device') && !editExpandedProps.brand && (
                    <button type="button" onClick={() => setEditExpandedProps(p => ({ ...p, brand: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      + Hersteller
                    </button>
                  )}
                  {[
                    { id: 'length', label: 'Kabellänge' },
                    { id: 'color', label: 'Farbe' },
                    { id: 'condition', label: 'Zustand' },
                    { id: 'material', label: 'Material' },
                    { id: 'dataRate', label: 'Datenrate' },
                    { id: 'chargingPower', label: 'Leistung' },
                  ].filter(prop => propertyAssignments[prop.id]?.includes('device') && !editExpandedProps[prop.id]).map(prop => (
                    <button key={prop.id} type="button" onClick={() => setEditExpandedProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      + {prop.label}
                    </button>
                  ))}
                  {customProperties.filter(prop => propertyAssignments[prop.id]?.includes('device') && !editExpandedProps[prop.id]).map(prop => (
                    <button key={prop.id} type="button" onClick={() => setEditExpandedProps(p => ({ ...p, [prop.id]: true }))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      + {prop.label}
                    </button>
                  ))}
                </div>

                {/* Verknüpfte Komponenten */}
                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Verknüpfte Komponenten:</strong>
                    <button 
                      type="button"
                      onClick={() => setLinkingSource({ id: selectedDeviceDetails.id, type: 'device', name: selectedDeviceDetails.name })}
                      className="btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                      Verknüpfen
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(selectedDeviceDetails.compatibleCableIds || []).map(cabId => {
                      const cab = cables.find(c => c.id === cabId);
                      if (!cab) return null;
                      const isCharger = cab.isMultiOutput || (cab.powerOutputs && cab.powerOutputs.length > 0);
                      return (
                        <div key={cabId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                          <span>{isCharger ? '🔌' : '🔌'} {cab.name} ({isCharger ? 'Ladegerät' : 'Kabel'})</span>
                          <button 
                            type="button"
                            onClick={() => handleUnlinkComponents('device', selectedDeviceDetails.id, isCharger ? 'charger' : 'cable', cabId)}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                    {(!selectedDeviceDetails.compatibleCableIds || selectedDeviceDetails.compatibleCableIds.length === 0) && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Keine Verknüpfungen vorhanden.</span>
                    )}
                  </div>
                </div>

                {/* EDITING CTA BUTTONS: 2-column grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <button type="submit" className="btn-primary" style={{ padding: '0.6rem' }}>Speichern</button>
                  <button type="button" onClick={() => setEditDevIsEditing(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Abbrechen</button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* GALLERY MODAL */}
      {galleryImages && galleryImages.length > 0 && (
        <div 
          onClick={() => { setGalleryImages(null); setGalleryZoomed(false); }}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(0,0,0,0.95)', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 2000, 
            backdropFilter: 'blur(15px)'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ 
              position: 'relative', 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem'
            }}
          >
            {/* Close Button Red X at the top-right corner */}
            <button 
              onClick={() => { setGalleryImages(null); setGalleryZoomed(false); }} 
              style={{ 
                position: 'absolute', 
                top: '20px', 
                right: '20px', 
                background: '#ef4444', 
                border: 'none', 
                color: 'white', 
                fontSize: '1.5rem', 
                cursor: 'pointer', 
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2100,
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                fontWeight: 'bold'
              }}
              title="Galerie schließen"
            >
              &times;
            </button>

            {/* Left navigation arrow for desktop */}
            {galleryIndex > 0 && (
              <button
                onClick={() => { setGalleryIndex(prev => prev - 1); setGalleryZoomed(false); }}
                style={{
                  position: 'absolute',
                  left: '20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2050,
                  fontSize: '1.5rem'
                }}
              >
                &#9001;
              </button>
            )}

            {/* Right navigation arrow for desktop */}
            {galleryIndex < galleryImages.length - 1 && (
              <button
                onClick={() => { setGalleryIndex(prev => prev + 1); setGalleryZoomed(false); }}
                style={{
                  position: 'absolute',
                  right: '20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2050,
                  fontSize: '1.5rem'
                }}
              >
                &#9002;
              </button>
            )}

            {/* Main Image Container */}
            <div 
              style={{ 
                maxWidth: '95%', 
                maxHeight: '75vh', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <img 
                src={galleryImages[galleryIndex].url} 
                alt={galleryImages[galleryIndex].label || `Bild ${galleryIndex + 1}`} 
                onClick={() => setGalleryZoomed(prev => !prev)}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '75vh', 
                  objectFit: 'contain', 
                  cursor: 'zoom-in',
                  transform: galleryZoomed ? 'scale(1.5)' : 'scale(1)',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
                }} 
              />
            </div>

            {/* Bottom Info bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginTop: '1.5rem', zIndex: 2050 }}>
              {galleryImages[galleryIndex].label && (
                <span style={{ color: 'white', fontSize: '0.95rem', fontWeight: 600, background: 'rgba(0,0,0,0.6)', padding: '0.3rem 0.85rem', borderRadius: '20px' }}>
                  {galleryImages[galleryIndex].label}
                </span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                Bild {galleryIndex + 1} von {galleryImages.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* LINKING MODAL */}
      {linkingSource && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)', padding: '1rem' }}>
          <div className="glass-panel" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Komponente verknüpfen</h3>
              <button onClick={() => { setLinkingSource(null); setLinkingTargetCategory(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Verknüpfung erstellen für: <strong>{linkingSource.name}</strong>
            </div>

            {linkingTargetCategory === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Kategorie wählen:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {linkingSource.type !== 'cable' && (
                    <button 
                      onClick={() => setLinkingTargetCategory('cable')}
                      className="btn-primary" 
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '0.75rem' }}
                    >
                      🔌 Kabel
                    </button>
                  )}
                  {linkingSource.type !== 'charger' && (
                    <button 
                      onClick={() => setLinkingTargetCategory('charger')}
                      className="btn-primary" 
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '0.75rem' }}
                    >
                      🔌 Ladegerät
                    </button>
                  )}
                  {linkingSource.type !== 'device' && (
                    <button 
                      onClick={() => setLinkingTargetCategory('device')}
                      className="btn-primary" 
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '0.75rem' }}
                    >
                      📱 Gerät
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Wähle {linkingTargetCategory === 'device' ? 'Gerät' : linkingTargetCategory === 'charger' ? 'Ladegerät' : 'Kabel'}:
                  </span>
                  <button onClick={() => setLinkingTargetCategory(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer' }}>Zurück</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {(() => {
                    let items: any[] = [];
                    if (linkingTargetCategory === 'device') {
                      const linkedIds = linkingSource.type === 'device' ? [] : (cables.find(c => c.id === linkingSource.id)?.assignedDeviceIds || []);
                      items = devices.filter(d => d.id !== linkingSource.id && !linkedIds.includes(d.id));
                    } else if (linkingTargetCategory === 'cable') {
                      const standardCables = cables.filter(c => !c.isMultiOutput && (!c.powerOutputs || c.powerOutputs.length === 0));
                      if (linkingSource.type === 'device') {
                        const linkedIds = devices.find(d => d.id === linkingSource.id)?.compatibleCableIds || [];
                        items = standardCables.filter(c => !linkedIds.includes(c.id));
                      } else {
                        const linkedIds = cables.find(c => c.id === linkingSource.id)?.assignedCableIds || [];
                        items = standardCables.filter(c => c.id !== linkingSource.id && !linkedIds.includes(c.id));
                      }
                    } else if (linkingTargetCategory === 'charger') {
                      const chargerCables = cables.filter(c => c.isMultiOutput || (c.powerOutputs && c.powerOutputs.length > 0));
                      if (linkingSource.type === 'device') {
                        const linkedIds = devices.find(d => d.id === linkingSource.id)?.compatibleCableIds || [];
                        items = chargerCables.filter(c => !linkedIds.includes(c.id));
                      } else {
                        const linkedIds = cables.find(c => c.id === linkingSource.id)?.assignedCableIds || [];
                        items = chargerCables.filter(c => c.id !== linkingSource.id && !linkedIds.includes(c.id));
                      }
                    }

                    if (items.length === 0) {
                      return <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>Keine verfügbaren Einträge vorhanden.</span>;
                    }

                    return items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          handleLinkComponents(linkingSource.type, linkingSource.id, linkingTargetCategory, item.id);
                          setLinkingSource(null);
                          setLinkingTargetCategory(null);
                        }}
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>{item.name}</span>
                        <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>Verknüpfen</span>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}

            <button 
              onClick={() => { setLinkingSource(null); setLinkingTargetCategory(null); }} 
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginTop: '0.5rem' }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
