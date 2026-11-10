// Shared with noasaitoshii.com and saitoshiia.com: keep both copies identical.
import { getEffectiveEventStatus, toEpoch } from './event-lifecycle.mjs'

export const isEventLiveAt = (event, now = new Date()) => {
  return Boolean(event) && getEffectiveEventStatus(event, now) === 'live'
}

export const getLiveEventsAt = (source, now = new Date()) =>
  source
    .filter((event) => isEventLiveAt(event, now))
    .sort((a, b) => toEpoch(a.startsAtUtc) - toEpoch(b.startsAtUtc))

export const getCurrentSetAt = (event, now = new Date()) => {
  if (!isEventLiveAt(event, now) || !Array.isArray(event.setTimes)) return null
  const current = toEpoch(now)
  return event.setTimes.find((set) => {
    const starts = toEpoch(set.startsAtUtc)
    const ends = toEpoch(set.endsAtUtc)
    return starts !== null && ends !== null && starts < ends && current >= starts && current < ends
  }) ?? null
}

// The set that starts next: after the current set ends, or after now between sets.
export const getNextSetAt = (event, now = new Date()) => {
  if (!isEventLiveAt(event, now) || !Array.isArray(event.setTimes)) return null
  const currentSet = getCurrentSetAt(event, now)
  const after = currentSet ? toEpoch(currentSet.endsAtUtc) : toEpoch(now)
  return event.setTimes
    .filter((set) => set !== currentSet && toEpoch(set.startsAtUtc) !== null && toEpoch(set.startsAtUtc) >= after)
    .sort((a, b) => toEpoch(a.startsAtUtc) - toEpoch(b.startsAtUtc))[0] ?? null
}

export const getLivePresentationAt = (event, now = new Date()) => {
  if (!isEventLiveAt(event, now)) return null
  const currentSet = getCurrentSetAt(event, now)
  const nextSet = getNextSetAt(event, now)
  const streamUrl = currentSet?.streamUrl ?? event.streamUrl ?? null
  return {
    currentSet,
    nextSet,
    lineupLine: [currentSet && `Live now: ${currentSet.name}`, nextSet && `Up next: ${nextSet.name}`]
      .filter(Boolean)
      .join('  →  ') || null,
    streamUrl,
    headline: currentSet ? `${currentSet.name} is live now` : `${event.title} is happening now`,
    streamCta: streamUrl
      ? currentSet
        ? `Join ${currentSet.name}'s stream`
        : 'Watch the event live'
      : null,
  }
}

export const formatStreamDestination = (streamUrl) => {
  if (!streamUrl) return null
  try {
    const url = new URL(streamUrl)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`
  } catch {
    return null
  }
}

const TWITCH_RESERVED_PATHS = new Set(['videos', 'directory', 'p', 'settings', 'search', 'downloads'])

// Returns the Twitch channel login for a channel URL, or null for any other URL.
export const getTwitchChannel = (streamUrl) => {
  try {
    const url = new URL(streamUrl)
    if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) return null
    const channel = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase()
    if (!channel || TWITCH_RESERVED_PATHS.has(channel) || !/^[a-z0-9_]{3,25}$/.test(channel)) return null
    return channel
  } catch {
    return null
  }
}

// Twitch player URL. Twitch requires `parent` to match the embedding host.
// Pages load it only after a visitor clicks (click-to-load keeps Twitch cookies
// off the page), so it may start unmuted.
export const getTwitchEmbedUrl = (streamUrl, parentHost, { muted = true } = {}) => {
  const channel = getTwitchChannel(streamUrl)
  if (!channel || !parentHost) return null
  const url = new URL('https://player.twitch.tv/')
  url.searchParams.set('channel', channel)
  url.searchParams.set('parent', parentHost)
  url.searchParams.set('muted', String(muted))
  url.searchParams.set('autoplay', 'true')
  return url.toString()
}
