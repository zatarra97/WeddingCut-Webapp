# Scripts di Utilità

Questo directory contiene script di utilità per la gestione del progetto.

## Script Disponibili

### `clean-whitespace.js`
Pulisce automaticamente tutte le righe che contengono solo spazi o tabulazioni, sostituendole con righe completamente vuote.

**Uso:**
```bash
npm run clean:whitespace
# oppure
node scripts/clean-whitespace.js
```

**Cosa fa:**
- Cerca ricorsivamente tutti i file con estensioni: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css`, `.html`, `.md`
- Identifica le righe che contengono solo spazi o tabulazioni usando il pattern regex `^[ \t]+$`
- Sostituisce queste righe con righe completamente vuote
- Mostra un report dettagliato delle modifiche effettuate

**Esempio di output:**
```
🧹 Starting whitespace cleanup...

📁 Found 118 files to process...

✅ Cleaned: src/Pages/Dashboard/Dashboard.tsx (12 lines)
✅ Cleaned: src/Components/Sidebar.tsx (3 lines)

📊 Summary:
   Files processed: 118
   Files cleaned: 56
   Total whitespace lines removed: 234
   Errors: 0

✅ Cleanup completed successfully!
```

### `version-bump.js`
Gestisce l'incremento automatico delle versioni del progetto.

**Uso:**
```bash
npm run version:patch  # Incrementa patch version (1.1.0 -> 1.1.1)
npm run version:minor  # Incrementa minor version (1.1.0 -> 1.2.0)
npm run version:major  # Incrementa major version (1.1.0 -> 2.0.0)
```

## Regole Cursor

Il progetto include un file `.cursorrules` che definisce le regole automatiche per l'Agent di Cursor, inclusa la pulizia automatica del whitespace.

## Git Hooks

### Installazione Hooks (Cross-Platform)
Per installare i Git hooks che puliscono automaticamente il whitespace prima di ogni commit:

```bash
npm run install:hooks
```

**Compatibilità:**
- ✅ Windows
- ✅ macOS  
- ✅ Linux

### Hook Pre-commit
Il hook pre-commit esegue automaticamente:
1. Pulizia del whitespace con `npm run clean:whitespace`
2. Aggiunta dei file puliti al commit
3. Continuazione del commit se tutto va bene

**Per saltare il hook:**
```bash
git commit --no-verify
```

## Best Practices

- Esegui `npm run clean:whitespace` prima di ogni commit
- Usa `npm run lint` per verificare la qualità del codice
- Mantieni sempre una formattazione consistente
- Documenta le modifiche significative
- Installa i Git hooks con `npm run install:hooks` per automatizzare la pulizia
