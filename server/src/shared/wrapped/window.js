const WINDOW_START_MONTH = 12
const WINDOW_START_DAY = 15
const TIME_ZONE = process.env.WRAPPED_TIME_ZONE || 'Europe/Tallinn'

/** Calendar date and time in the configured zone, independent of server TZ. */
function zonedParts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? 0 : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function isoInZone({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  // Build the UTC instant that shows this wall clock time in the zone: guess,
  // then correct by the offset the zone actually applied.
  const guess = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset = guess - new Date(
    new Date(guess).toLocaleString('en-US', { timeZone }),
  ).getTime()
  return new Date(guess + offset)
}

/**
 * The yearly recap is seasonal: it opens on 15 December and closes at the end
 * of 1 January, covering the year that just ended.
 */
export function wrappedWindow(now = new Date(), timeZone = TIME_ZONE) {
  const local = zonedParts(now, timeZone)
  const opensThisCycle = local.month === WINDOW_START_MONTH && local.day >= WINDOW_START_DAY
  const inJanuary = local.month === 1 && local.day === 1
  const available = opensThisCycle || inJanuary

  // In December the recap is about the year that is ending, in January about
  // the one that just ended.
  const recapYear = inJanuary ? local.year - 1 : local.year
  const opensAt = isoInZone({ year: recapYear, month: WINDOW_START_MONTH, day: WINDOW_START_DAY }, timeZone)
  const closesAt = isoInZone({ year: recapYear + 1, month: 1, day: 2 }, timeZone)

  return {
    available,
    year: recapYear,
    opens_at: opensAt.toISOString(),
    closes_at: closesAt.toISOString(),
    time_zone: timeZone,
  }
}
