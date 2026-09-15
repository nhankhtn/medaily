import { toISODate, type ISODate } from '@/lib/dates'

/**
 * The Vietnamese lunar calendar, computed rather than looked up.
 *
 * Tết and Giỗ Tổ move every year, so a table of dates would go stale and would
 * have to be topped up by hand forever. These are the astronomical formulas
 * behind the standard Vietnamese algorithm (Hồ Ngọc Đức, after Jean Meeus's
 * *Astronomical Algorithms*): new moons and the sun's longitude, resolved in
 * the timezone the calendar is kept in.
 *
 * The timezone matters and is not decoration. A new moon falling either side of
 * midnight decides which day the month starts on, which is why Vietnam and
 * China occasionally keep Tết a day apart — Vietnam works to UTC+7.
 */
const VN_TIMEZONE = 7

const DEG = Math.PI / 180

/** Days between two new moons, on average. */
const SYNODIC_MONTH = 29.530588853

/** The Julian day of the new moon that opens the lunar month numbering. */
const EPOCH_NEW_MOON = 2415021.076998695

export type LunarDate = {
  day: number
  month: number
  year: number
  /** True for the repeated month an embolismic year inserts. */
  leap: boolean
}

function julianDayFrom(day: number, month: number, year: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3

  const gregorian =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045

  // Before the Gregorian reform of October 1582 the Julian rule applies.
  return gregorian < 2299161
    ? day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083
    : gregorian
}

function dateFromJulianDay(jd: number): { day: number; month: number; year: number } {
  let b = 0
  let c

  if (jd > 2299160) {
    const a = jd + 32044
    b = Math.floor((4 * a + 3) / 146097)
    c = a - Math.floor((b * 146097) / 4)
  } else {
    c = jd + 32082
  }

  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)

  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: b * 100 + d - 4800 + Math.floor(m / 10),
  }
}

/** The instant of the `k`th new moon since January 1900, as a Julian day. */
function newMoon(k: number): number {
  const t = k / 1236.85
  const t2 = t * t
  const t3 = t2 * t

  const mean =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * t2 -
    0.000000155 * t3 +
    0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * DEG)

  const sunAnomaly = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3
  const moonAnomaly = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3
  const latitude = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3

  const correction =
    (0.1734 - 0.000393 * t) * Math.sin(sunAnomaly * DEG) +
    0.0021 * Math.sin(2 * sunAnomaly * DEG) -
    0.4068 * Math.sin(moonAnomaly * DEG) +
    0.0161 * Math.sin(2 * moonAnomaly * DEG) -
    0.0004 * Math.sin(3 * moonAnomaly * DEG) +
    0.0104 * Math.sin(2 * latitude * DEG) -
    0.0051 * Math.sin((sunAnomaly + moonAnomaly) * DEG) -
    0.0074 * Math.sin((sunAnomaly - moonAnomaly) * DEG) +
    0.0004 * Math.sin((2 * latitude + sunAnomaly) * DEG) -
    0.0004 * Math.sin((2 * latitude - sunAnomaly) * DEG) -
    0.0006 * Math.sin((2 * latitude + moonAnomaly) * DEG) +
    0.001 * Math.sin((2 * latitude - moonAnomaly) * DEG) +
    0.0005 * Math.sin((2 * moonAnomaly + sunAnomaly) * DEG)

  // Dynamical time runs ahead of universal time by a slowly changing amount.
  const deltaT =
    t < -11
      ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
      : -0.000278 + 0.000265 * t + 0.000262 * t2

  return mean + correction - deltaT
}

/** The sun's apparent longitude, in radians, at a Julian day. */
function sunLongitude(jd: number): number {
  const t = (jd - 2451545.0) / 36525
  const t2 = t * t

  const anomaly = 357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2
  const meanLongitude = 280.46645 + 36000.76983 * t + 0.0003032 * t2

  const equationOfCentre =
    (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(anomaly * DEG) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * anomaly * DEG) +
    0.00029 * Math.sin(3 * anomaly * DEG)

  const longitude = (meanLongitude + equationOfCentre) * DEG
  return longitude - Math.PI * 2 * Math.floor(longitude / (Math.PI * 2))
}

/** Which of the twelve 30° sectors the sun is in on a given local day. */
function sunSector(localDay: number): number {
  return Math.floor((sunLongitude(localDay - 0.5 - VN_TIMEZONE / 24) / Math.PI) * 6)
}

/** The local day the `k`th new moon falls on. */
function newMoonDay(k: number): number {
  return Math.floor(newMoon(k) + 0.5 + VN_TIMEZONE / 24)
}

/**
 * The day the eleventh month of `year` begins — the month that must contain the
 * winter solstice, which is what anchors the whole lunar year.
 */
function month11Of(year: number): number {
  const offset = julianDayFrom(31, 12, year) - 2415021
  const k = Math.floor(offset / SYNODIC_MONTH)
  const candidate = newMoonDay(k)

  return sunSector(candidate) >= 9 ? newMoonDay(k - 1) : candidate
}

/**
 * Which month of the year is the repeated one: the first month after the
 * eleventh that contains no sector boundary — no "principal term".
 */
function leapMonthOffset(month11: number): number {
  const k = Math.floor((month11 - EPOCH_NEW_MOON) / SYNODIC_MONTH + 0.5)

  let index = 1
  let sector = sunSector(newMoonDay(k + index))
  let previous: number

  do {
    previous = sector
    index += 1
    sector = sunSector(newMoonDay(k + index))
  } while (sector !== previous && index < 14)

  return index - 1
}

export function toLunar(date: ISODate): LunarDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const dayNumber = julianDayFrom(day, month, year)

  const k = Math.floor((dayNumber - EPOCH_NEW_MOON) / SYNODIC_MONTH)
  let monthStart = newMoonDay(k + 1)
  if (monthStart > dayNumber) monthStart = newMoonDay(k)

  let month11 = month11Of(year)
  let nextMonth11 = month11
  let lunarYear: number

  if (month11 >= monthStart) {
    lunarYear = year
    month11 = month11Of(year - 1)
  } else {
    lunarYear = year + 1
    nextMonth11 = month11Of(year + 1)
  }

  const monthsFrom11 = Math.floor((monthStart - month11) / 29)
  let lunarMonth = monthsFrom11 + 11
  let leap = false

  if (nextMonth11 - month11 > 365) {
    const offset = leapMonthOffset(month11)
    if (monthsFrom11 >= offset) {
      lunarMonth = monthsFrom11 + 10
      leap = monthsFrom11 === offset
    }
  }

  if (lunarMonth > 12) lunarMonth -= 12
  if (lunarMonth >= 11 && monthsFrom11 < 4) lunarYear -= 1

  return { day: dayNumber - monthStart + 1, month: lunarMonth, year: lunarYear, leap }
}

/**
 * The solar date of a lunar one, or null when that lunar date does not exist —
 * asking for a leap month in a year that has none.
 */
export function fromLunar(lunar: {
  day: number
  month: number
  year: number
  leap?: boolean
}): ISODate | null {
  const leap = lunar.leap ?? false

  const month11 = lunar.month < 11 ? month11Of(lunar.year - 1) : month11Of(lunar.year)
  const nextMonth11 = lunar.month < 11 ? month11Of(lunar.year) : month11Of(lunar.year + 1)

  let offset = lunar.month - 11
  if (offset < 0) offset += 12

  // Thirteen months between one eleventh month and the next: the year repeats one.
  const embolismic = nextMonth11 - month11 > 365
  if (leap && !embolismic) return null

  if (embolismic) {
    const leapOffset = leapMonthOffset(month11)
    let leapMonth = leapOffset - 2
    if (leapMonth < 0) leapMonth += 12

    if (leap && lunar.month !== leapMonth) return null
    if (leap || offset >= leapOffset) offset += 1
  }

  const k = Math.floor(0.5 + (month11 - EPOCH_NEW_MOON) / SYNODIC_MONTH)
  const monthStart = newMoonDay(k + offset)
  const { day, month, year } = dateFromJulianDay(monthStart + lunar.day - 1)

  return toISODate(new Date(year, month - 1, day))
}
