import PropTypes from 'prop-types';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import CustomInfowindowStyles from 'styles/components/map/c-custom-infowindow.scss';
import buttonCloseStyles from 'styles/components/c-button-close.scss';
import CloseIcon from 'babel!svg-react!assets/icons/close.svg?name=Icon';
import CustomInfoWindow from 'util/CustomInfoWindow';

export default class PolygonReport extends Component {
  constructor() {
    super();
    this.onInfoWindowClickBound = this.onInfoWindowClick.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (!this.map && nextProps.map) {
      this.infoWindow = new CustomInfoWindow(nextProps.map);
      this.infoWindow.div.addEventListener('click', this.onInfoWindowClickBound);
      this.map = nextProps.map;
    }
  }

  // avoids updating when props.map changes
  shouldComponentUpdate(nextProps) {
    if (nextProps.id !== this.props.id || nextProps.isInReport !== this.props.isInReport) {
      return true;
    }
    return false;
  }

  componentDidUpdate() {
    if (!this.infoWindow) return;
    ReactDOM.render(this.element, this.infoWindow.div);
    if (this.props.latLng) {
      this.infoWindow.setLatLng(this.props.latLng);
    }
  }

  onInfoWindowClick(e) {
    if (e.target.className.indexOf('js-close') > -1) {
      this.props.clearPolygon();
    } else if (e.target.className.indexOf('js-toggle') > -1) {
      this.props.toggleReportPolygon(this.props.id);
    }
  }

  render() {
    const toggleButtonText = (this.props.isInReport) ? 'remove from report' : 'add to report';
    let toggleButtonClassName = classnames('js-toggle', 'js-polygon-report', CustomInfowindowStyles.toggle);
    if (this.props.isInReport) {
      toggleButtonClassName += ` ${CustomInfowindowStyles['-remove']}`;
    }
    this.element = (this.props.id === undefined) ? <div /> : (<div
      className={classnames(CustomInfowindowStyles['c-custom-infowindow'], 'js-polygon-report')}
    >
      <div className={CustomInfowindowStyles.title}>
        {this.props.name}
      </div>
      <div className={CustomInfowindowStyles.description}>
        {this.props.description}
      </div>
      <button className={classnames('js-close', CustomInfowindowStyles.close, buttonCloseStyles['c-button-close'])}>
        <CloseIcon className={buttonCloseStyles.cross} />
      </button>
      <button className={toggleButtonClassName}>
        {toggleButtonText}
      </button>
    </div>);

    return null;
  }
}

PolygonReport.propTypes = {
  id: PropTypes.number,
  name: PropTypes.string,
  description: PropTypes.string,
  latLng: PropTypes.array,
  isInReport: PropTypes.bool,
  toggleReportPolygon: PropTypes.func,
  clearPolygon: PropTypes.func,
  map: PropTypes.object
};
