# PRD & Chronologischer Umsetzungsplan: Cable Guy

Dieser Plan beschreibt die schrittweise Entwicklung des MVP. Alle 20 Architekturtickets aus dem Qualitäts-Audit sind chronologisch in sinnvolle Meilensteine eingeteilt.

## Phase 1: Architektur, Datenmodell & Kosten-Setup (Fundament)
*Fokus: Die Datenbank steht, das Hosting kostet nichts und das Beziehungsmodell ist sauber definiert.*

* **Schritt 1:** **[Ticket 1] Definition der Entitäten-Beziehungen (Kabel vs. Gerät)**
    * *Aufgabe:* Datenmodell so aufbauen, dass Kabel unabhängig existieren können (z. B. in einer Kiste) oder als Universal-Ladekabel mehreren Geräten zugewiesen werden können.
* **Schritt 2:** **[Ticket 3] Strukturierung des „Lagerort“-Modells**
    * *Aufgabe:* Festlegung, ob Freitext ausreicht oder eine hierarchische Struktur (Raum -> Möbel -> Box) verwendet wird, um fehlerhafte Filterungen im Keim zu ersticken.
* **Schritt 3:** **[Ticket 4] Abbildung von Netzteilen (Multi-Output)**
    * *Aufgabe:* Datenstrukturen für Netzteile mit mehreren USB-Buchsen und unterschiedlichen Watt-Leistungen definieren.
* **Schritt 4:** **[Ticket 13] Zero-Hosting-Kosten-Architektur (Backend-Wahl)**
    * *Aufgabe:* Setup der Serverless-Architektur (z. B. Supabase Free Tier oder Firebase) und Überwachung der Free-Tier-Limits.
* **Schritt 5:** **[Ticket 15] API-Rate-Limiting gegen Brute-Force-Scans**
    * *Aufgabe:* Verwendung von nicht-erratbaren UUIDs (statt fortlaufender IDs) für Kabel-Ressourcen (`cable/UUID`), um Datenscraping zu verhindern.

## Phase 2: Core-Backend & Logik (Das Gehirn)
*Fokus: Daten können verarbeitet, exportiert und sicher abgerufen werden.*

* **Schritt 6:** **[Ticket 5] Daten-Schema für den QR-Code-Payload**
    * *Aufgabe:* Datenstruktur für den QR-Code festlegen. Entscheidung für eine kompakte, datensparende ID, die intern aufgelöst wird.
* **Schritt 7:** **[Ticket 11] Authentifizierung und Anonymous-Anmeldung**
    * *Aufgabe:* Implementierung eines Gast-Modus (LocalStorage/Anonymous Login), um die Hürde für Neunutzer minimal zu halten, inklusive Migrationspfad auf Apple/Google Auth.
* **Schritt 12:** **[Ticket 12] Zugriffsschutz für den anonymen QR-Scan**
    * *Aufgabe:* Absicherung der Endpunkte. Wer ein physisches Kabel scannt, sieht die Details nur, wenn er der rechtmäßige Besitzer ist (oder Freigabe-Logik greift).
* **Schritt 9:** **[Ticket 14] Daten-Export und DSGVO-Konformität**
    * *Aufgabe:* Bereitstellung eines simplen CSV/Excel-Exports für alle Nutzerdaten.
* **Schritt 10:** **[Ticket 18] Behandlung von gelöschten Original-Geräten**
    * *Aufgabe:* Logik implementieren: Wenn ein Gerät gelöscht wird, werden zugehörige Kabel automatisch als „verwaist“ markiert, statt unbemerkt mitgelöscht zu werden.

## Phase 3: Frontend, Kamera & UX (Die App zum Anfassen)
*Fokus: Die App wird mobil bedienbar, hübsch und fehlerverzeihend.*

* **Schritt 11:** **[Ticket 6] Kamera-Integration und Fallback-Workflow**
    * *Aufgabe:* Integration der HTML5-Kameraschnittstelle für den In-App-Scan sowie Bereitstellung des Galerie-Uploads als Fallback.
* **Schritt 12:** **[Ticket 2] Speicherstrategie und Komprimierung für Bilddaten**
    * *Aufgabe:* Clientseitige Bildkomprimierung (z. B. via JavaScript Canvas API) vor dem Upload in den Storage einbauen, um Speicherplatz zu sparen.
* **Schritt 13:** **[Ticket 7] Such-Algorithmus und Toleranz bei Tippfehlern**
    * *Aufgabe:* Integration einer Fuzzy-Search (z. B. Fuse.js) im Frontend, damit auch fehlerhafte Eingaben („Kamra“) korrekte Ergebnisse liefern.
* **Schritt 14:** **[Ticket 20] Fehlerhafte Volt-/Ampere-Eingabe durch Laien**
    * *Aufgabe:* UI-Schutzmaßnahmen bauen. Verwendung von plausiblen Dropdowns und Tooltips für elektrische Werte anstelle von freien, gefährlichen Texteingaben.
* **Schritt 15:** **[Ticket 8] Barrierefreiheit und Kontraste bei der Stecker-Auswahl**
    * *Aufgabe:* Kontrastreiches Interface-Design und Implementierung eines Dark-Modes für schlechte Lichtverhältnisse (Keller/unter Schreibtischen).

## Phase 4: Physische Welt & Offline-Betrieb (Der Härtetest)
*Fokus: QR-Codes drucken, Kabel markieren und App im Keller nutzen.*

* **Schritt 16:** **[Ticket 9] Onboarding-Prozess für die QR-Sticker**
    * *Aufgabe:* PDF-Generierung für Standard-A4-Etikettenbögen implementieren und den Prozess visuell in der App erklären.
* **Schritt 17:** **[Ticket 10] Performance-Optimierung beim Massen-Scan**
    * *Aufgabe:* Einen „Dauer-Scan-Modus“ für die Kamera bauen, damit der Nutzer zügig eine ganze Kiste an Kabeln nacheinander scannen kann.
* **Schritt 18:** **[Ticket 17] Offline-Fähigkeit in Empfangslöchern (Keller-Szenario)**
    * *Aufgabe:* Implementierung von Service Workern und IndexedDB, damit die App auch ohne mobiles Internet im tiefen Keller bereits gespicherte Kabel-Zuordnungen anzeigen kann.
* **Schritt 19:** **[Ticket 16] Der „Sticker verloren“-Workflow**
    * *Aufgabe:* Eine UI-Funktion bereitstellen, mit der ein bestehender digitaler Steckbrief einfach auf einen neu ausgedruckten QR-Code umgemappt werden kann.
* **Schritt 20:** **[Ticket 19] Doubletten-Erkennung beim Foto-Upload**
    * *Aufgabe:* Eine „Duplizieren“-Funktion für identische Massenkabel (z. B. 5x dasselbe schwarze HDMI-Kabel) integrieren, um redundante Foto-Uploads zu verhindern.