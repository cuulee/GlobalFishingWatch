// ye who enter here, fear not
// this is the first time I used D3, please dont hate me
/* eslint react/sort-comp:0 */
import React, { Component } from 'react';
import * as d3 from 'd3'; // TODO: namespace and only do the necessary imports
import classnames from 'classnames';
import { TIMELINE_MAX_TIME, MIN_FRAME_LENGTH_MS } from 'constants';
import timebarCss from 'styles/components/map/c-timebar.scss';
import timelineCss from 'styles/components/map/c-timeline.scss';
import extentChanged from 'util/extentChanged';
import DatePicker from 'components/Map/DatePicker';
import TogglePauseButton from 'components/Map/TogglePauseButton';
import DurationPicker from 'components/Map/DurationPicker';

let width;
let height;
let leftOffset;
let x;
let y;
let xAxis;
let area;
const INNER_OUTER_MARGIN_PX = 10;
const X_OVERFLOW_OFFSET = 16;

let currentInnerPxExtent = [0, 1];
let currentOuterPxExtent = [0, width];
let currentHandleIsWest;
let dragging;
let lastTimestamp;

let brush;
let outerBrushHandleLeft;
let outerBrushHandleRight;
let innerBrushLeftCircle;
let innerBrushRightCircle;
let innerBrushMiddle;

const customTickFormat = (date, index, allDates) => {
  let format;
  if (d3.timeDay(date) < date) {
    format = '%I %p';
  } else if (d3.timeMonth(date) < date) {
    format = d3.timeWeek(date) < date ? '%a %d' : '%b %d';
  } else if (d3.timeYear(date) < date) {
    if (index === 0) {
      format = '%b %Y';
    } else {
      format = (allDates.length >= 15 || window.innerWidth < 1024) ? '%b' : '%B';
    }
  } else {
    format = '%Y';
  }
  return d3.timeFormat(format)(date);
};

class Timebar extends Component {

  constructor(props) {
    super(props);
    this.onStartDatePickerChange = this.onStartDatePickerChange.bind(this);
    this.onEndDatePickerChange = this.onEndDatePickerChange.bind(this);
    this.onPauseToggle = this.onPauseToggle.bind(this);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.state = {
      innerExtentPx: [0, 100],  // used only by durationPicker
      durationPickerExtent: props.timelineInnerExtent
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.timebarChartData.length && !this.props.timebarChartData.length) {
      this.build(nextProps.timebarChartData);
    }

    if (!nextProps.timelineOuterExtent || !nextProps.timelineInnerExtent) {
      return;
    }

    // depending on whether state (outerExtent) or props (innerExtent) have been updated, we'll do different things
    const newInnerExtent = nextProps.timelineInnerExtent;
    this.setState({
      durationPickerExtent: newInnerExtent
    });
    if (extentChanged(this.props.timelineInnerExtent, newInnerExtent)) {
      this.redrawInnerBrush(newInnerExtent);
    }

    const currentOuterExtent = this.props.timelineOuterExtent;
    const newOuterExtent = nextProps.timelineOuterExtent;

    if (extentChanged(currentOuterExtent, newOuterExtent)) {
      this.redrawOuterBrush(newOuterExtent, currentOuterExtent);
    }
  }

  componentWillUpdate(nextProps) {
    if (this.props.timelinePaused !== nextProps.timelinePaused) {
      this.togglePause(nextProps.timelinePaused);
    }
  }

  componentWillUnmount() {
    if (!this.svg) return;

    outerBrushHandleLeft.on('mousedown', null);
    outerBrushHandleRight.on('mousedown', null);
    d3.select('body').on('mousemove', null);
    d3.select('body').on('mouseup', null);
    this.innerBrushFunc.on('end', null);
  }

  build(chartData) {
    const container = d3.select('#timeline_svg_container');
    const computedStyles = window.getComputedStyle(container.node());
    leftOffset = container.node().offsetLeft;
    width = parseInt(computedStyles.width, 10) - 50;
    height = parseInt(computedStyles.height, 10);

    x = d3.scaleTime().range([0, width]);
    y = d3.scaleLinear().range([height, 0]);
    xAxis = d3.axisTop().scale(x)
      .tickFormat(customTickFormat);

    // define the way the timeline chart is going to be drawn
    area = d3.area()
      .x(d => x(d.date))
      .y0(height)
      .y1(d => y(d.value));
    x.domain(this.props.timelineOverallExtent);
    y.domain([0, d3.max(chartData.map(d => d.value))]);

    this.svg = container.append('svg')
      .attr('width', width + 34)
      .attr('height', height);

    this.group = this.svg.append('g')
      .attr('transform', `translate(${X_OVERFLOW_OFFSET}, 0)`);

    this.group.append('path')
      .datum(chartData)
      .attr('class', timelineCss['c-timeline-area'])
      .attr('d', area);

    this.group.append('g')
      .attr('class', timelineCss['c-timeline-x-axis'])
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis);

    // set up brush generators
    brush = () => d3.brushX().extent([[0, 0], [width, height]]);
    this.innerBrushFunc = brush();

    this.innerBrush = this.group.append('g')
      .attr('class', timelineCss['c-timeline-inner-brush'])
      .call(this.innerBrushFunc);

    outerBrushHandleLeft = this.createOuterHandle();
    outerBrushHandleRight = this.createOuterHandle();

    this.innerBrush.select('.overlay').remove();

    this.innerBrush.select('.selection')
      .attr('height', height)
      .classed(timelineCss['c-timeline-inner-brush-selection'], true);

    const innerBrushCircles = this.innerBrush.append('g')
      .classed(timelineCss['c-timeline-inner-brush-circles'], true);

    innerBrushLeftCircle = innerBrushCircles.append('circle');
    innerBrushRightCircle = innerBrushCircles.append('circle');
    innerBrushCircles.selectAll('circle')
      .attr('cy', height / 2)
      .attr('r', 5)
      .classed(timelineCss['c-timeline-inner-brush-circle'], true);

    innerBrushMiddle = this.innerBrush.append('g')
      .classed(timelineCss['c-timeline-inner-brush-middle'], true);
    innerBrushMiddle.append('path')
      .attr('d', `M 0 0 L 0 ${height}`);
    innerBrushMiddle.append('circle')
      .attr('r', 5)
      .attr('cy', height / 2)
      .classed(timelineCss['c-timeline-inner-brush-circle'], true);

    // move both brushes to initial position
    this.resetOuterBrush();
    this.redrawInnerBrush(this.props.timelineInnerExtent);

    // custom outer brush events
    outerBrushHandleLeft.on('mousedown', this.onOuterHandleClick.bind(this));
    outerBrushHandleRight.on('mousedown', this.onOuterHandleClick.bind(this));

    this.group.on('mousemove', () => {
      this.onMouseOver(d3.event.offsetX);
    });
    this.group.on('mouseout', () => {
      this.onMouseOut();
    });

    d3.select('body').on('mousemove', () => {
      if (dragging) {
        const nx = d3.event.pageX - leftOffset - X_OVERFLOW_OFFSET;
        if (currentHandleIsWest) {
          currentOuterPxExtent[0] = nx;
        } else {
          currentOuterPxExtent[1] = nx;
        }
      }
    });
    d3.select('body').on('mouseup', () => {
      dragging = false;
      if (this.isZoomingIn(currentOuterPxExtent)) {
        // release, actually do the zoom in (when zooming out this is done at each tick)
        this.setOuterExtent(currentOuterPxExtent);
      }
      this.resetOuterBrush();
      this.enableInnerBrush();
    });

    this.enableInnerBrush();
  }

  createOuterHandle() {
    const handle = this.group.append('g')
      .classed(timelineCss['c-timeline-outer-brush-handle'], true);

    handle
      .append('path')
      .attr('d', `M0 0 V ${height}`);

    handle
      .append('rect')
      .attr('y', height / 2)
      .attr('x', 0);

    return handle;
  }

  onOuterHandleClick() {
    if (!this.props.timelinePaused) {
      this.props.updatePlayingStatus(true);
    }
    d3.event.preventDefault();
    currentHandleIsWest = outerBrushHandleLeft.node() === d3.event.currentTarget;
    dragging = true;
    this.disableInnerBrush();
    this.startTick();
  }

  setOuterExtent(outerExtentPx) {
    const outerExtent = this.getNewOuterExtent(outerExtentPx);

    this.props.updateOuterTimelineDates(outerExtent);
  }

  getNewOuterExtent(newOuterPxExtent) {
    // use the new x scale to compute new time values
    // do not get out of total range for outer brush
    const propsTimelineOverallExtent = this.props.timelineOverallExtent;
    const newOuterTimeLeft = x.invert(newOuterPxExtent[0]);
    const newOuterTimeRight = x.invert(newOuterPxExtent[1]);
    const isAfterOverallStartDate = newOuterTimeLeft.getTime() > propsTimelineOverallExtent[0].getTime();
    const isBeforeOverallEndDate = newOuterTimeRight.getTime() < propsTimelineOverallExtent[1].getTime();
    const newOuterTimeExtentLeft = isAfterOverallStartDate ? newOuterTimeLeft : propsTimelineOverallExtent[0];
    const newOuterTimeExtentRight = isBeforeOverallEndDate ? newOuterTimeRight : propsTimelineOverallExtent[1];
    return [newOuterTimeExtentLeft, newOuterTimeExtentRight];
  }

  resetOuterBrush() {
    currentOuterPxExtent = [0, width];
    outerBrushHandleLeft.attr('transform', 'translate(0,0)');
    outerBrushHandleRight.attr('transform', `translate(${width - 2}, 0)`);
  }

  redrawOuterBrush(newOuterExtent, currentOuterExtent) {
    const newOuterPxExtent = [x(newOuterExtent[0]), x(newOuterExtent[1])];
    const isLargerThanBefore =
      currentOuterExtent === undefined ||
      newOuterPxExtent[0] < x(currentOuterExtent[0]) ||
      newOuterPxExtent[1] > x(currentOuterExtent[1]);

    // grab inner time extent before changing x scale
    const prevInnerTimeExtent = [x.invert(currentInnerPxExtent[0]), x.invert(currentInnerPxExtent[1])];

    const newOuterTimeExtent = this.getNewOuterExtent(newOuterPxExtent);
    x.domain(newOuterTimeExtent);

    // redraw components
    this.group.select(`.${timelineCss['c-timeline-area']}`).transition().duration(isLargerThanBefore ? 0 : 500)
      .attr('d', area);
    this.group.select(`.${timelineCss['c-timeline-x-axis']}`).transition().duration(isLargerThanBefore ? 0 : 500)
      .call(xAxis);

    // calculate new inner extent, using old inner extent on new x scale
    this.redrawInnerBrush(prevInnerTimeExtent);

    this.svg.selectAll('g.tick text')
      .classed(timelineCss['c-timeline-full-year'], function isFullYear() { return this.innerHTML.match(/^\d{4}$/); });

    return newOuterTimeExtent;
  }

  onInnerBrushMoved() {
    let newExtentPx = d3.event.selection;
    const newExtent = this.getExtent(d3.event.selection);

    // time range is too long
    if (newExtent[1].getTime() - newExtent[0].getTime() > TIMELINE_MAX_TIME) {
      const oldExtent = this.props.timelineInnerExtent;

      if (oldExtent[0].getTime() === newExtent[0].getTime()) {
        // right brush was moved
        newExtent[1] = new Date(oldExtent[0].getTime() + TIMELINE_MAX_TIME);
      } else {
        // left brush was moved
        newExtent[0] = new Date(oldExtent[1].getTime() - TIMELINE_MAX_TIME);
      }
      newExtentPx = this.getPxExtent(newExtent);
      this.redrawInnerBrush(newExtent);
    }

    this.setState({
      durationPickerExtent: newExtent
    });
    this.redrawInnerBrushCircles(newExtentPx);
    this.redrawDurationPicker(newExtentPx);

    this.props.updateInnerTimelineDates(newExtent);

    if (!this.props.timelinePaused) {
      this.props.updatePlayingStatus(true);
    }
  }

  redrawInnerBrush(newInnerExtent) {
    currentInnerPxExtent = this.getPxExtent(newInnerExtent);
    // prevent d3 from dispatching brush events that are not user-initiated
    this.disableInnerBrush();
    this.innerBrushFunc.move(this.innerBrush, currentInnerPxExtent);
    this.redrawInnerBrushCircles(currentInnerPxExtent);
    this.redrawDurationPicker(currentInnerPxExtent);
    this.enableInnerBrush();
  }

  redrawInnerBrushCircles(newInnerPxExtent) {
    innerBrushLeftCircle.attr('cx', newInnerPxExtent[0]);
    innerBrushRightCircle.attr('cx', newInnerPxExtent[1]);
    const middle = newInnerPxExtent[0] + ((newInnerPxExtent[1] - newInnerPxExtent[0]) / 2);
    innerBrushMiddle.attr('transform', `translate(${middle}, 0)`);
  }

  redrawDurationPicker(newInnerPxExtent) {
    this.setState({
      innerExtentPx: newInnerPxExtent
    });
  }

  disableInnerBrush() {
    this.innerBrushFunc.on('brush', null);
    this.innerBrushFunc.on('end', null);
  }

  enableInnerBrush() {
    this.innerBrushFunc.on('brush', this.onInnerBrushMoved.bind(this));
  }

  getExtent(extentPx) {
    return [x.invert(extentPx[0]), x.invert(extentPx[1])];
  }

  getPxExtent(extent) {
    return [x(extent[0]), x(extent[1])];
  }

  isZoomingIn(outerExtentPx) {
    return outerExtentPx[0] > 0 || outerExtentPx[1] < width;
  }

  isZoomingOut(outerExtentPx) {
    return outerExtentPx[0] < 0 || outerExtentPx[1] > width;
  }

  zoomIn(outerExtentPx) {
    const extent = outerExtentPx;
    // do not go within the inner brush
    if (currentHandleIsWest) {
      extent[0] = Math.min(currentInnerPxExtent[0] - INNER_OUTER_MARGIN_PX, outerExtentPx[0]);
    } else {
      extent[1] = Math.max(currentInnerPxExtent[1] + INNER_OUTER_MARGIN_PX, outerExtentPx[1]);
    }

    outerBrushHandleLeft.attr('transform', `translate(${extent[0]}, 0)`);
    outerBrushHandleRight.attr('transform', `translate(${extent[1] - 2}, 0)`);
  }

  zoomOut(outerExtentPx, deltaTick) {
    // get prev offset
    const extent = [outerExtentPx[0], outerExtentPx[1]];

    // get delta
    let deltaOffset = (currentHandleIsWest) ? outerExtentPx[0] : outerExtentPx[1] - width;
    deltaOffset *= deltaOffset * deltaTick * 0.003;

    if (currentHandleIsWest) {
      extent[0] = -deltaOffset;
    } else {
      extent[1] = width + deltaOffset;
    }

    this.setOuterExtent(extent);
  }

  startTick() {
    window.requestAnimationFrame(this.onTick.bind(this));
  }

  onTick(timestamp) {
    if (!lastTimestamp) {
      lastTimestamp = timestamp;
    }
    const deltaTick = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (!this.props.timelinePaused) {
      this.playStep(deltaTick);
    }
    if (dragging) {
      const outerExtentPx = currentOuterPxExtent;
      if (this.isZoomingIn(outerExtentPx)) {
        this.zoomIn(outerExtentPx);
      } else if (this.isZoomingOut(outerExtentPx)) {
        this.zoomOut(outerExtentPx, deltaTick);
      }
    }

    if (dragging || !this.props.timelinePaused) {
      window.requestAnimationFrame(this.onTick.bind(this));
    }
  }

  getPlayStep(outerExtent) {
    const outerExtentDelta = outerExtent[1].getTime() - outerExtent[0].getTime();
    return outerExtentDelta / 50000;
  }

  togglePause(pause) {
    if (!pause) {
      this.startTick();
    }
  }

  /**
   * @param deltaTick frame length in ms
   */
  playStep(deltaTick) {
    // compute new basePlayStep (used for playback), because we want it to depend on the zoom levels
    const playStep = this.getPlayStep(this.props.timelineOuterExtent);
    const realtimePlayStep = Math.max(MIN_FRAME_LENGTH_MS, playStep * deltaTick);
    const previousInnerExtent = this.props.timelineInnerExtent;
    let offsetInnerExtent = previousInnerExtent.map(d => new Date(d.getTime() + realtimePlayStep));
    const endOfTime = this.props.timelineOuterExtent[1];
    const isAtEndOfTime = x(offsetInnerExtent[1]) >= x(endOfTime);

    // if we're at the end of time, just stop playing
    if (isAtEndOfTime) {
      const innerExtentDelta = offsetInnerExtent[1].getTime() - offsetInnerExtent[0].getTime();
      offsetInnerExtent = [new Date(endOfTime.getTime() - innerExtentDelta), endOfTime];
      this.props.updatePlayingStatus(true);
    }

    this.props.updateInnerTimelineDates(offsetInnerExtent);
  }

  onStartDatePickerChange(startDate) {
    this.props.updateOuterTimelineDates([startDate, this.props.timelineOuterExtent[1]], true);
  }

  onEndDatePickerChange(endDate) {
    this.props.updateOuterTimelineDates([this.props.timelineOuterExtent[0], endDate], false);
  }

  onPauseToggle() {
    const playStep = this.getPlayStep(this.props.timelineOuterExtent);
    const realTimePlayStep = Math.max(MIN_FRAME_LENGTH_MS, playStep);
    const offsetInnerExtent = this.props.timelineInnerExtent.map(d => new Date(d.getTime() + realTimePlayStep));
    const endOfTime = this.props.timelineOuterExtent[1];
    const isAtEndOfTime = x(offsetInnerExtent[1]) >= x(endOfTime);

    if (isAtEndOfTime) {
      this.props.rewind();
    }

    lastTimestamp = null;
    const paused = !this.props.timelinePaused;
    this.props.updatePlayingStatus(paused);
  }

  onMouseOver(offsetX) {
    const timelineOverExtent = this.getExtent([offsetX - 5, offsetX + 5]);
    this.props.updateTimelineOverDates(timelineOverExtent);
  }

  onMouseOut() {
    this.props.updateTimelineOverDates([new Date(0), new Date(0)]);
  }

  onTimeRangeSelected(rangeTimeMs) {
    let currentStartDate = this.props.timelineInnerExtent[0];
    let nextEndDate = new Date(currentStartDate.getTime() + rangeTimeMs);

    // if the predefined range time selection overrides timebar limits...
    if (this.props.timelineOuterExtent[1] < nextEndDate) {
      nextEndDate = this.props.timelineOuterExtent[1];
      currentStartDate = new Date(nextEndDate.getTime() - rangeTimeMs);
    }

    const newExtentPx = this.getPxExtent([currentStartDate, nextEndDate]);
    this.redrawInnerBrushCircles(newExtentPx);

    const newExtent = this.getExtent(newExtentPx);
    this.redrawInnerBrush(newExtent);

    this.props.updateInnerTimelineDates(newExtent);
  }

  render() {
    return (
      <div className={timebarCss['c-timebar']}>
        <div className={classnames(timebarCss['c-timebar-element'], timebarCss['c-timebar-datepicker'])}>
          <DatePicker
            selected={this.props.timelineOuterExtent && this.props.timelineOuterExtent[0]}
            onChange={this.onStartDatePickerChange}
            minDate={this.props.timelineOverallExtent && this.props.timelineOverallExtent[0]}
            maxDate={this.props.timelineOverallExtent && this.props.timelineOverallExtent[1]}
            label={'start'}
          />
        </div>
        <div className={classnames(timebarCss['c-timebar-element'], timebarCss['c-timebar-datepicker'])}>
          <DatePicker
            selected={this.props.timelineOuterExtent && this.props.timelineOuterExtent[1]}
            onChange={this.onEndDatePickerChange}
            minDate={this.props.timelineOverallExtent && this.props.timelineOverallExtent[0]}
            maxDate={this.props.timelineOverallExtent && this.props.timelineOverallExtent[1]}
            label={'end'}
          />
        </div>
        <div className={classnames(timebarCss['c-timebar-element'], timebarCss['c-timebar-playback'])}>
          <TogglePauseButton
            onToggle={this.onPauseToggle}
            paused={this.props.timelinePaused}
          />
        </div>

        <div
          className={classnames(timebarCss['c-timebar-element'], timelineCss['c-timeline'])}
          id="timeline_svg_container"
          ref={(timelineDOM) => { this.timelineDOM = timelineDOM; }}
        >
          <DurationPicker
            extent={this.state.durationPickerExtent}
            extentPx={this.state.innerExtentPx}
            offsetX={this.timelineDOM && this.timelineDOM.getBoundingClientRect().left}
            timelineOuterExtent={this.props.timelineOuterExtent}
            onTimeRangeSelected={rangeTime => this.onTimeRangeSelected(rangeTime)}
          />
        </div>
      </div>
    );
  }
}

Timebar.propTypes = {
  timebarChartData: React.PropTypes.array,
  updateInnerTimelineDates: React.PropTypes.func,
  updateOuterTimelineDates: React.PropTypes.func,
  updatePlayingStatus: React.PropTypes.func,
  updateTimelineOverDates: React.PropTypes.func,
  rewind: React.PropTypes.func,
  timelineOverallExtent: React.PropTypes.array,
  timelineOuterExtent: React.PropTypes.array,
  timelineInnerExtent: React.PropTypes.array,
  timelinePaused: React.PropTypes.bool
};
export default Timebar;
