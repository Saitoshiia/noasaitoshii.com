const FIELD_LABELS = {
  eventName: 'Event / project',
  inquiryType: 'Inquiry type',
  locationType: 'Location',
  venueName: 'Venue',
  venueAddress: 'Venue address / city',
  city: 'City',
  country: 'Country',
  estimatedAttendance: 'Estimated attendance',
  ageRestriction: 'Age restriction',
  productionProvided: 'Production provided',
  dataCenter: 'Data center',
  world: 'World',
  wardPlot: 'Ward / plot',
  platform: 'Platform',
  channelUrl: 'Channel URL',
  techRequirements: 'Technical requirements',
  startAt: 'Starts',
  endAt: 'Ends',
  timezone: 'Timezone',
  contactName: 'Contact',
  contactEmail: 'Email',
  organization: 'Organization',
  website: 'Website',
  genres: 'Genres / direction',
  vibe: 'Room / vibe',
  notes: 'Notes',
  feeAccepted: 'Professional fee',
  privacyAccepted: 'Privacy acknowledgement',
}

const ALLOWED_FIELDS = Object.keys(FIELD_LABELS)
const FRIENDLY_VALUES = {
  performance: 'Performance',
  collaboration: 'Collaboration',
  press: 'Press / interview',
  other: 'Something else',
  irl: 'In person',
  ffxiv: 'FFXIV',
  stream: 'Stream / online',
  undecided: 'Not decided',
}

const getValue = (form, name) => {
  const fields = Array.from(form.elements).filter((field) => field.name === name && !field.disabled)
  const selected = fields.find((field) => field.type === 'radio' ? field.checked : true)
  if (!selected) return ''
  if (selected.type === 'checkbox') return selected.checked
  return selected.value.trim()
}

const serializeInquiry = (form) => Object.fromEntries(
  ALLOWED_FIELDS
    .map((name) => [name, getValue(form, name)])
    .filter(([, value]) => value !== ''),
)

const rootTurnstileToken = (form) => form.querySelector('[name="cf-turnstile-response"]')?.value || ''

const toRequestPayload = (form) => ({
  ...serializeInquiry(form),
  companyFax: getValue(form, 'companyFax'),
  turnstileToken: rootTurnstileToken(form),
})

const validateDateRange = (form) => {
  const start = form.elements.namedItem('startAt')
  const end = form.elements.namedItem('endAt')
  end.setCustomValidity(
    start.value && end.value && end.value <= start.value
      ? 'End time must be later than the start time.'
      : '',
  )
}

const showPanel = (root, panel) => {
  root.querySelector('[data-edit-panel]').hidden = panel !== 'edit'
  root.querySelector('[data-review-panel]').hidden = panel !== 'review'
  root.querySelector('[data-success-panel]').hidden = panel !== 'success'
  root.querySelector('[data-progress-edit]').toggleAttribute('aria-current', panel === 'edit')
  root.querySelector('[data-progress-review]').toggleAttribute('aria-current', panel === 'review')
  root.querySelector('[data-progress-sent]').toggleAttribute('aria-current', panel === 'success')
}

const formatReviewValue = (name, value) => {
  if (name === 'feeAccepted' || name === 'privacyAccepted') return value ? 'Acknowledged' : 'Not acknowledged'
  if (name === 'startAt' || name === 'endAt') {
    const date = new Date(value)
    if (!Number.isNaN(date.valueOf())) {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    }
  }
  return FRIENDLY_VALUES[value] || String(value)
}

const renderReview = (root, payload) => {
  const list = root.querySelector('[data-review-list]')
  list.replaceChildren()
  Object.entries(payload).forEach(([name, value]) => {
    const row = document.createElement('div')
    const term = document.createElement('dt')
    const detail = document.createElement('dd')
    term.textContent = FIELD_LABELS[name]
    detail.textContent = formatReviewValue(name, value)
    row.append(term, detail)
    list.append(row)
  })
}

const showErrors = (root, form) => {
  const summary = root.querySelector('[data-error-summary]')
  const list = root.querySelector('[data-error-list]')
  const invalid = Array.from(form.elements).filter((field) => field.willValidate && !field.validity.valid)
  list.replaceChildren()
  const seen = new Set()

  invalid.forEach((field) => {
    const target = field.type === 'radio'
      ? form.elements.namedItem(field.name)?.[0] || field
      : field
    if (seen.has(target)) return
    seen.add(target)
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = `#${target.id}`
    link.textContent = `${FIELD_LABELS[field.name] || field.labels?.[0]?.textContent?.trim() || 'This field'}: ${field.validationMessage}`
    link.addEventListener('click', (event) => {
      event.preventDefault()
      target.focus()
    })
    item.append(link)
    list.append(item)
  })

  summary.hidden = invalid.length === 0
  if (invalid.length) summary.focus()
  return invalid.length === 0
}

const initForm = (root) => {
  if (root.dataset.initialized === 'true') return
  root.dataset.initialized = 'true'

  const form = root.querySelector('[data-booking-form]')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  root.querySelector('[data-timezone]').value = timezone
  root.querySelector('[data-timezone-display]').value = timezone

  const setLocation = () => {
    const locationType = getValue(form, 'locationType')
    root.querySelectorAll('[data-location-section]').forEach((section) => {
      const active = section.dataset.locationSection === locationType
      section.hidden = !active
      section.querySelectorAll('input, textarea, select').forEach((field) => {
        field.disabled = !active
      })
    })
  }

  form.elements.namedItem('locationType').forEach((field) => {
    field.addEventListener('change', setLocation)
  })
  setLocation()

  root.querySelector('[data-review-button]').addEventListener('click', () => {
    validateDateRange(form)
    if (!showErrors(root, form)) return
    const payload = serializeInquiry(form)
    renderReview(root, payload)
    root.querySelector('[data-error-summary]').hidden = true
    showPanel(root, 'review')
    root.querySelector('#booking-review-title').focus()
  })

  root.querySelector('[data-edit-button]').addEventListener('click', () => {
    showPanel(root, 'edit')
    root.querySelector('[data-review-button]').focus()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    validateDateRange(form)
    if (!showErrors(root, form)) {
      showPanel(root, 'edit')
      return
    }

    const submit = root.querySelector('[data-submit-button]')
    const status = root.querySelector('[data-submit-status]')
    submit.disabled = true
    submit.textContent = 'Sending…'
    root.dataset.state = 'pending'
    status.textContent = 'Sending your inquiry securely…'

    try {
      const response = await fetch('/api/booking-inquiries', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(toRequestPayload(form)),
      })
      if (!response.ok) throw new Error('The inquiry could not be sent.')
      root.dataset.state = 'success'
      showPanel(root, 'success')
      root.querySelector('[data-success-panel]').focus()
      form.reset()
      setLocation()
    } catch {
      root.dataset.state = 'error'
      status.textContent = 'Something interrupted the send. Your details are still here. Please try again.'
      submit.disabled = false
      submit.textContent = 'Try again'
      submit.focus()
    }
  })
}

export const initBookingInquiryForms = () => {
  document.querySelectorAll('[data-booking-inquiry]').forEach(initForm)
}
