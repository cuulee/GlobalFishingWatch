import PropTypes from 'prop-types';
import React, { Component } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import assign from 'lodash/assign';
import classnames from 'classnames';
import InputRange from 'react-input-range';
import { VESSELS_HUES_INCREMENT } from 'constants';
import icons from 'styles/icons.scss';
import BlendingStyles from 'styles/components/map/c-layer-blending.scss';
import BlendingIcon from 'babel!svg-react!assets/icons/blending-icon.svg?name=BlendingIcon';

const INPUT_RANGE_DEFAULT_CONFIG = {
  classnames: {
    component: 'blending-range',
    labelMax: 'label -max',
    labelMin: 'label -min',
    labelValue: 'label -current',
    trackActive: 'track-active',
    trackContainer: 'track-container',
    sliderContainer: 'thumb-container',
    slider: 'thumb'
  }
};

class LayerBlendingOptionsTooltip extends Component {

  constructor(props) {
    super(props);

    this.opacityRangeConfig = cloneDeep(INPUT_RANGE_DEFAULT_CONFIG);
    assign(this.opacityRangeConfig, {
      minValue: 10,
      maxValue: 100,
      step: 1,
      value: this.props.opacityValue * 100
    });

    this.hueRangeConfig = cloneDeep(INPUT_RANGE_DEFAULT_CONFIG);
    assign(this.hueRangeConfig, {
      minValue: 0,
      maxValue: 360,
      step: VESSELS_HUES_INCREMENT,
      value: this.props.hueValue
    });

    this.hueRangeConfig.classnames.component = 'blending-range -hue';

    this.state = {
      opacityRangeValue: this.opacityRangeConfig.value,
      hueRangeValue: this.hueRangeConfig.value
    };

    this.closeTooltip = this.closeTooltip.bind(this);
  }

  componentWillUpdate(nextProps) {
    if (nextProps.visible !== this.props.visible) {
      if (nextProps.visible) {
        window.addEventListener('touchend', this.closeTooltip);
        window.addEventListener('click', this.closeTooltip);
      } else {
        window.removeEventListener('touchend', this.closeTooltip);
        window.removeEventListener('click', this.closeTooltip);
      }
    }
  }

  componentWillUnmount() {
    window.removeEventListener('touchend', this.closeTooltip);
    window.removeEventListener('click', this.closeTooltip);
  }

  closeTooltip(e) {
    e.stopPropagation();
    e.preventDefault();
    if (this.tooltip.contains(e.target) || !this.props.visible) return;
    this.props.toggleVisibility();
  }

  onChangeOpacity(value) {
    const transparency = parseFloat(value) / 100;
    this.setState({
      opacityRangeValue: value
    });

    this.props.onChangeOpacity(transparency);
  }

  onChangeHue(value) {
    this.setState({
      hueRangeValue: value
    });

    this.props.onChangeHue(value);
  }

  render() {
    return (
      <div
        className={classnames(BlendingStyles['c-blending'])}
        ref={(ref) => { this.tooltip = ref; }}
      >
        <BlendingIcon
          onClick={() => this.props.toggleVisibility()}
          className={classnames(icons['blending-icon'],
            { [`${icons['-white']}`]: this.props.visible })}
        />
        {this.props.visible &&
        <div
          className={classnames(
            BlendingStyles['blending-tooltip'],
            { [`${BlendingStyles['-reverse']}`]: this.props.isReverse })
          }
        >
          {this.props.displayHue && <div>
            Hue
            <InputRange
              classNames={this.hueRangeConfig.classnames}
              value={this.state.hueRangeValue}
              maxValue={this.hueRangeConfig.maxValue}
              minValue={this.hueRangeConfig.minValue}
              onChange={(component, value) => this.onChangeHue(value)}
              step={this.hueRangeConfig.step}
            />
          </div>}
          {this.props.displayOpacity && <div>
            Opacity
            <InputRange
              classNames={this.opacityRangeConfig.classnames}
              value={this.state.opacityRangeValue}
              maxValue={this.opacityRangeConfig.maxValue}
              minValue={this.opacityRangeConfig.minValue}
              onChange={(component, value) => this.onChangeOpacity(value)}
              step={this.opacityRangeConfig.step}
            />
          </div>}
        </div>}
      </div>
    );
  }
}

LayerBlendingOptionsTooltip.propTypes = {
  displayHue: PropTypes.bool,
  displayOpacity: PropTypes.bool,
  hueValue: PropTypes.number,
  opacityValue: PropTypes.number,
  onChangeHue: PropTypes.func,
  onChangeOpacity: PropTypes.func,
  isReverse: PropTypes.bool,
  toggleVisibility: PropTypes.func,
  visible: PropTypes.bool
};

export default LayerBlendingOptionsTooltip;
