import { describe, it, expect } from 'vitest';
import { viewFor, applyAction, eliminationOf, START_LIFE } from './scoreboard.js';

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
