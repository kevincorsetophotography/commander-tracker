import MyDecks from '../components/MyDecks'

// /mazzi: griglia completa dei propri mazzi, con ricerca e ordinamento (vedi components/MyDecks).
export default function DecksPage() {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <MyDecks />
    </div>
  )
}
