import { resolvePortugueseDescription, resolveYouTubeTrailerId } from '../gameMediaResolver'

describe('gameMediaResolver', () => {
  it('should return already-portuguese text immediately', async () => {
    const pt = 'Este é um jogo incrível de luta e ação com heróis da Marvel.'
    const result = await resolvePortugueseDescription('Marvel Tokon', pt)
    expect(result).toBe(pt)
  })

  it('should return fallback description when no text is provided', async () => {
    const result = await resolvePortugueseDescription('Jogo Desconhecido XYZ 123456789')
    expect(result).toContain('Explore e jogue Jogo Desconhecido XYZ 123456789')
    expect(result).toContain('GhostShield')
  })

  it('should handle resolveYouTubeTrailerId gracefully on network or invalid query', async () => {
    const videoId = await resolveYouTubeTrailerId('Marvel Tokon Fighting Souls')
    // Either returns a string ID of 11 characters or null
    if (videoId) {
      expect(typeof videoId).toBe('string')
      expect(videoId.length).toBe(11)
    } else {
      expect(videoId).toBeNull()
    }
  })
})
