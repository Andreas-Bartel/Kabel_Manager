# Cable Guy - Deine digitale Kabelbox

**Cable Guy** ist eine All-in-One-Lösung zur Verwaltung des privaten Kabel- und Netzteilchaos. Diese App hilft dabei, Kabel und Netzteile digital zu erfassen, ihren physischen Aufbewahrungsort zu tracken, passende Kabel zu Geräten zu finden und QR-Code-Labels für schnelles Scannen zu drucken.

---

## 🏗️ Architektur & Design

Das Projekt folgt den Prinzipien des **Domain-Driven Design (DDD)** und ist in einer klaren Schichtenarchitektur aufgebaut. Dies sorgt für eine hohe Wartbarkeit und macht es extrem einfach, später beispielsweise die Datenhaltung von lokalem Speicher (`localStorage`) auf ein Cloud-Backend (z. B. Supabase) umzustellen.

### Bounded Contexts

1.  **`Inventory` (Inventar):**
    *   Verwaltet Kabel, Netzteile, Original-Geräte und Lagerorte.
    *   Prüft elektrische Kompatibilität (Volt, Ampere, Watt) zur Vermeidung von Hardware-Schäden.
2.  **`Auth` (Authentifizierung):**
    *   Ermöglicht einen sofortigen Start ohne Registrierung (anonymer Gast-Modus im LocalStorage) mit einem Migrationspfad zu Google/Apple-Auth.
3.  **`Labels` (Sticker & QR):**
    *   Generiert und verarbeitet QR-Sticker für das physische Aufkleben auf Kabel.
    *   Ordnet QR-Codes den digitalen Steckbriefen zu.

### Schichtenarchitektur (pro Kontext)

Jeder Bounded Context ist intern wie folgt gegliedert:
*   **`domain`:** Enthält Entities, Value Objects und Interfaces (z. B. Repository-Definitionen). Diese Schicht ist rein und frei von Framework-Abhängigkeiten.
*   **`application`:** Enthält Use Cases (Geschäftsprozesse wie z. B. "Kabel registrieren", "Kompatibilität prüfen").
*   **`infrastructure`:** Konkrete Implementierungen für Repositories (z. B. `LocalStorageCableRepository`) und externe Schnittstellen.
*   **`presentation`:** React-Komponenten, UI-Hooks und UI-spezifische Logik.

---

## 📂 Verzeichnisstruktur

```text
cable-guy/
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── index.css (Globales CSS-Design-System)
│   ├── shared/ (Gemeinsam genutzte UI-Komponenten und Utility-Funktionen)
│   └── contexts/ (Die drei Bounded Contexts)
│       ├── inventory/
│       ├── auth/
│       └── labels/
```

---

## 🛠️ Entwicklung starten

### Voraussetzungen

Stelle sicher, dass [Node.js](https://nodejs.org/) installiert ist.

### Installation

Installiere die Abhängigkeiten im Projektverzeichnis:
```bash
npm install
```

### Lokalen Server starten

Starte den Vite-Entwicklungsserver:
```bash
npm run dev
```

Die Anwendung öffnet sich automatisch unter [http://localhost:3000](http://localhost:3000).
