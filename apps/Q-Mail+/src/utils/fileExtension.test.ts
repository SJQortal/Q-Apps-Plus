import { describe, expect, it } from 'vitest'
import { extensionFromFilename, extensionFromMimeType } from './fileExtension'

describe('extensionFromMimeType', () => {
  it('maps the types browsers hand out for files without a name', () => {
    expect(extensionFromMimeType('image/jpeg')).toBe('jpg')
    expect(extensionFromMimeType('image/png')).toBe('png')
    expect(extensionFromMimeType('video/quicktime')).toBe('mov')
    expect(extensionFromMimeType('audio/mpeg')).toBe('mp3')
    expect(extensionFromMimeType('application/pdf')).toBe('pdf')
    expect(extensionFromMimeType(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )).toBe('docx')
  })

  it('ignores parameters and case, and derives simple subtypes', () => {
    expect(extensionFromMimeType('text/plain; charset=utf-8')).toBe('txt')
    expect(extensionFromMimeType('IMAGE/WEBP')).toBe('webp')
    expect(extensionFromMimeType('application/x-tar')).toBe('tar')
    expect(extensionFromMimeType('image/bmp')).toBe('bmp')
  })

  it('returns null for unknown or empty types', () => {
    expect(extensionFromMimeType('')).toBeNull()
    expect(extensionFromMimeType(null)).toBeNull()
    expect(extensionFromMimeType('application/vnd.something.odd+zip')).toBeNull()
  })
})

describe('extensionFromFilename', () => {
  it('returns the last extension and nothing for dotfiles or names without one', () => {
    expect(extensionFromFilename('report.final.PDF')).toBe('PDF')
    expect(extensionFromFilename('archive.tar.gz')).toBe('gz')
    expect(extensionFromFilename('.bashrc')).toBe('')
    expect(extensionFromFilename('README')).toBe('')
    expect(extensionFromFilename('trailing.')).toBe('')
    expect(extensionFromFilename(undefined)).toBe('')
  })
})
