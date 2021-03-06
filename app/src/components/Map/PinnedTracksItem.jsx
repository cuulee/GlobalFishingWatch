import PropTypes from 'prop-types';
import React, { Component } from 'react';
import classnames from 'classnames';
import { REVERSE_TOOLTIP_ITEMS_MOBILE } from 'constants';
import LayerBlendingOptionsTooltip from 'components/Map/LayerBlendingOptionsTooltip';
import pinnedTracksStyles from 'styles/components/map/c-pinned-tracks.scss';
import icons from 'styles/icons.scss';
import InfoIcon from 'babel!svg-react!assets/icons/info-icon.svg?name=InfoIcon';
import DeleteIcon from 'babel!svg-react!assets/icons/delete-icon.svg?name=DeleteIcon';
import Toggle from 'components/Shared/Toggle';

class PinnedTracksItem extends Component {

  onChangeName(value) {
    this.props.setPinnedVesselTitle(this.props.vessel.seriesgroup, value);
  }

  onVesselLabelClick() {
    if (this.props.pinnedVesselEditMode === false) {
      this.props.onVesselClicked(this.props.vessel.tilesetId, this.props.vessel.seriesgroup);
    }
  }

  onChangeHue(hue) {
    if (!this.props.vessel.visible) {
      this.props.togglePinnedVesselVisibility(this.props.vessel.seriesgroup);
    }
    this.props.setPinnedVesselHue(this.props.vessel.seriesgroup, hue);
  }

  onChangeVisibility() {
    this.props.togglePinnedVesselVisibility(this.props.vessel.seriesgroup);
  }

  toggleBlending() {
    this.props.onLayerBlendingToggled(this.props.index);
  }

  render() {
    let actions;
    if (this.props.vessel.title === undefined) return false;

    if (this.props.pinnedVesselEditMode === true) {
      actions = (
        <div className={pinnedTracksStyles['edition-menu']} >
          <DeleteIcon
            className={classnames(icons.icon, pinnedTracksStyles['delete-icon'])}
            onClick={() => {
              this.props.onRemoveClicked(this.props.vessel.seriesgroup);
            }}
          />
        </div>
      );
    } else {
      actions = (
        <ul className={pinnedTracksStyles['pinned-item-action-list']} >
          <li className={pinnedTracksStyles['pinned-item-action-item']}>
            <LayerBlendingOptionsTooltip
              displayHue
              hueValue={this.props.vessel.hue}
              onChangeHue={hue => this.onChangeHue(hue)}
              isReverse={this.props.index < REVERSE_TOOLTIP_ITEMS_MOBILE}
              visible={this.props.showBlending}
              toggleVisibility={() => this.toggleBlending()}
            />
          </li>
          <li
            className={pinnedTracksStyles['pinned-item-action-item']}
            onClick={e => this.onVesselLabelClick(e)}
          >
            <InfoIcon className={classnames(icons.icon, icons['info-icon'])} />
          </li>
        </ul>
      );
    }

    return (
      <li
        className={pinnedTracksStyles['pinned-item']}
        key={this.props.vessel.seriesgroup}
      >
        <Toggle
          on={this.props.vessel.visible}
          hue={this.props.vessel.hue}
          onToggled={() => this.onChangeVisibility()}
        />
        <input
          className={classnames(pinnedTracksStyles['item-name'], { [pinnedTracksStyles['item-rename']]: this.props.pinnedVesselEditMode })}
          onChange={e => this.onChangeName(e.currentTarget.value)}
          readOnly={!this.props.pinnedVesselEditMode}
          value={this.props.vessel.title}
          ref={((elem) => {
            this.inputName = elem;
          })}
          onClick={e => this.onVesselLabelClick(e)}
        />
        {actions}
      </li>);
  }
}

PinnedTracksItem.propTypes = {
  pinnedVesselEditMode: PropTypes.bool,
  index: PropTypes.number,
  togglePinnedVesselVisibility: PropTypes.func,
  onLayerBlendingToggled: PropTypes.func,
  onRemoveClicked: PropTypes.func,
  setPinnedVesselTitle: PropTypes.func,
  onVesselClicked: PropTypes.func,
  setPinnedVesselHue: PropTypes.func,
  showBlending: PropTypes.bool,
  vessel: PropTypes.object
};

export default PinnedTracksItem;
