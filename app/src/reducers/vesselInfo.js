import cloneDeep from 'lodash/cloneDeep';
import find from 'lodash/find';
import {
  ADD_VESSEL,
  SET_VESSEL_DETAILS,
  SET_VESSEL_TRACK,
  CLEAR_VESSEL_INFO,
  SET_TRACK_BOUNDS,
  HIDE_VESSELS_INFO_PANEL,
  TOGGLE_VESSEL_PIN,
  SHOW_VESSEL_DETAILS,
  SET_PINNED_VESSEL_HUE,
  LOAD_PINNED_VESSEL,
  SET_PINNED_VESSEL_TITLE,
  TOGGLE_PINNED_VESSEL_EDIT_MODE,
  SET_RECENT_VESSEL_HISTORY,
  LOAD_RECENT_VESSEL_HISTORY,
  SET_PINNED_VESSEL_TRACK_VISIBILITY
} from 'actions';
import { HEATMAP_TRACK_HIGHLIGHT_HUE, VESSEL_INFO_STATUS } from 'constants';

const initialState = {
  vessels: [],
  infoPanelStatus: VESSEL_INFO_STATUS.HIDDEN,
  pinnedVesselEditMode: false,
  history: [],
  currentlyShownVessel: null
};

export default function (state = initialState, action) {
  switch (action.type) {
    case ADD_VESSEL: {
      if (find(state.vessels, l => l.seriesgroup === action.payload.seriesgroup && l.tilesetId === action.payload.tilesetId)) {
        return state;
      }

      const newVessel = {
        seriesgroup: action.payload.seriesgroup,
        series: action.payload.series,
        visible: action.payload.visible || false,
        pinned: false,
        tilesetId: action.payload.tilesetId,
        shownInInfoPanel: false,
        hue: HEATMAP_TRACK_HIGHLIGHT_HUE
      };
      return Object.assign({}, state, {
        infoPanelStatus: VESSEL_INFO_STATUS.LOADING,
        vessels: [...state.vessels, newVessel]
      });
    }

    case SET_VESSEL_DETAILS: {
      const vesselData = action.payload.vesselData;
      const vesselIndex = state.vessels.findIndex(vessel => vessel.seriesgroup === vesselData.seriesgroup);
      const currentVessel = state.vessels[vesselIndex];

      const vesselFields = action.payload.layer.header.vesselFields;
      const vesselFieldPriorities = vesselFields
        .filter(v => v.titlePriority !== undefined)
        .sort(
          (a, b) => a.titlePriority > b.titlePriority
        );
      const vesselFieldValues = vesselFieldPriorities.map(v => vesselData[v.id]);

      const defaultTitle = vesselFieldValues.find(t => t !== undefined);

      const newVessel = Object.assign({
        defaultTitle,
        title: defaultTitle
      }, currentVessel, vesselData);

      return Object.assign({}, state, {
        vessels: [...state.vessels.slice(0, vesselIndex), newVessel, ...state.vessels.slice(vesselIndex + 1)],
        infoPanelStatus: VESSEL_INFO_STATUS.LOADED
      });
    }

    case SET_VESSEL_TRACK: {
      const vesselIndex = state.vessels.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
      const newVessel = cloneDeep(state.vessels[vesselIndex]);
      newVessel.track = {
        data: action.payload.seriesGroupData,
        selectedSeries: action.payload.selectedSeries
      };

      return Object.assign({}, state, {
        vessels: [...state.vessels.slice(0, vesselIndex), newVessel, ...state.vessels.slice(vesselIndex + 1)]
      });
    }

    case LOAD_PINNED_VESSEL: {
      const vesselIndex = state.vessels
        .findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup && vessel.tilesetId === action.payload.tilesetId);
      if (vesselIndex > -1) {
        const newVessel = Object.assign(state.vessels[vesselIndex], {
          hue: action.payload.hue || HEATMAP_TRACK_HIGHLIGHT_HUE,
          pinned: true,
          visible: action.payload.visible
        });

        let currentlyShownVessel = state.currentlyShownVessel;
        if (newVessel.seriesgroup === currentlyShownVessel.seriesgroup && newVessel.tilesetId === currentlyShownVessel.tilesetId) {
          currentlyShownVessel = cloneDeep(currentlyShownVessel);
          currentlyShownVessel.pinned = true;
        }

        return Object.assign({}, state, {
          vessels: [...state.vessels.slice(0, vesselIndex), newVessel, ...state.vessels.slice(vesselIndex + 1)],
          currentlyShownVessel
        });
      }

      const newVessel = Object.assign({
        visible: false,
        shownInInfoPanel: false,
        pinned: true,
        title: action.payload.title || action.payload.vesselname,
        hue: action.payload.hue || HEATMAP_TRACK_HIGHLIGHT_HUE
      }, action.payload);

      return Object.assign({}, state, {
        vessels: [...state.vessels, newVessel]
      });
    }

    case SHOW_VESSEL_DETAILS: {
      const vesselIndex = state.vessels.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
      const currentlyShownVessel = cloneDeep(state.vessels[vesselIndex]);
      currentlyShownVessel.shownInInfoPanel = true;

      return Object.assign({}, state, {
        vessels: [...state.vessels.slice(0, vesselIndex), currentlyShownVessel, ...state.vessels.slice(vesselIndex + 1)],
        infoPanelStatus: VESSEL_INFO_STATUS.LOADED,
        currentlyShownVessel
      });
    }

    case CLEAR_VESSEL_INFO: {
      const vesselIndex = state.vessels.findIndex(vessel => vessel.shownInInfoPanel === true);

      // no vessel currently shown: just reset infoPanelStatus
      if (vesselIndex === -1) {
        return Object.assign({}, state, {
          infoPanelStatus: VESSEL_INFO_STATUS.HIDDEN,
          currentlyShownVessel: null
        });
      }

      let currentlyShownVessel = state.vessels[vesselIndex];

      // vessel is pinned: set info to shownInInfoPanel = false
      if (currentlyShownVessel.pinned === true) {
        currentlyShownVessel = cloneDeep(currentlyShownVessel);
        currentlyShownVessel.shownInInfoPanel = false;
        return Object.assign({}, state, {
          vessels: [...state.vessels.slice(0, vesselIndex), currentlyShownVessel, ...state.vessels.slice(vesselIndex + 1)],
          infoPanelStatus: VESSEL_INFO_STATUS.LOADED,
          currentlyShownVessel: null
        });
      }

      // vessel is not pinned: get rid of vessel
      return Object.assign({}, state, {
        vessels: [...state.vessels.slice(0, vesselIndex), ...state.vessels.slice(vesselIndex + 1)],
        infoPanelStatus: VESSEL_INFO_STATUS.HIDDEN,
        currentlyShownVessel: null
      });
    }

    case HIDE_VESSELS_INFO_PANEL:
      return Object.assign({}, state, {
        detailsStatus: null
      });
    case SET_TRACK_BOUNDS: {
      return Object.assign({}, state, { trackBounds: action.trackBounds });
    }
    case TOGGLE_VESSEL_PIN: {
      const vesselIndex = action.payload.vesselIndex;
      const newVessel = cloneDeep(state.vessels[vesselIndex]);
      newVessel.pinned = action.payload.pinned;
      newVessel.visible = action.payload.visible;

      let currentlyShownVessel = state.currentlyShownVessel;
      if (
        state.currentlyShownVessel &&
        newVessel.seriesgroup === state.currentlyShownVessel.seriesgroup &&
        newVessel.tilesetId === state.currentlyShownVessel.tilesetId
      ) {
        currentlyShownVessel = cloneDeep(state.currentlyShownVessel);
        currentlyShownVessel.pinned = action.payload.pinned;
      }

      const newVessels = [...state.vessels.slice(0, vesselIndex), newVessel, ...state.vessels.slice(vesselIndex + 1)];
      return Object.assign({}, state, {
        vessels: newVessels,
        pinnedVesselEditMode: state.pinnedVesselEditMode && newVessels.filter(e => e.pinned === true).length > 0,
        currentlyShownVessel
      });
    }
    case SET_PINNED_VESSEL_HUE: {
      const vesselIndex = state.vessels.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
      const newVessel = cloneDeep(state.vessels[vesselIndex]);
      newVessel.hue = action.payload.hue;

      return Object.assign({}, state, {
        vessels: [...state.vessels.slice(0, vesselIndex), newVessel, ...state.vessels.slice(vesselIndex + 1)]
      });
    }
    case SET_PINNED_VESSEL_TRACK_VISIBILITY: {
      const vesselIndex = state.vessels.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
      const newVessel = cloneDeep(state.vessels[vesselIndex]);
      newVessel.visible = action.payload.visible;

      return Object.assign({}, state, {
        vessels: [...state.vessels.slice(0, vesselIndex), newVessel, ...state.vessels.slice(vesselIndex + 1)]
      });
    }
    case SET_PINNED_VESSEL_TITLE: {
      const vesselIndex = state.vessels.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
      const newVessel = Object.assign({}, state.vessels[vesselIndex]);
      newVessel.title = action.payload.title;

      return Object.assign({}, state, {
        vessels: [...state.vessels.slice(0, vesselIndex), newVessel, ...state.vessels.slice(vesselIndex + 1)]
      });
    }

    case SET_RECENT_VESSEL_HISTORY: {
      const newVessel = {};
      const vesselIndex = state.vessels.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
      const currentVessel = state.vessels[vesselIndex];
      let vesselHistoryIndex = -1;
      let vesselHistory = {};

      if (state.history.length > 0) {
        vesselHistoryIndex = state.history.findIndex(vessel => vessel.seriesgroup === action.payload.seriesgroup);
        vesselHistory = state.history[vesselHistoryIndex];
      }

      Object.assign(newVessel, vesselHistory, {
        mmsi: currentVessel.mmsi,
        seriesgroup: currentVessel.seriesgroup,
        vesselname: currentVessel.vesselname,
        pinned: currentVessel.pinned,
        tilesetId: currentVessel.tilesetId
      });

      if (vesselHistoryIndex !== -1) {
        return Object.assign({}, state, {
          history: [...state.history.slice(0, vesselHistoryIndex), newVessel, ...state.history.slice(vesselHistoryIndex + 1)]
        });
      }

      try {
        const serializedState = JSON.stringify([newVessel, ...state.history]);
        localStorage.setItem('vessel_history', serializedState);
      } catch (err) {
        return Object.assign({}, state, {
          history: [newVessel, ...state.history]
        });
      }

      return Object.assign({}, state, {
        history: [newVessel, ...state.history]
      });
    }

    case LOAD_RECENT_VESSEL_HISTORY: {
      try {
        const serializedState = localStorage.getItem('vessel_history');

        if (serializedState === null) {
          return state;
        }

        return Object.assign({}, state, {
          history: JSON.parse(serializedState)
        });
      } catch (err) {
        return state;
      }
    }

    case TOGGLE_PINNED_VESSEL_EDIT_MODE: {
      const newState = Object.assign({}, state, {
        pinnedVesselEditMode: action.payload.forceMode === null ? !state.pinnedVesselEditMode : action.payload.forceMode
      });

      if (newState.pinnedVesselEditMode === false) {
        newState.vessels = cloneDeep(state.vessels);

        newState.vessels.forEach((vesselDetail) => {
          if (vesselDetail.title.trim() === '') {
            vesselDetail.title = vesselDetail.defaultTitle;
          }
        });
      }

      return newState;
    }

    default:
      return state;
  }
}
