import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
}));

const { mkdir } = await import('node:fs/promises');

const { addResourceDetails, makeFolder } = await import('../src/utils');

describe('utils', () => {
  describe('addResourceDetails', () => {
    const cases = [
      ['folder/image.gif', 'image/gif'],
      ['folder/image.jpeg', 'image/jpeg'],
      ['folder/image.jpg', 'image/jpeg'],
      ['folder/image.png', 'image/png'],
      ['folder/image.svg', 'image/svg+xml'],
      ['folder/image.tif', 'image/tiff'],
      ['folder/image.tiff', 'image/tiff'],
      ['folder/some-file', ''],
    ];

    const data = Buffer.from([0]);

    it.concurrent.each(cases)('%s is of type %s', (image, exp) =>
      expect(addResourceDetails({ data, name: image })).toStrictEqual({
        base: image.slice('folder/'.length),
        data,
        name: image,
        properties: '',
        type: exp,
      }),
    );
  });

  describe('makeFolder', () => {
    beforeEach(() => {
      (mkdir as Mock).mockClear();
    });

    it('Works', async () => {
      (mkdir as Mock).mockImplementationOnce(() => Promise.resolve(0));
      await makeFolder('folder');
      expect(mkdir).toBeCalledWith('folder');
    });

    it('Throws Error', async () => {
      const err = new Error('Bad Folder');
      (mkdir as Mock).mockImplementationOnce(() => Promise.reject(err));
      try {
        await makeFolder('folder');
      } catch (e) {
        expect(e).toBe(err);
      }
    });

    it('Ignores EEXIST Error', async () => {
      const err = new Error('Already Exists');
      // Node doesn't expose SystemError
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = 'EEXIST';
      (mkdir as Mock).mockImplementationOnce(() => Promise.reject(err));
      try {
        await makeFolder('folder');
        expect(mkdir).toBeCalledWith('folder');
      } catch (e) {
        expect(e).not.toBeDefined();
      }
    });
  });
});
