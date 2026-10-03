import { describe, expect, it } from 'vitest'
import { presentNotification, type NoticeCopy } from '@/lib/notifications'

const copy: NoticeCopy = (key, values) => {
  if (key === 'grantExpense') return `${values?.name} recorded an expense`
  if (key === 'roomInvite') return `${values?.name} invited you to ${values?.room}`
  if (key === 'roomInviteUntitled') return `${values?.name} invited you to a room`
  return 'Notification'
}

const expense = {
  transactionId: '4f3a9c00-0000-4000-8000-000000000001',
  personName: 'A',
  amount: 15_000,
  currency: 'VND',
  merchant: 'bánh mì',
}

describe('presentNotification', () => {
  it('turns a grant expense into a sentence and a link to that row', () => {
    const shown = presentNotification('grant_expense', expense, 'vi', copy)
    expect(shown.title).toBe('A recorded an expense')
    expect(shown.body).toContain('bánh mì')
    expect(shown.url).toBe('/finance?q=4f3a9c')
  })

  it('leaves the merchant off when there is none', () => {
    const shown = presentNotification('grant_expense', { ...expense, merchant: null }, 'en', copy)
    expect(shown.body).not.toContain('·')
  })

  it('reads a legacy row as the words that were stored', () => {
    expect(
      presentNotification(
        'legacy',
        { title: 'Hello', body: 'there', url: '/finance' },
        'en',
        copy,
      ),
    ).toEqual({ title: 'Hello', body: 'there', url: '/finance' })
  })

  it('points a room invite at the question the invitee answers', () => {
    const shown = presentNotification(
      'room_invite',
      {
        inviteId: '4f3a9c00-0000-4000-8000-000000000002',
        roomId: 'room-1',
        roomTitle: 'Lunch',
        inviterName: 'Ada',
      },
      'en',
      copy,
    )
    expect(shown.title).toBe('Ada invited you to Lunch')
    expect(shown.url).toBe('/chat?invite=4f3a9c00-0000-4000-8000-000000000002')
  })

  it('does not drop a kind it has not learned yet', () => {
    expect(presentNotification('chat_message', { roomId: '1' }, 'en', copy)).toEqual({
      title: 'Notification',
      body: '',
      url: '/',
    })
  })
})
