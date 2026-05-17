## Obiettivo

Rimuovere completamente l'uso di `LOVABLE_API_KEY` / gateway Lovable dal codice AI e tornare a chiamate dirette all'API Anthropic usando la secret esistente `ANTHROPIC_API_KEY` e il modello `claude-haiku-4-5`.

Chiarimento importante: il login Google e il login con email/password passano da Supabase Auth e **non hanno alcun legame con la chiave AI**. Non tocco nulla dei flussi di autenticazione.

## Modifiche

### 1. `src/lib/elevate.functions.ts`
- Rimuovere import e uso di `createLovableAiModel` / `generateText` (AI SDK via gateway).
- Ripristinare chiamate `fetch` dirette a `https://api.anthropic.com/v1/messages` con headers:
  - `x-api-key: ${process.env.ANTHROPIC_API_KEY}`
  - `anthropic-version: 2023-06-01`
  - `content-type: application/json`
- Body: `{ model: "claude-haiku-4-5", max_tokens, system, messages: [...] }`.
- Parsing risposta: `data.content?.[0]?.text`.
- Mantenere identica la logica di prompt, validazione input e shape di output dei server functions.

### 2. `src/lib/onboarding.functions.ts`
- Stessa sostituzione in `getCoachResponse` (e qualsiasi altra chiamata AI nel file): fetch diretto ad Anthropic con `ANTHROPIC_API_KEY` e `claude-haiku-4-5`.

### 3. `src/lib/ai-gateway.ts`
- Eliminare il file (non più referenziato).

### 4. Verifica
- `rg "LOVABLE_API_KEY|ai.gateway.lovable.dev|createLovableAiModel"` su `src/` → 0 risultati attesi.
- Lasciare invariati: `src/routes/login.tsx`, `src/routes/auth.callback.tsx`, configurazione Supabase, provider OAuth.

## Note tecniche

- `ANTHROPIC_API_KEY` è già presente nelle secrets del progetto, quindi disponibile come `process.env.ANTHROPIC_API_KEY` nelle server functions.
- `claude-haiku-4-5` è veloce ed economico, adatto sia all'onboarding coach sia agli step di Elevate.
- Nessuna modifica al database, RLS o autenticazione.
