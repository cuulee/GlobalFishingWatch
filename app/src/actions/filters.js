import {
  SET_FLAG_FILTERS,
  SET_INNER_TIMELINE_DATES,
  SET_OUTER_TIMELINE_DATES,
  SET_PLAYING_STATUS,
  SET_TIMELINE_HOVER_DATES,
  GA_PLAY_STATUS_TOGGLED,
  GA_OUTER_TIMELINE_DATES_UPDATED,
  REWIND_TIMELINE
} from 'actions';
import { LAYER_TYPES, TIMELINE_MIN_INNER_EXTENT } from 'constants';
import { loadTilesExtraTimeRange } from 'actions/heatmap';
import debounce from 'lodash/debounce';

const gaLogOuterTimelineDatesUpdated = debounce((dispatch, outerTimelineDates) => {
  dispatch({
    type: GA_OUTER_TIMELINE_DATES_UPDATED,
    payload: outerTimelineDates
  });
}, 1000);

const getRangeDuration = range => range[1].getTime() - range[0].getTime();

export function setFlagFilters(flagFilters_) {
  return (dispatch, getState) => {
    // get heatmap layers and organise filters to have one sublayer per filter in each layer
    // if there's only one filter and it's not set, set it to ALL
    // for the next ones, ignore undefined filters
    // filter hue overrides heatmap layer hue when set
    const heatmapLayers = getState().layers.workspaceLayers.filter(layer =>
      layer.type === LAYER_TYPES.Heatmap && layer.added === true
    );
    const flagFilters = (flagFilters_ === undefined) ? [] : flagFilters_.slice(0);
    const flagFiltersLayers = {};
    if (!flagFilters.length) {
      flagFilters.push({});
    }
    heatmapLayers.forEach((heatmapLayer) => {
      const subLayers = [];
      flagFilters.forEach((flagFilter, index) => {
        let flag = flagFilter.flag;
        if (flag === undefined) {
          if (index === 0) {
            flag = 'ALL';
          } else {
            return;
          }
        } else {
          flag = parseInt(flag, 10);
        }
        const hue = (flagFilter.hue !== undefined) ? flagFilter.hue : heatmapLayer.hue;
        subLayers.push({ flag, hue });
      });
      flagFiltersLayers[heatmapLayer.id] = subLayers;
    });
    dispatch({
      type: SET_FLAG_FILTERS,
      payload: {
        flagFilters,
        flagFiltersLayers
      }
    });
  };
}

export function refreshFlagFiltersLayers() {
  return (dispatch, getState) => {
    dispatch(setFlagFilters(getState().filters.flags));
  };
}

export function setInnerTimelineDates(innerTimelineDates) {
  return {
    type: SET_INNER_TIMELINE_DATES,
    payload: innerTimelineDates
  };
}

export function setOuterTimelineDates(outerTimelineDates, startChanged = null) {
  return (dispatch, getState) => {
    gaLogOuterTimelineDatesUpdated(dispatch, outerTimelineDates);

    const currentInnerTimelineDates = getState().filters.timelineInnerExtent;
    const currentInnerDuration = getRangeDuration(currentInnerTimelineDates);

    // check if outer start goes beyond outer end or the opposite, in which case
    // we will arbitrarily move overlapped extent to set extent + currentInnerDuration * 2
    if (outerTimelineDates[0] > outerTimelineDates[1]) {
      if (startChanged === true) {
        outerTimelineDates[1] = new Date(outerTimelineDates[0].getTime() + (currentInnerDuration * 2));
      } else if (startChanged === false) {
        outerTimelineDates[0] = new Date(outerTimelineDates[1].getTime() - (currentInnerDuration * 2));
      }
    }

    // check inner dates, move inner range inside new outer timeline dates if needed
    if (outerTimelineDates[0] >= currentInnerTimelineDates[0] ||
        outerTimelineDates[1] <= currentInnerTimelineDates[1]) {
      const newInner = [];
      const currentOverallTimelineDates = getState().filters.timelineOverallExtent;
      if (outerTimelineDates[0] >= currentInnerTimelineDates[0]) {
        newInner[0] = outerTimelineDates[0];
        newInner[1] = new Date(Math.min(outerTimelineDates[0].getTime() + currentInnerDuration, currentOverallTimelineDates[1].getTime()));
      } else {
        newInner[1] = outerTimelineDates[1];
        newInner[0] = new Date(Math.max(outerTimelineDates[1].getTime() - currentInnerDuration, currentOverallTimelineDates[0].getTime()));
      }
      dispatch(setInnerTimelineDates(newInner));
    }

    dispatch({
      type: SET_OUTER_TIMELINE_DATES,
      payload: outerTimelineDates
    });

    dispatch(loadTilesExtraTimeRange());
  };
}

export function setPlayingStatus(paused) {
  return (dispatch, getState) => {
    const state = getState();

    if (paused !== state.filters.timelinePaused) {
      dispatch({
        type: GA_PLAY_STATUS_TOGGLED,
        payload: paused
      });
    }

    dispatch({
      type: SET_PLAYING_STATUS,
      payload: paused
    });
  };
}

export function setTimelineHoverDates(overDates) {
  return {
    type: SET_TIMELINE_HOVER_DATES,
    payload: overDates
  };
}

export function rewindTimeline() {
  return {
    type: REWIND_TIMELINE
  };
}

// change Timebar bounds, so that
// - outer bounds fits time range of tracks (filtered by series if applicable)
// - outer bounds is not less than a week
// - inner bounds start is moved to beginning of outer bounds if it's outside
// - inner bounds end is moved to fit in outer bounds
export function fitTimelineToTrack(tracksExtent) {
  return (dispatch, getState) => {
    let tracksDuration = tracksExtent[1] - tracksExtent[0];

    if (tracksDuration < TIMELINE_MIN_INNER_EXTENT) {
      tracksExtent[1] = tracksExtent[0] + TIMELINE_MIN_INNER_EXTENT;
      tracksDuration = TIMELINE_MIN_INNER_EXTENT;
    }

    const currentInnerExtent = getState().filters.timelineInnerExtent;
    const currentInnerExtentStart = currentInnerExtent[0].getTime();
    const currentInnerExtentEnd = currentInnerExtent[1].getTime();
    const currentInnerDuration = currentInnerExtentEnd - currentInnerExtentStart;
    let newInnerExtentStart = currentInnerExtentStart;
    let newInnerExtentEnd = currentInnerExtentEnd;

    if (newInnerExtentStart < tracksExtent[0] || newInnerExtentStart > tracksExtent[1]) {
      newInnerExtentStart = tracksExtent[0];
      newInnerExtentEnd = newInnerExtentStart + currentInnerDuration;
    }

    if (newInnerExtentEnd > tracksExtent[1]) {
      newInnerExtentEnd = newInnerExtentStart + (tracksDuration * 0.1);
    }

    dispatch(setInnerTimelineDates([new Date(newInnerExtentStart), new Date(newInnerExtentEnd)]));
    dispatch(setOuterTimelineDates([new Date(tracksExtent[0]), new Date(tracksExtent[1])]));
  };
}
