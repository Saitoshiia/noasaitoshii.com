import { sets } from './sets.js'

export const epk = {
  positioning: 'Electronic journeys between the dance floor and the metaverse.',
  introduction:
    'Noa Saitoshii is a San Francisco-based DJ and multidisciplinary artist known for building patient, emotionally coherent journeys across melodic house, progressive, techno, and trance.',
  formats: ['Solo DJ', 'B2B', 'IRL', 'Metaverse', 'Livestream'],
  shortBio:
    'Noa Saitoshii is a San Francisco-based DJ and multidisciplinary artist creating immersive electronic music experiences across physical and virtual worlds. His sets move from melodic house and progressive grooves into techno pressure and uplifting trance, guided by patient storytelling, fluid transitions, and a close reading of the room. Years of live broadcasting and community-led events have shaped a performance style that can hold both intimate listening spaces and high-energy dance floors. Beyond the booth, Noa brings a background in professional graphic design to the atmosphere surrounding the music. He is the founder and creative director of Saitoshiia, an international event community and virtual-world project spanning original venues, recurring parties, livestreams, and real-world appearances. His performance history includes direct support, B2B sets, and shared stages with established electronic artists across the Bay Area and online.',
  longBio: [
    'Noa Saitoshii is a San Francisco-based DJ and multidisciplinary artist creating immersive electronic music experiences across physical and virtual worlds. His sound moves fluidly through melodic house, progressive, techno, and trance, not as disconnected genres, but as different emotional intensities within one unfolding journey. Patient openings, elegant transitions, and earned peaks define a style built around reading the room rather than forcing a predetermined arc.',
    'Years of livestreaming and recurring event production gave Noa an unusually deep performance laboratory before his growing run of real-world appearances. That experience shaped both his technical calm and his ability to create connection across very different settings: an intimate warm-up, a late-night club room, an outdoor melodic gathering, or a virtual venue filled by an international audience. Selected performance contexts include direct support for Daxson, a B2B performance with Dave Dresden, and bills or stages alongside Gabriel & Dresden, Morgan Page, Valentina Soto, Triode, Donald Glaude, and Monic.',
    'Noa’s work extends beyond the booth. A former professional graphic designer, he approaches events as complete authored environments: music, identity, spatial design, visual atmosphere, hospitality, and community. He is the founder and creative director of Saitoshiia, a world and events organization that grew from Final Fantasy XIV nightlife into an interconnected family of original venues, recurring parties, livestreams, and IRL collaborations. Whether he is supporting a touring artist or opening a doorway into the metaverse, the objective is the same: build a room people can feel themselves become part of.',
  ],
  music: [
    { ...sets[0], role: 'Featured journey', note: 'A melodic, progressive selection that represents Noa’s warm, patient, emotionally led register.' },
    { ...sets[1], role: 'Peak-time register', note: 'A live Obsidian set showing the harder techno-rave edge of Noa’s range.' },
    { ...sets[2], role: 'Open-air register', note: 'Liquid drum & bass, melodic breaks, and house built for a bright communal setting.' },
  ],
  proof: [
    {
      relationship: 'Direct support',
      artist: 'Daxson',
      context: 'Aura Nightclub · San Jose · July 2026',
      detail: 'Noa Saitoshii B2B Petirwyn opened the main room for Daxson’s Bay Area debut.',
      href: '/events/drop-daxson-aura-2026-07-25',
    },
    {
      relationship: 'B2B performance',
      artist: 'Dave Dresden',
      context: 'Club Quarantine anniversary stream',
      detail: 'An invited in-person B2B following the Gabriel & Dresden Starlight Gala metaverse event.',
    },
    {
      relationship: 'Selected support & shared stages',
      artist: 'Gabriel & Dresden · Morgan Page · Valentina Soto · Triode · Donald Glaude · Monic',
      context: 'Bay Area clubs · Livestreams · Metaverse events',
      detail: 'Selected contexts only; each name represents a documented performance bill, support slot, or shared-stage appearance.',
    },
  ],
  capabilities: [
    ['Home market', 'San Francisco Bay Area'],
    ['Sound', 'Melodic house · Progressive · Techno · Trance'],
    ['Performance', 'Solo · B2B · Opening · Club · Livestream'],
    ['World', 'IRL · Twitch · Final Fantasy XIV metaverse'],
  ],
}
