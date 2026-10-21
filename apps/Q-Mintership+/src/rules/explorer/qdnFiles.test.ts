import { describe, expect, it } from 'vitest';
import {
  declaredKind,
  extensionOf,
  fileTypeWords,
  kindFromMime,
  openableResource,
  qortalLinkFor,
  resolveFileKind,
  saveFilename,
  sniffBytes,
  textOf,
} from './qdnFiles';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe('what kind of file a QDN resource is', () => {
  it('reads extensions and types', () => {
    expect(extensionOf('rev-poster.webp')).toBe('webp');
    expect(extensionOf('dir/Report.PDF')).toBe('pdf');
    expect(extensionOf('.gitignore')).toBe('');
    expect(extensionOf('README')).toBe('');
    expect(kindFromMime('text/plain; charset=utf-8')).toBe('text');
    expect(kindFromMime('application/octet-stream')).toBeNull();
    expect(kindFromMime('application/ld+json')).toBe('json');
    expect(kindFromMime('image/svg+xml')).toBe('image');
    expect(kindFromMime('application/x-whatever')).toBe('binary');
  });

  it('goes by the type, then the name, then the service before any byte is read', () => {
    expect(declaredKind({ service: 'DOCUMENT', mimeType: 'application/pdf' })).toBe('pdf');
    expect(declaredKind({ service: 'FILE', filename: 'notes.md' })).toBe('text');
    expect(declaredKind({ service: 'VIDEO' })).toBe('video');
    expect(declaredKind({ service: 'DOCUMENT' })).toBeNull();
    expect(declaredKind({ service: 'FILE', filename: 'letter.docx' })).toBe('binary');
  });

  it('knows the signatures of the formats it shows', () => {
    expect(sniffBytes(text('%PDF-1.7\n'))?.kind).toBe('pdf');
    expect(sniffBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe(
      'image/png'
    );
    expect(sniffBytes(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe('image/jpeg');
    expect(sniffBytes(text('RIFF\0\0\0\0WEBPVP8 '))?.mime).toBe('image/webp');
    expect(sniffBytes(text('RIFF\0\0\0\0WAVEfmt '))?.kind).toBe('audio');
    expect(sniffBytes(text('\0\0\0\x18ftypisom'))?.mime).toBe('video/mp4');
    expect(sniffBytes(text('\0\0\0\x18ftypM4A '))?.mime).toBe('audio/mp4');
    expect(sniffBytes(text('\0\0\0\x18ftypheic'))?.kind).toBe('binary');
    expect(sniffBytes(bytes(0x1a, 0x45, 0xdf, 0xa3))?.kind).toBe('video');
    expect(sniffBytes(text('ID3\x04'))?.mime).toBe('audio/mpeg');
    expect(sniffBytes(bytes(0x50, 0x4b, 0x03, 0x04))?.kind).toBe('zip');
    expect(sniffBytes(bytes(0x1f, 0x8b, 0x08))?.mime).toBe('application/gzip');
    expect(sniffBytes(text('{"a":1}'))).toBeNull();
  });

  it('tells text from binary, even with a character cut at the end', () => {
    expect(textOf(text('hello\nworld'))).toBe('hello\nworld');
    const cut = text('café').subarray(0, 4); // "caf" and half of "é"
    expect(textOf(cut)).toBe('caf');
    expect(textOf(bytes(0x68, 0x00, 0x69))).toBeNull();
    expect(textOf(bytes(0xc3, 0x28, 0x41, 0x42, 0x43, 0x44))).toBeNull();
    expect(textOf(bytes(1, 2, 3, 4, 5, 6, 7, 8))).toBeNull();
  });

  it('lets bytes that are certain win over what was declared', () => {
    expect(
      resolveFileKind({ service: 'DOCUMENT', mimeType: 'text/plain', head: text('%PDF-1.4') })
    ).toEqual({ kind: 'pdf', mime: 'application/pdf' });
    expect(resolveFileKind({ service: 'VIDEO', head: text('just words') }).kind).toBe('text');
    // A DOCX is a ZIP inside: named, not listed.
    expect(
      resolveFileKind({ service: 'FILE', filename: 'a.docx', head: bytes(0x50, 0x4b, 0x03, 0x04) })
    ).toEqual({
      kind: 'binary',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(
      resolveFileKind({
        service: 'FILE',
        filename: 'site.zip',
        head: bytes(0x50, 0x4b, 0x03, 0x04),
      }).kind
    ).toBe('zip');
  });

  it('keeps text as text, with JSON, CSV, HTML and SVG told apart', () => {
    expect(resolveFileKind({ service: 'DOCUMENT', head: text(' {"title":"Rev"}') })).toEqual({
      kind: 'json',
      mime: 'application/json',
    });
    expect(
      resolveFileKind({ service: 'FILE', filename: 'a.csv', head: text('a,b\n1,2') }).kind
    ).toBe('csv');
    expect(resolveFileKind({ service: 'WEBSITE', head: text('<!DOCTYPE html><html>') }).kind).toBe(
      'html'
    );
    expect(
      resolveFileKind({ service: 'IMAGE', head: text('<?xml version="1.0"?><svg xmlns="x">') })
    ).toEqual({ kind: 'image', mime: 'image/svg+xml' });
    expect(
      resolveFileKind({ service: 'FILE', filename: 'x.bin', head: text('plain words') })
    ).toEqual({ kind: 'text', mime: 'text/plain' });
  });

  it('keeps a declared picture, video or sound when its bytes have no signature here', () => {
    expect(
      resolveFileKind({ service: 'IMAGE', filename: 'icon.ico', head: bytes(0, 0, 1, 0, 1, 0) })
    ).toEqual({ kind: 'image', mime: 'image/x-icon' });
    expect(resolveFileKind({ service: 'FILE', head: bytes(0, 1, 2, 3, 4, 5, 6) })).toEqual({
      kind: 'binary',
      mime: 'application/octet-stream',
    });
  });

  it('says what a file is in words', () => {
    expect(fileTypeWords('pdf', 'application/pdf')).toBe('A PDF document');
    expect(
      fileTypeWords('binary', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ).toBe('An Excel spreadsheet (XLSX)');
    expect(fileTypeWords('binary', 'application/octet-stream')).toBe('Binary data');
  });
});

describe('saving and opening', () => {
  it('saves under its own name, or the identifier with the type’s extension', () => {
    expect(saveFilename({ filename: 'rev-poster.webp', name: 'igorcoin', identifier: 'x' })).toBe(
      'rev-poster.webp'
    );
    expect(saveFilename({ filename: 'a/b:c?.txt', name: 'n', identifier: 'x' })).toBe('b_c_.txt');
    expect(saveFilename({ name: 'igorcoin', identifier: 'post-1_p', mime: 'image/jpeg' })).toBe(
      'post-1_p.jpg'
    );
    expect(saveFilename({ name: 'Q-Maps', identifier: null, mime: 'application/json' })).toBe(
      'Q-Maps.json'
    );
    expect(saveFilename({ name: 'n', identifier: 'x', mime: 'application/x-odd' })).toBe('x.bin');
    expect(saveFilename({ name: '', identifier: null })).toBe('file');
  });

  it('opens public QDN publishes with a name only', () => {
    expect(
      openableResource({ type: 'ARBITRARY', service: 400, name: 'igorcoin', identifier: 'x_p' })
    ).toEqual({ service: 'IMAGE', name: 'igorcoin', identifier: 'x_p' });
    expect(openableResource({ type: 'ARBITRARY', service: 'WEBSITE', name: 'Q-Maps' })).toEqual({
      service: 'WEBSITE',
      name: 'Q-Maps',
      identifier: null,
    });
    expect(
      openableResource({ type: 'ARBITRARY', service: 'APP', name: 'A', identifier: 'default' })
        ?.identifier
    ).toBeNull();
    // Encrypted: never opened, not even read.
    expect(
      openableResource({ type: 'ARBITRARY', service: 801, name: 'a', identifier: 'b' })
    ).toBeNull();
    expect(openableResource({ type: 'ARBITRARY', service: 'MAIL', name: 'a' })).toBeNull();
    expect(openableResource({ type: 'ARBITRARY', service: 400 })).toBeNull();
    expect(openableResource({ type: 'PAYMENT', service: 400, name: 'a' })).toBeNull();
  });

  it('links an app or a website published under its default identifier', () => {
    // Hub never decodes an app's name in a link: written as it is.
    expect(qortalLinkFor({ service: 'APP', name: 'Q-Mintership+', identifier: null })).toBe(
      'qortal://APP/Q-Mintership+'
    );
    expect(qortalLinkFor({ service: 'WEBSITE', name: 'Q Maps', identifier: null })).toBe(
      'qortal://WEBSITE/Q Maps'
    );
    expect(qortalLinkFor({ service: 'WEBSITE', name: 'a/b', identifier: null })).toBeNull();
    expect(qortalLinkFor({ service: 'APP', name: 'A', identifier: 'beta' })).toBeNull();
    expect(qortalLinkFor({ service: 'IMAGE', name: 'A', identifier: null })).toBeNull();
  });
});
