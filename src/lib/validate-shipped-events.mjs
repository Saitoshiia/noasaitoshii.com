import { events } from '../data/events.js'
import { validateEvents } from './validate-events.mjs'

const { errors } = validateEvents(events)
if (errors.length) {
  console.error(`Public event validation failed:\n- ${errors.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(`Public event data valid: ${events.length} events.`)
}
