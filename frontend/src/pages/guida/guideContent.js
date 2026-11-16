// Contenuti della Guida utente (/guida). Solo dati: GuidaPage.jsx li impagina.
// Screenshot in docs/img/guida/<nome>.webp (presi dall'app in locale, telefono 390px @2x).
// Blocchi: p · steps · list · tip · warn · shot · shots · table · gestures · cta
// Nel testo **grassetto** è l'unico markup.

export const IMG = (name) => `/docs/img/guida/${name}.webp`

// dimensioni reali (px) per riservare lo spazio prima che l'immagine arrivi
export const DIMS = {
  dock: [780, 180], eventi: [766, 743], 'evento-tavoli': [766, 1348], 'evento-testa': [766, 845],
  'feed-classifica': [766, 933], 'feed-serata': [766, 592], 'feed-spotlight': [766, 805],
  'gioca-altro': [766, 1216], 'gioca-hero': [766, 256], giudice: [780, 1520], 'gruppo-primati': [780, 1347],
  gruppo: [780, 1380], header: [780, 108], login: [780, 1688], mazzi: [780, 1280], 'mazzo-lista': [780, 1100],
  'mazzo-profilo': [780, 1240], 'menu-account': [780, 928], notifiche: [780, 1000],
  'nuova-eliminazioni': [766, 1815], 'nuova-giocatori': [766, 1136], 'nuova-picker': [780, 1500],
  'nuova-vincitore': [766, 674], partita: [780, 1680], 'profilo-achievement': [766, 1300],
  'profilo-avatar': [716, 952], profilo: [780, 1120], 'segnapunti-libero': [780, 1120],
  'segnapunti-menu': [780, 1688], segnapunti: [780, 1688], 'tavoli-aperti': [766, 1003],
  'tavolo-mazzi': [766, 768], 'tavolo-segnapunti': [766, 598], admin: [780, 1280], 'evento-nuovo': [780, 1238],
}

// Ogni capitolo ha un colore di mana: dà l'accento alla sezione e alla sua carta nell'indice.
export const MANA = {
  W: { hex: '#F3E3B0', name: 'Bianco' },
  U: { hex: '#6AB8EE', name: 'Blu' },
  B: { hex: '#B9A6D6', name: 'Nero' },
  R: { hex: '#F2805F', name: 'Rosso' },
  G: { hex: '#4FD08A', name: 'Verde' },
  C: { hex: '#C9C6DA', name: 'Incolore' },
}

export const CHAPTERS = [
  {
    id: 'primi-passi', mana: 'W', cover: 'login',
    title: 'Primi passi',
    lede: 'Crea l’account, entra e metti l’app sulla schermata Home del telefono.',
    blocks: [
      { shot: 'login', alt: 'Schermata di accesso', caption: 'La pagina di accesso. Da qui c’è anche il link alla presentazione del gruppo.', narrow: true },
      { h: 'Accedere' },
      { steps: [
        'Apri il sito e inserisci **nome utente** e **password**.',
        'Premi **Accedi**: entri nel Feed, la home del portale.',
        'L’accesso resta attivo sul dispositivo. Quando la sessione scade l’app te lo dice e ti riporta qui.',
      ] },
      { h: 'Registrarsi la prima volta' },
      { p: 'Premi **Registrati**, scegli nome utente e password e inserisci il **codice d’invito**. Il codice lo dà un membro del gruppo o un amministratore: senza non si crea l’account.' },
      { tip: 'Hai dimenticato la password? Chiedi a un amministratore di reimpostarla dal pannello Admin.' },
      { h: 'Installare l’app sul telefono' },
      { p: 'Commanderone è una web app installabile: si apre a schermo intero come un’app vera, senza passare dallo store.' },
      { table: { head: ['Telefono', 'Come fare'], rows: [
        ['iPhone (Safari)', 'Tasto **Condividi** → **Aggiungi alla schermata Home**'],
        ['Android (Chrome)', 'Menu **⋮** → **Installa app** (o **Aggiungi a schermata Home**)'],
      ] } },
      { tip: 'Chi non è ancora del gruppo può conoscerci dalla pagina pubblica **/info**: chi siamo, come giochiamo, quando e dove. Da lì il pulsante **Entra nel pod** porta al login.' },
    ],
  },
  {
    id: 'navigazione', mana: 'U', cover: 'menu-account',
    title: 'Muoversi nell’app',
    lede: 'In alto il logo, la campanella e il tuo avatar. In basso la barra con le cinque sezioni.',
    blocks: [
      { shot: 'header', alt: 'Barra in alto', caption: 'Barra in alto: logo, notifiche e avatar.', flat: true },
      { shot: 'dock', alt: 'Barra di navigazione in basso', caption: 'La barra in basso. Il pulsante tondo al centro è Gioca.', flat: true },
      { table: { head: ['Pulsante', 'Cosa trovi'], rows: [
        ['**Feed**', 'La home: la tua stagione, la prossima serata e le ultime partite'],
        ['**Eventi**', 'Il calendario. Il pallino verde segnala un evento in arrivo'],
        ['**Gioca** (centro)', 'Registra partita, tavoli aperti, Giudice'],
        ['**Gruppo**', 'Classifica, giocatori, mazzi e storico di tutti'],
        ['**Io**', 'Il tuo profilo'],
      ] } },
      { h: 'Il menu dell’avatar' },
      { shot: 'menu-account', alt: 'Menu che si apre toccando l’avatar', caption: 'Tocca il tuo avatar in alto a destra.', narrow: true },
      { list: [
        '**Il mio profilo** e **I miei mazzi**.',
        '**Segnapunti**: punti vita per una partita qualsiasi, anche fuori dai tavoli (vedi il capitolo dedicato).',
        '**Tema chiaro / scuro**: lo scuro è pensato per la serata al tavolo. La scelta resta sul dispositivo.',
        '**Guida utente**: questa pagina.',
        '**Pannello Admin** (solo amministratori) ed **Esci**.',
      ] },
      { tip: 'Da computer le stesse sezioni sono nella barra in alto: Feed, Gioca, Eventi, Gruppo, Mazzi.' },
    ],
  },
  {
    id: 'feed', mana: 'G', cover: 'feed-classifica',
    title: 'Feed, la home',
    lede: 'Tutto quello che ti serve sapere appena apri l’app, in una colonna.',
    blocks: [
      { shot: 'feed-serata', alt: 'Card della prossima serata', caption: 'La prossima serata, con il pulsante per iscriverti.' },
      { p: '**Prossima serata**: titolo, giorno, ora, luogo e chi è già iscritto. Tocca **Ci sei?** per segnarti: diventa **Iscritto!**. Ritoccalo per toglierti.' },
      { shot: 'feed-classifica', alt: 'Classifica, win rate e podio', caption: 'La tua posizione nella stagione e il podio.' },
      { list: [
        '**Classifica**: la tua posizione nella stagione in corso e i punti.',
        '**Win rate**: percentuale di vittorie, con vinte e perse.',
        '**Podio stagione**: i primi tre. **Classifica** apre quella completa.',
      ] },
      { shot: 'feed-spotlight', alt: 'Mazzo del momento e attività della settimana', caption: 'Il mazzo più in forma e l’andamento della settimana.' },
      { list: [
        '**Mazzo del momento**: il mazzo con la miglior percentuale negli ultimi 10 giorni (almeno 3 partite).',
        '**Questa settimana**: partite giocate da lunedì, giorno per giorno, confrontate con la settimana scorsa.',
        '**Attività recente**: le ultime partite del gruppo e le tue notifiche. Tocca una partita per aprirla.',
      ] },
    ],
  },
  {
    id: 'gioca', mana: 'R', cover: 'gioca-hero',
    title: 'Gioca',
    lede: 'Il pulsante centrale della barra. È il punto di partenza della serata.',
    blocks: [
      { shot: 'gioca-hero', alt: 'Pulsante Registra partita', caption: 'Il pulsante grande porta dritto a Registra partita.', flat: true },
      { list: [
        '**Registra partita**: il risultato di una partita appena finita.',
        '**Tavoli aperti adesso**: siediti a un tavolo o aprine uno tu (capitolo successivo).',
        '**Stasera**: se sei in un tavolo di torneo compare qui, con il pulsante per registrarne il risultato.',
        '**Chiedi al Giudice**: dubbi sulle regole.',
        '**Ultimi mazzi usati**, **Prossimo evento** e **La tua ultima partita**, a un tocco.',
      ] },
      { shot: 'gioca-altro', alt: 'Giudice, ultimi mazzi, prossimo evento, ultima partita', caption: 'Più in basso: Giudice, mazzi recenti, prossimo evento e ultima partita.' },
    ],
  },
  {
    id: 'tavoli', mana: 'R', cover: 'tavoli-aperti',
    title: 'Tavoli aperti',
    lede: 'Formare un tavolo con un tocco: tu lo apri, gli altri vedono i posti liberi e si siedono.',
    blocks: [
      { shot: 'tavoli-aperti', alt: 'Card di un tavolo aperto', caption: 'Un tavolo aperto da Ramuh con quattro giocatori e un posto libero.' },
      { h: 'Aprire un tavolo' },
      { steps: [
        'In **Gioca** (o nella pagina della serata) premi **Apri un tavolo**. Sei già seduto, l’orario è adesso.',
        'Gli altri vedono il tavolo e premono **Siediti**. Ti arriva una notifica per ognuno.',
        'Quando siete al completo usa l’interruttore **Aperto** per chiuderlo: nessun altro potrà entrare.',
        'Premi **Apri il tavolo** per la pagina del tavolo: mazzi e segnapunti.',
      ] },
      { list: [
        'Al massimo **5 posti**, chi apre compreso.',
        'Puoi cambiare l’**orario**, togliere qualcuno con la **×** o **cancellare** il tavolo (cestino).',
        '**Alzati** ti toglie dal tavolo. Se si alza chi l’ha aperto, il tavolo passa al primo seduto.',
        'Se c’è una serata in calendario il tavolo si aggancia da solo a quella serata. Nei tornei 1v1 non si aprono tavoli.',
      ] },
      { h: 'La pagina del tavolo' },
      { shot: 'tavolo-mazzi', alt: 'Giocatori e mazzi del tavolo', caption: 'Ognuno sceglie il mazzo che sta giocando.' },
      { p: 'La vedono solo i giocatori seduti. Tocca la tua riga per scegliere il mazzo. Chi ha aperto il tavolo può sceglierlo per tutti.' },
      { shot: 'tavolo-segnapunti', alt: 'Riquadro del segnapunti', caption: 'Il riassunto dei punti, aggiornato per tutto il tavolo.' },
      { p: 'A fine partita premi **Registra risultati** (servono almeno 3 giocatori): si apre Registra partita con giocatori e mazzi già inseriti. Salvata la partita, il tavolo risulta **Concluso** e il segnapunti si azzera.' },
    ],
  },
  {
    id: 'segnapunti', mana: 'B', cover: 'segnapunti',
    title: 'Il segnapunti',
    lede: 'Il telefono al centro del tavolo, un riquadro per giocatore girato verso di lui. Condiviso con tutto il tavolo.',
    blocks: [
      { gestures: {
        shot: 'segnapunti', alt: 'Segnapunti a schermo intero con quattro giocatori',
        marks: [
          { n: 1, x: 34, y: 6 }, { n: 2, x: 34, y: 44 }, { n: 3, x: 10, y: 33 },
          { n: 4, x: 42, y: 15 }, { n: 5, x: 59, y: 45 }, { n: 6, x: 14, y: 82 },
        ],
        items: [
          'Tocca la **metà “meno”** del riquadro: −1. Tieni premuto: −10, ripetuto.',
          'Tocca la **metà “più”**: +1. Tieni premuto: +10, ripetuto.',
          '**Scorri** lungo il riquadro per cambiare contatore: vita → veleno → danni da commander di ciascun avversario. I puntini dicono dove sei. Dopo 5 secondi torna alla vita.',
          '**Tieni premuto il nome** e trascinalo su un altro posto: i due giocatori si scambiano di posto.',
          'Tocca lo **stemma** al centro per il menu.',
          'Veleno e danni da commander restano visibili in piccolo sotto la vita.',
        ],
      } },
      { p: 'Si apre dalla pagina del tavolo con **Apri segnapunti**. Ogni modifica arriva sui telefoni di tutti i seduti in pochi secondi. Chiuderlo non azzera niente.' },
      { table: { head: ['Contatore', 'Parte da', 'Fuori quando'], rows: [
        ['Vita', '40', 'arriva a 0'],
        ['Veleno', '0', 'arriva a 10'],
        ['Danni da commander', '0 per avversario', '21 dallo stesso commander (tolgono anche vita)'],
      ] } },
      { h: 'Il menu dello stemma' },
      { shot: 'segnapunti-menu', alt: 'Menu del segnapunti', caption: 'Il menu che si apre toccando lo stemma.', narrow: true },
      { list: [
        '**Annulla ultima azione**: mostra cosa annulla prima di farlo.',
        '**Ripristina punti vita**: tutti a 40, veleno e danni a 0. Solo chi ha aperto il tavolo.',
        '**Ruota i posti**: tutti scalano di un posto, per tutto il tavolo.',
        '**Chi inizia?** e **Tira d20**: valgono solo sul tuo telefono.',
        '**Chiudi segnapunti**: torni alla pagina del tavolo, i punti restano.',
      ] },
    ],
  },
  {
    id: 'segnapunti-libero', mana: 'B', cover: 'segnapunti-libero',
    title: 'Segnapunti libero',
    lede: 'Per una partita qualsiasi, anche senza tavolo e con amici che non hanno l’account.',
    blocks: [
      { shot: 'segnapunti-libero', alt: 'Preparazione del segnapunti libero', caption: 'Un giocatore registrato e un ospite.', narrow: true },
      { steps: [
        'Tocca il tuo avatar → **Segnapunti**. Ci sei già tu.',
        'Aggiungi giocatori del gruppo con **Giocatori** (col loro mazzo) o amici con **Ospite** (nome e, se vuoi, commander).',
        'Da 2 a 6 giocatori, poi **Inizia**. I gesti sono gli stessi del segnapunti del tavolo.',
      ] },
      { list: [
        'Resta **solo su questo telefono**. Se ricarichi la pagina i punti ci sono ancora.',
        '**Chiudi segnapunti** chiede conferma e cancella i punti.',
        'Se siete almeno 3 e tutti registrati, nel menu c’è **Registra risultati**: apre Registra partita già compilata.',
      ] },
    ],
  },
  {
    id: 'registra', mana: 'G', cover: 'nuova-eliminazioni',
    title: 'Registrare una partita',
    lede: 'Quattro passi, due obbligatori. Più dettagli inserisci, più ricche sono le statistiche.',
    blocks: [
      { h: '1. Chi ha giocato' },
      { shot: 'nuova-picker', alt: 'Scelta dei giocatori', caption: 'Cerca per nome o tocca chi ha giocato di recente.', narrow: true },
      { p: 'Premi **Scegli i giocatori** e tocca da 3 a 5 persone. In alto trovi chi ha giocato di recente. Poi scegli il **mazzo** di ognuno: chi ne ha uno solo lo trova già inserito.' },
      { shot: 'nuova-giocatori', alt: 'Giocatori con il mazzo scelto', caption: 'Ogni giocatore con il suo mazzo.' },
      { h: '2. Chi ha vinto' },
      { shot: 'nuova-vincitore', alt: 'Scelta del vincitore', caption: 'Tocca il vincitore.' },
      { h: '3. Ordine di eliminazione (facoltativo)' },
      { shot: 'nuova-eliminazioni', alt: 'Ordine di eliminazione e punti stagione', caption: 'Chi è uscito per primo, chi l’ha eliminato e i punti che ne derivano.' },
      { p: 'Tocca i giocatori **dal primo eliminato all’ultimo**: i piazzamenti si calcolano da soli. Sotto ognuno indica **chi l’ha eliminato**: serve per arcinemico, kill e primati.' },
      { tip: 'Senza ordine di eliminazione contano solo vittoria (+3) e presenza (+1). Con l’ordine completo prendono punti anche 2° e 3°.' },
      { h: '4. Data e note' },
      { p: 'La data è oggi: toccala in alto per una partita passata. Nelle **Note** un ricordo della partita. Poi **Salva**, e partono i coriandoli.' },
      { tip: 'Se arrivi da un tavolo aperto, da un tavolo di torneo o dal segnapunti libero, giocatori e mazzi sono già inseriti.' },
    ],
  },
  {
    id: 'partita', mana: 'W', cover: 'partita',
    title: 'Partite, commenti e reazioni',
    lede: 'Ogni partita ha la sua pagina, con piazzamenti, eliminazioni e la parte social.',
    blocks: [
      { shot: 'partita', alt: 'Pagina di una partita', caption: 'Vincitore, piazzamenti, reazioni e commenti.', narrow: true },
      { list: [
        'La apri toccando una partita nel Feed, nello Storico o in un profilo.',
        '**Reazioni**: 👍 🔥 😂 😮 💀 🎉 🐸. Tocca per reagire, ritocca per togliere.',
        '**Commenti**: scrivi e premi **Invia**. I tuoi li elimini con la ×.',
        'Gli altri giocatori della partita ricevono una notifica.',
      ] },
      { tip: 'Hai sbagliato a registrare? Un amministratore può correggere o eliminare la partita dal pannello Admin.' },
    ],
  },
  {
    id: 'mazzi', mana: 'U', cover: 'mazzi',
    title: 'I tuoi mazzi',
    lede: 'Crea i mazzi una volta, poi li scegli in un tocco a ogni partita.',
    blocks: [
      { shot: 'mazzi', alt: 'Pagina I miei mazzi', caption: 'Ogni mazzo con l’illustrazione del commander, livello e archetipo.', narrow: true },
      { h: 'Creare un mazzo' },
      { steps: [
        'Avatar → **I miei mazzi** → **Nuovo mazzo** (o **+ Aggiungi** dal tuo profilo).',
        'Dai un **nome** e scrivi il **commander**: scegli dai suggerimenti, così l’illustrazione è giusta.',
        'I **colori** si riconoscono dal commander.',
        'Scegli **livello** e **archetipo**, se vuoi, e salva.',
      ] },
      { h: 'Livello e archetipo' },
      { p: 'Si cambiano dai due menu sulla card e si salvano subito.' },
      { table: { head: ['Livello', 'In breve'], rows: [
        ['**B1 · Casual**', 'Divertimento, niente combo veloci'],
        ['**B2 · Bilanciato**', 'Mazzo onesto, sinergie ma non spietato'],
        ['**B3 · Potente**', 'Ottimizzato, combo e tutor'],
        ['**B4 · cEDH**', 'Massima potenza competitiva'],
      ] } },
      { p: 'Archetipi: **Aggro, Midrange, Control, Combo, Stax, Aristocrats, Tokens, Voltron, Ramp**.' },
      { h: 'La lista delle carte' },
      { p: 'Premi **Lista** sulla card. Puoi **importarla da un link** (Archidekt funziona sempre; Moxfield spesso blocca: lì usa Export → Text e incolla) oppure scriverla a mano, una carta per riga: `1 Sol Ring`. Con **Modifica mazzo** cambi anche nome e commander.' },
      { tip: 'Al salvataggio l’app controlla che le carte siano **100** (commander compreso) e che ogni nome esista. Se qualcosa non torna ti dice quale carta correggere.' },
      { h: 'Il profilo del mazzo' },
      { shots: [
        { shot: 'mazzo-profilo', alt: 'Profilo mazzo, scheda Performance', caption: 'Performance: partite, win rate, matchup, prezzo stimato.' },
        { shot: 'mazzo-lista', alt: 'Profilo mazzo, scheda Lista carte', caption: 'Lista carte divisa per tipo. Tocca una carta per vederla.' },
      ] },
      { p: 'Nella scheda **Performance** trovi anche la stima del prezzo in euro (prezzi Scryfall) e l’andamento del win rate. Un mazzo si elimina solo se non ha partite registrate.' },
    ],
  },
  {
    id: 'gruppo', mana: 'G', cover: 'gruppo',
    title: 'Gruppo e stagioni',
    lede: 'Le statistiche di tutti: classifica della stagione, giocatori, mazzi e storico delle partite.',
    blocks: [
      { shot: 'gruppo', alt: 'Pagina Gruppo, scheda Stagione', caption: 'In alto i numeri del gruppo, sotto le quattro schede.', narrow: true },
      { h: 'Come funziona la stagione' },
      { p: 'Ci sono tre stagioni l’anno: **gennaio–aprile**, **maggio–agosto**, **settembre–dicembre**. Ripartono da sole.' },
      { table: { head: ['Piazzamento', 'Punti'], rows: [
        ['1° (vittoria)', '3'], ['2°', '2'], ['3°', '1'], ['Ogni partita giocata', '+1'],
      ] } },
      { p: 'Per vincere la stagione bisogna essere **qualificati**: aver giocato almeno il **30%** delle partite della stagione. Col menu della stagione sfogli quelle passate.' },
      { tip: 'Per le stagioni concluse c’è il pulsante **Infografica**: un riepilogo in tre slide da scaricare e pubblicare su Instagram.' },
      { h: 'Primati e meta' },
      { shot: 'gruppo-primati', alt: 'I primati del gruppo', caption: 'I record del gruppo.' },
      { p: '**Primati**: re del mese, serie record, più vittorie, miglior win rate, mazzo più forte, più presenze, tavolo record, re della sopravvivenza, sfortunato, più spietato, bersaglio. **Meta colori**: win rate per colore e partite mese per mese.' },
      { h: 'Le altre schede' },
      { list: [
        '**Giocatori**: tutti, in ordine di win rate. Tocca per aprire il profilo.',
        '**Mazzi**: tutti i mazzi del gruppo, con livello e archetipo.',
        '**Storico**: tutte le partite, filtrabili per periodo o per date, con reazioni e commenti.',
      ] },
    ],
  },
  {
    id: 'profilo', mana: 'C', cover: 'profilo',
    title: 'Il tuo profilo',
    lede: 'Avatar, stagione, achievement, mazzi e tutte le tue statistiche. Lo apri con Io nella barra.',
    blocks: [
      { shot: 'profilo', alt: 'Profilo giocatore', caption: 'Il tuo profilo: avatar, win rate, stagione e achievement.', narrow: true },
      { h: 'L’avatar' },
      { p: 'Finché non ne scegli uno, l’avatar è l’illustrazione del **commander che giochi di più**. Per sceglierlo tocca la **matita** sull’avatar, cerca una carta e scegli la stampa che preferisci.' },
      { shot: 'profilo-avatar', alt: 'Scelta dell’avatar', caption: 'Ogni stampa ha la sua illustrazione.', narrow: true },
      { p: 'Premi **Usa come avatar**. **Rimuovi** torna all’avatar automatico. L’avatar compare ovunque: classifiche, tavoli, commenti, iscritti agli eventi.' },
      { h: 'Achievement' },
      { shot: 'profilo-achievement', alt: 'Elenco degli achievement', caption: 'Quelli sbloccati sono evidenziati.', narrow: true },
      { list: [
        '**26 achievement**: 20 visibili da subito, 6 **segreti** che compaiono solo quando li sblocchi.',
        'Quando la sezione è chiusa vedi il **prossimo** da sbloccare.',
        'Due si assegnano solo a **stagione conclusa**: campione e stagione perfetta.',
        'Ogni sblocco ti arriva come notifica.',
      ] },
      { h: 'Le altre sezioni' },
      { list: [
        '**Stagione corrente**: posizione, punti e se sei qualificato.',
        '**I miei mazzi**: con livello, archetipo, lista ed eliminazione.',
        '**Scontri diretti**: scegli un avversario e guarda il testa a testa.',
        '**Statistiche dettagliate**: eliminazioni fatte e subite, arcinemico, preda preferita, piazzamento medio, andamento.',
        '**Storico partite**.',
      ] },
    ],
  },
  {
    id: 'eventi', mana: 'W', cover: 'eventi',
    title: 'Eventi e tornei',
    lede: 'Il calendario del gruppo: serate, tornei multiplayer e tornei 1v1.',
    blocks: [
      { shot: 'eventi', alt: 'Card di un evento', caption: 'Data, formato, luogo, chi organizza e chi viene.' },
      { list: [
        'Due schede: **Prossimi** e **Passati**. Un evento passa tra i passati alle 5 del mattino dopo.',
        '**Ci sei?** ti iscrive, **Iscritto!** conferma. Ritoccalo per toglierti.',
        '**Apri** porta alla pagina dell’evento.',
      ] },
      { table: { head: ['Formato', 'Come si gioca'], rows: [
        ['**Solo evento**', 'Serata libera: le partite registrate quel giorno compaiono nella pagina dell’evento'],
        ['**Multiplayer**', 'Tavoli da 3 a 5 (meglio 4) generati dall’organizzatore. Ogni tavolo è una partita vera: conta per stagione e statistiche'],
        ['**1v1**', 'Svizzera al meglio di 1 o di 3, massimo 4 turni, con classifica'],
      ] } },
      { h: 'La pagina dell’evento' },
      { shot: 'evento-testa', alt: 'Intestazione dell’evento', caption: 'Dettagli, organizzatore e iscritti.' },
      { shot: 'evento-tavoli', alt: 'Tavoli della serata', caption: 'Il tuo tavolo è evidenziato. Quando è finito mostra chi ha vinto.' },
      { list: [
        'Nei multiplayer, quando tutti sono iscritti, l’organizzatore genera i **tavoli**.',
        'Il risultato lo registra un giocatore del tavolo con **Registra partita del tavolo**: giocatori già inseriti.',
        'Più in basso: **Tavoli aperti della serata** e **Partite della serata**.',
        'Nei 1v1 si registra il punteggio del match (o il pareggio) e la classifica si aggiorna da sola.',
      ] },
      { tip: 'Servono mazzi per entrare in un tavolo di torneo: crea almeno un mazzo prima della serata.' },
    ],
  },
  {
    id: 'giudice', mana: 'U', cover: 'giudice',
    title: 'Il Giudice',
    lede: 'Dubbi su una regola? Chiedi in italiano, anche informale.',
    blocks: [
      { shot: 'giudice', alt: 'Pagina del Giudice', caption: 'Domanda in alto, sotto lo storico del gruppo.', narrow: true },
      { steps: [
        'Da **Gioca** → **Chiedi al Giudice**.',
        'Scrivi la domanda, anche con nomi di carte e abbreviazioni.',
        'Premi **Chiedi al Judge** (da tastiera Ctrl+Invio).',
      ] },
      { p: 'Ricevi la risposta con un indicatore di **affidabilità**, la spiegazione, le **carte riconosciute** e le **regole ufficiali** citate. Sotto trovi le ultime 20 domande del gruppo: magari qualcuno l’ha già chiesto.' },
      { warn: 'Il Giudice usa l’intelligenza artificiale e può sbagliare. Per le partite che contano verifica sulle regole ufficiali.' },
    ],
  },
  {
    id: 'notifiche', mana: 'C', cover: 'notifiche',
    title: 'Notifiche',
    lede: 'La campanella in alto ti dice cosa è successo mentre non c’eri.',
    blocks: [
      { shot: 'notifiche', alt: 'Elenco delle notifiche', caption: 'Tocca una notifica per andare al punto giusto.', narrow: true },
      { list: [
        'Un nuovo **evento** in calendario.',
        'Qualcuno si **siede al tuo tavolo**.',
        'Un **achievement** sbloccato.',
        'Un **commento** o una **reazione** a una tua partita.',
      ] },
      { p: 'Il numero sulla campanella sono le non lette: aprendo l’elenco diventano lette. Si aggiorna da sola ogni minuto.' },
    ],
  },
  {
    id: 'ruoli', mana: 'B', cover: 'admin',
    title: 'Organizzatori e amministratori',
    lede: 'Chi crea gli eventi e chi gestisce il portale.',
    blocks: [
      { h: 'Organizzatore' },
      { p: 'Un giocatore a cui l’amministratore dà il permesso di **creare eventi**. Gioca e compare in classifica come tutti. Degli eventi che crea può fare tutto: modificarli, eliminarli, generare turni e tavoli, registrare i risultati. Gli altri lo vedono come “Organizzato da”.' },
      { steps: [
        'In **Eventi** premi **Nuovo evento**.',
        'Titolo, data, ora (facoltativa), luogo, descrizione.',
        'Formato: **Solo evento**, **Multiplayer** o **1v1** (al meglio di 1 o di 3).',
        'Premi **Crea evento**: tutti gli altri ricevono una notifica.',
      ] },
      { shot: 'evento-nuovo', alt: 'Modulo Nuovo evento', caption: 'Il modulo per creare un evento.', narrow: true },
      { h: 'Amministratore' },
      { shot: 'admin', alt: 'Pannello Admin', caption: 'Il pannello Admin, scheda Utenti, con l’interruttore Organizzatore.', narrow: true },
      { list: [
        '**Utenti**: crea account, cambia nome e password, rende un giocatore **Organizzatore** con l’interruttore.',
        '**Mazzi**: gestisce i mazzi di tutti.',
        '**Partite**: corregge o elimina qualsiasi partita.',
        '**Esporta backup**: scarica tutti i dati in un file.',
        'Gestisce tutti gli eventi, anche quelli creati da altri.',
      ] },
      { tip: 'L’account admin non gioca: non compare in classifiche e statistiche.' },
    ],
  },
]

export const FAQ = [
  ['Ho dimenticato la password.', 'Chiedi a un amministratore: la reimposta dal pannello Admin.'],
  ['Il mio mazzo non mostra l’illustrazione del commander.', 'Il nome non combacia con quello ufficiale. Apri la lista del mazzo, premi Modifica mazzo e riscrivi il commander scegliendolo dai suggerimenti.'],
  ['Devo per forza inserire l’ordine di eliminazione?', 'No. Ma senza contano solo vittoria e presenza, e mancano kill, arcinemico e piazzamenti.'],
  ['Come si vince la stagione?', 'Con più punti tra i qualificati: 3 al primo, 2 al secondo, 1 al terzo, più 1 a ogni partita giocata. Qualificato è chi gioca almeno il 30% delle partite della stagione.'],
  ['Il segnapunti del tavolo lo vedono tutti?', 'Sì, tutti i giocatori seduti, anche su telefoni diversi. Il segnapunti libero dal menu dell’avatar invece resta solo sul tuo telefono.'],
  ['Ho chiuso per sbaglio il segnapunti del tavolo.', 'Nessun problema: i punti restano. Riaprilo dalla pagina del tavolo con Apri segnapunti.'],
  ['Perché non riesco a entrare in un tavolo?', 'Il tavolo è chiuso o al completo (5 posti), oppure sei già seduto a un altro tavolo attivo.'],
  ['Posso creare un evento?', 'Solo se sei organizzatore o amministratore. Gli altri si iscrivono con Ci sei?.'],
  ['Non trovo un achievement che avevo.', 'Gli achievement sbloccati restano tuoi anche se poi le statistiche cambiano. Quelli segreti compaiono solo dopo lo sblocco.'],
  ['Si può usare da computer?', 'Sì: stesse funzioni, con la barra di navigazione in alto.'],
]
