// Rigenera GUIDA_UTENTE.md (radice del repo) dai contenuti della guida in-app,
// così le due versioni dicono sempre la stessa cosa.
// Uso: cd frontend && npm run guide:md
import { writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
// il frontend non è "type": "module": il modulo dei contenuti si importa come sorgente ESM
const src = readFileSync(resolve(here, '..', 'src', 'pages', 'guida', 'guideContent.js'), 'utf8')
const { CHAPTERS, FAQ } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
const img = (name) => `docs/img/guida/${name}.webp`
const out = []
const push = (...l) => out.push(...l)

push('# 🐸 Commanderone · Guida all’app', '')
push('Tutto quello che puoi fare nel portale del gruppo **Commanderone Villastellone**, dal primo accesso al segnapunti in mezzo al tavolo.', '')
push('> Questa guida è anche dentro l’app: tocca il tuo avatar → **Guida utente** (pagina `/guida`).', '')
push('## Indice', '')
CHAPTERS.forEach((c, i) => push(`${i + 1}. [${c.title}](#${c.id})`))
push(`${CHAPTERS.length + 1}. [Domande frequenti](#domande-frequenti)`, '', '---', '')

const shot = (b) => {
  push(`<img src="${img(b.shot)}" alt="${b.alt}" width="${b.flat ? 390 : b.narrow ? 300 : 360}">`, '')
  if (b.caption) push(`*${b.caption}*`, '')
}

CHAPTERS.forEach((c, i) => {
  push(`<a id="${c.id}"></a>`, '', `## ${i + 1}. ${c.title}`, '', `**${c.lede}**`, '')
  for (const b of c.blocks) {
    if (b.h) push(`### ${b.h}`, '')
    else if (b.p) push(b.p, '')
    else if (b.steps) { b.steps.forEach((s, k) => push(`${k + 1}. ${s}`)); push('') }
    else if (b.list) { b.list.forEach(s => push(`- ${s}`)); push('') }
    else if (b.tip) push(`> 💡 ${b.tip}`, '')
    else if (b.warn) push(`> ⚠️ ${b.warn}`, '')
    else if (b.table) {
      push(`| ${b.table.head.join(' | ')} |`, `|${b.table.head.map(() => '---').join('|')}|`)
      b.table.rows.forEach(r => push(`| ${r.join(' | ')} |`))
      push('')
    }
    else if (b.shot) { if (!b.optional) shot(b) }
    else if (b.shots) b.shots.forEach(shot)
    else if (b.gestures) {
      shot({ shot: b.gestures.shot, alt: b.gestures.alt, narrow: true })
      b.gestures.items.forEach((s, k) => push(`${k + 1}. ${s}`))
      push('')
    }
  }
  push('---', '')
})

push('<a id="domande-frequenti"></a>', '', '## Domande frequenti', '')
FAQ.forEach(([q, a]) => push(`**${q}**  `, a, ''))
push('---', '', '*Buone partite, e che vinca il mazzo migliore. 🐸*', '')
push('<!-- File generato da frontend/scripts/build-guide-md.mjs: modifica frontend/src/pages/guida/guideContent.js e rilancia `npm run guide:md`. -->', '')

writeFileSync(resolve(root, 'GUIDA_UTENTE.md'), out.join('\n'))
console.log('GUIDA_UTENTE.md aggiornato:', CHAPTERS.length, 'capitoli,', FAQ.length, 'domande')
