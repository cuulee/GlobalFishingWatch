import _ from 'lodash';
import {
  UPDATE_HEATMAP_TILES,
  ADD_REFERENCE_TILE,
  REMOVE_REFERENCE_TILE,
  ADD_HEATMAP_LAYER,
  REMOVE_HEATMAP_LAYER,
  INIT_HEATMAP_LAYERS,
  UPDATE_HEATMAP_LAYER_TEMPORAL_EXTENTS_LOADED_INDICES,
  HIGHLIGHT_VESSELS
} from 'actions';
import {
  getTilePelagosPromises,
  getCleanVectorArrays,
  groupData,
  addWorldCoordinates,
  getTilePlaybackData,
  selectVesselsAt
} from 'actions/helpers/heatmapTileData';
import { LAYER_TYPES, LOADERS } from 'constants';
import { clearVesselInfo, addVessel, hideVesselsInfoPanel } from 'actions/vesselInfo';
import { trackMapClicked } from 'actions/analytics';
import { addLoader, removeLoader, zoomIntoVesselCenter } from 'actions/map';

/**
 * getTemporalExtentsVisibleIndices - Compares timebar outer extent with temporal extents present on the layer header
 * @param  {array} currentOuterExtent Current timebar outer extent
 * @param  {array} temporalExtents    Temporal extents present on the layer's header (an array of extent arrays)
 * @return {array}                    Indices of the layer's temporal extents that should be visible
 */
function getTemporalExtentsVisibleIndices(currentOuterExtent, temporalExtents) {
  const currentExtentStart = currentOuterExtent[0].getTime();
  const currentExtentEnd = currentOuterExtent[1].getTime();
  const indices = [];
  temporalExtents.forEach((temporalExtent, index) => {
    const temporalExtentStart = temporalExtent[0];
    const temporalExtentEnd = temporalExtent[1];
    if (temporalExtentEnd >= currentExtentStart && temporalExtentStart <= currentExtentEnd) {
      indices.push(index);
    }
  });
  return indices;
}


/**
 * initHeatmapLayers - Creates the base reducer state, extracting heatmap layers from all layers
 */
export function initHeatmapLayers() {
  return (dispatch, getState) => {
    const currentOuterExtent = getState().filters.timelineOuterExtent;
    const workspaceLayers = getState().layers.workspaceLayers;
    const heatmapLayers = {};

    workspaceLayers.forEach((workspaceLayer) => {
      if (workspaceLayer.type === LAYER_TYPES.Heatmap && workspaceLayer.added === true) {
        heatmapLayers[workspaceLayer.id] = {
          url: workspaceLayer.url,
          tiles: [],
          // initially attach which of the temporal extents indices are visible with initial outerExtent
          visibleTemporalExtentsIndices: getTemporalExtentsVisibleIndices(currentOuterExtent, workspaceLayer.header.temporalExtents)
        };
      }
    });

    dispatch({
      type: INIT_HEATMAP_LAYERS,
      payload: heatmapLayers
    });
  };
}


/**
 * loadLayerTile - loads an heatmap tile.
 *
 * @param  {object} tileCoordinates        tile coordinates from reference tile
 * @param  {string} layerUrl             the base layer url
 * @param  {string} token                the user's token
 * @param  {array} temporalExtents       all of the layer's header temporal extents
 * @param  {array} temporalExtentsIndices which of the temporal extents from  temporalExtents should be loaded
 * @return {Promise}                     a Promise that will be resolved when tile is loaded
 */
function loadLayerTile(tileCoordinates, layerUrl, token, temporalExtents, temporalExtentsIndices) {
  // const tileCoordinates = referenceTile.tileCoordinates;
  const pelagosPromises = getTilePelagosPromises(layerUrl, token, temporalExtents, { tileCoordinates, temporalExtentsIndices });
  const allLayerPromises = Promise.all(pelagosPromises);

  const layerTilePromise = new Promise((resolve) => {
    allLayerPromises.then((rawTileData) => {
      resolve(rawTileData);
    });
  });

  return layerTilePromise;
}

/**
 * parseLayerTile - parses an heatmap tile to a playback-ready format.
 *
 * @param  {object} tileCoordinates      tile coordinates from reference tile
 * @param  {array} columns               names of the columns present in the raw tiles that need to be included in the final playback data
 * @param  {object} map                  a reference to the Google Map object. This is required to access projection data.
 * @param  {Object} rawTileData
 * @param  {array} prevPlaybackData      (optional) in case some time extent was already loaded for this tile, append to this data
 * @return {Object}                      playback-ready merged data
 */
function parseLayerTile(tileCoordinates, columns, map, rawTileData, prevPlaybackData) {
  // console.time('test')
  const cleanVectorArrays = getCleanVectorArrays(rawTileData);
  const groupedData = groupData(cleanVectorArrays, columns);
  const vectorArray = addWorldCoordinates(groupedData, map);
  const data = getTilePlaybackData(
    tileCoordinates.zoom,
    vectorArray,
    columns,
    prevPlaybackData
  );
  return data;
  // console.timeEnd('test');
}

/**
 * getTiles - loads a bunch of heatmap tiles
 * @param  {array} layerIds                 list of layer Ids that need to be loaded for this/these tiles
 * @param  {array} referenceTiles           list of reference tiles (tile data regardless of layer) that need to be loaded
 * @param  {object} newTemporalExtentsToLoad (optional) a dict (layerId is the key) of temporal extents indices that should be
 * appended to existing data
 * @param  {bool} deferParsing              load but keep parsing for later, avoiding UI lock
 */
function getTiles(layerIds, referenceTiles, newTemporalExtentsToLoad, deferParsing) {
  return (dispatch, getState) => {
    const loaderId = LOADERS.HEATMAP_TILES + new Date().getTime();
    dispatch(addLoader(loaderId));
    const layers = getState().heatmap.heatmapLayers;
    const token = getState().user.token;
    const map = getState().map.googleMaps;
    const allPromises = [];

    layerIds.forEach((layerId) => {
      const workspaceLayers = getState().layers.workspaceLayers;
      const workspaceLayer = workspaceLayers.find(layer => layer.id === layerId);
      const layerHeader = workspaceLayer.header;
      if (!layerHeader) {
        console.warn('no header has been set on this heatmap layer');
      }
      referenceTiles.forEach((referenceTile) => {
        // check if tile does not already exist first
        let tile = layers[layerId].tiles.find(t => t.uid === referenceTile.uid);
        if (!tile) {
          tile = {
            uid: referenceTile.uid,
            canvas: referenceTile.canvas,
            temporalExtentsIndicesLoaded: [],
            deferredParsingRawData: undefined
          };
          layers[layerId].tiles.push(tile);
        }

        const queriedTemporalExtentsIndices = (newTemporalExtentsToLoad === undefined)
          ? layers[layerId].visibleTemporalExtentsIndices
          : newTemporalExtentsToLoad[layerId];

        console.log(referenceTile.tileCoordinates)
        console.log('temporal extents already loaded', tile.temporalExtentsIndicesLoaded)

        const temporalExtentsIndicesToLoad = _.difference(queriedTemporalExtentsIndices, tile.temporalExtentsIndicesLoaded);
        console.log('temporal extents to load', temporalExtentsIndicesToLoad)

        const tilePromise = loadLayerTile(
          referenceTile.tileCoordinates,
          // TODO use URL from header
          layers[layerId].url,
          token,
          layerHeader.temporalExtents,
          temporalExtentsIndicesToLoad
        );

        allPromises.push(tilePromise);

        tilePromise.then((rawTileData) => {
          console.log('resolved', rawTileData)

          // keep loaded indices to avoid having to reload them later on
          tile.temporalExtentsIndicesLoaded = _.uniq(tile.temporalExtentsIndicesLoaded.concat(temporalExtentsIndicesToLoad));

          if (deferParsing === true) {
            tile.deferredParsingRawData = rawTileData;
          } else {
            if (tile.deferredParsingRawData !== undefined) {
              tile.data = parseLayerTile(
                referenceTile.tileCoordinates,
                Object.keys(layerHeader.colsByName),
                map,
                tile.deferredParsingRawData,
                tile.data
              );
            }

            if (rawTileData.length) {
              tile.data = parseLayerTile(
                referenceTile.tileCoordinates,
                Object.keys(layerHeader.colsByName),
                map,
                rawTileData,
                tile.data
              );
            }

            dispatch({
              type: UPDATE_HEATMAP_TILES, payload: layers
            });
          }
        });
      });
    });

    Promise.all(allPromises).then(() => {
      dispatch(removeLoader(loaderId));
    });
  };
}


/**
 * getTile - This action is emitted when a new tile is queried from panning or zooming the map
 * This will load a tile for all currently visible heatmap layers
 *
 * @param  {number} uid             the reference tile uid
 * @param  {object} tileCoordinates the reference tiles coordinates
 * @param  {object} canvas          the tiles DOM canvas
 */
export function getTile(uid, tileCoordinates, canvas) {
  return (dispatch, getState) => {
    const referenceTile = {
      uid,
      tileCoordinates,
      canvas
    };

    dispatch({
      type: ADD_REFERENCE_TILE,
      payload: referenceTile
    });

    const visibleHeatmapLayers = getState().layers.workspaceLayers.filter(workspaceLayer =>
      workspaceLayer.type === LAYER_TYPES.Heatmap && workspaceLayer.added === true && workspaceLayer.visible === true)
      .map(layer => layer.id);

    dispatch(getTiles(visibleHeatmapLayers, [referenceTile]));

    // dispatch(getTiles(Object.keys(getState().heatmap.heatmapLayers), [referenceTile]));
  };
}


/**
* releaseTile - This action is emitted when an existing tile is removed from panning or zooming the map
 * @param  {type} uid the reference tile uid
 */
export function releaseTile(uid) {
  return (dispatch, getState) => {
    dispatch({
      type: REMOVE_REFERENCE_TILE,
      payload: uid
    });

    const layers = getState().heatmap.heatmapLayers;
    Object.keys(layers).forEach((layerId) => {
      const layer = layers[layerId];
      const tiles = layer.tiles;
      const releasedTileIndex = tiles.findIndex(tile => tile.uid === uid);
      if (releasedTileIndex === -1) {
        return;
      }
      tiles.splice(releasedTileIndex, 1);
    });
    dispatch({
      type: UPDATE_HEATMAP_TILES, payload: layers
    });
  };
}


export function loadAllTilesForLayer(layerId) {
  return (dispatch, getState) => {
    //                current layer, all reference tiles
    dispatch(getTiles([layerId], getState().heatmap.referenceTiles));
  };
}


export function addHeatmapLayerFromLibrary(layerId, url) {
  return (dispatch) => {
    dispatch({
      type: ADD_HEATMAP_LAYER,
      payload: {
        layerId,
        url
      }
    });

    dispatch(loadAllTilesForLayer(layerId));
  };
}

export function removeHeatmapLayerFromLibrary(id) {
  return (dispatch) => {
    dispatch({
      type: REMOVE_HEATMAP_LAYER,
      payload: {
        id
      }
    });
  };
}

/**
 * loadTilesExtraTimeRange - when outer time extent changes, checks if more tiles needs to be loaded
 * by comparing the outer time range with the temporalExtent already loaded on each layer
 */
export function loadTilesExtraTimeRange() {
  return (dispatch, getState) => {
    const currentOuterExtent = getState().filters.timelineOuterExtent;
    const heatmapLayers = getState().heatmap.heatmapLayers;
    const layersToUpdate = {};
    Object.keys(heatmapLayers).forEach((layerId) => {
      const workspaceLayer = getState().layers.workspaceLayers.find(layer => layer.id === layerId);
      const heatmapLayer = heatmapLayers[layerId];
      const oldVisibleTemporalExtents = heatmapLayer.visibleTemporalExtentsIndices;
      const newVisibleTemporalExtents = getTemporalExtentsVisibleIndices(currentOuterExtent, workspaceLayer.header.temporalExtents);
      const diff = _.difference(newVisibleTemporalExtents, oldVisibleTemporalExtents);
      if (diff.length) {
        // add new loaded indices to heatmap layer if applicable
        layersToUpdate[layerId] = diff;
        dispatch({
          type: UPDATE_HEATMAP_LAYER_TEMPORAL_EXTENTS_LOADED_INDICES,
          payload: {
            layerId,
            diff
          }
        });
      }
    });

    // getTiles with indices diff
    if (Object.keys(layersToUpdate).length) {
      dispatch(getTiles(Object.keys(layersToUpdate), getState().heatmap.referenceTiles, layersToUpdate));
    }
  };
}


const _getCurrentFlagsForLayer = (state, layerId) => {
  if (layerId === undefined) {
    return undefined;
  }
  const flags = state.filters.flagsLayers[layerId].map(flagLayer => flagLayer.flag);
  return (flags.length === 1 && flags[0] === 'ALL') ? undefined : flags;
};

const _queryHeatmap = (state, tileQuery) => {
  const layers = state.heatmap.heatmapLayers;
  const timelineExtent = state.filters.timelineInnerExtentIndexes;
  const startIndex = timelineExtent[0];
  const endIndex = timelineExtent[1];
  const layersVessels = [];
  Object.keys(layers).forEach((layerId) => {
    const layer = layers[layerId];
    const queriedTile = layer.tiles.find(tile => tile.uid === tileQuery.uid);
    const currentFlags = _getCurrentFlagsForLayer(state, layerId);
    if (queriedTile !== undefined && queriedTile.data !== undefined) {
      layersVessels.push({
        layerId,
        vessels: selectVesselsAt(queriedTile.data, state.map.zoom, tileQuery.worldX, tileQuery.worldY, startIndex, endIndex, currentFlags)
      });
    }
  });

  const layersVesselsResult = layersVessels.filter(layerVessels => layerVessels.vessels.length > 0);

  // it's a cluster because of aggregation on the server side
  let isCluster;
  // its a cluster because or multiple vessels under mouse
  let isMouseCluster;
  let isEmpty;
  let layerId;
  let seriesUids;

  if (layersVesselsResult.length === 0) {
    isEmpty = true;
  } else if (layersVesselsResult.length > 1) {
    // if there are points over multiple layers, consider this a cluster
    isCluster = true;
  } else {
    // we can get multiple points with similar series and seriesgroup, in which case
    // we should treat that as a successful vessel query, not a cluster
    layerId = layersVesselsResult[0].layerId;
    const vessels = layersVesselsResult[0].vessels;

    if (vessels.length === 0) {
      isEmpty = true;
    } else {
      // look up for any non-negative seriesgroup (not clusters on the server side)
      const nonClusteredVessels = vessels.filter(v => v.seriesgroup > 0);

      if (nonClusteredVessels.length) {
        seriesUids = _.uniq(nonClusteredVessels.map(v => v.seriesUid));
        isMouseCluster = seriesUids.length > 1;
      } else {
        isCluster = true;
      }
    }
  }

  return { isEmpty, isCluster, isMouseCluster, seriesUids, layerId };
};

export function highlightVesselFromHeatmap(tileQuery, latLng) {
  return (dispatch, getState) => {
    const state = getState();
    const { layerId, isEmpty, isCluster, isMouseCluster, seriesUids } = _queryHeatmap(state, tileQuery);

    dispatch({
      type: HIGHLIGHT_VESSELS,
      payload: {
        layerId,
        isEmpty,
        clickableCluster: isCluster === true || isMouseCluster === true,
        highlightableCluster: isCluster !== true,
        seriesUids,
        latLng,
        currentFlags: _getCurrentFlagsForLayer(state, layerId)
      }
    });
  };
}

export function getVesselFromHeatmap(tileQuery, latLng) {
  return (dispatch, getState) => {
    const state = getState();

    if (state.user.userPermissions !== null && state.user.userPermissions.indexOf('selectVessel') === -1) {
      return;
    }

    const { isEmpty, isCluster, isMouseCluster, layerId, seriesUids } = _queryHeatmap(state, tileQuery);

    dispatch(clearVesselInfo());

    if (isEmpty === true) {
      // nothing to see here
    } else if (isCluster === true || isMouseCluster === true) {
      dispatch(trackMapClicked(latLng.lat(), latLng.lng(), 'cluster'));
      dispatch(hideVesselsInfoPanel());
      dispatch(zoomIntoVesselCenter(latLng));
      dispatch({
        type: HIGHLIGHT_VESSELS,
        payload: { isEmpty: true }
      });
    } else {
      dispatch(trackMapClicked(latLng.lat(), latLng.lng(), 'vessel'));
      const seriesUid = seriesUids[0];
      const seriesgroup = parseInt(seriesUid.split('-')[0], 10);
      const series = parseInt(seriesUid.split('-')[1], 10);

      dispatch(addVessel(layerId, seriesgroup, series));
    }
  };
}
