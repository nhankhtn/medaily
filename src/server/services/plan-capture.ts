import { toPlanItems, type ParsedPlanItem, type PlanItem } from '@/lib/capture/plan-items'
import type { ISODate } from '@/lib/dates'
import { aiClient } from '@/server/services/ai-service'

/**
 * Whatever someone dumped into the capture box, split into goals to pursue and
 * tasks to tick off. Nothing is written: the rows land in a list the user
 * unticks and edits, and the save is their press.
 *
 * The reading is `medaily-ai`'s — the prompt lives there, with every other
 * prompt, at `src/services/capture/plan.ts`. `toPlanItems` stays here: a row
 * off a model is untrusted, and what a goal or a task is allowed to be is this
 * app's rule, not the reader's.
 *
 * What leaves the machine is that text. No goals they already have, no tasks,
 * no numbers they have logged.
 */
const TIMEOUT_MS = 45_000

export async function parsePlan({
  text,
  today,
}: {
  text: string
  today: ISODate
}): Promise<PlanItem[]> {
  const body = await aiClient('capture', TIMEOUT_MS).request<{ items?: ParsedPlanItem[] }>(
    '/api/capture/plan',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, today }),
    },
  )

  return toPlanItems({ parsed: body.items ?? [], today })
}
