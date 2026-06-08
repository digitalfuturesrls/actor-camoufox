# Analysis Report: HTTP Headers per Profilo Italiano

## 1. Stato Attuale del Codice

### 1.1 Header HTTP Esistenti
**Nessun header HTTP esplicito trovato** nel progetto.

La ricerca per extraHTTPHeaders, additionalHttpHeaders, setExtraHTTPHeaders e Accept-Language ha prodotto zero risultati in src/.

### 1.2 Locale Configurato (Camoufox)
In src/main.ts riga 154, solo locale: "it-IT" e impostato nelle camoufoxLaunchOptions. Questo influenza il fingerprint del browser (navigator.language), ma non imposta header HTTP a livello di richiesta.

### 1.3 Struttura preNavigationHooks
L'array preNavigationHooks (src/main.ts righe 81-113) contiene 2 hook:

Hook #1 (righe 82-92): Block tracker domains con page.route()
Hook #2 (righe 94-111): Random delay + cookie consent simulation

---

## 2. Posizione di Inserimento

**File**: src/main.ts
**Riga target**: Dopo riga 92 (chiusura dell'hook di block tracker), prima dell'hook di delay.

Il nuovo hook andra inserito tra:
- Linea 92: chiusura hook block tracker
- Linea 94: inizio hook delay

---

## 3. Header da Impostare

### 3.1 Accept-Language

it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7

Ragione: Priorita a italiano, fallback a inglese americano poi inglese generico
Formato: Standard HTTP Content-Language negotiation

### 3.2 Accept

text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/ *;q=0.8

Ragione: Priorita a HTML/XHTML, accept comune per browser reali
Formato: MIME type con quality values

### 3.3 Note su Referer
Rimandato a fase successiva perche:
- Richiede logica dinamica basata su request precedente
- Potrebbe interferire con fingerprint se implementato staticamente
- L'aggiunta di Accept-Language e Accept e sufficiente per questa fase

---

## 4. Compatibilita con Camoufox

### 4.1 Verifica
- Camoufox non espone extraHTTPHeaders in launchOptions (verificato tramite grep negativo in node_modules)
- page.setExtraHTTPHeaders() opera a livello Playwright, dopo la configurazione del browser
- Non ci sono conflitti: Camoufox non sovrascrive header impostati da Playwright

### 4.2 Funzionamento
page.setExtraHTTPHeaders() imposta header prima di ogni navigazione grazie al preNavigationHook. Questi header vengono inviati con ogni richiesta HTTP dal page context.

---

## 5. Codice da Implementare

// Set realistic HTTP headers for Italian profile
async ({ page }) => {
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
},

Posizione in src/main.ts: Linea 93 (nuova), come terzo elemento in preNavigationHooks.

---

## 6. File da Modificare

src/main.ts: Aggiunta hook dopo riga 92, prima riga 94

Nessuna modifica a:
- src/routes.ts (non imposta header)
- test/main.test.ts (test esistente non coinvolto)
- Dockerfile o config (non necessario per questa feature)

---

## 7. Conflitti e Rischi

### 7.1 Potenziali Conflitti
- Nessuno identificato: Camoufox non sovrascrive header Playwright
- L'ordine degli hook garantisce che block tracker funzioni anche con nuovi header

### 7.2 Edge Cases
- Se Camoufox modifica Accept-Language automaticamente dopo il nostro hook (improbabile), potremmo dover usare page.on('request') per override forzato
- Proxy italiano configurato (riga 63-67) complementa gli header per un profilo completamente italiano

---

## 8. Validazione

### 8.1 Criteri di Accettazione
1. Codice compila senza errori TypeScript
2. PreNavigationHooks array contiene 3 elementi dopo la modifica
3. page.setExtraHTTPHeaders chiamato con oggetto contenente Accept-Language e Accept
4. Test esistente (npm test) continua a passare

### 8.2 Verifica Visiva (post-implementazione)
Controllare che l'hook appaia in src/main.ts tra block tracker e delay hooks.

---

## 9. Dipendenze

Runtime: Node >=20, ESM modules
Librerie: @crawlee/playwright (PlaywrightCrawler, page.setExtraHTTPHeaders)
Nessuna nuova dipendenza richiesta

---

Report generato: 2026-06-08
Step: 1 di 3 (Analisi)