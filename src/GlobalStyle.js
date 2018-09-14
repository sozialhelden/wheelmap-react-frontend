import { createGlobalStyle } from 'styled-components';

import MainView from './MainView';

const GlobalStyle = createGlobalStyle`
  html {
    background-color: #6c7374;
  }

  body {
    position: fixed;
  }

  html,
  body {
    -webkit-tap-highlight-color: transparent;
  }

  html,
  body,
  #__next,
  ${MainView} {
    width: 100%;
    width: 100vw;
    height: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
  }

  /* iPhone-X notch support */

  body {
    /* padding-top: constant(safe-area-inset-top);
    padding-top: env(safe-area-inset-top);
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom); */
  }

  body:before {
    content: ' ';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background-color: rgba(0, 0, 0, 0.25);
    height: 0;
    height: constant(safe-area-inset-top);
    height: env(safe-area-inset-top);
    z-index: 401;
    -webkit-backdrop-filter: blur(10px);
  }

  /*
  Focus ring styling is disabled by default and instead we are using the :focus-ring polyfill. The
  :focus-ring pseudo selector is a future browser standard that differentiates between mouse
  and keyboard usage when determining whether to draw a focus ring. Usually we only want a
  focus ring in the latter case.
  */

  *:focus {
    outline: none;
  }

  *.focus-ring {
    border-radius: 4px;
    box-shadow: inset 0px 0px 0px 2px #4469E1;
    transition: box-shadow 0.2s;
  }

  .sr-only {
    position: absolute;
    left: -10000px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  #lightboxBackdrop {
    -webkit-backdrop-filter: blur(10px);
    background-color: rgba(0, 0, 0, 0.9);
  }
`;

export default GlobalStyle;
