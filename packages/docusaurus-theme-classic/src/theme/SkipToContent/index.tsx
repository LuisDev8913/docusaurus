/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {useRef, useEffect} from 'react';
import Translate from '@docusaurus/Translate';
import {useLocation} from '@docusaurus/router';
import styles from './styles.module.css';

function programmaticFocus(el) {
  el.setAttribute('tabindex', '-1');
  el.focus();
  setTimeout(() => el.removeAttribute('tabindex'), 1000);
}

function SkipToContent(): JSX.Element {
  const containerRef = useRef(null);
  const location = useLocation();

  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const targetElement =
      document.querySelector('main:first-of-type') ||
      document.querySelector('.main-wrapper');

    if (targetElement) {
      programmaticFocus(targetElement);
    }
  };

  useEffect(() => {
    programmaticFocus(containerRef.current);
  }, [location.pathname]);

  return (
    <div ref={containerRef}>
      <a href="#main" className={styles.skipToContent} onClick={handleSkip}>
        <Translate
          id="theme.SkipToContent.skipToMainContent"
          description="The skip to content label used for accessibility, allowing to rapidly navigate to main content with keyboard tab/enter navigation">
          Skip to main content
        </Translate>
      </a>
    </div>
  );
}

export default SkipToContent;
