import React, { useState, useEffect, useRef } from 'react';
import { Cable as CableIcon, Layers, QrCode, Search, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Plus, Trash2, Link, Link2Off, Info, Sun, Moon, Camera, Upload, Copy, RefreshCw, Printer } from 'lucide-react';
import Fuse from 'fuse.js';
import { Cable, Device, StorageLocation, buildLocationPath, checkPowerCompatibility, CompatibilityResult } from './contexts/inventory/domain/types';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'locations' | 'cables' | 'devices' | 'compatibility' | 'scan'>('overview');

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
  const [ports, setPorts] = useState<{ voltage: number; amperage: number; portType: string }[]>([
    { voltage: 5, amperage: 2, portType: 'USB-C' }
  ]);

  // Form States - Device
  const [devName, setDevName] = useState('');
  const [devBrand, setDevBrand] = useState('');
  const [devConnector, setDevConnector] = useState('USB-C');
  const [devVoltage, setDevVoltage] = useState(5);
  const [devAmperage, setDevAmperage] = useState(2);
  const [devLocation, setDevLocation] = useState('');

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

  // Register PWA Service Worker (Schritt 18)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    
    let anonId = localStorage.getItem('cable_guy_anon_user_id');
    if (!anonId) {
      anonId = crypto.randomUUID();
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
    } else {
      root.style.setProperty('--bg-primary', '#f9fafb');
      root.style.setProperty('--bg-secondary', '#ffffff');
      root.style.setProperty('--bg-tertiary', '#f3f4f6');
      root.style.setProperty('--bg-glass', 'rgba(255, 255, 255, 0.8)');
      root.style.setProperty('--border-glass', 'rgba(0, 0, 0, 0.06)');
      root.style.setProperty('--text-primary', '#111827');
      root.style.setProperty('--text-secondary', '#4b5563');
    }
  }, [darkMode]);

  const refreshData = async () => {
    const c = await cableRepo.getAllCables();
    const d = await deviceRepo.getAllDevices();
    const l = await locationRepo.getAllLocations();
    setCables(c);
    setDevices(d);
    setLocations(l);
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

  // Actions - Cable
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      setCabImage(compressed);
    } catch (err) {
      alert("Fehler bei der Bildkomprimierung.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCreateCable = async (e: React.FormEvent) => {
    e.preventDefault();
    const powerOutputs = cabIsMulti 
      ? ports.map(p => ({ ...p, wattage: p.voltage * p.amperage, portType: p.portType as any }))
      : [{ voltage: 5, amperage: 1, wattage: 5, portType: cabConnector as any }];

    const newCable: Cable = {
      id: crypto.randomUUID(),
      name: cabName,
      connectorType: cabConnector,
      locationId: cabLocation || undefined,
      isMultiOutput: cabIsMulti,
      powerOutputs,
      imageUrl: cabImage || undefined,
      userId: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await cableRepo.saveCable(newCable);
    setCabName('');
    setCabLocation('');
    setCabIsMulti(false);
    setCabImage(null);
    refreshData();
  };

  // Duplizier-Funktion (Schritt 20)
  const handleDuplicateCable = async (cable: Cable) => {
    const duplicatedCable: Cable = {
      ...cable,
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
      name: devName,
      manufacturer: devBrand || undefined,
      requiredVoltage: devVoltage,
      requiredAmperage: devAmperage,
      requiredConnectorType: devConnector,
      locationId: devLocation || undefined,
      userId: currentUserId,
      createdAt: new Date().toISOString()
    };

    await deviceRepo.saveDevice(newDevice);
    setDevName('');
    setDevBrand('');
    refreshData();
  };

  const handleDeleteDevice = async (id: string) => {
    if (confirm("Gerät wirklich löschen? Zugehörige Kabel bleiben als 'verwaist' erhalten.")) {
      await deleteDeviceUseCase.execute(id);
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
      `}</style>

      {/* Header & Theme Switch */}
      <header style={{ position: 'relative', textAlign: 'center', marginTop: '0.5rem' }}>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          style={{ position: 'absolute', right: 0, top: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '0.5rem', borderRadius: '50%', color: 'var(--text-primary)' }}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'var(--accent-gradient)', color: 'white', marginBottom: '0.5rem', boxShadow: '0 8px 24px var(--accent-glow)' }}>
          <CableIcon size={32} />
        </div>
        <h1>Cable Guy</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Der Hüter über dein Kabelchaos
        </p>
      </header>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        <button className={activeTab === 'overview' ? 'btn-primary' : ''} onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('overview'); }} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: activeTab === 'overview' ? '' : 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Übersicht</button>
        <button className={activeTab === 'scan' ? 'btn-primary' : ''} onClick={() => { setActiveTab('scan'); startCamera(); }} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: activeTab === 'scan' ? '' : 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Scan / QR</button>
        <button className={activeTab === 'locations' ? 'btn-primary' : ''} onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('locations'); }} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: activeTab === 'locations' ? '' : 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Lagerorte</button>
        <button className={activeTab === 'cables' ? 'btn-primary' : ''} onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('cables'); }} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: activeTab === 'cables' ? '' : 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Kabel / Lader</button>
        <button className={activeTab === 'devices' ? 'btn-primary' : ''} onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('devices'); }} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: activeTab === 'devices' ? '' : 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Geräte</button>
        <button className={activeTab === 'compatibility' ? 'btn-primary' : ''} onClick={() => { stopCamera(); setReassigningCableId(null); setActiveTab('compatibility'); }} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: activeTab === 'compatibility' ? '' : 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Kompatibilität</button>
      </nav>

      {/* Fuzzy Search */}
      <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Search size={20} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Fuzzy-Suche (z.B. 'hmdi', 'kamra')..."
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

      {/* Search Results */}
      {searchQuery && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Suchergebnisse</h3>
          {searchResults.cables.length === 0 && searchResults.devices.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>Keine passenden Kabel/Geräte gefunden.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {searchResults.cables.map(c => (
              <div key={c.id} style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>🔌 {c.name} ({c.connectorType})</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kabel</span>
              </div>
            ))}
            {searchResults.devices.map(d => (
              <div key={d.id} style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📱 {d.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gerät</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && !searchQuery && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="glass-panel" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Dein Kabel-Inventar</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{cables.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kabel/Lader</div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>{devices.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Geräte</div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{locations.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Lagerorte</div>
              </div>
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn-primary" onClick={() => { setActiveTab('scan'); startCamera(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem' }}>
              <QrCode size={20} />
              Sticker scannen (Kamera)
            </button>
            <button onClick={handleExportData} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', width: '100%', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
              <Upload size={18} />
              DSGVO-Datenexport (.json)
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
            <h3>Neuen Lagerort anlegen</h3>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {locations.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{l.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{buildLocationPath(l.id, locations)}</div>
                  </div>
                  <button onClick={() => handleDeleteLocation(l.id)} style={{ background: 'none', color: 'var(--error)' }}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: CABLES (Klonen & Ummampen) */}
      {activeTab === 'cables' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <form onSubmit={handleCreateCable} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Neues Kabel / Lader registrieren</h3>
            <input type="text" placeholder="Name" value={cabName} onChange={e => setCabName(e.target.value)} style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} required />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Steckertyp</label>
                <select value={cabConnector} onChange={e => setCabConnector(e.target.value as any)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="USB-C">USB-C</option>
                  <option value="Micro-USB">Micro-USB</option>
                  <option value="Lightning">Lightning</option>
                  <option value="HDMI">HDMI</option>
                  <option value="DC-Jack">DC-Jack</option>
                  <option value="Other">Andere</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Lagerort</label>
                <select value={cabLocation} onChange={e => setCabLocation(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <option value="">-- Kein Ort --</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{buildLocationPath(l.id, locations)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bild Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Foto</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} id="file-upload" />
                <label htmlFor="file-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <Upload size={16} /> Foto wählen
                </label>
                {isCompressing && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kompression...</span>}
              </div>
              {cabImage && <img src={cabImage} alt="Vorschau" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="multi" checked={cabIsMulti} onChange={e => setCabIsMulti(e.target.checked)} />
              <label htmlFor="multi">Mehrere Ausgänge</label>
            </div>

            <button type="submit" className="btn-primary">Registrieren</button>
          </form>

          {/* List Cables */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3>Registrierte Kabel</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {cables.map(c => (
                <div key={c.id} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{c.name}</strong>
                    <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>{c.connectorType}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Ort: {c.locationId ? buildLocationPath(c.locationId, locations) : 'Kein Ort'}
                  </div>

                  {/* Actions: Klonen (Schritt 20) & Ummampen (Schritt 19) */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setReassigningCableId(c.id); setActiveTab('scan'); startCamera(); }} style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <RefreshCw size={12} /> Sticker ersetzen
                    </button>
                    <button onClick={() => handleDuplicateCable(c)} style={{ background: 'none', color: 'var(--success)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
            <h3>Neues Gerät anlegen</h3>
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

      {/* TAB: COMPATIBILITY */}
      {activeTab === 'compatibility' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Smarter Lade-Check</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Gerät</label>
                <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                  <option value="">-- Gerät wählen --</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.requiredVoltage}V @ {d.requiredAmperage}A)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kabel / Lader</label>
                <select value={selectedCableId} onChange={e => setSelectedCableId(e.target.value)} style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                  <option value="">-- Kabel wählen --</option>
                  {cables.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleCheckCompatibility} className="btn-primary" style={{ marginTop: '0.5rem' }}>Prüfen</button>
          </div>

          {compatResult && (
            <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '6px solid', borderLeftColor: compatResult.status === 'COMPATIBLE' ? 'var(--success)' : 'var(--error)' }}>
              <h4>{compatResult.status === 'COMPATIBLE' ? 'Kompatibel ✔' : 'Inkompatibel ❌'}</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {'message' in compatResult ? compatResult.message : 'Dieses Ladegerät kann das Gerät laden.'}
              </p>
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

      {/* Footer */}
      <footer style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
          <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
          <span>Lokaler Gast-Modus aktiv</span>
        </div>
        <div>Cable Guy MVP v0.1.0</div>
      </footer>
    </div>
  );
}
