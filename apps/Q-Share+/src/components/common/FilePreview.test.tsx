import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  FilePreview,
  IMAGE_AUTO_PREVIEW_BYTES,
  PDF_OPEN_MAX_BYTES,
  TEXT_PREVIEW_BYTES,
  previewKind,
  shouldAutoPreview,
} from './FilePreview';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { store } from '../../state/store';
import { clearFinishedDownloads, removeDownload, setAddToDownloads, updateDownloads } from '../../state/features/globalSlice';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, resetSettingsCache } from '../../utils/settings';

const base = { name: 'alice', service: 'FILE' };
const image = { ...base, identifier: 'qshare_file_x_img', filename: 'photo.png', mimetype: 'image/png', size: 200_000 };
const bigImage = { ...image, identifier: 'qshare_file_x_big', size: IMAGE_AUTO_PREVIEW_BYTES + 1 };
const text = { ...base, identifier: 'qshare_file_x_txt', filename: 'readme.md', mimetype: 'text/markdown', size: 1_000 };
const bigText = { ...text, identifier: 'qshare_file_x_bigtxt', size: TEXT_PREVIEW_BYTES + 1 };
const pdf = { ...base, identifier: 'qshare_file_x_pdf', filename: 'paper.pdf', mimetype: 'application/pdf', size: 5_000_000 };
const video = { ...base, identifier: 'qshare_file_x_vid', filename: 'clip.mp4', mimetype: 'video/mp4', size: 90_000_000 };
const archive = { ...base, identifier: 'qshare_file_x_zip', filename: 'all.zip', mimetype: 'application/zip', size: 1 };

/**
 * A download machine for one file: `retryDownload` starts polling again, which
 * drops the `stopped` marker as DownloadWrapper does, and `giveUp` is its
 * poller stopping after six status errors in a row.
 */
function stoppableDownload(identifier: string) {
  const at = (status: Record<string, unknown>) =>
    store.dispatch(updateDownloads({ identifier, status: { percentLoaded: 40, ...status } }));
  const downloadVideo = vi.fn(() => {
    store.dispatch(setAddToDownloads({ name: 'alice', service: 'FILE', identifier, properties: {} }));
    at({ status: 'DOWNLOADING' });
  });
  const retryDownload = vi.fn(() => at({ status: 'REFETCHING' }));
  const giveUp = () => act(() => at({ status: 'REFETCHING', stopped: true }));
  const ready = () => act(() => at({ status: 'READY', percentLoaded: 100 }));
  return { value: { downloadVideo, retryDownload }, retryDownload, giveUp, ready };
}

function setAutoPreview(on: boolean) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, autoPreviewImages: on }));
  resetSettingsCache();
}

describe('previewKind and shouldAutoPreview', () => {
  it('classifies by mimetype and filename, with size limits for text', () => {
    expect(previewKind(image)).toBe('image');
    expect(previewKind(pdf)).toBe('pdf');
    expect(previewKind(video)).toBe('video');
    expect(previewKind(text)).toBe('text');
    expect(previewKind({ ...base, identifier: 'j', filename: 'data.json', mimetype: 'application/json', size: 10 })).toBe('text');
    expect(previewKind({ ...base, identifier: 'y', filename: 'conf.yaml', mimetype: 'application/octet-stream', size: 10 })).toBe('text');
    expect(previewKind(bigText)).toBeNull();
    expect(previewKind(archive)).toBeNull();
  });

  it('previews only video and audio formats the player can play', () => {
    const media = (filename: string, mimetype = '') => ({ ...base, identifier: filename, filename, mimetype, size: 1 });
    for (const name of ['a.mp4', 'a.M4V', 'a.webm', 'a.ogv', 'a.mov', 'a.mkv']) expect(previewKind(media(name))).toBe('video');
    for (const name of ['a.mp3', 'a.m4a', 'a.aac', 'a.wav', 'a.ogg', 'a.oga', 'a.opus', 'a.flac']) expect(previewKind(media(name))).toBe('audio');
    expect(previewKind(media('clip', 'video/webm'))).toBe('video');
    expect(previewKind(media('song.mp3', 'application/octet-stream'))).toBe('audio');
    for (const name of ['a.avi', 'a.wmv', 'a.flv', 'a.mpg', 'a.mpeg', 'a.3gp', 'a.wma', 'a.aiff', 'a.mid']) {
      expect(previewKind(media(name))).toBeNull();
    }
    expect(previewKind(media('clip', 'video/x-msvideo'))).toBeNull();
    expect(previewKind(media('song', 'audio/x-ms-wma'))).toBeNull();
  });

  it('auto-opens only small images while the setting is on', () => {
    expect(shouldAutoPreview(image, DEFAULT_SETTINGS)).toBe(true);
    expect(shouldAutoPreview(bigImage, DEFAULT_SETTINGS)).toBe(false);
    expect(shouldAutoPreview(image, { ...DEFAULT_SETTINGS, autoPreviewImages: false })).toBe(false);
    expect(shouldAutoPreview(text, DEFAULT_SETTINGS)).toBe(false);
  });
});

describe('FilePreview', () => {
  beforeEach(() => {
    resetQdnSearchCache();
    resetSettingsCache();
  });

  it('shows a small image at once when auto preview is on, lazily, and opens a lightbox on tap', () => {
    setAutoPreview(true);
    renderWithProviders(<FilePreview file={image} />);
    const img = screen.getByRole('img', { name: 'photo.png' });
    expect(img).toHaveAttribute('src', '/arbitrary/FILE/alice/qshare_file_x_img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('button', { name: 'Hide preview of photo.png' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open photo.png full screen' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  });

  it('waits for a tap when auto preview is off', () => {
    setAutoPreview(false);
    renderWithProviders(<FilePreview file={image} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview image photo.png' }));
    expect(screen.getByRole('img', { name: 'photo.png' })).toBeInTheDocument();
  });

  it('waits for a tap for images over 5 MB even when auto preview is on', () => {
    setAutoPreview(true);
    renderWithProviders(<FilePreview file={bigImage} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview image photo.png' })).toBeInTheDocument();
  });

  it('hides a broken image and says the preview failed', () => {
    setAutoPreview(true);
    renderWithProviders(<FilePreview file={image} />);
    fireEvent.error(screen.getByRole('img', { name: 'photo.png' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Preview failed')).toBeInTheDocument();
  });

  it('fetches text only after "Preview text" and shows it in a pre', async () => {
    mockFetch('/arbitrary/FILE/', 'hello **world**');
    renderWithProviders(<FilePreview file={text} />);
    expect(fetchCallsMatching('/arbitrary/FILE/').length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Preview text readme.md' }));
    expect(await screen.findByText('hello **world**')).toBeInTheDocument();
    expect(fetchCallsMatching('/arbitrary/FILE/')).toEqual(['/arbitrary/FILE/alice/qshare_file_x_txt']);
    fireEvent.click(screen.getByRole('button', { name: 'Hide preview of readme.md' }));
    expect(screen.queryByText('hello **world**')).not.toBeInTheDocument();
  });

  it('shows an inline error when the text cannot be read', async () => {
    mockFetch('/arbitrary/FILE/', () => {
      throw new Error('offline');
    });
    renderWithProviders(<FilePreview file={text} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview text readme.md' }));
    expect(await screen.findByText('Could not load the text. Download the file instead.')).toBeInTheDocument();
  });

  it("shows the error state, not the node's error JSON, when the text is not on the node", async () => {
    const body = '{"error":1401,"message":"Couldn\'t find PUT transaction"}';
    vi.mocked(fetch).mockImplementationOnce(async () => new Response(body, { status: 404 }));
    renderWithProviders(<FilePreview file={text} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview text readme.md' }));
    expect(await screen.findByText('Could not load the text. Download the file instead.')).toBeInTheDocument();
    expect(screen.queryByText(body)).not.toBeInTheDocument();
  });

  it('renders nothing for text over 200 KB or for archives', () => {
    const { container } = renderWithProviders(
      <>
        <FilePreview file={bigText} />
        <FilePreview file={archive} />
      </>
    );
    expect(container.querySelector('button')).toBeNull();
  });

  describe('PDF', () => {
    beforeEach(() => {
      store.dispatch(removeDownload(pdf.identifier));
      mockQortalAction('SHOW_PDF_READER', true);
    });

    it('opens a PDF on the node in Hub\'s reader as an application/pdf blob, with no inline frame', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY', percentLoaded: 100 });
      mockFetch('/arbitrary/FILE/', '%PDF-1.4 tiny');
      const { container } = renderWithProviders(<FilePreview file={pdf} />);
      expect(container.querySelector('iframe')).toBeNull();
      expect(fetchCallsMatching('/arbitrary/FILE/').length).toBe(0);

      fireEvent.click(screen.getByRole('button', { name: 'Open PDF paper.pdf' }));

      await waitFor(() => expect(qortalCallsFor('SHOW_PDF_READER').length).toBe(1));
      const blob = qortalCallsFor('SHOW_PDF_READER')[0].blob as Blob;
      expect(blob.type).toBe('application/pdf');
      expect(fetchCallsMatching('/arbitrary/FILE/')).toEqual(['/arbitrary/FILE/alice/qshare_file_x_pdf']);
      expect(container.querySelector('iframe')).toBeNull();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Open PDF paper.pdf' })).toBeEnabled());

      // Opening it again reads it once more, with no second status check.
      fireEvent.click(screen.getByRole('button', { name: 'Open PDF paper.pdf' }));
      await waitFor(() => expect(qortalCallsFor('SHOW_PDF_READER').length).toBe(2));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Open PDF paper.pdf' })).toBeEnabled());
      expect(qortalCallsFor('SHOW_PDF_READER').length).toBe(2);
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS').length).toBe(1);
    });

    it('fetches a PDF that is not on the node yet, then opens it when it is ready', async () => {
      const downloadVideo = vi.fn();
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'DOWNLOADING', percentLoaded: 20 });
      mockFetch('/arbitrary/FILE/', '%PDF-1.7 later');
      renderWithProviders(
        <MyContext.Provider value={{ downloadVideo, retryDownload: () => {} }}>
          <FilePreview file={pdf} />
        </MyContext.Provider>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open PDF paper.pdf' }));
      await waitFor(() => expect(downloadVideo).toHaveBeenCalledTimes(1));
      expect(downloadVideo.mock.calls[0][0]).toMatchObject({ name: 'alice', service: 'FILE', identifier: pdf.identifier });
      // The shared download machine takes it from here; the file row shows its progress.
      act(() => {
        store.dispatch(setAddToDownloads({ name: 'alice', service: 'FILE', identifier: pdf.identifier, properties: {} }));
        store.dispatch(updateDownloads({ identifier: pdf.identifier, status: { status: 'DOWNLOADING', percentLoaded: 40 } }));
      });
      expect(await screen.findByText('Opens when ready')).toBeInTheDocument();
      expect(fetchCallsMatching('/arbitrary/FILE/').length).toBe(0);

      act(() => {
        store.dispatch(updateDownloads({ identifier: pdf.identifier, status: { status: 'READY', percentLoaded: 100 } }));
      });
      await waitFor(() => expect(qortalCallsFor('SHOW_PDF_READER').length).toBe(1));
    });

    it('starts a fetch again once when the node stops answering, then lets a tap start it', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'DOWNLOADING', percentLoaded: 20 });
      mockFetch('/arbitrary/FILE/', '%PDF-1.7 later');
      const machine = stoppableDownload(pdf.identifier);
      renderWithProviders(
        <MyContext.Provider value={machine.value}>
          <FilePreview file={pdf} />
        </MyContext.Provider>
      );
      const button = () => screen.getByRole('button', { name: 'Open PDF paper.pdf' });
      fireEvent.click(button());
      expect(await screen.findByText('Opens when ready')).toBeInTheDocument();

      // Core drops out while the tap waits: picked up with no new tap.
      machine.giveUp();
      expect(machine.retryDownload).toHaveBeenCalledTimes(1);
      expect(button()).toBeDisabled();

      // Still down: the button comes back and says why.
      machine.giveUp();
      expect(machine.retryDownload).toHaveBeenCalledTimes(1);
      expect(button()).toBeEnabled();
      expect(screen.getByText('Your node stopped answering at 40%')).toBeInTheDocument();

      fireEvent.click(button());
      expect(machine.retryDownload).toHaveBeenCalledTimes(2);
      expect(button()).toBeDisabled();
      machine.ready();
      await waitFor(() => expect(qortalCallsFor('SHOW_PDF_READER').length).toBe(1));
    });

    it('refuses a file that is not really a PDF', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' });
      mockFetch('/arbitrary/FILE/', '<html><script>alert(1)</script></html>');
      renderWithProviders(<FilePreview file={pdf} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open PDF paper.pdf' }));
      expect(await screen.findByText("This file isn't a PDF. Download to view.")).toBeInTheDocument();
      expect(qortalCallsFor('SHOW_PDF_READER').length).toBe(0);
    });

    it('says to download when Hub cannot show the reader', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' });
      mockFetch('/arbitrary/FILE/', '%PDF-1.4 x');
      mockQortalAction('SHOW_PDF_READER', () => {
        throw { error: 'Unknown action', message: 'Unknown action' };
      });
      renderWithProviders(<FilePreview file={pdf} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open PDF paper.pdf' }));
      expect(await screen.findByText("Couldn't open the PDF. Download to view.")).toBeInTheDocument();
    });

    it('offers no reader for PDFs over the cap', () => {
      renderWithProviders(<FilePreview file={{ ...pdf, size: PDF_OPEN_MAX_BYTES + 1 }} />);
      expect(screen.queryByRole('button', { name: /Open PDF/ })).not.toBeInTheDocument();
      expect(screen.getByText('Too large to open here. Download to view.')).toBeInTheDocument();
    });
  });

  describe('video and audio', () => {
    beforeEach(() => {
      store.dispatch(removeDownload(video.identifier));
    });

    it('checks the node once, then renders a player with preload="none" after "Preview video"', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY', percentLoaded: 100 });
      const { container } = renderWithProviders(<FilePreview file={video} />);
      expect(container.querySelector('video')).toBeNull();
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS').length).toBe(0);
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
      const player = container.querySelector('video');
      expect(player).toHaveAttribute('src', '/arbitrary/FILE/alice/qshare_file_x_vid');
      expect(player).toHaveAttribute('preload', 'none');
      expect(player).toHaveAttribute('controls');
      expect(player).toHaveAttribute('playsinline');
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(1);
      expect(fetchCallsMatching('/arbitrary/FILE/').length).toBe(0);
    });

    it('a failed play is not sticky: Try again, or Hide then Preview, brings the player back', async () => {
      // No answer from the status check: the player is tried, but the file is not confirmed.
      mockQortalAction('GET_QDN_RESOURCE_STATUS', () => {
        throw new Error('no answer');
      });
      const { container } = renderWithProviders(<FilePreview file={video} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());

      fireEvent.error(container.querySelector('video')!);
      expect(screen.getByText('Preview failed. The file may not be on your node yet.')).toBeInTheDocument();
      expect(container.querySelector('video')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());

      fireEvent.error(container.querySelector('video')!);
      fireEvent.click(screen.getByRole('button', { name: 'Hide preview of clip.mp4' }));
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
      expect(screen.queryByText(/Preview failed/)).not.toBeInTheDocument();
    });

    it('fetches audio that is not on the node, shows why there is no player, and plays once READY', async () => {
      const audio = { ...base, identifier: 'qshare_file_x_mp3', filename: 'song.mp3', mimetype: 'audio/mpeg', size: 9_000_000 };
      store.dispatch(removeDownload(audio.identifier));
      const downloadVideo = vi.fn();
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'PUBLISHED', percentLoaded: 0 });
      const { container } = renderWithProviders(
        <MyContext.Provider value={{ downloadVideo, retryDownload: () => {} }}>
          <FilePreview file={audio} />
        </MyContext.Provider>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Preview audio song.mp3' }));
      await waitFor(() => expect(downloadVideo).toHaveBeenCalledTimes(1));
      act(() => {
        store.dispatch(setAddToDownloads({ name: 'alice', service: 'FILE', identifier: audio.identifier, properties: {} }));
        store.dispatch(updateDownloads({ identifier: audio.identifier, status: { status: 'DOWNLOADING', percentLoaded: 40 } }));
      });
      expect(await screen.findByText('Fetching from peers… 40%')).toBeInTheDocument();
      expect(screen.getByText("It plays here once it's on your node.")).toBeInTheDocument();
      expect(container.querySelector('audio')).toBeNull();

      act(() => {
        store.dispatch(updateDownloads({ identifier: audio.identifier, status: { status: 'READY', percentLoaded: 100 } }));
      });
      const player = container.querySelector('audio');
      expect(player).toHaveAttribute('src', '/arbitrary/FILE/alice/qshare_file_x_mp3');

      // "Clear finished" in the downloads sheet leaves the player alone.
      act(() => {
        store.dispatch(clearFinishedDownloads());
      });
      expect(container.querySelector('audio')).toBe(player);
    });

    it('says the format cannot be played when a file the node confirmed fails, with no Try again', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' });
      const { container } = renderWithProviders(<FilePreview file={video} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());

      fireEvent.error(container.querySelector('video')!);
      expect(screen.getByText("This format can't be played here. Download it instead.")).toBeInTheDocument();
      expect(screen.queryByText(/may not be on your node/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      expect(container.querySelector('video')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Hide preview of clip.mp4' }));
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    });

    it('keeps the same player when the file is downloaded while it plays', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' });
      const { container } = renderWithProviders(<FilePreview file={video} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
      const player = container.querySelector('video');

      // The row's Download (or Fetch all) starts, then its first poll says READY.
      act(() => {
        store.dispatch(setAddToDownloads({ name: 'alice', service: 'FILE', identifier: video.identifier, properties: {} }));
      });
      expect(container.querySelector('video')).toBe(player);
      act(() => {
        store.dispatch(updateDownloads({ identifier: video.identifier, status: { status: 'READY', percentLoaded: 100 } }));
      });
      expect(container.querySelector('video')).toBe(player);
    });

    it('keeps the player when a finished download is cleared from the list', async () => {
      store.dispatch(setAddToDownloads({ name: 'alice', service: 'FILE', identifier: video.identifier, properties: {} }));
      store.dispatch(updateDownloads({ identifier: video.identifier, status: { status: 'READY', percentLoaded: 100 } }));
      const { container } = renderWithProviders(<FilePreview file={video} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
      const player = container.querySelector('video');
      // The READY entry is enough: no status check.
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(0);

      act(() => {
        store.dispatch(clearFinishedDownloads());
      });
      expect(container.querySelector('video')).toBe(player);
      expect(screen.queryByText('Checking your node…')).not.toBeInTheDocument();
    });

    it('a play that failed before the file was READY clears once it is', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', () => {
        throw new Error('no answer');
      });
      const { container } = renderWithProviders(<FilePreview file={video} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
      fireEvent.error(container.querySelector('video')!);
      expect(screen.getByText(/Preview failed/)).toBeInTheDocument();

      // The row's Download finishes.
      act(() => {
        store.dispatch(setAddToDownloads({ name: 'alice', service: 'FILE', identifier: video.identifier, properties: {} }));
        store.dispatch(updateDownloads({ identifier: video.identifier, status: { status: 'READY', percentLoaded: 100 } }));
      });
      expect(screen.queryByText(/Preview failed/)).not.toBeInTheDocument();
      expect(container.querySelector('video')).not.toBeNull();

      // The node has confirmed it now, so clearing the entry doesn't bring the old failure back.
      act(() => {
        store.dispatch(clearFinishedDownloads());
      });
      expect(screen.queryByText(/Preview failed/)).not.toBeInTheDocument();
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('starts a fetch again once when the node stops answering, then offers Try again', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'PUBLISHED', percentLoaded: 0 });
      const machine = stoppableDownload(video.identifier);
      const { container } = renderWithProviders(
        <MyContext.Provider value={machine.value}>
          <FilePreview file={video} />
        </MyContext.Provider>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      expect(await screen.findByText('Fetching from peers… 40%')).toBeInTheDocument();

      machine.giveUp();
      expect(machine.retryDownload).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Stalled, retrying… 40%')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

      machine.giveUp();
      expect(machine.retryDownload).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Your node stopped answering at 40%')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(machine.retryDownload).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Stalled, retrying… 40%')).toBeInTheDocument();

      machine.ready();
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('says when the network does not have the file', async () => {
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'NOT_PUBLISHED' });
      const { container } = renderWithProviders(<FilePreview file={video} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
      expect(await screen.findByText('Not found on the network')).toBeInTheDocument();
      expect(container.querySelector('video')).toBeNull();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
  });
});
