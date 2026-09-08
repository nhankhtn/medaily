import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { Achievement, PortfolioItem, Skill } from '@/lib/db/schema'
import { today as todayOf, type ISODate } from '@/lib/dates'
import { findAchievements, findPortfolio, findSkills } from '@/server/repositories/career'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type CareerData = {
  today: ISODate
  skills: Skill[]
  achievements: Achievement[]
  portfolio: PortfolioItem[]
}

export const getCareerData = cache(async (): Promise<CareerData> => {
  const settings = await getSettings()
  const userId = getCurrentUserId()

  const [skills, achievements, portfolio] = await Promise.all([
    findSkills(userId),
    findAchievements(userId),
    findPortfolio(userId),
  ])

  return { today: todayOf(dayContextOf(settings)), skills, achievements, portfolio }
})
