// @flow

import styled from 'styled-components';
import * as React from 'react';
import {
  FacebookShareButton,
  TwitterShareButton,
  TelegramShareButton,
  WhatsappShareButton,
} from 'react-share';
import { t } from 'ttag';
import colors from '../../lib/colors';
import IconButton, { Circle, Caption } from '../IconButton';
import isCordova from '../../lib/isCordova';
import { interpolateLab } from 'd3-interpolate';

import ChevronLeft from './icons/ChevronLeft';
import FacebookIcon from './icons/Facebook';
import TwitterIcon from './icons/Twitter';
import TelegramIcon from './icons/Telegram';
import EmailIcon from './icons/Email';
import WhatsAppIcon from './icons/WhatsApp';

import ShareIcon from '../icons/actions/ShareIOS';

type Props = {
  className?: string,
  shareButtonCaption: string,
  url: string,
  pageDescription: string,
  sharedObjectTitle: string,
  mailToLink: string,
  onToggle: () => void,
};

type State = {
  isExpanded: boolean,
};

class ExpandableShareButtons extends React.Component<Props, State> {
  collapseButton: ?HTMLButtonElement;
  shareButton: ?HTMLButtonElement;

  state = {
    isExpanded: false,
  };

  toggle(isExpanded) {
    const hasChanged = isExpanded !== this.state.isExpanded;
    if (!hasChanged) return;
    this.setState({ isExpanded });
    if (this.props.onToggle) this.props.onToggle();
  }

  // FIXME Why needed?
  // componentWillReceiveProps(newProps: Props) {
  //   if (newProps.featureId !== this.props.featureId) {
  //     this.toggle(false);
  //   }
  // }

  componentDidUpdate(prevProps, prevState) {
    this.manageFocus(prevProps, prevState);
  }

  manageFocus(_, prevState) {
    if (this.state.isExpanded && !prevState.isExpanded && this.collapseButton) {
      this.collapseButton.focus();
    }

    if (prevState.isExpanded && !this.state.isExpanded && this.shareButton) {
      this.shareButton.focus();
    }
  }

  focus() {
    if (this.shareButton) {
      this.shareButton.focus();
    }
  }

  render() {
    const { shareButtonCaption, url, pageDescription, sharedObjectTitle, mailToLink } = this.props;

    const expandButton = (
      <button
        ref={shareButton => (this.shareButton = shareButton)}
        className={'link-button expand-button full-width-button'}
        aria-label={t`Expand share menu`}
        aria-expanded={this.state.isExpanded}
        onClick={() => this.toggle(true)}
      >
        <ShareIcon />
        <span>{shareButtonCaption}</span>
      </button>
    );

    if (!this.state.isExpanded) return expandButton;

    // The share button lib we're using is using window.open() by default which
    // seems to not work in our Cordova app for some reason. If we are a Cordova
    // app then we configure the share buttons to use window.location.href which
    // works in Cordova.
    // If we are on web we just use the default behavior of the share buttons.
    const linkOpeningViaLocationHrefProps = isCordova()
      ? { openWindow: false, onClick: link => (window.location.href = link) }
      : {};

    return (
      <div className={this.props.className}>
        <button
          ref={collapseButton => (this.collapseButton = collapseButton)}
          className={'link-button collapse-button'}
          onClick={() => this.toggle(false)}
          aria-expanded={this.state.isExpanded}
          aria-label={t`Collapse share menu`}
        >
          <ChevronLeft />
        </button>

        <footer className={this.state.isExpanded ? 'is-visible' : ''}>
          <FacebookShareButton
            url={url}
            quote={pageDescription}
            {...linkOpeningViaLocationHrefProps}
          >
            <StyledIconButton
              isHorizontal={false}
              hasCircle
              hoverColor={'#3C5A99'}
              activeColor={'#3C5A99'}
              caption="Facebook"
              ariaLabel="Facebook"
            >
              <FacebookIcon />
            </StyledIconButton>
          </FacebookShareButton>

          <TwitterShareButton
            url={url}
            title={sharedObjectTitle}
            hashtags={['wheelmap', 'accessibility', 'a11y']}
            {...linkOpeningViaLocationHrefProps}
          >
            <StyledIconButton
              isHorizontal={false}
              hasCircle
              hoverColor={'#1DA1F2'}
              activeColor={'#1DA1F2'}
              caption="Twitter"
              ariaLabel="Twitter"
            >
              <TwitterIcon />
            </StyledIconButton>
          </TwitterShareButton>

          <TelegramShareButton
            url={url}
            title={sharedObjectTitle}
            {...linkOpeningViaLocationHrefProps}
          >
            <StyledIconButton
              isHorizontal={false}
              hasCircle
              hoverColor={'#7AA5DA'}
              activeColor={'#7AA5DA'}
              caption="Telegram"
              ariaLabel="Telegram"
            >
              <TelegramIcon />
            </StyledIconButton>
          </TelegramShareButton>

          <a href={mailToLink}>
            <StyledIconButton
              isHorizontal={false}
              hasCircle
              hoverColor={'#57C4AA'}
              activeColor={'#57C4AA'}
              caption="Email"
              ariaLabel="Email"
            >
              <EmailIcon />
            </StyledIconButton>
          </a>

          <WhatsappShareButton
            url={url}
            title={sharedObjectTitle}
            {...linkOpeningViaLocationHrefProps}
          >
            <StyledIconButton
              isHorizontal={false}
              hasCircle
              hoverColor={'#25D366'}
              activeColor={'#25D366'}
              caption="Whatsapp"
              ariaLabel="Whatsapp"
            >
              <WhatsAppIcon />
            </StyledIconButton>
          </WhatsappShareButton>
        </footer>
      </div>
    );
  }
}

const StyledIconButton = styled(IconButton)`
  ${Caption} {
    font-size: 80%;
    margin-top: 0.3em;
  }

  ${Circle} {
    background-color: ${colors.tonedDownSelectedColor};
  }

  &.active {
    font-weight: bold;

    ${Circle} {
      background-color: ${props => props.activeColor || colors.selectedColor};
    }
  }

  @media (hover), (-moz-touch-enabled: 0) {
    &:not(.active):hover ${Circle} {
      background-color: ${props =>
        props.hoverColor ||
        interpolateLab(props.activeColor || colors.selectedColor, colors.tonedDownSelectedColor)(
          0.5
        )};
    }
  }
  &:focus {
    outline: none;
    ${Circle} {
      background-color: ${colors.selectedColor};
    }
  }
`;

const StyledExpandableShareButtons = styled(ExpandableShareButtons)`
  margin: 0 -10px;
  padding: 0 5px 0 0;
  display: flex;
  flex-direction: row;

  header {
    min-height: 38px;
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  button.collapse-button {
    width: 25px;
    padding: 0;
    margin: 0;
    text-align: center;
  }

  footer {
    flex: 1;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transition: opacity 1s ease-out, max-height 0.15s ease-out;

    &.is-visible {
      max-height: 100px;
      opacity: 1;
    }
  }

  footer {
    display: flex;
    flex-flow: row wrap;
    justify-content: space-between;
  }

  .SocialMediaShareButton,
  a {
    cursor: pointer !important;
    border-radius: 10px;
    &:focus {
      background-color: ${colors.linkBackgroundColorTransparent};
      outline: none;
      border: none;
    }

    svg {
      width: 21px;
      height: 21px;
      opacity: 0.95;
      g {
        fill: white;
      }
    }

    @media (hover), (-moz-touch-enabled: 0) {
      &:hover {
        ${Caption} {
          color: ${colors.linkColor} !important;
        }
      }
    }
  }
`;

export default StyledExpandableShareButtons;