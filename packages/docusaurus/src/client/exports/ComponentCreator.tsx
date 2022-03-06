/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import Loadable from 'react-loadable';
import Loading from '@theme/Loading';
import routesChunkNames from '@generated/routesChunkNames';
import registry from '@generated/registry';
import flat from '../flat';

type OptsLoader = Record<string, typeof registry[keyof typeof registry][0]>;

export default function ComponentCreator(
  path: string,
  hash: string,
): ReturnType<typeof Loadable> {
  // 404 page
  if (path === '*') {
    return Loadable({
      loading: Loading,
      loader: () => import('@theme/NotFound'),
    });
  }

  const chunkNamesKey = `${path}-${hash}`;
  const chunkNames = routesChunkNames[chunkNamesKey]!;
  const optsModules: string[] = [];
  const optsWebpack: string[] = [];
  const optsLoader: OptsLoader = {};

  /* Prepare opts data that react-loadable needs
  https://github.com/jamiebuilds/react-loadable#declaring-which-modules-are-being-loaded
  Example:
  - optsLoader:
    {
      component: () => import('./Pages.js'),
      content.foo: () => import('./doc1.md'),
    }
  - optsModules: ['./Pages.js', './doc1.md']
  - optsWebpack: [
      require.resolveWeak('./Pages.js'),
      require.resolveWeak('./doc1.md'),
    ]
  */
  const flatChunkNames = flat(chunkNames);
  Object.entries(flatChunkNames).forEach(([key, chunkName]) => {
    const chunkRegistry = registry[chunkName];
    if (chunkRegistry) {
      // eslint-disable-next-line prefer-destructuring
      optsLoader[key] = chunkRegistry[0];
      optsModules.push(chunkRegistry[1]);
      optsWebpack.push(chunkRegistry[2]);
    }
  });

  return Loadable.Map({
    loading: Loading,
    loader: optsLoader,
    modules: optsModules,
    webpack: () => optsWebpack,
    render: (loaded, props) => {
      // Clone the original object since we don't want to alter the original.
      const loadedModules = JSON.parse(JSON.stringify(chunkNames));
      Object.keys(loaded).forEach((key) => {
        let val = loadedModules;
        const keyPath = key.split('.');
        keyPath.slice(0, -1).forEach((k) => {
          val = val[k];
        });
        val[keyPath[keyPath.length - 1]!] = loaded[key].default;
        const nonDefaultKeys = Object.keys(loaded[key]).filter(
          (k) => k !== 'default',
        );
        if (nonDefaultKeys && nonDefaultKeys.length) {
          nonDefaultKeys.forEach((nonDefaultKey) => {
            val[keyPath[keyPath.length - 1]!][nonDefaultKey] =
              loaded[key][nonDefaultKey];
          });
        }
      });

      const Component = loadedModules.component;
      delete loadedModules.component;
      return <Component {...loadedModules} {...props} />;
    },
  });
}
