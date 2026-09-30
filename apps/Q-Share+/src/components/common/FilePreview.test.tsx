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
import { removeDownload, setAddToDownloads, updateDownloads } from '../../state/features/globalSlice';
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

  it('renders a video player with preload="none" after "Preview video"', () => {
    const { container } = renderWithProviders(<FilePreview file={video} />);
    expect(container.querySelector('video')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Preview video clip.mp4' }));
    const player = container.querySelector('video');
    expect(player).not.toBeNull();
    expect(player).toHaveAttribute('preload', 'none');
    expect(player).toHaveAttribute('controls');
    expect(player).toHaveAttribute('playsinline');
    expect(fetchCallsMatching('/arbitrary/FILE/').length).toBe(0);
  });
});
