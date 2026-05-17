# Demo pubblica read-only

Trasformiamo l'app in una **vetrina pubblica**: chiunque visita il sito vede tutti i contenuti (home, tracks, insights, una journey di esempio), ma nessuno può iscriversi, creare account, modificare o salvare dati. Login e onboarding vengono rimossi dall'esperienza utente.

## Cosa cambia per l'utente

- Niente più schermata di login né "Sign in" in alto.
- Cliccando "Begin" o qualunque CTA, l'utente entra direttamente nella demo (nessun form, nessuna password).
- Tutti i pulsanti di azione (log giornaliero, salva nota, invia messaggio al coach, marca giorno completato, ecc.) vengono **sostituiti con uno stato disabilitato** che mostra una banner/tooltip: *"Demo pubblica · le azioni sono disabilitate"*.
- I dati visti sono un **singolo set di esempio condiviso**, identico per tutti i visitatori.

## Cosa elimino

- `src/routes/login.tsx`
- `src/routes/auth.callback.tsx`
- `src/routes/begin.tsx` (l'onboarding pre-auth non serve più)
- Il gate `beforeLoad` in `src/routes/_authenticated.tsx` (la cartella resta come layout puro)
- Il pulsante "Sign out" nella sidebar
- Il link "Sign in" e "Already on the path" nella landing
- Il flusso `pending_onboarding` in localStorage
- Il provider `useAuth` (`src/lib/auth.tsx`) — rimpiazzato da uno stub che ritorna sempre `user = null`

## Dati della demo

Creo un utente demo fisso lato database (un UUID hardcoded, es. `00000000-0000-0000-0000-00000000d3m0`) con:

- 1 profilo (`display_name: "Demo Explorer"`)
- 2-3 `user_tracks` attivi (es. Meditation, Strength, Quit Sugar)
- 1 `journey` con ~30 `journey_days` di esempio, alcuni completati
- qualche `track_log` e `insight` di esempio
- qualche `community_post` di esempio

Una migration popola questi dati una volta sola (idempotente con `ON CONFLICT DO NOTHING`).

## Server functions

Le funzioni esistenti usano `requireSupabaseAuth` e leggono dati dell'utente loggato. Le converto in **pubbliche read-only**:

- Tolgo `.middleware([requireSupabaseAuth])`
- Uso `supabaseAdmin` (bypass RLS) e leggo sempre con `where user_id = DEMO_USER_ID`
- Le funzioni di **scrittura** (activate tracks, log day, send message, save reflection, ecc.) diventano no-op: ritornano `{ ok: false, demo: true }` senza scrivere nulla.

Niente più bearer token, niente più 401, niente `attachSupabaseAuth` necessario.

## RLS

Lascio l'RLS attiva sulle tabelle (sicurezza in profondità) — non serve aprire al public perché tutte le letture passano dal server tramite `supabaseAdmin`. Nessuna nuova policy richiesta.

## Tecnico — file toccati

```text
DELETE  src/routes/login.tsx
DELETE  src/routes/auth.callback.tsx
DELETE  src/routes/begin.tsx
EDIT    src/routes/_authenticated.tsx       rimuove beforeLoad + Sign out
EDIT    src/routes/index.tsx                rimuove link Sign in, "Begin" → /app
EDIT    src/lib/auth.tsx                    stub: user=null, signOut=no-op
EDIT    src/lib/elevate.functions.ts        usa DEMO_USER_ID + supabaseAdmin, mutazioni no-op
EDIT    src/lib/account.functions.ts        idem
EDIT    src/lib/peak.functions.ts           idem
EDIT    src/routes/_authenticated/app.tsx          banner "demo", disabilita CTA
EDIT    src/routes/_authenticated/onboarding.tsx   stessa cosa o redirect a /app
EDIT    src/routes/_authenticated/settings.tsx     rimuove sezione account
EDIT    src/routes/_authenticated/insights.tsx     read-only
EDIT    src/routes/_authenticated/tracks.tsx       il pulsante "Activate" mostra "Demo"
EDIT    src/routes/_authenticated/track.$slug.tsx  input messaggi disabilitato
EDIT    src/components/momentum-hero.tsx           rimuove dipendenza da auth
NEW     supabase migration                  seed demo user + tracks + journey
```

## Cosa NON faccio

- Non rimuovo le tabelle né l'RLS — i dati restano nel DB per ripristinare l'auth in futuro.
- Non tocco `src/integrations/supabase/*` (auto-generati).
- Non tolgo Google OAuth dalle impostazioni Cloud (resta inattivo, semplicemente non viene chiamato).

Vuoi che proceda con questo piano?
