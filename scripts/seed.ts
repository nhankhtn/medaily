import './load-env'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, sql } from 'drizzle-orm'
import {
  accounts,
  achievements,
  bodyMeasurements,
  budgets,
  dailyLogs,
  events,
  financeCategories,
  focusSessions,
  goalMilestones,
  goals,
  habitLogs,
  habits,
  interactions,
  journalEntries,
  notes,
  people,
  plannedBlocks,
  projectTasks,
  projects,
  reminders,
  resources,
  skills,
  topics,
  transactions,
  users,
  weeklyReviews,
  workouts,
} from '../src/lib/db/schema'
import { SINGLE_USER_ID } from '../src/lib/auth/current-user'

/**
 * Spec 32 — deliberately imperfect data: weekday/weekend patterns, a slump, a
 * streak that breaks once, missing days, and correlations planted with noise so
 * the analytics engine has something real but not clean to find.
 *
 * Reproducible: a fixed RNG seed, and it refuses to run against a database
 * that already holds data (use `pnpm db:reset` to start over).
 */
// Only a bare number is a day count; flags like `--force` must not become NaN.
const DAY_ARG = process.argv.slice(2).find((arg) => /^\d+$/.test(arg))
const DAYS = Number(process.env.SEED_DAYS ?? DAY_ARG ?? 90)
const RNG_SEED = 20260907

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(RNG_SEED)
const between = (min: number, max: number) => min + rnd() * (max - min)
const intBetween = (min: number, max: number) => Math.round(between(min, max))
const chance = (p: number) => rnd() < p
const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function isoDate(offsetFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetFromToday)
  return d.toISOString().slice(0, 10)
}

function weekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

const WINS = [
  'Finished the DB indexing task',
  'Shipped the auth refactor',
  'Understood MVCC properly',
  'Ran 5k without stopping',
  'Closed three stale PRs',
  'Wrote the design doc',
]
const PROBLEMS = [
  'Too much YouTube after dinner',
  'Meetings ate the morning',
  'Slept badly, low focus',
  'Context-switched all day',
  'Skipped the workout again',
]
const PRIORITIES = [
  'Study MVCC',
  'Finish the migration script',
  'Review the analytics spec',
  'Gym before work',
  'Write the weekly review',
]
const EXERCISE_TYPES = ['Running', 'Gym', 'Cycling', 'Swimming', 'Walking'] as const

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  const owner = await db.select().from(users).where(eq(users.id, SINGLE_USER_ID)).limit(1)
  if (owner.length === 0) throw new Error('owner row missing — run pnpm db:migrate first')

  /**
   * Seeding is a first-run and development tool, so it refuses to touch a
   * database that already holds data. There is no way to tell a seeded row
   * from a real one — and there should not be: tagging every table with a
   * `is_demo` column to support a "wipe the samples" button that was never
   * built is a column carried for nothing. `pnpm db:reset` is the honest way
   * to start over.
   */
  const [existing] = await db.execute<{ rows: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM daily_logs) +
      (SELECT COUNT(*) FROM habits) +
      (SELECT COUNT(*) FROM goals) +
      (SELECT COUNT(*) FROM projects) +
      (SELECT COUNT(*) FROM transactions) +
      (SELECT COUNT(*) FROM people) AS rows
  `)

  if (Number(existing?.rows ?? 0) > 0 && !process.argv.includes('--force')) {
    console.error(
      `✗ the database already has ${existing?.rows} rows.\n` +
        '  Seeding would add sample data on top of real entries, and nothing\n' +
        '  distinguishes the two afterwards.\n\n' +
        '  To start from scratch:  pnpm db:reset\n' +
        // The `--` matters: without it pnpm consumes `--force` itself.
        '  To add anyway:          pnpm db:seed -- --force',
    )
    process.exit(1)
  }

  console.log(`→ seeding topics`)
  const topicRows = await db
    .insert(topics)
    .values(
      [
        { name: 'Databases', category: 'engineering' },
        { name: 'Distributed systems', category: 'engineering' },
        { name: 'Go', category: 'engineering' },
        { name: 'System design', category: 'engineering' },
        { name: 'English', category: 'language' },
      ].map((t) => ({ ...t, userId: SINGLE_USER_ID })),
    )
    .returning()

  console.log(`→ seeding ${DAYS} days of daily logs`)
  // A two-week slump sits in the middle of the window, and one 2-day gap plus
  // scattered misses keep the streak logic honest.
  const slumpStart = Math.floor(DAYS * 0.45)
  const slumpEnd = slumpStart + 14
  const gapStart = Math.floor(DAYS * 0.2)

  type LogRow = typeof dailyLogs.$inferInsert
  const logRows: LogRow[] = []
  const sessionRows: (typeof focusSessions.$inferInsert)[] = []

  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDate(-i)
    const dayIndex = DAYS - 1 - i
    const wd = weekday(date)
    const weekend = wd >= 6
    const inSlump = dayIndex >= slumpStart && dayIndex < slumpEnd
    const inGap = dayIndex >= gapStart && dayIndex < gapStart + 2

    // Missing days are a fact of life; the app has to read well without them.
    if (inGap || chance(0.06)) continue

    const sleepHours = clamp(
      between(6.2, 8.2) + (weekend ? 0.7 : 0) - (inSlump ? 0.6 : 0),
      4.5,
      10,
    )

    const studyBase = weekend ? between(15, 70) : between(35, 95)
    const study = Math.round(clamp(studyBase * (inSlump ? 0.4 : 1), 0, 240))

    const deepBase = weekend ? between(0, 80) : between(50, 160)
    const deepWork = Math.round(clamp(deepBase * (inSlump ? 0.5 : 1), 0, 300))

    // Roughly four sessions a week, with a run that breaks once.
    const exerciseDay = chance(weekend ? 0.45 : 0.55) && !(inSlump && chance(0.6))
    const exerciseMinutes = exerciseDay ? intBetween(25, 70) : 0

    const readingMinutes = chance(0.6) ? intBetween(10, 45) : 0
    const entertainment = Math.round(
      clamp(between(30, 110) + (weekend ? 55 : 0) + (inSlump ? 60 : 0), 0, 400),
    )
    const english = chance(0.35) ? intBetween(10, 30) : 0

    // Planted correlations, noisy on purpose: sleep and exercise lift energy,
    // heavy entertainment drags it.
    const energyRaw =
      4.6 +
      (sleepHours - 7) * 0.9 +
      (exerciseMinutes > 0 ? 0.6 : 0) +
      (study > 60 ? 0.3 : 0) -
      (entertainment > 150 ? 0.7 : 0) -
      (inSlump ? 0.8 : 0) +
      between(-0.9, 0.9)
    const energy = clamp(Math.round(energyRaw), 1, 10)
    const mood = clamp(energy + intBetween(-1, 1), 1, 10)

    logRows.push({
      userId: SINGLE_USER_ID,
      logDate: date,
      energy,
      mood,
      sleepHours: sleepHours.toFixed(1),
      technicalStudyMinutes: study,
      deepWorkMinutes: deepWork,
      exerciseMinutes,
      exerciseType: exerciseMinutes > 0 ? pick(EXERCISE_TYPES) : null,
      readingMinutes,
      readingPages: readingMinutes > 0 ? Math.round(readingMinutes / 2.2) : null,
      entertainmentMinutes: entertainment,
      englishMinutes: english,
      dailyWin: chance(0.45) ? pick(WINS) : null,
      dailyProblem: chance(0.35) ? pick(PROBLEMS) : null,
      tomorrowPriority: chance(0.4) ? pick(PRIORITIES) : null,
      note: chance(0.15) ? 'Felt scattered but got the important thing done.' : null,
      source: 'import',
    })

    // Some days are logged through focus sessions instead of the quick field,
    // which exercises the `v_daily_effective` precedence rule (spec 5.4).
    if (chance(0.3) && study > 20) {
      const chunks = intBetween(1, 3)
      let remaining = study
      for (let c = 0; c < chunks; c++) {
        const minutes = c === chunks - 1 ? remaining : Math.round(remaining / (chunks - c))
        remaining -= minutes
        if (minutes < 5) continue
        sessionRows.push({
          userId: SINGLE_USER_ID,
          sessionDate: date,
          minutes,
          kind: 'learning',
          topicId: pick(topicRows).id,
          source: 'manual',
        })
      }
    }
  }

  for (let i = 0; i < logRows.length; i += 200) {
    await db.insert(dailyLogs).values(logRows.slice(i, i + 200))
  }
  if (sessionRows.length) {
    for (let i = 0; i < sessionRows.length; i += 200) {
      await db.insert(focusSessions).values(sessionRows.slice(i, i + 200))
    }
  }

  console.log(`→ seeding habits (all four frequency types, linked and manual)`)
  const habitRows = await db
    .insert(habits)
    .values([
      {
        userId: SINGLE_USER_ID,
        name: 'Sleep 7h+',
        category: 'health',
        frequencyType: 'daily',
        targetCount: 1,
        linkedMetric: 'sleep_hours',
        linkedOperator: 'gte',
        linkedThreshold: '7',
        startDate: isoDate(-DAYS),
        sortOrder: 0,
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Study 30 minutes',
        category: 'knowledge',
        frequencyType: 'daily',
        targetCount: 1,
        linkedMetric: 'technical_study_minutes',
        linkedOperator: 'gte',
        linkedThreshold: '30',
        startDate: isoDate(-DAYS),
        sortOrder: 1,
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Entertainment under 1h',
        category: 'life',
        frequencyType: 'daily',
        targetCount: 1,
        linkedMetric: 'entertainment_minutes',
        linkedOperator: 'lte',
        linkedThreshold: '60',
        startDate: isoDate(-DAYS),
        sortOrder: 2,
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Exercise 4× a week',
        category: 'health',
        frequencyType: 'weekly',
        targetCount: 4,
        startDate: isoDate(-DAYS),
        sortOrder: 3,
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Journal',
        category: 'life',
        frequencyType: 'specific_days',
        targetCount: 1,
        weekdays: [1, 3, 5],
        startDate: isoDate(-DAYS),
        sortOrder: 4,
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Review finances',
        category: 'finance',
        frequencyType: 'interval',
        targetCount: 1,
        intervalDays: 7,
        startDate: isoDate(-DAYS),
        sortOrder: 5,
      },
    ])
    .returning()

  console.log(`→ deriving habit logs from the daily rows`)
  const logByDate = new Map(logRows.map((row) => [row.logDate as string, row]))
  const sessionsByDate = new Map<string, number>()
  for (const session of sessionRows) {
    const key = session.sessionDate as string
    sessionsByDate.set(key, (sessionsByDate.get(key) ?? 0) + (session.minutes ?? 0))
  }

  const habitLogRows: (typeof habitLogs.$inferInsert)[] = []
  for (const habit of habitRows) {
    for (const [date, log] of logByDate) {
      if (habit.linkedMetric) {
        const value = (() => {
          switch (habit.linkedMetric) {
            case 'sleep_hours':
              return log.sleepHours === null || log.sleepHours === undefined
                ? null
                : Number(log.sleepHours)
            case 'technical_study_minutes':
              return sessionsByDate.get(date) ?? log.technicalStudyMinutes ?? null
            case 'entertainment_minutes':
              return log.entertainmentMinutes ?? null
            default:
              return null
          }
        })()
        if (value === null) continue
        const threshold = Number(habit.linkedThreshold)
        const met = habit.linkedOperator === 'lte' ? value <= threshold : value >= threshold
        if (!met) continue
        habitLogRows.push({
          userId: SINGLE_USER_ID,
          habitId: habit.id,
          logDate: date,
          count: 1,
          completed: true,
          source: 'derived',
        })
        continue
      }

      // Manual habits: plausible adherence, not perfect adherence.
      if (habit.frequencyType === 'weekly' && (log.exerciseMinutes ?? 0) > 0) {
        habitLogRows.push({
          userId: SINGLE_USER_ID,
          habitId: habit.id,
          logDate: date,
          count: 1,
          completed: true,
          source: 'manual',
        })
      } else if (habit.frequencyType === 'specific_days' && [1, 3, 5].includes(weekday(date))) {
        if (chance(0.7)) {
          habitLogRows.push({
            userId: SINGLE_USER_ID,
            habitId: habit.id,
            logDate: date,
            count: 1,
            completed: true,
            source: 'manual',
          })
        }
      } else if (habit.frequencyType === 'interval' && chance(0.12)) {
        habitLogRows.push({
          userId: SINGLE_USER_ID,
          habitId: habit.id,
          logDate: date,
          count: 1,
          completed: true,
          source: 'manual',
        })
      }
    }
  }

  for (let i = 0; i < habitLogRows.length; i += 500) {
    await db.insert(habitLogs).values(habitLogRows.slice(i, i + 500)).onConflictDoNothing()
  }

  console.log(`→ seeding goals (all three progress modes)`)
  const goalRows = await db
    .insert(goals)
    .values([
      {
        userId: SINGLE_USER_ID,
        name: '300 study minutes per week',
        description: 'Keep learning at a steady weekly rate.',
        category: 'knowledge',
        status: 'active',
        priority: 'high',
        startDate: isoDate(-DAYS),
        progressMode: 'metric',
        metricKey: 'technical_study_minutes',
        metricAggregation: 'sum',
        metricPeriod: 'weekly',
        metricTarget: '300',
        metricDirection: 'at_least',
        recurrence: 'weekly',
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Entertainment under 10h a week',
        category: 'life',
        status: 'active',
        priority: 'medium',
        startDate: isoDate(-DAYS),
        progressMode: 'metric',
        metricKey: 'entertainment_minutes',
        metricAggregation: 'sum',
        metricPeriod: 'weekly',
        metricTarget: '600',
        metricDirection: 'at_most',
        recurrence: 'weekly',
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Ship Personal OS v1',
        description: 'Use it myself for 30 days before adding anything new.',
        category: 'career',
        status: 'active',
        priority: 'high',
        startDate: isoDate(-40),
        targetDate: isoDate(45),
        progressMode: 'milestones',
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Read 12 books this year',
        category: 'knowledge',
        status: 'active',
        priority: 'low',
        startDate: isoDate(-DAYS),
        targetDate: isoDate(200),
        progressMode: 'manual',
        progressManual: '42',
        progressUpdatedAt: new Date(),
      },
    ])
    .returning()

  const milestoneGoal = goalRows.find((g) => g.progressMode === 'milestones')
  if (milestoneGoal) {
    await db.insert(goalMilestones).values([
      {
        goalId: milestoneGoal.id,
        title: 'Daily log + dashboard',
        sortOrder: 0,
        completedAt: new Date(),
        weight: '1',
      },
      { goalId: milestoneGoal.id, title: 'Habits + goals', sortOrder: 1, completedAt: new Date(), weight: '1' },
      { goalId: milestoneGoal.id, title: 'Analytics + insights', sortOrder: 2, weight: '2' },
      { goalId: milestoneGoal.id, title: 'Deploy and use for 30 days', sortOrder: 3, weight: '1' },
    ])
  }

  console.log(`→ seeding one finalized weekly review`)
  const lastWeekStart = (() => {
    const d = new Date()
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    d.setDate(d.getDate() - iso + 1 - 7)
    return d.toISOString().slice(0, 10)
  })()

  await db.insert(weeklyReviews).values({
    userId: SINGLE_USER_ID,
    weekStartDate: lastWeekStart,
    whatWorked: 'Morning study blocks before opening Slack.',
    whatDidnt: 'Evening entertainment crept up after Wednesday.',
    changeNext: 'Phone out of the room after 22:00.',
    topPriority: 'Finish the analytics module.',
    reflection: 'Energy tracked sleep closely this week.',
    finalizedAt: new Date(),
    snapshotVersion: 1,
  })

  console.log(`→ seeding projects, learning resources and the remaining modules`)
  const projectRows = await db
    .insert(projects)
    .values([
      {
        userId: SINGLE_USER_ID,
        name: 'Personal OS',
        description: 'This app. Dogfood it for 30 days before adding anything.',
        status: 'active',
        priority: 'high',
        startDate: isoDate(-40),
      },
      {
        userId: SINGLE_USER_ID,
        name: 'Home lab',
        description: 'Self-hosted backups and monitoring.',
        status: 'on_hold',
        priority: 'low',
        startDate: isoDate(-70),
      },
    ])
    .returning()

  const mainProject = projectRows[0]
  if (mainProject) {
    await db.insert(projectTasks).values(
      [
        { title: 'Daily log form', status: 'done' as const },
        { title: 'Dashboard and score', status: 'done' as const },
        { title: 'Analytics gates', status: 'doing' as const },
        { title: 'Write the README', status: 'todo' as const },
        { title: 'Deploy behind Tailscale', status: 'todo' as const },
      ].map((task, index) => ({
        userId: SINGLE_USER_ID,
        projectId: mainProject.id,
        title: task.title,
        status: task.status,
        sortOrder: index,
        completedAt: task.status === 'done' ? new Date() : null,
      })),
    )

    // Some focus sessions belong to the project, so "time spent" is derivable.
    await db.insert(focusSessions).values(
      Array.from({ length: 12 }, () => ({
        userId: SINGLE_USER_ID,
        sessionDate: isoDate(-intBetween(1, 30)),
        minutes: intBetween(30, 120),
        kind: 'project' as const,
        projectId: mainProject.id,
        source: 'manual' as const,
      })),
    )
  }

  await db.insert(resources).values([
    {
      userId: SINGLE_USER_ID,
      type: 'book',
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      status: 'in_progress',
      progressPercent: 62,
      topicId: topicRows[0]?.id ?? null,
      startedAt: isoDate(-60),
    },
    {
      userId: SINGLE_USER_ID,
      type: 'course',
      title: 'Postgres internals',
      status: 'backlog',
    },
    {
      userId: SINGLE_USER_ID,
      type: 'book',
      title: 'Deep Work',
      author: 'Cal Newport',
      status: 'done',
      rating: 4,
      finishedAt: isoDate(-25),
    },
  ])

  // Health: workouts on the days the daily log recorded exercise.
  const exerciseDays = logRows.filter((row) => (row.exerciseMinutes ?? 0) > 0).slice(-20)
  if (exerciseDays.length > 0) {
    await db.insert(workouts).values(
      exerciseDays.map((row) => ({
        userId: SINGLE_USER_ID,
        performedOn: row.logDate as string,
        type: (row.exerciseType as string) ?? 'Running',
        durationMinutes: row.exerciseMinutes ?? 30,
        rpe: intBetween(4, 9),
      })),
    )
  }

  await db.insert(bodyMeasurements).values(
    Array.from({ length: 14 }, (_, i) => ({
      userId: SINGLE_USER_ID,
      measuredOn: isoDate(-i * 6),
      weightKg: (70 + between(-1.2, 1.2) - i * 0.05).toFixed(1),
      restingHr: intBetween(52, 64),
    })),
  )

  // Finance: two accounts, a handful of categories, a month of transactions.
  const accountRows = await db
    .insert(accounts)
    .values([
      { userId: SINGLE_USER_ID, name: 'Bank', type: 'bank', currency: 'VND', openingBalance: '45000000' },
      { userId: SINGLE_USER_ID, name: 'Cash', type: 'cash', currency: 'VND', openingBalance: '2000000' },
    ])
    .returning()

  const categoryRows = await db
    .insert(financeCategories)
    .values([
      { userId: SINGLE_USER_ID, name: 'Salary', kind: 'income' as const },
      { userId: SINGLE_USER_ID, name: 'Rent', kind: 'expense' as const },
      { userId: SINGLE_USER_ID, name: 'Food', kind: 'expense' as const },
      { userId: SINGLE_USER_ID, name: 'Transport', kind: 'expense' as const },
      { userId: SINGLE_USER_ID, name: 'Learning', kind: 'expense' as const },
    ])
    .returning()

  const bank = accountRows[0]
  const expenseCategories = categoryRows.filter((row) => row.kind === 'expense')

  if (bank && expenseCategories.length > 0) {
    const transactionRows: (typeof transactions.$inferInsert)[] = [
      {
        userId: SINGLE_USER_ID,
        occurredOn: isoDate(-20),
        amount: '32000000',
        currency: 'VND',
        kind: 'income',
        accountId: bank.id,
        categoryId: categoryRows[0]?.id ?? null,
        merchant: 'Employer',
      },
    ]

    for (let i = 0; i < 40; i++) {
      const category = pick(expenseCategories)
      transactionRows.push({
        userId: SINGLE_USER_ID,
        occurredOn: isoDate(-intBetween(0, 28)),
        amount: String(intBetween(50, 900) * 1000),
        currency: 'VND',
        kind: 'expense',
        accountId: bank.id,
        categoryId: category.id,
        merchant: category.name,
      })
    }

    await db.insert(transactions).values(transactionRows)

    const monthStart = `${isoDate(0).slice(0, 7)}-01`
    await db.insert(budgets).values(
      expenseCategories.slice(0, 3).map((category) => ({
        userId: SINGLE_USER_ID,
        categoryId: category.id,
        periodStart: monthStart,
        amount: String(intBetween(3, 9) * 1000000),
      })),
    )
  }

  // Knowledge and journal, including a wiki link between two notes.
  await db.insert(notes).values([
    {
      userId: SINGLE_USER_ID,
      title: 'MVCC',
      bodyMd: 'Multiversion concurrency control keeps a version chain per row. See [[Postgres vacuum]].',
      type: 'concept',
      topicId: topicRows[0]?.id ?? null,
    },
    {
      userId: SINGLE_USER_ID,
      title: 'Postgres vacuum',
      bodyMd: 'Vacuum reclaims dead tuples left behind by MVCC.',
      type: 'concept',
    },
    {
      userId: SINGLE_USER_ID,
      title: 'Use the index, Luke',
      bodyMd: 'Reference site on SQL indexing.',
      type: 'bookmark',
      url: 'https://use-the-index-luke.com',
    },
  ])

  await db.insert(journalEntries).values(
    Array.from({ length: 6 }, (_, i) => ({
      userId: SINGLE_USER_ID,
      entryDate: isoDate(-i * 5),
      title: i === 0 ? 'On shipping slowly' : null,
      bodyMd:
        'Wrote this instead of scrolling. The days that go well are boring days: sleep, one hard problem, a walk.',
      mood: intBetween(5, 9),
    })),
  )

  // Calendar: a couple of events and planned blocks for the coming week.
  await db.insert(events).values([
    {
      userId: SINGLE_USER_ID,
      title: 'Team retro',
      startsAt: new Date(`${isoDate(2)}T09:00:00`),
      endsAt: new Date(`${isoDate(2)}T10:00:00`),
    },
    {
      userId: SINGLE_USER_ID,
      title: 'Dentist',
      startsAt: new Date(`${isoDate(5)}T14:30:00`),
    },
  ])

  await db.insert(plannedBlocks).values(
    Array.from({ length: 8 }, (_, i) => ({
      userId: SINGLE_USER_ID,
      blockDate: isoDate(-intBetween(0, 6)),
      startTime: '09:00',
      endTime: i % 2 === 0 ? '11:00' : '10:30',
      kind: i % 3 === 0 ? ('learning' as const) : ('deep_work' as const),
      projectId: mainProject?.id ?? null,
    })),
  )

  // People, with one deliberately overdue contact.
  const peopleRows = await db
    .insert(people)
    .values([
      { userId: SINGLE_USER_ID, name: 'Minh', relationship: 'friend' as const, contactIntervalDays: 14, birthday: '1994-09-20' },
      { userId: SINGLE_USER_ID, name: 'Lan', relationship: 'colleague' as const, contactIntervalDays: 30, company: 'Hasaki' },
      { userId: SINGLE_USER_ID, name: 'Duc', relationship: 'mentor' as const, contactIntervalDays: 60 },
    ])
    .returning()

  if (peopleRows.length > 0) {
    await db.insert(interactions).values([
      { userId: SINGLE_USER_ID, personId: peopleRows[0]!.id, occurredOn: isoDate(-25), channel: 'message' as const, summary: 'Caught up about the move' },
      { userId: SINGLE_USER_ID, personId: peopleRows[1]!.id, occurredOn: isoDate(-3), channel: 'call' as const, summary: 'Project handover' },
    ])

    await db.insert(reminders).values({
      userId: SINGLE_USER_ID,
      title: 'Send Duc the design doc',
      dueOn: isoDate(1),
      personId: peopleRows[2]!.id,
    })
  }

  // Career.
  await db.insert(skills).values([
    { userId: SINGLE_USER_ID, name: 'PostgreSQL', category: 'engineering', level: 3, targetLevel: 5 },
    { userId: SINGLE_USER_ID, name: 'Go', category: 'engineering', level: 4, targetLevel: 5 },
    { userId: SINGLE_USER_ID, name: 'System design', category: 'engineering', level: 3, targetLevel: 4 },
    { userId: SINGLE_USER_ID, name: 'English', category: 'language', level: 3, targetLevel: 4 },
  ])

  await db.insert(achievements).values([
    {
      userId: SINGLE_USER_ID,
      title: 'Cut checkout latency by 40%',
      achievedOn: isoDate(-45),
      impact: 'p95 from 820ms to 490ms after fixing the N+1 and adding a covering index.',
    },
  ])

  const counts = {
    dailyLogs: logRows.length,
    focusSessions: sessionRows.length,
    habits: habitRows.length,
    habitLogs: habitLogRows.length,
    goals: goalRows.length,
    projects: projectRows.length,
    people: peopleRows.length,
  }
  console.log('✓ seed complete', counts)
  await client.end()
}

main().catch((error) => {
  console.error('✗ seed failed:', error)
  process.exit(1)
})
