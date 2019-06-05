// @flow

import React from 'react';
import styled from 'styled-components';
import { t } from 'ttag';

import ModalDialog from '../ModalDialog';
import { PrimaryButton } from '../Button';
import { type MappingEvent } from '../../lib/MappingEvent';

type Props = {
  className?: string,
  mappingEvent: MappingEvent,
  onMappingEventWelcomeDialogClose: () => void,
};

const MappingEventWelcomeDialog = ({
  className,
  mappingEvent,
  onMappingEventWelcomeDialogClose,
}: Props) => {
  const dialogAriaLabel = t`Welcome`;

  return (
    <ModalDialog
      className={className}
      isVisible={true}
      onClose={onMappingEventWelcomeDialogClose}
      ariaLabel={dialogAriaLabel}
      ariaDescribedBy="mapping-event-welcome-message"
    >
      <p id="mapping-event-welcome-message">{mappingEvent.welcomeMessage}</p>
      <PrimaryButton onClick={onMappingEventWelcomeDialogClose}>Let's go</PrimaryButton>
    </ModalDialog>
  );
};

const StyledMappingEventWelcomeDialog = styled(MappingEventWelcomeDialog)`
  .modal-dialog-fullscreen-overlay {
    background-color: transparent;
  }

  .modal-dialog-content {
    display: flex;
    flex-direction: column;
    padding: 15px;
    border-radius: 20px;
    background-color: rgba(255, 255, 255, 0.96);
    box-shadow: 0 5px 30px rgba(0, 0, 0, 0.15), 0 2px 5px rgba(0, 0, 0, 0.3);
    animation: fadeIn 0.5s linear;
    max-width: 80%;
    text-align: center;

    p {
      margin-top: 0;
      max-width: 400px;
      align-self: center;
    }

    .close-dialog {
      display: none;
    }
  }

  ${PrimaryButton} {
    margin-top: 20px;
    max-width: 250px;
    align-self: center;
  }
`;

export default StyledMappingEventWelcomeDialog;
