import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { FilePreview, IMAGE_AUTO_PREVIEW_BYTES, TEXT_PREVIEW_BYTES, previewKind, shouldAutoPreview } from './FilePreview';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
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

  it('shows a PDF frame only after "Preview PDF", without fetching anything itself', () => {
    renderWithProviders(<FilePreview file={pdf} />);
    expect(screen.queryByTitle('Preview of paper.pdf')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview PDF paper.pdf' }));
    const frame = screen.getByTitle('Preview of paper.pdf');
    expect(frame).toHaveAttribute('src', '/arbitrary/FILE/alice/qshare_file_x_pdf');
    expect(screen.getByText('If the preview stays blank, download the file.')).toBeInTheDocument();
    expect(fetchCallsMatching('/arbitrary/FILE/').length).toBe(0);
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
