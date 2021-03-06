import { GET_LAYER_LIBRARY } from 'actions';
import { DEFAULT_TRACK_HUE } from 'constants';
import { getWorkspace } from 'actions/workspace';
import { hexToHue } from 'util/colors';
import calculateLayerId from 'util/calculateLayerId';
import { toggleLayerVisibility, toggleLayerWorkspacePresence } from 'actions/layers';

export function getLayerLibrary() {
  return (dispatch, getState) => {
    const state = getState();

    const options = {};
    if (state.user.token) {
      options.headers = {
        Authorization: `Bearer ${state.user.token}`
      };
    }

    fetch(`${V2_API_ENDPOINT}/directory`, options)
      .then(res => res.json())
      .then((data) => {
        const layers = data.entries.map((l) => {
          const layer = {
            id: l.args.id,
            title: l.args.title,
            label: l.args.title,
            description: l.args.description,
            hue: (l.args.color ? hexToHue(l.args.color) : DEFAULT_TRACK_HUE),
            visible: false,
            type: l.type,
            url: l.args.source.args.url,
            added: false,
            library: true
          };
          if (l.args.meta && l.args.meta.reports && l.args.meta.reports.regions) {
            layer.reportId = Object.keys(l.args.meta.reports.regions)[0];
          }

          return layer;
        });

        layers.forEach((layer) => {
          layer.id = calculateLayerId(layer);
        });

        dispatch({
          type: GET_LAYER_LIBRARY, payload: layers
        });

        dispatch(getWorkspace());
      });

    return true;
  };
}

export function addLayer(layerId) {
  return (dispatch) => {
    dispatch(toggleLayerVisibility(layerId, true));
    dispatch(toggleLayerWorkspacePresence(layerId, true));
  };
}

export function removeLayer(layerId) {
  return (dispatch) => {
    dispatch(toggleLayerVisibility(layerId, false));
    dispatch(toggleLayerWorkspacePresence(layerId, false));
  };
}
