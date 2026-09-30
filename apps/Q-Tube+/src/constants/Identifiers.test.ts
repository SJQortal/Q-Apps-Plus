import { describe, expect, it } from 'vitest';
import {
  CHANNEL_DESCRIPTION,
  COMMENT_BASE,
  FOR,
  FOR_SUPER_LIKE,
  LIKE_BASE,
  QTUBE_PLAYLIST_BASE,
  QTUBE_VIDEO_BASE,
  SUPER_LIKE_BASE,
} from './Identifiers';

/**
 * Ground rule 1: the + app must read and write the same QDN identifiers as
 * the original Q-Tube. These are the production prefixes; if one of them
 * changes, existing videos, playlists and super likes disappear.
 */
describe('QDN identifier prefixes stay compatible with Q-Tube', () => {
  it('uses the production prefixes, not the MYTEST_ ones', () => {
    expect(QTUBE_VIDEO_BASE).toBe('qtube_vid_');
    expect(QTUBE_PLAYLIST_BASE).toBe('qtube_playlist_');
    expect(SUPER_LIKE_BASE).toBe('qtube_superlike_');
    expect(LIKE_BASE).toBe('qtube_like_');
    expect(COMMENT_BASE).toBe('qc_v1_qtube_');
    expect(FOR).toBe('FOR096');
    expect(FOR_SUPER_LIKE).toBe('qtube_sl');
    expect(CHANNEL_DESCRIPTION).toBe('qtube_channel_description');
  });
});
