import { epk } from '../../data/epk.js'

export const prerender = true

export function GET() {
  const body = [
    'NOA SAITOSHII: PRESS BIOGRAPHIES',
    '',
    'Approved spelling: Noa Saitoshii',
    'Artist website: https://noasaitoshii.com',
    'Booking and press: contact@saitoshii.com',
    '',
    'SHORT BIOGRAPHY',
    '',
    epk.shortBio,
    '',
    'FULL BIOGRAPHY',
    '',
    ...epk.longBio.flatMap((paragraph) => [paragraph, '']),
  ].join('\n').trimEnd() + '\n'

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
