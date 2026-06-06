// Algoritmi del torneo (puri): dimensionamento pod e abbinamenti.

// Dimensioni dei pod per n giocatori: ognuno 3-5, preferendo 4.
// Es: 3→[3] 4→[4] 5→[5] 6→[3,3] 7→[4,3] 9→[4,5] 11→[4,4,3] 13→[4,4,5]
function podSizes(n) {
  if (n < 3) return [];
  const k = Math.floor(n / 4);
  const r = n % 4;
  if (r === 0) return Array(k).fill(4);
  if (r === 1) return [...Array(k - 1).fill(4), 5]; // n>=5 ⇒ k>=1
  if (r === 2) return [...Array(k - 1).fill(4), 3, 3]; // n>=6 ⇒ k>=1
  return [...Array(k).fill(4), 3]; // r===3
}

// Fisher-Yates, ritorna un nuovo array mescolato.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Suddivide userIds in pod (mescolati) secondo podSizes.
function makePods(userIds) {
  const sizes = podSizes(userIds.length);
  const ids = shuffle(userIds);
  const pods = [];
  let i = 0;
  for (const s of sizes) { pods.push(ids.slice(i, i + s)); i += s; }
  return pods;
}

// Abbinamenti 1v1 del primo turno: mescola e accoppia; dispari ⇒ un bye.
function makePairings(userIds) {
  const ids = shuffle(userIds);
  let bye = null;
  if (ids.length % 2 === 1) bye = ids.pop();
  const pairs = [];
  for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
  return { pairs, bye };
}

module.exports = { podSizes, shuffle, makePods, makePairings };
