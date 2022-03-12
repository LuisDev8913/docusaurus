/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {jest} from '@jest/globals';
import {
  truncate,
  parseBlogFileName,
  linkify,
  getSourceToPermalink,
  type LinkifyParams,
} from '../blogUtils';
import fs from 'fs-extra';
import path from 'path';
import type {
  BlogBrokenMarkdownLink,
  BlogContentPaths,
  BlogPost,
} from '../types';

const siteDir = path.join(__dirname, '__fixtures__', 'website');
const contentPaths: BlogContentPaths = {
  contentPath: path.join(siteDir, 'blog-with-ref'),
  contentPathLocalized: path.join(siteDir, 'blog-with-ref-localized'),
};
const pluginDir = 'blog-with-ref';
const blogPosts: BlogPost[] = [
  {
    id: 'Happy 1st Birthday Slash!',
    metadata: {
      permalink: '/blog/2018/12/14/Happy-First-Birthday-Slash',
      source: path.posix.join(
        '@site',
        pluginDir,
        '2018-12-14-Happy-First-Birthday-Slash.md',
      ),
      title: 'Happy 1st Birthday Slash!',
      description: `pattern name`,
      date: new Date('2018-12-14'),
      tags: [],
      prevItem: {
        permalink: '/blog/2019/01/01/date-matter',
        title: 'date-matter',
      },
      truncated: false,
    },
  },
];

const transform = async (
  filePath: string,
  options?: Partial<LinkifyParams>,
) => {
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const transformedContent = linkify({
    filePath,
    fileString: fileContent,
    siteDir,
    contentPaths,
    sourceToPermalink: getSourceToPermalink(blogPosts),
    onBrokenMarkdownLink: (brokenMarkdownLink) => {
      throw new Error(
        `Broken markdown link found: ${JSON.stringify(brokenMarkdownLink)}`,
      );
    },
    ...options,
  });
  return [fileContent, transformedContent];
};

describe('truncate', () => {
  it('truncates texts', () => {
    expect(
      truncate('aaa\n<!-- truncate -->\nbbb\nccc', /<!-- truncate -->/),
    ).toEqual('aaa\n');
    expect(
      truncate('\n<!-- truncate -->\nbbb\nccc', /<!-- truncate -->/),
    ).toEqual('\n');
  });

  it('leaves texts without markers', () => {
    expect(truncate('aaa\nbbb\nccc', /<!-- truncate -->/)).toEqual(
      'aaa\nbbb\nccc',
    );
    expect(truncate('', /<!-- truncate -->/)).toEqual('');
  });
});

describe('parseBlogFileName', () => {
  it('parses file', () => {
    expect(parseBlogFileName('some-post.md')).toEqual({
      date: undefined,
      text: 'some-post',
      slug: '/some-post',
    });
  });

  it('parses folder', () => {
    expect(parseBlogFileName('some-post/index.md')).toEqual({
      date: undefined,
      text: 'some-post',
      slug: '/some-post',
    });
  });

  it('parses nested file', () => {
    expect(parseBlogFileName('some-post/some-file.md')).toEqual({
      date: undefined,
      text: 'some-post/some-file',
      slug: '/some-post/some-file',
    });
  });

  it('parses nested folder', () => {
    expect(parseBlogFileName('some-post/some-subfolder/index.md')).toEqual({
      date: undefined,
      text: 'some-post/some-subfolder',
      slug: '/some-post/some-subfolder',
    });
  });

  it('parses file respecting date convention', () => {
    expect(
      parseBlogFileName('2021-05-12-announcing-docusaurus-two-beta.md'),
    ).toEqual({
      date: new Date('2021-05-12Z'),
      text: 'announcing-docusaurus-two-beta',
      slug: '/2021/05/12/announcing-docusaurus-two-beta',
    });
  });

  it('parses folder name respecting date convention', () => {
    expect(
      parseBlogFileName('2021-05-12-announcing-docusaurus-two-beta/index.md'),
    ).toEqual({
      date: new Date('2021-05-12Z'),
      text: 'announcing-docusaurus-two-beta',
      slug: '/2021/05/12/announcing-docusaurus-two-beta',
    });
  });

  it('parses folder tree respecting date convention', () => {
    expect(
      parseBlogFileName('2021/05/12/announcing-docusaurus-two-beta/index.md'),
    ).toEqual({
      date: new Date('2021-05-12Z'),
      text: 'announcing-docusaurus-two-beta',
      slug: '/2021/05/12/announcing-docusaurus-two-beta',
    });
  });

  it('parses folder name/tree (mixed) respecting date convention', () => {
    expect(
      parseBlogFileName('2021/05-12-announcing-docusaurus-two-beta/index.md'),
    ).toEqual({
      date: new Date('2021-05-12Z'),
      text: 'announcing-docusaurus-two-beta',
      slug: '/2021/05/12/announcing-docusaurus-two-beta',
    });
  });

  it('parses nested folder tree respecting date convention', () => {
    expect(
      parseBlogFileName(
        '2021/05/12/announcing-docusaurus-two-beta/subfolder/subfile.md',
      ),
    ).toEqual({
      date: new Date('2021-05-12Z'),
      text: 'announcing-docusaurus-two-beta/subfolder/subfile',
      slug: '/2021/05/12/announcing-docusaurus-two-beta/subfolder/subfile',
    });
  });

  it('parses date in the middle of path', () => {
    expect(
      parseBlogFileName('team-a/2021/05/12/announcing-docusaurus-two-beta.md'),
    ).toEqual({
      date: new Date('2021-05-12Z'),
      text: 'announcing-docusaurus-two-beta',
      slug: '/2021/05/12/team-a/announcing-docusaurus-two-beta',
    });
  });

  it('parses date in the middle of a folder name', () => {
    expect(
      parseBlogFileName(
        'team-a-2021-05-12-hey/announcing-docusaurus-two-beta.md',
      ),
    ).toEqual({
      date: new Date('2021-05-12Z'),
      text: 'hey/announcing-docusaurus-two-beta',
      slug: '/2021/05/12/team-a-hey/announcing-docusaurus-two-beta',
    });
  });
});

describe('linkify', () => {
  it('transforms to correct link', async () => {
    const post = path.join(contentPaths.contentPath, 'post.md');
    const [content, transformedContent] = await transform(post);
    expect(transformedContent).toMatchSnapshot();
    expect(transformedContent).toContain(
      '](/blog/2018/12/14/Happy-First-Birthday-Slash',
    );
    expect(transformedContent).not.toContain(
      '](2018-12-14-Happy-First-Birthday-Slash.md)',
    );
    expect(content).not.toEqual(transformedContent);
  });

  it('reports broken markdown links', async () => {
    const filePath = 'post-with-broken-links.md';
    const folderPath = contentPaths.contentPath;
    const postWithBrokenLinks = path.join(folderPath, filePath);
    const onBrokenMarkdownLink = jest.fn();
    const [, transformedContent] = await transform(postWithBrokenLinks, {
      onBrokenMarkdownLink,
    });
    expect(transformedContent).toMatchSnapshot();
    expect(onBrokenMarkdownLink).toHaveBeenCalledTimes(2);
    expect(onBrokenMarkdownLink).toHaveBeenNthCalledWith(1, {
      filePath: path.resolve(folderPath, filePath),
      contentPaths,
      link: 'postNotExist1.md',
    } as BlogBrokenMarkdownLink);
    expect(onBrokenMarkdownLink).toHaveBeenNthCalledWith(2, {
      filePath: path.resolve(folderPath, filePath),
      contentPaths,
      link: './postNotExist2.mdx',
    } as BlogBrokenMarkdownLink);
  });
});
