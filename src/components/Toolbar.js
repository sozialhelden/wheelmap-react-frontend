/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
// @flow
import { t } from 'ttag';
import { hsl } from 'd3-color';
import uniq from 'lodash/uniq';
import minBy from 'lodash/minBy';
import isEqual from 'lodash/isEqual';
import includes from 'lodash/includes';
import styled from 'styled-components';
import debounce from 'lodash/debounce';
import * as React from 'react';
import colors from '../lib/colors';
import { isOnSmallViewport } from '../lib/ViewportSize';
import * as safeAreaInsets from 'safe-area-insets';
import Measure from 'react-measure';

type Props = {
  className?: string,
  children: React.Node,
  hidden?: boolean,
  inert?: boolean,
  role?: string,
  ariaLabel?: string,
  ariaDescribedBy?: string,
  minimalHeight?: number,
  minimalTopPosition?: number,
  isSwipeable?: boolean,
  isModal?: boolean,
  enableTransitions?: boolean,
};

function getNearestStopForTopOffset(topOffset: number, stops: number[]): number {
  return minBy(stops, stop => Math.abs(stop - topOffset));
}

function logStateValueChange(name: string, value: any) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useLayoutEffect(() => {
    console.log(name, '=', value);
  }, [name, value]);
}

function isElementDescendantOfElement(element: HTMLElement, ancestor: HTMLElement) {
  let e: HTMLElement | null = element;
  while (e.parentElement !== ancestor) {
    e = e.parentElement;
    if (!e) {
      // We're at the top
      return false;
    }
  }
  return true;
}

/**
 * A toolbar that shows as a card that you can swipe up and down on small viewports,
 * and that has a fixed position on bigger viewports.
 *
 * Automatically becomes scrollable when fully visible.
 *
 * When dragged with a swipe gesture, it transitions smoothly between expanding/collapsing
 * and scrolling its content.
 *
 * Can be modal and is not swipeable then.
 */

function Toolbar(props: Props) {
  const scrollElementRef = React.useRef<HTMLElement | null>(null);
  const [topOffset, setTopOffset] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [toolbarHeight, setToolbarHeight] = React.useState(0);
  const [toolbarScrollHeight, setToolbarScrollHeight] = React.useState(0);
  const [deltaY, setDeltaY] = React.useState(0);
  const [touchStartY, setTouchStartY] = React.useState(0);
  const [scrollTopStartY, setScrollTopStartY] = React.useState(0);

  const minimalTopPosition = React.useMemo(
    () => (typeof window !== 'undefined' ? safeAreaInsets.top : 0) + props.minimalTopPosition || 0,
    [props.minimalTopPosition]
  );

  const isLandscapePhone = React.useMemo(
    () => isOnSmallViewport() && viewportWidth > viewportHeight,
    [viewportWidth, viewportHeight]
  );

  /** An array of top position offsets that the toolbar is allowed to stop on. */
  const stops: number[] = React.useMemo(() => {
    // On landscape phones, the toolbar is fixed on the left side.
    if (isLandscapePhone) {
      return [0];
    }
    // The toolbar needs a minimal height be draggable from the bottom when minimized
    const minimalHeight = Math.max(props.minimalHeight || 0, 90);
    const bottomPosition = Math.max(0, toolbarHeight - minimalHeight);
    const safeAreaInsetTop = typeof window !== 'undefined' ? safeAreaInsets.top : 0;
    const middleStop = toolbarHeight - 0.5 * viewportHeight;
    const defaultStops = uniq([0, middleStop, bottomPosition]);
    return defaultStops;
  }, [isLandscapePhone, props.minimalHeight, toolbarHeight, viewportHeight]);

  const isAtTopmostPosition = React.useMemo(() => topOffset <= 0, [topOffset]);

  // logStateValueChange('deltaY', deltaY);
  logStateValueChange('touchStartY', touchStartY);
  logStateValueChange('scrollTopStartY', scrollTopStartY);
  logStateValueChange('scrollTop', scrollTop);
  logStateValueChange('topOffset', topOffset);
  logStateValueChange('isAtTopmostPosition', isAtTopmostPosition);
  logStateValueChange('toolbarScrollHeight', toolbarScrollHeight);

  const touchAction = React.useMemo(() => (isAtTopmostPosition ? 'inherit' : 'none'), [
    isAtTopmostPosition,
  ]);

  const transition = React.useMemo(() => {
    const defaultTransitions = 'opacity 0.3s ease-out';
    return props.enableTransitions
      ? isSwiping
        ? defaultTransitions
        : `${defaultTransitions}, transform 0.3s ease-out, height 0.3s ease-out`
      : '';
  }, [props.enableTransitions, isSwiping]);

  const transformY = React.useMemo(() => {
    const isToolbarFittingOnScreenCompletely = viewportHeight - toolbarHeight - stops[0] > 0;
    const isBigViewport = viewportWidth > 512 && viewportHeight > 512;
    const transformY =
      isBigViewport && isToolbarFittingOnScreenCompletely
        ? 0
        : Math.max(topOffset + (scrollTop <= 0 ? -scrollTopStartY - deltaY : 0), 0);
    return transformY;
  }, [
    viewportHeight,
    toolbarHeight,
    stops,
    viewportWidth,
    topOffset,
    deltaY,
    scrollTop,
    scrollTopStartY,
  ]);

  const onWindowResize = React.useCallback(() => {
    setViewportWidth(typeof window === 'undefined' ? 1024 : window.innerWidth);
    setViewportHeight(typeof window === 'undefined' ? 768 : window.innerHeight);
    const newTopOffset = getNearestStopForTopOffset(topOffset, stops);
    setTopOffset(newTopOffset);
  }, [setViewportWidth, setViewportHeight, topOffset, stops, setTopOffset]);

  const onToolbarResize = React.useCallback(() => {
    if (scrollElementRef.current) {
      const previousClientTop = scrollElementRef.current.getClientRects()[0].top;
      const newTopOffset = previousClientTop + toolbarHeight - viewportHeight;
      setToolbarHeight(scrollElementRef.current.clientHeight);
      setToolbarScrollHeight(scrollElementRef.current.scrollHeight);
      setTopOffset(newTopOffset);
    }
  }, [toolbarHeight, viewportHeight]);

  React.useLayoutEffect(() => {}, [toolbarScrollHeight]);

  // Register toolbar resize observer
  React.useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver(onToolbarResize);
    onToolbarResize();
    resizeObserver.observe(scrollElementRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, [onToolbarResize, scrollElementRef]);

  const ensureFullVisibility = React.useCallback(
    (preferredHeight?: number) => {
      if (isSwiping) {
        return;
      }
      // Move the toolbar to show as much of its content as possible.
      setTopOffset(Math.max(0, preferredHeight ? toolbarHeight - preferredHeight : 0));
    },
    [setTopOffset, toolbarHeight, isSwiping]
  );

  React.useLayoutEffect(() => {
    const resize = onWindowResize;
    resize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resize);
    }
    return () => window.removeEventListener('resize', resize);
  }, [onWindowResize]);

  React.useLayoutEffect(() => {
    if (props.isModal) {
      ensureFullVisibility();
    }
  }, [props.isModal, ensureFullVisibility]);

  const handleKeyDown = React.useCallback((event: SyntheticKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && scrollElementRef.current) {
      const closeLink = scrollElementRef.current.querySelector('.close-link');
      if (closeLink && closeLink.click) {
        closeLink.click();
      }
    }
  }, []);

  const onScroll = React.useCallback(() => {
    setScrollTop(scrollElementRef.current.scrollTop);
  }, [setScrollTop]);

  const handleTouchStart = React.useCallback(
    (event: TouchEvent) => {
      event.preventDefault();
      setTouchStartY(event.touches[0].clientY);
      setScrollTopStartY(scrollElementRef.current.scrollTop);
    },
    [setTouchStartY]
  );

  const handleTouchEnd = React.useCallback(
    (e: TouchEvent) => {
      if (!props.isSwipeable || props.isModal) {
        return;
      }
      setDeltaY(0);
      setScrollTopStartY(0);
      setIsSwiping(false);
      console.log('Touch ended at', transformY);
      const isFlick = false;
      if (isFlick && scrollTop <= 0) {
        const isSwipingUp = deltaY > 0;
        const newIndex = isSwipingUp ? 0 : stops.length - 1;
        setTopOffset(stops[newIndex]);
        return;
      }
      const newStop = getNearestStopForTopOffset(transformY, stops);
      setTopOffset(newStop);
    },
    [deltaY, props.isModal, props.isSwipeable, scrollTop, stops, transformY]
  );

  const handleTouchMove = React.useCallback(
    (event: TouchEvent) => {
      event.stopPropagation();
      setDeltaY(touchStartY - event.touches[0].clientY);
      setIsSwiping(true);
      event.preventDefault();
    },
    [touchStartY]
  );

  const toolbarIsScrollable = React.useMemo(() => {
    if (!scrollElementRef.current) {
      return;
    }
    const scrollElementHasMoreContentThanShown =
      scrollElementRef.current.scrollHeight > scrollElementRef.current.clientHeight;
    const isScrollable = isAtTopmostPosition && scrollElementHasMoreContentThanShown;
    return isScrollable && scrollTop > 0;
  }, [isAtTopmostPosition, scrollTop]);

  const xModels = ['iPhone10,3', 'iPhone10,6', 'x86_64'];
  const isIphoneX =
    typeof window !== 'undefined' &&
    window.device &&
    window.device.model &&
    includes(xModels, window.device.model);
  const classNames = [
    'toolbar',
    isIphoneX ? 'toolbar-iphone-x' : null,
    props.hidden ? 'toolbar-hidden' : null,
    props.isModal ? 'toolbar-is-modal' : null,
    toolbarIsScrollable ? 'toolbar-is-scrollable' : null,
    props.className,
  ];
  const className = classNames.filter(Boolean).join(' ');

  return (
    <section
      onKeyDown={handleKeyDown}
      className={className}
      style={{
        touchAction,
        transition,
        overflowY: 'auto',
        transform: `translate3d(0, ${transformY}px, 0)`,
      }}
      ref={scrollElementRef}
      aria-hidden={props.inert || props.hidden}
      role={props.role}
      aria-label={props.ariaLabel}
      aria-describedby={props.ariaDescribedBy}
      data-minimal-top-position={props.minimalTopPosition}
      data-top-offset={topOffset}
      data-dimensions-viewport-height={viewportHeight}
      data-dimensions-height={toolbarHeight}
      data-stops={stops.toString()}
      onTouchMoveCapture={handleTouchMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onScroll={onScroll}
    >
      <div style={{ transform: `translateY(${scrollTop < 0 ? scrollTop : 0}px)` }}>
        {props.isSwipeable && !props.isModal ? (
          <button
            style={{ transform: `translate3d(-50%, 0px, 0)` }}
            className="grab-handle"
            aria-label={isAtTopmostPosition ? t`Collapse details` : t`Expand details`}
            onClick={() => {
              if (isAtTopmostPosition) {
                const offset = stops[stops.length - 1];
                // reset scroll position
                if (scrollElementRef.current) {
                  scrollElementRef.current.scrollTop = 0;
                }
                setTopOffset(offset);
              } else {
                ensureFullVisibility();
              }
            }}
          />
        ) : null}
        {props.children}
      </div>
    </section>
  );
}

Toolbar.defaultProps = {
  hidden: false,
  minimalHeight: 90,
  isSwipeable: true,
  isModal: false,
  role: '',
  enableTransitions: true,
};

const StyledToolbar = styled(Toolbar)`
  position: fixed;
  overscroll-behavior-y: contain;
  touch-action: pan-y;

  user-select: none;
  -webkit-user-drag: none;

  /* Positioning */
  left: 0;
  left: constant(safe-area-inset-left);
  left: env(safe-area-inset-left);

  /* Sizing (more sizing for different viewports below) */
  box-sizing: border-box;
  width: 320px;
  min-width: 320px;
  max-height: calc(100% - ${p => p.minimalTopPosition || 0}px);
  max-height: calc(100% - ${p => p.minimalTopPosition || 0}px - constant(safe-area-inset-top));
  max-height: calc(100% - ${p => p.minimalTopPosition || 0}px - env(safe-area-inset-top));

  @media (max-height: 512px), (max-width: 512px) {
    bottom: 0;
  }

  @media (min-width: 513px) and (min-height: 513px) {
    max-height: calc(100% - ${p => p.minimalTopPosition || 0}px);
    max-height: calc(
      100% - ${p => p.minimalTopPosition || 0}px - constant(safe-area-inset-top) - 20px
    );
    max-height: calc(100% - ${p => p.minimalTopPosition || 0}px - env(safe-area-inset-top) - 20px);

    &:not(.toolbar-is-modal) {
      top: ${p => p.minimalTopPosition || 0}px;
    }
  }

  &.toolbar-is-modal {
    z-index: 1000;
    padding-bottom: calc(constant(safe-area-inset-bottom) + 8px);
    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);

    @media (max-height: 512px), (max-width: 512px) {
      margin-bottom: 0px;
    }

    @media (min-width: 513px) and (min-height: 513px) {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) !important;
    }
  }

  margin: 0 10px 10px 10px;
  padding: 0px 15px 5px 15px;
  outline: none;
  border-top: ${colors.colorizedBackgroundColor} 8px solid;
  padding-bottom: 8px;

  font-size: 16px;
  box-shadow: 0 5px 30px rgba(0, 0, 0, 0.2), 0 1px 5px rgba(0, 0, 0, 0.1);
  background-color: ${colors.colorizedBackgroundColor};

  overflow: auto;
  overflow-x: hidden;
  -ms-overflow-style: -ms-autohiding-scrollbar;
  /* -webkit-overflow-scrolling: touch; */

  transform: scale3d(1, 1, 1); /* switch on 3D acceleration for the panel */

  .grab-handle {
    display: none;
    border: none;
    outline: none;
  }

  border-radius: 8px;

  @media (max-width: 512px) {
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    border-bottom-left-radius: 0px;
    border-bottom-right-radius: 0px;

    width: 100%;
    min-width: 250px;
    margin: 0;
    .grab-handle {
      display: block;
      position: sticky;
      top: 0;
      left: 50%;
      z-index: 3;
      width: 50%;
      height: 10px;
      margin: -10px 0 -20px 0;
      padding: 15px;
      touch-action: none;
      background-color: transparent;
      &:before {
        display: block;
        position: absolute;
        margin: 0 auto;
        top: 0px;
        left: calc(50% - 20px);
        content: '';
        width: 44px;
        height: 5px;
        border-radius: 2.5px;
        background-color: rgba(0, 0, 0, 0.2);
        &.focus-visible {
          box-shadow: 0px 0px 0px 2px #4469e1;
        }
      }
      &.focus-visible {
        box-shadow: none !important;
      }
    }
  }

  p {
    line-height: 1.5;
    margin-top: 10px;
    margin-bottom: 10px;
  }

  .link-button {
    display: block;
    font-size: 16px;
    padding: 10px;
    text-decoration: none;
    border-radius: 4px;
    cursor: pointer;
    background-color: transparent;
    border: none;
    outline: none;
    color: ${colors.linkColor};

    @media (hover), (-moz-touch-enabled: 0) {
      &:hover {
        background-color: ${colors.linkBackgroundColorTransparent};
      }
    }

    &:focus&:not(.primary-button) {
      background-color: ${colors.linkBackgroundColorTransparent};
    }

    &:disabled {
      opacity: 0.15;
    }
  }

  button.link-button.full-width-button {
    text-align: left;
  }

  .primary-button {
    color: white;
    background-color: ${colors.linkColor};
    min-width: 8em;

    @media (hover), (-moz-touch-enabled: 0) {
      &:hover {
        background-color: ${hsl(colors.linkColor).brighter(0.2)};
      }
    }
    &:active {
      background-color: ${hsl(colors.linkColor).darker(0.2)};
    }

    &.focus-visible {
      box-shadow: 0px 0px 0px 4px ${colors.selectedColorLight};
      transition: box-shadow 0.2s;
    }

    &[disabled] {
      opacity: 0.8;
      pointer-events: none;
    }
  }

  .negative-button {
    color: ${hsl(colors.negativeColor).darker(1)};
    @media (hover), (-moz-touch-enabled: 0) {
      &:hover,
      &:focus {
        background-color: ${colors.negativeBackgroundColorTransparent};
      }
    }

    &:active {
      background-color: ${hsl(colors.negativeBackgroundColorTransparent).darker(1)};
    }

    &[disabled] {
      opacity: 0.8;
      color: ${colors.neutralColor};
      pointer-events: none;
    }
  }

  &.toolbar-hidden {
    opacity: 0;
    pointer-events: none;
  }
`;

export default StyledToolbar;
