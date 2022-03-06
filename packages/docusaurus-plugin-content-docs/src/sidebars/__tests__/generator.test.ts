/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {DefaultSidebarItemsGenerator} from '../generator';
import type {SidebarItemsGenerator} from '../types';
import {DefaultNumberPrefixParser} from '../../numberPrefix';
import {isCategoryIndex} from '../../docs';

describe('DefaultSidebarItemsGenerator', () => {
  function testDefaultSidebarItemsGenerator(
    params: Partial<Parameters<SidebarItemsGenerator>[0]>,
  ) {
    return DefaultSidebarItemsGenerator({
      numberPrefixParser: DefaultNumberPrefixParser,
      isCategoryIndex,
      item: {
        type: 'autogenerated',
        dirName: '.',
      },
      version: {
        versionName: 'current',
        contentPath: 'docs',
      },
      docs: [],
      options: {
        sidebarCollapsed: true,
        sidebarCollapsible: true,
      },
      categoriesMetadata: {},
      ...params,
    });
  }

  test('generates empty sidebar slice when no docs and emit a warning', async () => {
    const consoleWarn = jest.spyOn(console, 'warn');
    const sidebarSlice = await testDefaultSidebarItemsGenerator({
      docs: [],
    });
    expect(sidebarSlice).toEqual([]);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*\[WARNING\].* No docs found in .*\..*: can't auto-generate a sidebar\..*/,
      ),
    );
  });

  test('generates simple flat sidebar', async () => {
    const sidebarSlice = await DefaultSidebarItemsGenerator({
      numberPrefixParser: DefaultNumberPrefixParser,
      item: {
        type: 'autogenerated',
        dirName: '.',
      },
      version: {
        versionName: 'current',
        contentPath: '',
      },
      docs: [
        {
          id: 'doc1',
          source: 'doc1.md',
          sourceDirName: '.',
          sidebarPosition: 2,
          frontMatter: {
            sidebar_label: 'doc1 sidebar label',
          },
        },
        {
          id: 'doc2',
          source: 'doc2.md',
          sourceDirName: '.',
          sidebarPosition: 3,
          frontMatter: {},
        },
        {
          id: 'doc3',
          source: 'doc3.md',
          sourceDirName: '.',
          sidebarPosition: 1,
          frontMatter: {},
        },
        {
          id: 'doc4',
          source: 'doc4.md',
          sourceDirName: '.',
          sidebarPosition: 1.5,
          frontMatter: {},
        },
        {
          id: 'doc5',
          source: 'doc5.md',
          sourceDirName: '.',
          sidebarPosition: undefined,
          frontMatter: {},
        },
      ],
      options: {
        sidebarCollapsed: true,
        sidebarCollapsible: true,
      },
    });

    expect(sidebarSlice).toMatchSnapshot();
  });

  test('generates complex nested sidebar', async () => {
    const sidebarSlice = await DefaultSidebarItemsGenerator({
      numberPrefixParser: DefaultNumberPrefixParser,
      isCategoryIndex,
      item: {
        type: 'autogenerated',
        dirName: '.',
      },
      version: {
        versionName: 'current',
        contentPath: '',
      },
      categoriesMetadata: {
        '02-Guides': {
          collapsed: false,
          customProps: {
            description: 'foo',
          },
        },
        '02-Guides/01-SubGuides': {
          label: 'SubGuides (metadata file label)',
          link: {
            type: 'generated-index',
            slug: 'subguides-generated-index-slug',
            title: 'subguides-title',
            description: 'subguides-description',
          },
        },
      },
      docs: [
        {
          id: 'intro',
          source: '@site/docs/intro.md',
          sourceDirName: '.',
          sidebarPosition: 0,
          frontMatter: {},
        },
        {
          id: 'tutorials-index',
          source: '@site/docs/01-Tutorials/index.md',
          sourceDirName: '01-Tutorials',
          sidebarPosition: 2,
          frontMatter: {},
        },
        {
          id: 'tutorial2',
          source: '@site/docs/01-Tutorials/tutorial2.md',
          sourceDirName: '01-Tutorials',
          sidebarPosition: 2,
          frontMatter: {},
        },
        {
          id: 'tutorial1',
          source: '@site/docs/01-Tutorials/tutorial1.md',
          sourceDirName: '01-Tutorials',
          sidebarPosition: 1,
          frontMatter: {},
        },
        {
          id: 'guides-index',
          source: '@site/docs/02-Guides/02-Guides.md', // TODO should we allow to just use "Guides.md" to have an index?
          sourceDirName: '02-Guides',
          frontMatter: {},
        },
        {
          id: 'guide2',
          source: '@site/docs/02-Guides/guide2.md',
          sourceDirName: '02-Guides',
          sidebarPosition: 2,
          frontMatter: {},
        },
        {
          id: 'guide1',
          source: '@site/docs/02-Guides/guide1.md',
          sourceDirName: '02-Guides',
          sidebarPosition: 0,
          frontMatter: {
            sidebar_class_name: 'foo',
          },
        },
        {
          id: 'nested-guide',
          source: '@site/docs/02-Guides/01-SubGuides/nested-guide.md',
          sourceDirName: '02-Guides/01-SubGuides',
          sidebarPosition: undefined,
          frontMatter: {},
        },
        {
          id: 'end',
          source: '@site/docs/end.md',
          sourceDirName: '.',
          sidebarPosition: 3,
          frontMatter: {},
        },
      ],
      options: {
        sidebarCollapsed: true,
        sidebarCollapsible: true,
      },
    });

    expect(sidebarSlice).toMatchSnapshot();
  });

  test('generates subfolder sidebar', async () => {
    // Ensure that category metadata file is correctly read
    // fix edge case found in https://github.com/facebook/docusaurus/issues/4638
    const sidebarSlice = await DefaultSidebarItemsGenerator({
      numberPrefixParser: DefaultNumberPrefixParser,
      isCategoryIndex,
      item: {
        type: 'autogenerated',
        dirName: 'subfolder/subsubfolder',
      },
      version: {
        versionName: 'current',
        contentPath: '',
      },
      categoriesMetadata: {
        'subfolder/subsubfolder/subsubsubfolder2': {
          position: 2,
          label: 'subsubsubfolder2 (_category_.yml label)',
          className: 'bar',
        },
        'subfolder/subsubfolder/subsubsubfolder3': {
          position: 1,
          label: 'subsubsubfolder3 (_category_.json label)',
          link: {
            type: 'doc',
            id: 'doc1', // This is a "fully-qualified" ID that can't be found locally
          },
        },
      },
      docs: [
        {
          id: 'doc1',
          source: 'doc1.md',
          sourceDirName: 'subfolder/subsubfolder',
          sidebarPosition: undefined,
          frontMatter: {},
        },
        {
          id: 'doc2',
          source: 'doc2.md',
          sourceDirName: 'subfolder',
          sidebarPosition: undefined,
          frontMatter: {},
        },
        {
          id: 'doc3',
          source: 'doc3.md',
          sourceDirName: '.',
          sidebarPosition: undefined,
          frontMatter: {},
        },
        {
          id: 'doc4',
          source: 'doc4.md',
          sourceDirName: 'subfolder/subsubfolder',
          sidebarPosition: undefined,
          frontMatter: {},
        },
        {
          id: 'doc5',
          source: 'doc5.md',
          sourceDirName: 'subfolder/subsubfolder/subsubsubfolder',
          sidebarPosition: undefined,
          frontMatter: {},
        },
        {
          id: 'doc6',
          source: 'doc6.md',
          sourceDirName: 'subfolder/subsubfolder/subsubsubfolder2',
          sidebarPosition: undefined,
          frontMatter: {},
        },
        {
          id: 'doc7',
          source: 'doc7.md',
          sourceDirName: 'subfolder/subsubfolder/subsubsubfolder3',
          sidebarPosition: 2,
          frontMatter: {},
        },
        {
          id: 'doc8',
          source: 'doc8.md',
          sourceDirName: 'subfolder/subsubfolder/subsubsubfolder3',
          sidebarPosition: 1,
          frontMatter: {},
        },
      ],
      options: {
        sidebarCollapsed: true,
        sidebarCollapsible: true,
      },
    });

    expect(sidebarSlice).toMatchSnapshot();
  });

  test('uses explicit link over the index/readme.{md,mdx} naming convention', async () => {
    const sidebarSlice = await DefaultSidebarItemsGenerator({
      numberPrefixParser: DefaultNumberPrefixParser,
      item: {
        type: 'autogenerated',
        dirName: '.',
      },
      version: {
        versionName: 'current',
        contentPath: '',
      },
      categoriesMetadata: {
        Category: {
          label: 'Category label',
          link: {
            type: 'doc',
            id: 'doc3', // Using a "local doc id" ("doc1" instead of "parent/doc1") on purpose
          },
        },
        Category2: {
          label: 'Category 2 label',
          link: null,
        },
      },
      docs: [
        {
          id: 'parent/doc1',
          source: '@site/docs/Category/index.md',
          sourceDirName: 'Category',
          frontMatter: {},
        },
        {
          id: 'parent/doc2',
          source: '@site/docs/Category/doc2.md',
          sourceDirName: 'Category',
          frontMatter: {},
        },
        {
          id: 'parent/doc3',
          source: '@site/docs/Category/doc3.md',
          sourceDirName: 'Category',
          frontMatter: {},
        },
        {
          id: 'parent/doc4',
          source: '@site/docs/Category2/doc1.md',
          sourceDirName: 'Category2',
          frontMatter: {},
        },
        {
          id: 'parent/doc5',
          source: '@site/docs/Category2/index.md',
          sourceDirName: 'Category2',
          frontMatter: {},
        },
        {
          id: 'parent/doc6',
          source: '@site/docs/Category2/doc3.md',
          sourceDirName: 'Category2',
          frontMatter: {},
        },
      ],
      options: {
        sidebarCollapsed: true,
        sidebarCollapsible: true,
      },
    });

    expect(sidebarSlice).toMatchSnapshot();
  });

  test('respects custom isCategoryIndex', async () => {
    const sidebarSlice = await DefaultSidebarItemsGenerator({
      numberPrefixParser: DefaultNumberPrefixParser,
      isCategoryIndex({fileName, directories}) {
        return (
          fileName.replace(
            `${DefaultNumberPrefixParser(
              directories[0],
            ).filename.toLowerCase()}-`,
            '',
          ) === 'index'
        );
      },
      item: {
        type: 'autogenerated',
        dirName: '.',
      },
      version: {
        versionName: 'current',
        contentPath: '',
      },
      categoriesMetadata: {},
      docs: [
        {
          id: 'intro',
          source: '@site/docs/intro.md',
          sourceDirName: '.',
          sidebarPosition: 0,
          frontMatter: {},
        },
        {
          id: 'tutorials-index',
          source: '@site/docs/01-Tutorials/tutorials-index.md',
          sourceDirName: '01-Tutorials',
          sidebarPosition: 2,
          frontMatter: {},
        },
        {
          id: 'tutorial2',
          source: '@site/docs/01-Tutorials/tutorial2.md',
          sourceDirName: '01-Tutorials',
          sidebarPosition: 2,
          frontMatter: {},
        },
        {
          id: 'tutorial1',
          source: '@site/docs/01-Tutorials/tutorial1.md',
          sourceDirName: '01-Tutorials',
          sidebarPosition: 1,
          frontMatter: {},
        },
        {
          id: 'not-guides-index',
          source: '@site/docs/02-Guides/README.md',
          sourceDirName: '02-Guides',
          frontMatter: {},
        },
        {
          id: 'guide2',
          source: '@site/docs/02-Guides/guide2.md',
          sourceDirName: '02-Guides',
          sidebarPosition: 2,
          frontMatter: {},
        },
        {
          id: 'guide1',
          source: '@site/docs/02-Guides/guide1.md',
          sourceDirName: '02-Guides',
          sidebarPosition: 1,
          frontMatter: {
            sidebar_class_name: 'foo',
          },
        },
      ],
      options: {
        sidebarCollapsed: true,
        sidebarCollapsible: true,
      },
    });

    expect(sidebarSlice).toMatchSnapshot();
  });

  test('throws for unknown index link', async () => {
    const generateSidebar = () =>
      DefaultSidebarItemsGenerator({
        numberPrefixParser: DefaultNumberPrefixParser,
        isCategoryIndex,
        item: {
          type: 'autogenerated',
          dirName: '.',
        },
        version: {
          versionName: 'current',
          contentPath: '',
        },
        categoriesMetadata: {
          category: {
            link: {
              type: 'doc',
              id: 'foo',
            },
          },
        },
        docs: [
          {
            id: 'intro',
            unversionedId: 'intro',
            source: '@site/docs/category/intro.md',
            sourceDirName: 'category',
            frontMatter: {},
          },
        ],
        options: {
          sidebarCollapsed: true,
          sidebarCollapsible: true,
        },
      });

    await expect(generateSidebar).rejects.toThrowErrorMatchingInlineSnapshot(`
            "Can't find any doc with ID foo.
            Available doc IDs:
            - intro"
          `);
  });
});
