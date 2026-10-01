import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The one credential in the app with any power, and the one that has twice
 * been set and unusable with nothing on screen to say so.
 *
 * It is a JSON document carrying a PEM key on a single line of an environment
 * file, which is a shape that invites exactly one mistake: pasting it as
 * downloaded, so the value stops at the first newline. Every path through the
 * reader is pinned here, because the cost of getting one wrong is silence.
 */
const holder = vi.hoisted(() => ({ value: undefined as string | undefined }))

vi.mock('@/lib/env', () => ({
  get env() {
    return { FIREBASE_SERVICE_ACCOUNT: holder.value }
  },
}))

const { GoogleAuthError, readServiceAccount } = await import('@/server/services/google-auth')

const ACCOUNT = {
  project_id: 'medaily-demo',
  client_email: 'firebase-adminsdk-x@medaily-demo.iam.gserviceaccount.com',
  // Real newlines once parsed, which is what PEM needs and what makes this
  // awkward to carry in an environment variable in the first place.
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIBVgIBADA\n-----END PRIVATE KEY-----\n',
}

const asJson = () => JSON.stringify(ACCOUNT)

afterEach(() => {
  holder.value = undefined
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
})

describe('readServiceAccount', () => {
  it('is nothing at all when nothing is set', () => {
    expect(readServiceAccount()).toBeNull()
  })

  it('treats whitespace as nothing, rather than as a broken document', () => {
    holder.value = '   \n  '
    expect(readServiceAccount()).toBeNull()
  })

  it('reads the document on one line', () => {
    holder.value = asJson()
    expect(readServiceAccount()).toEqual({
      projectId: ACCOUNT.project_id,
      clientEmail: ACCOUNT.client_email,
      privateKey: ACCOUNT.private_key,
    })
  })

  it('keeps the newlines in the key, which is the whole difficulty', () => {
    // `jq -c` escapes them as `\n` inside the string; JSON.parse puts them
    // back. A value that lost them is a PEM that will not import.
    holder.value = asJson()
    expect(readServiceAccount()?.privateKey).toContain('\n')
  })

  it('refuses a document truncated at the first newline', () => {
    // What a paste of the downloaded file actually leaves behind: a prefix of
    // valid JSON, set and non-empty, which every `Boolean(...)` check passes.
    holder.value = asJson().slice(0, 60)
    expect(() => readServiceAccount()).toThrow(GoogleAuthError)
  })

  it('names the variable, so the message says what to go and look at', () => {
    holder.value = 'not-a-document'
    expect(() => readServiceAccount()).toThrow(/FIREBASE_SERVICE_ACCOUNT is not valid JSON/)
  })

  it('refuses a document missing a field it will be asked for', () => {
    holder.value = JSON.stringify({ ...ACCOUNT, private_key: undefined })
    expect(() => readServiceAccount()).toThrow(/project_id, client_email and private_key/)
  })

  it('refuses a credential for another project, naming both', () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'medaily-production'
    holder.value = asJson()
    // The failure this prevents is silent and remote: a staging key in a
    // production environment deletes from somewhere nobody is watching.
    expect(() => readServiceAccount()).toThrow(/medaily-demo.*medaily-production/)
  })

  it('does not object when the deploy names no project to check against', () => {
    holder.value = asJson()
    expect(readServiceAccount()?.projectId).toBe('medaily-demo')
  })

})
