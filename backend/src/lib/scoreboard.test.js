import { describe, it, expect } from 'vitest';
import { viewFor, applyAction, undoLast, eliminationOf, seatOrderOf, setSeatOrder, resetState, START_LIFE, HISTORY_MAX, MERGE_MS } from './scoreboard.js';

const seats = [1, 2, 3];

describe('viewFor', () => {
  it('stato vuoto: tutti a 40, nessun veleno, danni commander a 0 per ogni avversario', () => {
    const v = viewFor(null, seats);
    expect(v.players[1]).toEqual({ life: START_LIFE, poison: 0, cmd: { 2: 0, 3: 0 }, eliminated: false, reason: null });
    expect(Object.keys(v.players)).toEqual(['1', '2', '3']);
  });

  it('segue i posti attuali: chi non è più seduto sparisce, chi arriva parte da 40', () => {
    const { state } = applyAction(null, seats, { type: 'life', userId: 1, delta: -5 });
    const v = viewFor(state, [1, 3, 4]);
    expect(v.players[1].life).toBe(35);
    expect(v.players[4].life).toBe(40);
    expect(v.players[2]).toBeUndefined();
    expect(v.players[1].cmd).toEqual({ 3: 0, 4: 0 });
  });
});

describe('applyAction', () => {
  it('vita +1/-1/+5/-5', () => {
    let s = null;
    for (const d of [1, -1, 5, -5, -5]) s = applyAction(s, seats, { type: 'life', userId: 2, delta: d }).state;
    expect(viewFor(s, seats).players[2].life).toBe(35);
  });

  it('vita <= 0 = eliminato', () => {
    const { state } = applyAction(null, seats, { type: 'life', userId: 1, delta: -40 });
    expect(viewFor(state, seats).players[1]).toMatchObject({ life: 0, eliminated: true, reason: 'life' });
  });

  it('10 veleni = eliminato; il veleno non scende sotto 0', () => {
    let s = applyAction(null, seats, { type: 'poison', userId: 3, delta: -1 }).state;
    expect(viewFor(s, seats).players[3].poison).toBe(0);
    for (let i = 0; i < 10; i++) s = applyAction(s, seats, { type: 'poison', userId: 3, delta: 1 }).state;
    expect(viewFor(s, seats).players[3]).toMatchObject({ poison: 10, eliminated: true, reason: 'poison' });
  });

  it('danno da commander: toglie anche vita, 21 da un singolo commander = eliminato', () => {
    let s = applyAction(null, seats, { type: 'cmd', userId: 1, fromUserId: 2, delta: 5 }).state;
    expect(viewFor(s, seats).players[1]).toMatchObject({ life: 35, cmd: { 2: 5, 3: 0 } });
    for (let i = 0; i < 16; i++) s = applyAction(s, seats, { type: 'cmd', userId: 1, fromUserId: 2, delta: 1 }).state;
    const p = viewFor(s, seats).players[1];
    expect(p.cmd[2]).toBe(21);
    expect(p.eliminated).toBe(true);
  });

  it('20 + 20 da due commander diversi non elimina per commander (ma la vita sì se arriva a 0)', () => {
    expect(eliminationOf({ life: 5, poison: 0, cmd: { 2: 20, 3: 20 } }).eliminated).toBe(false);
  });

  it('togliere danno da commander restituisce la vita, senza scendere sotto 0', () => {
    let s = applyAction(null, seats, { type: 'cmd', userId: 1, fromUserId: 2, delta: 1 }).state;
    s = applyAction(s, seats, { type: 'cmd', userId: 1, fromUserId: 2, delta: -5 }).state;
    expect(viewFor(s, seats).players[1]).toMatchObject({ life: 40, cmd: { 2: 0 } });
  });

  it('rifiuta azioni non valide', () => {
    expect(applyAction(null, seats, { type: 'life', userId: 9, delta: 1 }).error).toBeTruthy();
    expect(applyAction(null, seats, { type: 'life', userId: 1, delta: 0 }).error).toBeTruthy();
    expect(applyAction(null, seats, { type: 'life', userId: 1, delta: 1.5 }).error).toBeTruthy();
    expect(applyAction(null, seats, { type: 'cmd', userId: 1, fromUserId: 1, delta: 1 }).error).toBeTruthy();
    expect(applyAction(null, seats, { type: 'boh', userId: 1, delta: 1 }).error).toBeTruthy();
  });
});

describe('storico e annulla', () => {
  const T0 = 1_000_000;
  const act = (s, a, by = 1, at = T0) => applyAction(s, seats, a, by, at).state;

  it('registra chi, cosa e la variazione applicata', () => {
    const s = act(null, { type: 'cmd', userId: 2, fromUserId: 3, delta: 4 }, 3);
    expect(viewFor(s, seats).history).toEqual([{ by: 3, type: 'cmd', userId: 2, fromUserId: 3, d: { life: -4, poison: 0, cmd: 4 }, at: T0 }]);
  });

  it('tocchi ripetuti sullo stesso contatore entro pochi secondi = una voce sola', () => {
    let s = null;
    for (let i = 0; i < 5; i++) s = act(s, { type: 'life', userId: 2, delta: -1 }, 1, T0 + i * 500);
    s = act(s, { type: 'life', userId: 2, delta: -1 }, 1, T0 + 2000 + MERGE_MS + 1); // troppo tardi: voce nuova
    s = act(s, { type: 'life', userId: 2, delta: -1 }, 3, T0 + 2000 + MERGE_MS + 2); // altro autore: voce nuova
    const h = viewFor(s, seats).history;
    expect(h.map(e => e.d.life)).toEqual([-5, -1, -1]);
  });

  it('+1 e -1 che si annullano spariscono dallo storico', () => {
    let s = act(null, { type: 'life', userId: 2, delta: 1 });
    s = act(s, { type: 'life', userId: 2, delta: -1 }, 1, T0 + 100);
    expect(viewFor(s, seats).history).toEqual([]);
  });

  it('annulla ripetuto riporta indietro una voce alla volta (anche i danni da commander)', () => {
    let s = act(null, { type: 'life', userId: 1, delta: -7 }, 2);
    s = act(s, { type: 'poison', userId: 1, delta: 3 }, 2);
    s = act(s, { type: 'cmd', userId: 1, fromUserId: 3, delta: 6 }, 3);
    let u = undoLast(s, seats);
    expect(u.undone).toMatchObject({ type: 'cmd', by: 3 });
    expect(viewFor(u.state, seats).players[1]).toMatchObject({ life: 33, poison: 3, cmd: { 3: 0 } });
    u = undoLast(u.state, seats);
    expect(viewFor(u.state, seats).players[1]).toMatchObject({ life: 33, poison: 0 });
    u = undoLast(u.state, seats);
    expect(viewFor(u.state, seats).players[1]).toMatchObject({ life: 40, poison: 0 });
    expect(undoLast(u.state, seats).error).toBeTruthy();
  });

  it('annulla solo ciò che è stato applicato davvero (veleno già a 0, commander a 0)', () => {
    let s = act(null, { type: 'poison', userId: 1, delta: -3 });
    expect(viewFor(s, seats).history).toEqual([]);
    s = act(s, { type: 'cmd', userId: 1, fromUserId: 2, delta: 2 });
    s = act(s, { type: 'cmd', userId: 1, fromUserId: 2, delta: -5 }, 1, T0 + MERGE_MS + 1);
    s = undoLast(s, seats).state;
    expect(viewFor(s, seats).players[1]).toMatchObject({ life: 38, cmd: { 2: 2 } });
  });

  it('salta le voci di chi non è più seduto', () => {
    let s = act(null, { type: 'life', userId: 1, delta: -2 });
    s = act(s, { type: 'life', userId: 2, delta: -9 }, 1, T0 + MERGE_MS + 1);
    const u = undoLast(s, [1, 3]);
    expect(u.undone.userId).toBe(1);
    expect(viewFor(u.state, [1, 3]).players[1].life).toBe(40);
  });

  it(`tiene al massimo ${HISTORY_MAX} voci`, () => {
    let s = null;
    for (let i = 0; i < HISTORY_MAX + 10; i++) s = act(s, { type: 'life', userId: 1 + (i % 3), delta: -1 }, 1, T0 + i);
    expect(viewFor(s, seats).history).toHaveLength(HISTORY_MAX);
  });

  it('il reset (stato null) azzera anche lo storico', () => {
    expect(viewFor(null, seats).history).toEqual([]);
  });
});

describe('ordine dei posti (seatOrder)', () => {
  const four = [1, 2, 3, 4];

  it("di default segue l'ordine di seduta", () => {
    expect(seatOrderOf(null, four)).toEqual([1, 2, 3, 4]);
    expect(viewFor(null, four).seatOrder).toEqual([1, 2, 3, 4]);
  });

  it('accetta solo una permutazione esatta dei seduti', () => {
    expect(setSeatOrder(null, four, [3, 1, 4, 2]).state.seatOrder).toEqual([3, 1, 4, 2]);
    expect(setSeatOrder(null, four, ['3', '1', '4', '2']).state.seatOrder).toEqual([3, 1, 4, 2]);
    for (const bad of [[1, 2, 3], [1, 2, 3, 4, 5], [1, 1, 2, 3], [1, 2, 3, 9], [1, 2, 3, 2.5], ['a', 2, 3, 4], [null, 2, 3, 4], ['', 2, 3, 4], 'x', null, undefined]) {
      expect(setSeatOrder(null, four, bad).error).toBeTruthy();
    }
  });

  it('non tocca punteggi né storico (non si annulla con Annulla)', () => {
    let s = applyAction(null, four, { type: 'life', userId: 2, delta: -7 }, 1, 1000).state;
    s = setSeatOrder(s, four, [4, 3, 2, 1], 2000).state;
    const v = viewFor(s, four);
    expect(v.players[2].life).toBe(33);
    expect(v.history).toHaveLength(1);
    const u = undoLast(s, four, 3000);
    expect(viewFor(u.state, four).players[2].life).toBe(40);
    expect(viewFor(u.state, four).seatOrder).toEqual([4, 3, 2, 1]);
  });

  it('sopravvive a tocchi e annulla successivi', () => {
    let s = setSeatOrder(null, four, [2, 1, 4, 3]).state;
    s = applyAction(s, four, { type: 'poison', userId: 1, delta: 1 }).state;
    expect(s.seatOrder).toEqual([2, 1, 4, 3]);
    s = undoLast(s, four).state;
    expect(s.seatOrder).toEqual([2, 1, 4, 3]);
  });

  it('se cambiano i seduti si ricalcola: chi si alza sparisce, chi arriva va in fondo', () => {
    const s = setSeatOrder(null, four, [4, 3, 2, 1]).state;
    expect(seatOrderOf(s, [1, 2, 4])).toEqual([4, 2, 1]);
    expect(seatOrderOf(s, [1, 2, 3, 4, 7])).toEqual([4, 3, 2, 1, 7]);
    expect(viewFor(s, [2, 5, 3]).seatOrder).toEqual([3, 2, 5]);
    // id duplicati o spazzatura nel JSON salvato non rompono la permutazione
    expect(seatOrderOf({ seatOrder: [3, 3, 'x', 1] }, [1, 2, 3])).toEqual([3, 1, 2]);
  });

  it('dopo un cambio di seduti il vecchio ordine non è più valido: serve una permutazione dei nuovi', () => {
    expect(setSeatOrder(null, [1, 2, 4], [4, 3, 2, 1]).error).toBeTruthy();
    expect(setSeatOrder(null, [1, 2, 4], [4, 2, 1]).state.seatOrder).toEqual([4, 2, 1]);
  });

  it("il ripristino azzera i punteggi ma tiene l'ordine dei posti", () => {
    expect(resetState(null, four)).toBeNull();
    expect(resetState(applyAction(null, four, { type: 'life', userId: 1, delta: -1 }).state, four)).toBeNull();
    const s = applyAction(setSeatOrder(null, four, [4, 3, 2, 1]).state, four, { type: 'life', userId: 1, delta: -9 }).state;
    const r = resetState(s, four);
    expect(r).toEqual({ seatOrder: [4, 3, 2, 1] });
    const v = viewFor(r, four);
    expect(v.players[1].life).toBe(40);
    expect(v.history).toEqual([]);
    expect(v.seatOrder).toEqual([4, 3, 2, 1]);
  });
});
