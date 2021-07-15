/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs-extra';
import {
  aliasedSitePath,
  getEditUrl,
  getFolderContainingFile,
  normalizeUrl,
  parseMarkdownString,
  posixPath,
  Globby,
} from '@docusaurus/utils';
import {LoadContext} from '@docusaurus/types';

import {getFileLastUpdate} from './lastUpdate';
import {
  DocFile,
  DocMetadataBase,
  LastUpdateData,
  MetadataOptions,
  PluginOptions,
  VersionMetadata,
} from './types';
import getSlug from './slug';
import {CURRENT_VERSION_NAME} from './constants';
import {getDocsDirPaths} from './versions';
import {stripPathNumberPrefixes} from './numberPrefix';
import {validateDocFrontMatter} from './docFrontMatter';
import chalk from 'chalk';

type LastUpdateOptions = Pick<
  PluginOptions,
  'showLastUpdateAuthor' | 'showLastUpdateTime'
>;

async function readLastUpdateData(
  filePath: string,
  options: LastUpdateOptions,
): Promise<LastUpdateData> {
  const {showLastUpdateAuthor, showLastUpdateTime} = options;
  if (showLastUpdateAuthor || showLastUpdateTime) {
    // Use fake data in dev for faster development.
    const fileLastUpdateData =
      process.env.NODE_ENV === 'production'
        ? await getFileLastUpdate(filePath)
        : {
            author: 'Author',
            timestamp: 1539502055,
          };

    if (fileLastUpdateData) {
      const {author, timestamp} = fileLastUpdateData;
      return {
        lastUpdatedAt: showLastUpdateTime ? timestamp : undefined,
        lastUpdatedBy: showLastUpdateAuthor ? author : undefined,
      };
    }
  }

  return {};
}

export async function readDocFile(
  versionMetadata: Pick<
    VersionMetadata,
    'contentPath' | 'contentPathLocalized'
  >,
  source: string,
  options: LastUpdateOptions,
): Promise<DocFile> {
  const contentPath = await getFolderContainingFile(
    getDocsDirPaths(versionMetadata),
    source,
  );

  const filePath = path.join(contentPath, source);

  const [content, lastUpdate] = await Promise.all([
    fs.readFile(filePath, 'utf-8'),
    readLastUpdateData(filePath, options),
  ]);
  return {source, content, lastUpdate, contentPath, filePath};
}

export async function readVersionDocs(
  versionMetadata: VersionMetadata,
  options: Pick<
    PluginOptions,
    'include' | 'exclude' | 'showLastUpdateAuthor' | 'showLastUpdateTime'
  >,
): Promise<DocFile[]> {
  const sources = await Globby(options.include, {
    cwd: versionMetadata.contentPath,
    ignore: options.exclude,
  });
  return Promise.all(
    sources.map((source) => readDocFile(versionMetadata, source, options)),
  );
}

function doProcessDocMetadata({
  docFile,
  versionMetadata,
  context,
  options,
}: {
  docFile: DocFile;
  versionMetadata: VersionMetadata;
  context: LoadContext;
  options: MetadataOptions;
}): DocMetadataBase {
  const {source, content, lastUpdate, contentPath, filePath} = docFile;
  const {homePageId} = options;
  const {siteDir, i18n} = context;

  const {
    frontMatter: unsafeFrontMatter,
    contentTitle,
    excerpt,
  } = parseMarkdownString(content);
  const frontMatter = validateDocFrontMatter(unsafeFrontMatter);

  const {
    custom_edit_url: customEditURL,

    // Strip number prefixes by default (01-MyFolder/01-MyDoc.md => MyFolder/MyDoc) by default,
    // but allow to disable this behavior with frontmatterr
    // eslint-disable-next-line camelcase
    parse_number_prefixes = true,
  } = frontMatter;

  // ex: api/plugins/myDoc -> myDoc
  // ex: myDoc -> myDoc
  const sourceFileNameWithoutExtension = path.basename(
    source,
    path.extname(source),
  );

  // ex: api/plugins/myDoc -> api/plugins
  // ex: myDoc -> .
  const sourceDirName = path.dirname(source);

  // eslint-disable-next-line camelcase
  const {filename: unprefixedFileName, numberPrefix} = parse_number_prefixes
    ? options.numberPrefixParser(sourceFileNameWithoutExtension)
    : {filename: sourceFileNameWithoutExtension, numberPrefix: undefined};

  const baseID: string = frontMatter.id ?? unprefixedFileName;
  if (baseID.includes('/')) {
    throw new Error(`Document id "${baseID}" cannot include slash.`);
  }

  // For autogenerated sidebars, sidebar position can come from filename number prefix or frontmatter
  const sidebarPosition: number | undefined =
    frontMatter.sidebar_position ?? numberPrefix;

  // TODO legacy retrocompatibility
  // The same doc in 2 distinct version could keep the same id,
  // we just need to namespace the data by version
  const versionIdPrefix =
    versionMetadata.versionName === CURRENT_VERSION_NAME
      ? undefined
      : `version-${versionMetadata.versionName}`;

  // TODO legacy retrocompatibility
  // I think it's bad to affect the frontmatter id with the dirname?
  function computeDirNameIdPrefix() {
    if (sourceDirName === '.') {
      return undefined;
    }
    // Eventually remove the number prefixes from intermediate directories
    // eslint-disable-next-line camelcase
    return parse_number_prefixes
      ? stripPathNumberPrefixes(sourceDirName, options.numberPrefixParser)
      : sourceDirName;
  }

  const unversionedId = [computeDirNameIdPrefix(), baseID]
    .filter(Boolean)
    .join('/');

  // TODO is versioning the id very useful in practice?
  // legacy versioned id, requires a breaking change to modify this
  const id = [versionIdPrefix, unversionedId].filter(Boolean).join('/');

  // TODO remove soon, deprecated homePageId
  const isDocsHomePage = unversionedId === (homePageId ?? '_index');
  if (frontMatter.slug && isDocsHomePage) {
    throw new Error(
      `The docs homepage (homePageId=${homePageId}) is not allowed to have a frontmatter slug=${frontMatter.slug} => you have to choose either homePageId or slug, not both`,
    );
  }

  const docSlug = isDocsHomePage
    ? '/'
    : getSlug({
        baseID,
        dirName: sourceDirName,
        frontmatterSlug: frontMatter.slug,
        stripDirNumberPrefixes: parse_number_prefixes,
        numberPrefixParser: options.numberPrefixParser,
      });

  // Note: the title is used by default for page title, sidebar label, pagination buttons...
  // frontMatter.title should be used in priority over contentTitle (because it can contain markdown/JSX syntax)
  const title: string = frontMatter.title ?? contentTitle ?? baseID;

  const description: string = frontMatter.description ?? excerpt ?? '';

  const permalink = normalizeUrl([versionMetadata.versionPath, docSlug]);

  function getDocEditUrl() {
    const relativeFilePath = path.relative(contentPath, filePath);

    if (typeof options.editUrl === 'function') {
      return options.editUrl({
        version: versionMetadata.versionName,
        versionDocsDirPath: posixPath(
          path.relative(siteDir, versionMetadata.contentPath),
        ),
        docPath: posixPath(relativeFilePath),
        permalink,
        locale: context.i18n.currentLocale,
      });
    } else if (typeof options.editUrl === 'string') {
      const isLocalized = contentPath === versionMetadata.contentPathLocalized;
      const baseVersionEditUrl =
        isLocalized && options.editLocalizedFiles
          ? versionMetadata.versionEditUrlLocalized
          : versionMetadata.versionEditUrl;
      return getEditUrl(relativeFilePath, baseVersionEditUrl);
    } else {
      return undefined;
    }
  }

  // Assign all of object properties during instantiation (if possible) for
  // NodeJS optimization.
  // Adding properties to object after instantiation will cause hidden
  // class transitions.
  return {
    unversionedId,
    id,
    isDocsHomePage,
    title,
    description,
    source: aliasedSitePath(filePath, siteDir),
    sourceDirName,
    slug: docSlug,
    permalink,
    editUrl: customEditURL !== undefined ? customEditURL : getDocEditUrl(),
    version: versionMetadata.versionName,
    lastUpdatedBy: lastUpdate.lastUpdatedBy,
    lastUpdatedAt: lastUpdate.lastUpdatedAt,
    formattedLastUpdatedAt: lastUpdate.lastUpdatedAt
      ? new Intl.DateTimeFormat(i18n.currentLocale).format(
          lastUpdate.lastUpdatedAt * 1000,
        )
      : undefined,
    sidebarPosition,
    frontMatter,
  };
}

export function processDocMetadata(args: {
  docFile: DocFile;
  versionMetadata: VersionMetadata;
  context: LoadContext;
  options: MetadataOptions;
}): DocMetadataBase {
  try {
    return doProcessDocMetadata(args);
  } catch (e) {
    console.error(
      chalk.red(
        `Can't process doc metadatas for doc at path "${args.docFile.filePath}" in version "${args.versionMetadata.versionName}"`,
      ),
    );
    throw e;
  }
}
