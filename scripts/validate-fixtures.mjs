import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Epub from '../lib/epub.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const epubcheckJar = process.env.EPUBCHECK_JAR;

if (!epubcheckJar) {
  throw new Error(
    'EPUBCHECK_JAR is required and must point to EPUBCheck 5.3.0 epubcheck.jar',
  );
}

await access(epubcheckJar).catch(() => {
  throw new Error(`EPUBCheck jar does not exist: ${epubcheckJar}`);
});

const epubcheckVersion = spawnSync(
  'java',
  ['-jar', epubcheckJar, '--version'],
  { encoding: 'utf8' },
);
if (
  epubcheckVersion.status !== 0 ||
  !`${epubcheckVersion.stdout}${epubcheckVersion.stderr}`.includes('v5.3.0')
) {
  throw new Error(
    `Expected EPUBCheck 5.3.0, received: ${epubcheckVersion.stdout}${epubcheckVersion.stderr}`,
  );
}

const aceBin = join(projectRoot, 'node_modules/.bin/ace-puppeteer');
await access(aceBin).catch(() => {
  throw new Error(
    'Ace 1.4.6 is missing; install dev dependencies with pnpm install',
  );
});

const run = (command, args, label) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
};

const outputFolder = await mkdtemp(join(tmpdir(), 'nodepub-validation-'));
const reportFolder = await mkdtemp(join(tmpdir(), 'nodepub-ace-'));

const metadata = {
  accessMode: ['textual'],
  accessModeSufficient: ['textual'],
  accessibilityFeature: ['structuralNavigation'],
  accessibilityHazard: ['none'],
  accessibilitySummary:
    'This text-only publication includes structural navigation.',
  author: 'Example Author',
  contents: 'Contents',
  cover: '<h1>Validation fixture</h1>',
  id: 'urn:uuid:c0f5cfc0-11c9-4695-907c-01ef40f32a92',
  language: 'en',
  modified: '2026-08-09T09:00:00Z',
  published: '2026-08-09',
  title: 'Validation fixture',
};

const sections = [
  {
    content: '<h1>Chapter one</h1><p>A text-only chapter.</p>',
    title: 'Chapter one',
  },
];

try {
  const [coverData, bodyImageData] = await Promise.all([
    readFile(join(projectRoot, 'example/cover.png')),
    readFile(join(projectRoot, 'example/hat.png')),
  ]);
  const fixtures = [
    {
      filename: 'minimal.epub',
      options: { coverType: 'text', showContentsInSpine: true },
    },
    {
      filename: 'hidden-contents.epub',
      options: { coverType: 'text', showContentsInSpine: false },
    },
    {
      filename: 'accessibility-metadata.epub',
      metadata: {
        ...metadata,
        accessMode: ['textual', 'visual'],
        accessibilityFeature: ['structuralNavigation', 'tableOfContents'],
      },
      options: { coverType: 'text', showContentsInSpine: true },
    },
    {
      filename: 'images.epub',
      metadata: {
        ...metadata,
        accessMode: ['textual', 'visual'],
        accessibilityFeature: ['structuralNavigation', 'alternativeText'],
        accessibilitySummary:
          'This publication includes structural navigation and text alternatives for its images.',
        cover: { data: coverData, name: 'cover.png' },
        coverAlt: 'Cover of Validation fixture by Example Author',
      },
      options: { coverType: 'image', showContentsInSpine: true },
      resources: [{ data: bodyImageData, name: 'hat.png' }],
      sections: [
        {
          content:
            '<h1>Illustrated chapter</h1><p><img src="../resources/hat.png" alt="A black top hat." /></p>',
          title: 'Illustrated chapter',
        },
      ],
    },
  ];

  for (const fixture of fixtures) {
    const epub = new Epub({
      metadata: fixture.metadata || metadata,
      options: fixture.options,
      resources: fixture.resources || [],
      sections: fixture.sections || sections,
    });
    await epub.write(outputFolder, fixture.filename);
    run(
      'java',
      ['-jar', epubcheckJar, join(outputFolder, fixture.filename)],
      `EPUBCheck 5.3.0 (${fixture.filename})`,
    );
  }

  for (const filename of [
    'minimal.epub',
    'accessibility-metadata.epub',
    'images.epub',
  ]) {
    run(
      aceBin,
      [
        '--exiterror2',
        '--force',
        '--subdir',
        '--outdir',
        reportFolder,
        join(outputFolder, filename),
      ],
      `Ace 1.4.6 (${filename})`,
    );
  }
} finally {
  await Promise.all([
    rm(outputFolder, { force: true, recursive: true }),
    rm(reportFolder, { force: true, recursive: true }),
  ]);
}
