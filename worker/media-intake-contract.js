const GIB = 1024 ** 3
const MIB = 1024 ** 2

export const MEDIA_INTAKE_DEFAULTS = Object.freeze({
  maxFilesPerSession: 12,
  maxFileBytes: 5 * GIB,
  maxSessionBytes: 10 * GIB,
  maxDailyBytes: 20 * GIB,
  maxFailedInviteAttemptsPerHour: 20,
  maxSessionsPerIpPerHour: 120,
  partBytes: 16 * MIB,
  sessionLifetimeSeconds: 72 * 60 * 60,
  sniffBytes: 64 * 1024,
})

export const ALLOWED_MEDIA = Object.freeze({
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.heic': ['image/heic', 'image/heif'],
  '.heif': ['image/heic', 'image/heif'],
  '.mov': ['video/quicktime', 'video/mp4'],
  '.mp4': ['video/mp4', 'video/quicktime'],
  '.m4v': ['video/mp4', 'video/quicktime'],
})

export const MEDIA_INTAKE_CONSENT = Object.freeze({
  version: 'media-use-v1-2026-07-30',
  authorityStatement: 'I confirm I created these files or have permission from the creator to share them.',
  licenseStatement: 'I give Noa Saitoshii non-exclusive, worldwide, royalty-free permission to store, edit, reproduce, publish, and share these files for artist promotion and social media, with credit according to my selection.',
})

export const CREDIT_PREFERENCES = Object.freeze(['social-handle', 'name', 'no-credit'])

const SAFE_TEXT_MAX = Object.freeze({
  contributorName: 80,
  handle: 80,
  email: 254,
  creditPreference: 32,
  eventLabel: 120,
  note: 500,
  originalName: 255,
})

export class IntakeError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'IntakeError'
    this.code = code
    this.status = status
  }
}

export function extensionOf(filename) {
  if (typeof filename !== 'string') return ''
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] ?? ''
}

export function cleanText(value, field) {
  if (value == null) return ''
  if (typeof value !== 'string') {
    throw new IntakeError('invalid_text', `${field} must be text.`)
  }

  const cleaned = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const max = SAFE_TEXT_MAX[field] ?? 255
  if (cleaned.length > max) {
    throw new IntakeError('text_too_long', `${field} is too long.`)
  }
  return cleaned
}

export function validateFileDescriptor(file, defaults = MEDIA_INTAKE_DEFAULTS) {
  if (!file || typeof file !== 'object') {
    throw new IntakeError('invalid_file', 'Each upload must include file details.')
  }

  const originalName = cleanText(file.name, 'originalName')
  const extension = extensionOf(originalName)
  const allowedTypes = ALLOWED_MEDIA[extension]
  if (!allowedTypes) {
    throw new IntakeError(
      'unsupported_extension',
      'Only JPG, PNG, HEIC, HEIF, MOV, MP4, and M4V files are accepted.',
    )
  }

  const bytes = Number(file.size)
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new IntakeError('invalid_size', `${originalName} has an invalid size.`)
  }
  if (bytes > defaults.maxFileBytes) {
    throw new IntakeError('file_too_large', `${originalName} is larger than the per-file limit.`, 413)
  }

  const browserType = typeof file.type === 'string' ? file.type.toLowerCase() : ''
  if (browserType && !allowedTypes.includes(browserType)) {
    throw new IntakeError(
      'type_mismatch',
      `${originalName} does not match its browser-reported media type.`,
    )
  }

  const lastModified = file.lastModified == null ? 0 : Number(file.lastModified)
  if (!Number.isSafeInteger(lastModified) || lastModified < 0) {
    throw new IntakeError('invalid_last_modified', `${originalName} has invalid file metadata.`)
  }

  return { originalName, extension, bytes, browserType, lastModified }
}

export function validateSessionRequest(payload, defaults = MEDIA_INTAKE_DEFAULTS) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new IntakeError('invalid_request', 'Upload details are missing.')
  }

  const files = Array.isArray(payload.files) ? payload.files : []
  if (files.length === 0) {
    throw new IntakeError('empty_session', 'Choose at least one photo or video.')
  }
  if (files.length > defaults.maxFilesPerSession) {
    throw new IntakeError(
      'too_many_files',
      `Choose no more than ${defaults.maxFilesPerSession} files at once.`,
      413,
    )
  }

  const validatedFiles = files.map((file) => validateFileDescriptor(file, defaults))
  const totalBytes = validatedFiles.reduce((total, file) => total + file.bytes, 0)
  if (!Number.isSafeInteger(totalBytes) || totalBytes > defaults.maxSessionBytes) {
    throw new IntakeError('session_too_large', 'This group of files is over the upload limit.', 413)
  }

  const contributorName = cleanText(payload.contributorName, 'contributorName')
  const handle = cleanText(payload.handle, 'handle')
  const email = cleanText(payload.email, 'email').toLowerCase()
  if (!contributorName && !handle) {
    throw new IntakeError('identity_required', 'Add your name or social handle so Noa knows who sent these files.')
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new IntakeError('invalid_email', 'Enter a valid email address or leave it blank.')
  }

  const creditPreference = cleanText(payload.creditPreference, 'creditPreference')
  if (!CREDIT_PREFERENCES.includes(creditPreference)) {
    throw new IntakeError('credit_preference_required', 'Choose how you would like to be credited.')
  }
  if (creditPreference === 'social-handle' && !handle) {
    throw new IntakeError('handle_required_for_credit', 'Add a social handle or choose a different credit option.')
  }
  if (creditPreference === 'name' && !contributorName) {
    throw new IntakeError('name_required_for_credit', 'Add your name or choose a different credit option.')
  }

  if (
    payload.consentVersion !== MEDIA_INTAKE_CONSENT.version
    || payload.confirmsAuthority !== true
    || payload.grantsMediaLicense !== true
  ) {
    throw new IntakeError(
      'consent_required',
      'Both permission confirmations are required before files can be sent.',
    )
  }

  return {
    contributorName,
    handle,
    email,
    creditPreference,
    note: cleanText(payload.note, 'note'),
    consent: {
      ...MEDIA_INTAKE_CONSENT,
      confirmsAuthority: true,
      grantsMediaLicense: true,
    },
    files: validatedFiles,
    totalBytes,
  }
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

function hasSignature(bytes, signature, offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])
const QUICKTIME_BRANDS = new Set(['qt  '])
const VIDEO_BRANDS = new Set([
  'avc1', 'dash', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'isom',
  'm4v ', 'mp41', 'mp42', 'mp71', 'msnv',
])

export function sniffMediaType(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.length >= 3 && hasSignature(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', family: 'jpeg' }
  }
  if (bytes.length >= 8 && hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', family: 'png' }
  }

  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brands = new Set()
    for (let offset = 8; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
      brands.add(ascii(bytes, offset, 4).toLowerCase())
    }
    if ([...brands].some((brand) => HEIF_BRANDS.has(brand))) {
      return { mime: 'image/heic', family: 'heif' }
    }
    if ([...brands].some((brand) => QUICKTIME_BRANDS.has(brand))) {
      return { mime: 'video/quicktime', family: 'video' }
    }
    if ([...brands].some((brand) => VIDEO_BRANDS.has(brand))) {
      return { mime: 'video/mp4', family: 'video' }
    }
  }

  return null
}

export function signatureMatchesExtension(extension, detected) {
  if (!detected) return false
  if (extension === '.jpg' || extension === '.jpeg') return detected.family === 'jpeg'
  if (extension === '.png') return detected.family === 'png'
  if (extension === '.heic' || extension === '.heif') return detected.family === 'heif'
  if (extension === '.mov' || extension === '.mp4' || extension === '.m4v') {
    return detected.family === 'video'
  }
  return false
}

export function safeStorageSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80)
}

export function safeDownloadName(value) {
  const cleaned = cleanText(value, 'originalName')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/[\\/"<>:|?*]/g, '_')
    .replace(/^\.+/, '')
  return cleaned || 'media'
}
