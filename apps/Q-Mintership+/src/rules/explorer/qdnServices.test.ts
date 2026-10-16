import { describe, expect, it } from 'vitest';
import {
  isKnownService,
  isPrivateService,
  QDN_SERVICES,
  serviceName,
  serviceWords,
} from './qdnServices';

describe('QDN services', () => {
  it("knows Core's 54 services by number", () => {
    expect(Object.keys(QDN_SERVICES)).toHaveLength(54);
    expect(new Set(Object.values(QDN_SERVICES)).size).toBe(54);
    expect(serviceName(800)).toBe('DOCUMENT');
    expect(serviceName('1000')).toBe('APP');
    expect(serviceName(1110)).toBe('JSON');
    expect(serviceName(1901)).toBe('MAIL_PRIVATE');
    expect(serviceName(121)).toBe('QCHAT_ATTACHMENT_PRIVATE');
  });

  it('keeps a name that is already one, and reads a new number plainly', () => {
    expect(serviceName('VIDEO')).toBe('VIDEO');
    expect(serviceName(4242)).toBe('SERVICE_4242');
    expect(serviceName(undefined)).toBeNull();
    expect(serviceName('not a service')).toBeNull();
    expect(serviceName(-1)).toBeNull();
    expect(isKnownService('APP')).toBe(true);
    expect(isKnownService('SERVICE_4242')).toBe(false);
  });

  it('treats every *_PRIVATE service and MAIL as encrypted', () => {
    const encrypted = Object.values(QDN_SERVICES).filter(isPrivateService);
    expect(encrypted.sort()).toEqual(
      [
        'QCHAT_ATTACHMENT_PRIVATE',
        'ATTACHMENT_PRIVATE',
        'FILE_PRIVATE',
        'IMAGE_PRIVATE',
        'VIDEO_PRIVATE',
        'AUDIO_PRIVATE',
        'VOICE_PRIVATE',
        'DOCUMENT_PRIVATE',
        'MAIL',
        'MAIL_PRIVATE',
        'MESSAGE_PRIVATE',
      ].sort()
    );
    expect(isPrivateService('SOMETHING_PRIVATE')).toBe(true);
    expect(isPrivateService('APP')).toBe(false);
    expect(isPrivateService(null)).toBe(false);
  });

  it('says what was published', () => {
    expect(serviceWords('APP')).toBe('an app');
    expect(serviceWords('VIDEO')).toBe('a video');
    expect(serviceWords('JSON')).toBe('JSON data');
    expect(serviceWords('MAIL_PRIVATE')).toBe('an encrypted resource');
    expect(serviceWords('MAIL')).toBe('an encrypted resource');
    expect(serviceWords('SERVICE_4242')).toBe('a QDN resource');
    expect(serviceWords(null)).toBe('a QDN resource');
    for (const name of Object.values(QDN_SERVICES))
      expect(serviceWords(name), name).toMatch(/^(an? |[A-Za-z])/);
  });
});
