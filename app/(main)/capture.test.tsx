/**
 * Tests for app/(main)/capture.tsx
 *
 * Level 1 (Unit):       generateImageId and copyImageToPermanentStorage in isolation —
 *                        no React rendering, no AsyncStorage, pure function behavior.
 *
 * Level 2 (Integration): CaptureScreen component with all native modules mocked —
 *                        verifies that the component wires file-copy to navigation correctly.
 *
 * Level 3 (Acceptance):  Full capture flow from button press to router.push —
 *                        asserts the imageUri query param carries a permanent
 *                        documentDirectory path, not the original temp picker URI.
 *
 * Note: AsyncStorage storage of the final imageUri happens downstream in classify.tsx
 * → JobService.addDocument. The acceptance boundary tested here is that the URI
 * passed through the navigation layer (imageUri query param) is already permanent,
 * which is what classify.tsx will write to AsyncStorage unchanged.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';

import CaptureScreen, { generateImageId, copyImageToPermanentStorage } from './capture';

// ─── Shared helper ────────────────────────────────────────────────────────────

/** Extracts and URL-decodes a named query param from a URL string. */
function getQueryParam(url: string, param: string): string {
  const match = url.match(new RegExp(`[?&]${param}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// ─── Level 1: Unit Tests ──────────────────────────────────────────────────────

describe('Unit | generateImageId', () => {
  it('returns a non-empty string', () => {
    // Validates the basic contract: callers can use the return value as a
    // filename-safe identifier without guarding against null/empty.
    const id = generateImageId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns a unique value on each call', () => {
    // Validates uniqueness across 50 rapid calls to guard against filename
    // collisions when multiple photos are taken in quick succession.
    const ids = Array.from({ length: 50 }, () => generateImageId());
    expect(new Set(ids).size).toBe(50);
  });
});

describe('Unit | copyImageToPermanentStorage', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any — spying on mock prototype methods
  let copySpy: jest.SpyInstance;
  let createSpy: jest.SpyInstance;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any — File.copy exists in v19 runtime; jest.setup.js mock provides it
    copySpy = jest.spyOn(FileSystem.File.prototype as any, 'copy');
    createSpy = jest.spyOn(FileSystem.Directory.prototype, 'create');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a URI rooted under documentDirectory', async () => {
    // Core contract of the fix: the returned URI must be under documentDirectory
    // so it survives OS cache eviction. If this fails, the bug is not fixed.
    const uri = await copyImageToPermanentStorage('mock://temp-photo.jpg');
    expect(uri.startsWith(FileSystem.Paths.document.uri)).toBe(true);
  });

  it('returns a URI containing the pegasus_images directory segment', async () => {
    // Images must land in a dedicated subdirectory, not loose in the root
    // of documentDirectory where they could conflict with other app data.
    const uri = await copyImageToPermanentStorage('mock://temp-photo.jpg');
    expect(uri).toContain('pegasus_images');
  });

  it('returns a URI with a .jpg extension', async () => {
    // Downstream consumers (export.tsx email attachments, sharing) rely on
    // the extension to set correct MIME types.
    const uri = await copyImageToPermanentStorage('mock://temp-photo.jpg');
    expect(uri.endsWith('.jpg')).toBe(true);
  });

  it('creates the pegasus_images directory when it does not yet exist', async () => {
    // The MockDirectory.exists getter returns false by default, simulating
    // first-run where the directory has not been created yet.
    await copyImageToPermanentStorage('mock://temp-photo.jpg');
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('skips directory creation when pegasus_images already exists', async () => {
    // Calling Directory.create() on an already-existing directory can throw
    // on some platforms. The function must check before creating.
    jest
      .spyOn(FileSystem.Directory.prototype, 'exists', 'get')
      .mockReturnValueOnce(true);
    await copyImageToPermanentStorage('mock://temp-photo.jpg');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('calls copy on the source File exactly once', async () => {
    // Validates that the file copy operation actually executes and is not
    // accidentally skipped or called multiple times.
    await copyImageToPermanentStorage('mock://temp-photo.jpg');
    expect(copySpy).toHaveBeenCalledTimes(1);
  });

  it('passes a destination File under documentDirectory to copy()', async () => {
    // Validates that copy() receives a File instance pointing to the
    // permanent location — not a string, not a temp cache path.
    await copyImageToPermanentStorage('mock://temp-photo.jpg');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any — mock instance type
    const destArg = copySpy.mock.calls[0][0] as any;
    expect(destArg).toBeInstanceOf(FileSystem.File);
    expect(destArg.uri.startsWith(FileSystem.Paths.document.uri)).toBe(true);
  });

  it('propagates filesystem errors so the caller can surface them to the user', async () => {
    // copyImageToPermanentStorage must NOT silently swallow errors. The
    // calling handleImageSelected() relies on the rejection to show the
    // driver an alert and prevent navigation with a broken URI.
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(FileSystem.File.prototype as any, 'copy')
      .mockImplementationOnce(() => {
        throw new Error('Mock filesystem error');
      });
    await expect(
      copyImageToPermanentStorage('mock://temp-photo.jpg')
    ).rejects.toThrow('Mock filesystem error');
  });
});

// ─── Level 2: Integration Tests ──────────────────────────────────────────────

describe('Integration | CaptureScreen', () => {
  let mockPush: jest.Mock;

  beforeEach(() => {
    mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      dismissAll: jest.fn(),
    });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ jobId: 'job-001' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('TAKE PHOTO button', () => {
    it('copies the image to permanent storage before navigating to classify', async () => {
      // Validates the ordering contract: copy must complete before router.push
      // so the URI that classify.tsx receives is always permanent. If push
      // fires before copy, the original temp URI reaches AsyncStorage.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const copySpy = jest.spyOn(FileSystem.File.prototype as any, 'copy');
      const { getByText } = render(<CaptureScreen />);

      fireEvent.press(getByText('TAKE PHOTO'));
      await waitFor(() => expect(mockPush).toHaveBeenCalled());

      expect(copySpy).toHaveBeenCalled();
      expect(copySpy.mock.invocationCallOrder[0]).toBeLessThan(
        mockPush.mock.invocationCallOrder[0]
      );
    });

    it('navigates to classify with a permanent URI, not the picker temp URI', async () => {
      // The ImagePicker mock returns 'mock://photo.jpg'. After the fix,
      // the imageUri param must be a documentDirectory path.
      const { getByText } = render(<CaptureScreen />);

      fireEvent.press(getByText('TAKE PHOTO'));
      await waitFor(() => expect(mockPush).toHaveBeenCalled());

      const url = mockPush.mock.calls[0][0] as string;
      const imageUri = getQueryParam(url, 'imageUri');
      expect(imageUri).not.toBe('mock://photo.jpg');
      expect(imageUri.startsWith(FileSystem.Paths.document.uri)).toBe(true);
    });

    it('includes the correct jobId in the classify URL', async () => {
      const { getByText } = render(<CaptureScreen />);

      fireEvent.press(getByText('TAKE PHOTO'));
      await waitFor(() => expect(mockPush).toHaveBeenCalled());

      const url = mockPush.mock.calls[0][0] as string;
      expect(url).toContain('jobId=job-001');
    });

    it('shows a Save Failed alert and does NOT navigate when the file copy throws', async () => {
      // Validates the failure path: the driver must be informed clearly and
      // must not land on classify with an already-broken URI.
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(FileSystem.File.prototype as any, 'copy')
        .mockImplementationOnce(() => {
          throw new Error('Disk full');
        });
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = render(<CaptureScreen />);

      fireEvent.press(getByText('TAKE PHOTO'));
      await waitFor(() => expect(alertSpy).toHaveBeenCalled());

      expect(alertSpy).toHaveBeenCalledWith('Save Failed', expect.any(String));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('CHOOSE FROM GALLERY button', () => {
    it('copies the image to permanent storage before navigating to classify', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const copySpy = jest.spyOn(FileSystem.File.prototype as any, 'copy');
      const { getByText } = render(<CaptureScreen />);

      fireEvent.press(getByText('CHOOSE FROM GALLERY'));
      await waitFor(() => expect(mockPush).toHaveBeenCalled());

      expect(copySpy).toHaveBeenCalled();
      expect(copySpy.mock.invocationCallOrder[0]).toBeLessThan(
        mockPush.mock.invocationCallOrder[0]
      );
    });

    it('navigates to classify with a permanent URI, not the picker temp URI', async () => {
      // The gallery mock returns 'mock://library-photo.jpg'.
      const { getByText } = render(<CaptureScreen />);

      fireEvent.press(getByText('CHOOSE FROM GALLERY'));
      await waitFor(() => expect(mockPush).toHaveBeenCalled());

      const url = mockPush.mock.calls[0][0] as string;
      const imageUri = getQueryParam(url, 'imageUri');
      expect(imageUri).not.toBe('mock://library-photo.jpg');
      expect(imageUri.startsWith(FileSystem.Paths.document.uri)).toBe(true);
    });

    it('shows a Save Failed alert and does NOT navigate when the file copy throws', async () => {
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(FileSystem.File.prototype as any, 'copy')
        .mockImplementationOnce(() => {
          throw new Error('No storage');
        });
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = render(<CaptureScreen />);

      fireEvent.press(getByText('CHOOSE FROM GALLERY'));
      await waitFor(() => expect(alertSpy).toHaveBeenCalled());

      expect(alertSpy).toHaveBeenCalledWith('Save Failed', expect.any(String));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

// ─── Level 3: Acceptance Tests ───────────────────────────────────────────────

describe('Acceptance | Capture flow stores permanent image URI', () => {
  let mockPush: jest.Mock;

  beforeEach(() => {
    mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      dismissAll: jest.fn(),
    });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ jobId: 'acc-job-001' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('camera capture: imageUri query param starts with documentDirectory path', async () => {
    // End-to-end validation of the fix. The picker mock returns 'mock://photo.jpg'
    // (a temp URI). This test asserts that the imageUri which will be written to
    // AsyncStorage by classify.tsx → JobService.addDocument is a permanent
    // documentDirectory URI — not the temp cache URI that could be invalidated.
    const { getByText } = render(<CaptureScreen />);

    fireEvent.press(getByText('TAKE PHOTO'));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    const url = mockPush.mock.calls[0][0] as string;
    const imageUri = getQueryParam(url, 'imageUri');
    expect(imageUri.startsWith(FileSystem.Paths.document.uri)).toBe(true);
  });

  it('gallery selection: imageUri query param starts with documentDirectory path', async () => {
    const { getByText } = render(<CaptureScreen />);

    fireEvent.press(getByText('CHOOSE FROM GALLERY'));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    const url = mockPush.mock.calls[0][0] as string;
    const imageUri = getQueryParam(url, 'imageUri');
    expect(imageUri.startsWith(FileSystem.Paths.document.uri)).toBe(true);
  });

  it('imageUri query param never contains the original temp picker URI', async () => {
    // Belt-and-suspenders: confirms the raw picker URI is not being forwarded
    // even if the documentDirectory check above were somehow falsely satisfied.
    const { getByText } = render(<CaptureScreen />);

    fireEvent.press(getByText('TAKE PHOTO'));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    const url = mockPush.mock.calls[0][0] as string;
    const imageUri = getQueryParam(url, 'imageUri');

    // 'mock://photo.jpg' is the URI returned by the ImagePicker mock in jest.setup.js.
    expect(imageUri).not.toContain('mock://photo.jpg');
  });
});
