import { describe, it, expect } from 'vitest'
import { isValidRedirectPath } from './route'

describe('isValidRedirectPath', () => {
    it('accepts valid relative paths', () => {
        expect(isValidRedirectPath('/dashboard')).toBe(true)
        expect(isValidRedirectPath('/es/dashboard')).toBe(true)
        expect(isValidRedirectPath('/en/reports')).toBe(true)
        expect(isValidRedirectPath('/es/admin/settings')).toBe(true)
        expect(isValidRedirectPath('/pt/upload')).toBe(true)
    })

    it('rejects null, undefined, and empty strings', () => {
        expect(isValidRedirectPath(null)).toBe(false)
        expect(isValidRedirectPath(undefined)).toBe(false)
        expect(isValidRedirectPath('')).toBe(false)
    })

    it('rejects absolute URLs (open redirect prevention)', () => {
        expect(isValidRedirectPath('https://evil.com')).toBe(false)
        expect(isValidRedirectPath('http://evil.com')).toBe(false)
        expect(isValidRedirectPath('ftp://evil.com')).toBe(false)
    })

    it('rejects protocol-relative URLs', () => {
        expect(isValidRedirectPath('//evil.com')).toBe(false)
        expect(isValidRedirectPath('//evil.com/dashboard')).toBe(false)
    })

    it('rejects paths containing /login to prevent redirect loops', () => {
        expect(isValidRedirectPath('/es/login')).toBe(false)
        expect(isValidRedirectPath('/login')).toBe(false)
        expect(isValidRedirectPath('/en/login?redirectTo=/dashboard')).toBe(false)
    })

    it('rejects non-string values', () => {
        expect(isValidRedirectPath(123 as unknown as string)).toBe(false)
        expect(isValidRedirectPath({} as unknown as string)).toBe(false)
    })
})
