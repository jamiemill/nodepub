import defaults from 'defaults';
import mime from 'mime';
import { basename, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

import type { Resource } from './types.js';

// Create a folder, throwing an error only if the error is not that
// the folder already exists. Effectively creates if not found.
const makeFolder = async (topPath: string) => {
  await mkdir(topPath).catch((err) => {
    if (err && err.code !== 'EEXIST') {
      throw err;
    }
    resolve();
  });
};

const uniqueResources = (acc: Resource[], cur: Resource) => {
  if (!acc.some(({ name }) => name === cur.name)) {
    acc.push(cur);
  }
  return acc;
};

const assertUniqueResourceBases = (resources: Required<Resource>[]) => {
  const namesByBase = new Map<string, string>();

  resources.forEach(({ base, name }) => {
    if (!base || basename(base) !== base || base.includes('\\')) {
      throw new Error(`Invalid resource archive filename: "${base}"`);
    }

    const previousName = namesByBase.get(base);
    if (previousName) {
      throw new Error(
        `Resource "${base}" archive path collision: "${previousName}" and "${name}"`,
      );
    }
    namesByBase.set(base, name);
  });
};

// Checks if a type already has been added manually by user
const addResourceDetails = (resource: Resource): Required<Resource> => {
  let { data } = resource;
  const { name } = resource;
  const requiredResource = defaults(resource, {
    base: basename(name),
    properties: '',
    type: mime.getType(name) || '',
  });

  if (!requiredResource.type) {
    throw new Error(
      `Unable to determine a media type for resource "${name}"; provide type explicitly`,
    );
  }

  // Overwrite because buffer has become an uint8array
  if (!Buffer.isBuffer(data)) {
    data = Buffer.from(data);
  }
  requiredResource.data = data;
  return requiredResource;
};

export {
  addResourceDetails,
  assertUniqueResourceBases,
  makeFolder,
  uniqueResources,
};
