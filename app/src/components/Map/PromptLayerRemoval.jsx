import PropTypes from 'prop-types';
import React, { Component } from 'react';
import classnames from 'classnames';
import ModalStyles from 'styles/components/shared/c-modal.scss';
import PromptLayerStyles from 'styles/components/map/c-prompt-layer.scss';
import MapButtonStyles from 'styles/components/map/c-button.scss';

class PromptLayerRemoval extends Component {
  render() {
    return (
      <div >
        <h3 className={ModalStyles['modal-title']} >Delete layer</h3>
        <div className={PromptLayerStyles['c-prompt-layer']}>
          <p
            className={PromptLayerStyles['layer-description']}
          >
            You are about to remove a custom layer, which is part of your workspace and cannot be restored from
            the layer library once deleted.
          </p>
          <p
            className={PromptLayerStyles['layer-description']}
          >
            Are you sure you want to proceed?
          </p>
          <div className={classnames(ModalStyles.footer, PromptLayerStyles.footer)} >
            <button
              className={classnames(MapButtonStyles['c-button'], MapButtonStyles['-filled'],
                PromptLayerStyles['modal-btn'])}
              onClick={() => this.props.removeLayer(this.props.layerIdPromptedForRemoval)}
            >
              Yes, delete
            </button>
            <button
              className={classnames(MapButtonStyles['c-button'], PromptLayerStyles['modal-btn'])}
              onClick={() => this.props.keepLayer()}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
}

PromptLayerRemoval.propTypes = {
  layerIdPromptedForRemoval: PropTypes.any,
  removeLayer: PropTypes.func,
  keepLayer: PropTypes.func
};

export default PromptLayerRemoval;
