import { describe, expect, it } from 'vitest'
import {
  attachmentDisplayName,
  attachmentKind,
  attachmentSizeHint,
  fileExtension,
  formatFileSize,
  mimeFromFilename,
  resolveMimeType,
} from './attachmentMeta'

describe('attachmentMeta', () => {
  it('reads the extension and guesses a MIME type from it', () => {
    expect(fileExtension('photo.JPG')).toBe('jpg')
    expect(fileExtension('noext')).toBe('')
    expect(fileExtension('trailing.')).toBe('')
    expect(mimeFromFilename('photo.jpg')).toBe('image/jpeg')
    expect(mimeFromFilename('report.pdf')).toBe('application/pdf')
    expect(mimeFromFilename('notes.md')).toBe('text/markdown')
    expect(mimeFromFilename('code.rs')).toBe('text/plain')
    expect(mimeFromFilename('thing.bin')).toBe('application/octet-stream')
  })

  it('resolves the MIME type: reference type, then properties, then the filename', () => {
    const ref = { name: 'a', service: 'ATTACHMENT_PRIVATE', identifier: 'x', originalFilename: 'doc.pdf' }
    expect(resolveMimeType({ ...ref, type: 'image/png' }, 'text/plain')).toBe('image/png')
    expect(resolveMimeType({ ...ref, type: null }, 'text/plain')).toBe('text/plain')
    expect(resolveMimeType({ ...ref, type: null })).toBe('application/pdf')
    expect(resolveMimeType({ ...ref, type: 'application/octet-stream' })).toBe('application/pdf')
    expect(resolveMimeType({ ...ref, originalFilename: 'blob.xyz', type: undefined })).toBe('application/octet-stream')
    expect(resolveMimeType({ ...ref, type: undefined, mimeTypeSaved: 'audio/mpeg' })).toBe('audio/mpeg')
  })

  it('classifies attachments by MIME type or extension', () => {
    const base = { name: 'a', service: 'ATTACHMENT_PRIVATE', identifier: 'x' }
    expect(attachmentKind({ ...base, originalFilename: 'a.png', type: null })).toBe('image')
    expect(attachmentKind({ ...base, originalFilename: 'a.pdf', type: 'application/pdf' })).toBe('pdf')
    expect(attachmentKind({ ...base, originalFilename: 'a.txt', type: 'text/plain' })).toBe('text')
    expect(attachmentKind({ ...base, originalFilename: 'a.json', type: 'application/json' })).toBe('text')
    expect(attachmentKind({ ...base, originalFilename: 'a.mp3', type: null })).toBe('audio')
    expect(attachmentKind({ ...base, originalFilename: 'a.mp4', type: 'video/mp4' })).toBe('video')
    expect(attachmentKind({ ...base, originalFilename: 'a.zip', type: null })).toBe('archive')
    expect(attachmentKind({ ...base, originalFilename: 'a.docx', type: null })).toBe('other')
    expect(attachmentKind({ ...base, filename: 'id.bin', type: 'image/webp' })).toBe('image')
  })

  it('formats sizes and names', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(300 * 1024)).toBe('300 KB')
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB')
    expect(formatFileSize(undefined)).toBe('')
    expect(attachmentDisplayName({ filename: 'id.png', originalFilename: 'cat.png' })).toBe('cat.png')
    expect(attachmentDisplayName({ filename: 'id.png' })).toBe('id.png')
    expect(attachmentDisplayName({})).toBe('attachment')
    expect(attachmentSizeHint({ size: 10 })).toBe(10)
    expect(attachmentSizeHint({})).toBeUndefined()
  })
})
