/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  NumberPrefixParser,
  DocMetadataBase,
  VersionMetadata,
  SidebarOptions,
} from '../types';
import type {
  Sidebars,
  Sidebar,
  SidebarItem,
  NormalizedSidebarItem,
  NormalizedSidebar,
  NormalizedSidebars,
  SidebarItemsGeneratorOption,
  SidebarItemsGeneratorDoc,
  SidebarItemsGeneratorVersion,
} from './types';
import {transformSidebarItems} from './utils';
import {DefaultSidebarItemsGenerator} from './generator';
import {mapValues, memoize, pick} from 'lodash';
import combinePromises from 'combine-promises';

export type SidebarProcessorProps = {
  sidebarItemsGenerator: SidebarItemsGeneratorOption;
  numberPrefixParser: NumberPrefixParser;
  docs: DocMetadataBase[];
  version: VersionMetadata;
  options: SidebarOptions;
};

function toSidebarItemsGeneratorDoc(
  doc: DocMetadataBase,
): SidebarItemsGeneratorDoc {
  return pick(doc, [
    'id',
    'frontMatter',
    'source',
    'sourceDirName',
    'sidebarPosition',
  ]);
}

function toSidebarItemsGeneratorVersion(
  version: VersionMetadata,
): SidebarItemsGeneratorVersion {
  return pick(version, ['versionName', 'contentPath']);
}

// Handle the generation of autogenerated sidebar items and other post-processing checks
async function processSidebar(
  unprocessedSidebar: NormalizedSidebar,
  {
    sidebarItemsGenerator,
    numberPrefixParser,
    docs,
    version,
    options,
  }: SidebarProcessorProps,
): Promise<Sidebar> {
  // Just a minor lazy transformation optimization
  const getSidebarItemsGeneratorDocsAndVersion = memoize(() => ({
    docs: docs.map(toSidebarItemsGeneratorDoc),
    version: toSidebarItemsGeneratorVersion(version),
  }));

  async function handleAutoGeneratedItems(
    item: NormalizedSidebarItem,
  ): Promise<SidebarItem[]> {
    if (item.type === 'category') {
      return [
        {
          ...item,
          items: (
            await Promise.all(item.items.map(handleAutoGeneratedItems))
          ).flat(),
        },
      ];
    }
    if (item.type === 'autogenerated') {
      return sidebarItemsGenerator({
        item,
        numberPrefixParser,
        defaultSidebarItemsGenerator: DefaultSidebarItemsGenerator,
        ...getSidebarItemsGeneratorDocsAndVersion(),
        options,
      });
    }
    return [item];
  }

  const processedSidebar = (
    await Promise.all(unprocessedSidebar.map(handleAutoGeneratedItems))
  ).flat();

  const fixSidebarItemInconsistencies = (item: SidebarItem): SidebarItem => {
    // A non-collapsible category can't be collapsed!
    if (item.type === 'category' && !item.collapsible && item.collapsed) {
      return {
        ...item,
        collapsed: false,
      };
    }
    return item;
  };
  return transformSidebarItems(processedSidebar, fixSidebarItemInconsistencies);
}

export async function processSidebars(
  unprocessedSidebars: NormalizedSidebars,
  props: SidebarProcessorProps,
): Promise<Sidebars> {
  return combinePromises(
    mapValues(unprocessedSidebars, (unprocessedSidebar) =>
      processSidebar(unprocessedSidebar, props),
    ),
  );
}
