# Documentazione Webapp OrangePV

## Struttura del Progetto

### 1. Configurazione delle Rotte (`src/App.tsx`)

Le rotte dell'applicazione sono definite nel file `src/App.tsx` utilizzando React Router. La struttura delle rotte segue il pattern:

```typescript
// Rotte principali per le entità
<Route path="/users" element={<Users />} />
<Route path="/users/detail/:id" element={<UserDetail />} />
```

Ogni entità ha due rotte principali:

- **Lista**: `/entità` (es. `/users`)
- **Dettaglio**: `/entità/detail/:id` (es. `/users/detail/123`)

### 2. Sidebar (`src/Components/Sidebar.tsx`)

La navigazione principale è gestita dal componente `Sidebar` che contiene le voci di menu per tutte le entità:

```typescript
// Voci principali della sidebar
<NavItem to="/" icon="fa-gauge" text="Dashboard" />
<NavItem to="/users" icon="fa-user" text="Utenti" />
```

### 3. Organizzazione delle Entità

Ogni entità è organizzata in una cartella dedicata sotto `src/Pages/` con la seguente struttura:

```
src/Pages/Entità/
├── Entità.tsx              # Pagina lista (es. Clients.tsx)
├── EntitàDetail.tsx        # Pagina dettaglio (es. ClientDetail.tsx)
├── entitàSchema.ts         # Schema Zod per validazione (es. clientSchema.ts)
└── tabs/                   # Cartella per le tab (se presente, ripreso nel punto 4)
    ├── _general.tsx        # Tab generale
    ├── _metrics.tsx        # Tab letture
    └── _other.tsx          # Altre tab specifiche
```

#### 3.1 Pagina Lista (`Entità.tsx`)

La pagina lista contiene:

- **Array `columns`**: Definisce le colonne della tabella
- **Array `actions`**: Definisce le azioni disponibili (modifica, elimina)
- **Array `filterConfig`**: Configurazione dei filtri
- **Componente `Table`**: Visualizzazione dei dati
- **Componente `Filters`**: Gestione dei filtri

Esempio di configurazione colonne:

```typescript
const columns = [
  { header: "Logo", key: "logoClientUrl", type: "image" },
  { header: "Nome", key: "name", type: "text" },
  {
    header: "Importo fatturazione",
    key: "subscriptionAmount",
    type: "text",
    render: (value: number) =>
      value.toLocaleString("it-IT", { style: "currency", currency: "EUR" }),
  },
];
```

#### 3.2 Pagina Dettaglio (`EntitàDetail.tsx`)

La pagina dettaglio gestisce:

- **Creazione** (`id === 'new'`): Form semplice per la creazione
- **Modifica** (`id !== 'new'`): Form con tab per la modifica
- **Validazione**: Utilizza React Hook Form con Zod
- **API calls**: CRUD operations tramite `api-utility`

#### 3.3 Schema Zod (`entitàSchema.ts`)

Ogni entità ha un file schema che definisce:

- **Struttura dei dati**: Campi obbligatori e opzionali
- **Validazione**: Regole di validazione con messaggi in italiano
- **Tipi TypeScript**: Derivati automaticamente dallo schema
- **Opzioni per select**: Array di opzioni per i campi select

Esempio di schema:

```typescript
export const clientSchema = z.object({
  id: z.number(),
  code: z
    .string()
    .min(1, "Il codice è obbligatorio")
    .max(10, "Il codice non può superare i 10 caratteri"),
  name: z
    .string()
    .optional() //In caso di campo opzionale
    .nullable() //Nel caso in cui il campo sia nullabile
  vat: z
    .string()
    .min(1, "La partita IVA è obbligatoria")
    .max(50, "La partita IVA non può superare i 50 caratteri"),
  // ... altri campi
});

export type ClientFormData = z.infer<typeof clientSchema>;
```

### 4. Sistema di Tab

Per le entità complesse, la pagina di dettaglio utilizza un sistema di tab organizzato nella cartella `tabs/`:

```
tabs/
├── _general.tsx        # Tab principale con form generale
├── _metrics.tsx        # Tab per letture e grafici
├── _plants.tsx         # Tab per relazioni (es. impianti di un cliente)
└── MonthlyMetricsTable.tsx  # Componenti specifici per le tab
```

Ogni tab è un componente React che riceve props dal componente padre:

- `register`: Funzione di registrazione di React Hook Form
- `control`: Controller per campi complessi
- `errors`: Errori di validazione
- Dati specifici dell'entità

### 5. Componenti Condivisi

Il progetto utilizza componenti condivisi in `src/Components/`:

- **`Table`**: Tabella generica per le liste
- **`Filters`**: Sistema di filtri
- **`PageHeader`**: Header delle pagine con titolo e azioni
- **`FormSection`**: Sezioni dei form
- **`Input`**, **`Select`**, **`DateTimePicker`**: Campi form
- **`DeleteModal`**: Modal per conferma eliminazione
- **`CustomTabs`**: Sistema di tab personalizzato

## Struttura delle API

Le chiamate API utilizzano il servizio `api-utility` con metodi standardizzati:

- `getList(entity, filters, options, sort)`: Recupera liste
- `getItem(entity, id)`: Recupera singolo elemento
- `createItem(entity, data)`: Crea nuovo elemento
- `updateItem(entity, id, data)`: Aggiorna elemento
- `deleteItem(entity, id)`: Elimina elemento

## 🚀 Tecnologie Principali

- **React**: Libreria UI moderna e performante
- **Vite**: Build tool veloce e moderno
- **Tailwind CSS**: Framework CSS utility-first
- **Amazon Cognito**: Gestione autenticazione e autorizzazione
- **Zod**: Validazione dei dati e type safety
- **React Router**: Gestione delle rotte
- **React Hook Form**: Gestione dei form
- **TypeScript**: Tipizzazione statica

## 🚀 Come Iniziare

1. Clona il repository
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Avvia il server di sviluppo:
   ```bash
   npm run start
   ```

## 📦 Requisiti di Sistema

### Node.js

Questo progetto richiede Node.js versione 22 o superiore.

## 📦 Script Disponibili

- `npm run start`: Avvia il server di sviluppo
- `npm run build`: Crea la build di produzione
- `npm run lint`: Esegue il linting del codice

### Deploy con commit e tag
- `npm run patch`: aggiorna la versione del package.json 0.0.X,
- `npm run minor`:  aggiorna la versione del package.json 0.X.0,
- `npm run major`:  aggiorna la versione del package.json X.0.0,

## 🔧 Configurazione

Crea un file `.env` nella root del progetto con le seguenti variabili:

```env
VITE_APP_NAME="Nome del Progetto"
VITE_ENVIRONMENT="development"
BUILD_PATH=./build

###----COGNITO-CONFIG----###
VITE_AWS_REGION=
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=

###---LOOPBACK-CONFIG---###
VITE_BACKEND_URL=

###----ROLLBAR-CONFIG----###
VITE_ROLLBAR_TOKEN=

###----GOOGLE-CONFIG-----###
VITE_GOOGLE_API_KEY=
```

## 📚 Documentazione

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Amazon Cognito](https://docs.aws.amazon.com/cognito/)
- [Zod](https://zod.dev/)

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT.
