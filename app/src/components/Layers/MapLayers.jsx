/* eslint-disable react/sort-comp  */
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import compact from 'lodash/compact';
import isEqual from 'lodash/isEqual';
import extentChanged from 'util/extentChanged';
import TiledLayer from 'components/Layers/TiledLayer';
import GLContainer from 'components/Layers/GLContainer';
import CustomLayerWrapper from 'components/Layers/CustomLayerWrapper';
import PolygonReport from 'containers/Map/PolygonReport';
import ClusterInfoWindow from 'containers/Map/ClusterInfoWindow';
import { LAYER_TYPES, VESSELS_HEATMAP_STYLE_ZOOM_THRESHOLD } from 'constants';

const useHeatmapStyle = zoom => zoom < VESSELS_HEATMAP_STYLE_ZOOM_THRESHOLD;

const getTracks = vessels => vessels
    .filter(vessel => vessel.track && (vessel.visible || vessel.shownInInfoPanel))
    .map(vessel => ({
      data: vessel.track.data,
      selectedSeries: vessel.track.selectedSeries,
      hue: vessel.hue
    }));

class MapLayers extends Component {
  constructor(props) {
    super(props);
    this.addedLayers = {};
    this.onMapIdleBound = this.onMapIdle.bind(this);
    this.onMapClickBound = this.onMapInteraction.bind(this, 'click');
    this.onMapMoveBound = this.onMapInteraction.bind(this, 'move');
    this.onMapDragStartBound = this.onMapDragStart.bind(this);
    this.onMapDragEndBound = this.onMapDragEnd.bind(this);
    this.onCartoLayerFeatureClickBound = this.onCartoLayerFeatureClick.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (!this.map && nextProps.map) {
      this.map = nextProps.map;
      this.build();
    } else if ((nextProps.viewportWidth !== this.props.viewportWidth ||
        nextProps.viewportHeight !== this.props.viewportHeight) && this.glContainer !== undefined) {
      this.glContainer.updateViewportSize(nextProps.viewportWidth, nextProps.viewportHeight);
        // TODO update tracks layer viewport as well
    }
    if (nextProps.layers.length) {
      if (!this.glContainer) {
        this.initHeatmap();
      }
      this.updateLayers(nextProps);
    }

    if (this.props.zoom !== nextProps.zoom && this.glContainer) {
      // zooming started: hide gl container, show again when map is idle
      this.glContainer.hide();
      this.glContainer.setStyle(useHeatmapStyle(nextProps.zoom));
    }

    if (!isEqual(nextProps.reportedPolygonsIds, this.props.reportedPolygonsIds)) {
      this.highlightReportedPolygons(nextProps.reportedPolygonsIds, this.props.reportLayerId);
    }

    if (nextProps.reportLayerId !== this.props.reportLayerId) {
      if (this.props.reportLayerId !== null) {
        this.resetReportedPolygons(this.props.reportLayerId);
      }
      this.setLayersInteraction(nextProps.reportLayerId);
    }

    if (!this.glContainer || !nextProps.timelineOuterExtent || !nextProps.timelineInnerExtent) {
      return;
    }

    const innerExtentChanged = extentChanged(this.props.timelineInnerExtent, nextProps.timelineInnerExtent);
    const startTimestamp = nextProps.timelineInnerExtent[0].getTime();
    const endTimestamp = nextProps.timelineInnerExtent[1].getTime();

    const nextTracks = getTracks(nextProps.vesselTracks);

    if (!nextTracks || nextTracks.length === 0) {
      if (this.props.vesselTracks && this.props.vesselTracks.length) {
        this.glContainer.clearTracks();
        this.glContainer.toggleHeatmapDimming(false);
      }
    } else if (this.shouldUpdateTrackLayer(nextProps, innerExtentChanged)) {
      this.updateTrackLayer({
        data: nextTracks,
        // TODO directly use timelineInnerExtentIndexes
        startTimestamp,
        endTimestamp,
        timelinePaused: nextProps.timelinePaused,
        timelineOverExtent: nextProps.timelineOverExtent,
        zoom: nextProps.zoom
      });
      this.glContainer.toggleHeatmapDimming(true);
    }

    // update heatmap layer when:
    // - tiled data changed
    // - selected inner extent changed
    if (this.props.heatmap !== nextProps.heatmap || innerExtentChanged || nextProps.flagsLayers !== this.props.flagsLayers) {
      this.setHeatmapFlags(nextProps);
      this.updateHeatmap(nextProps);
    }

    if (nextProps.highlightedVessels !== this.props.highlightedVessels) {
      this.updateHeatmapHighlighted(nextProps);
    }
  }

  /**
   * TODO remove this monster. This will be possible with an isolated container only interested
   *    in relevant props.
   * update tracks layer when:
   * - user selected a new vessel (seriesgroup or selectedSeries changed)
   * - zoom level changed (needs fetching of a new tileset)
   * - playing state changed
   * - user hovers on timeline to highlight a portion of the track, only if selectedSeries is set (redrawing is too
   * slow when all series are shown)
   * - selected inner extent changed
   *
   * @param nextProps
   * @param innerExtentChanged
   * @returns {boolean}
   */
  shouldUpdateTrackLayer(nextProps, innerExtentChanged) {
    if (!this.props.vesselTracks) {
      return true;
    }
    if (this.props.vesselTracks.length !== nextProps.vesselTracks.length) {
      return true;
    }
    if (nextProps.vesselTracks.some((vesselTrack, index) =>
      vesselTrack.hue !== this.props.vesselTracks[index].hue ||
      vesselTrack.visible !== this.props.vesselTracks[index].visible ||
      vesselTrack.shownInInfoPanel !== this.props.vesselTracks[index].shownInInfoPanel ||
      vesselTrack.track !== this.props.vesselTracks[index].track
    ) === true) {
      return true;
    }
    if (this.props.zoom !== nextProps.zoom) {
      return true;
    }
    if (this.props.timelinePaused !== nextProps.timelinePaused) {
      return true;
    }
    if (extentChanged(this.props.timelineOverExtent, nextProps.timelineOverExtent)) {
      return true;
    }
    if (innerExtentChanged) {
      return true;
    }
    return false;
  }

  build() {
    this.map.addListener('idle', this.onMapIdleBound);
    this.map.addListener('click', this.onMapClickBound);
    this.map.addListener('mousemove', this.onMapMoveBound);
    this.map.addListener('dragstart', this.onMapDragStartBound);
    this.map.addListener('dragend', this.onMapDragEndBound);
  }

  componentWillUnmount() {
    google.maps.event.clearInstanceListeners(this.map);
    this.map.overlayMapTypes.clear();
  }

  initHeatmap() {
    this.tiledLayer = new TiledLayer(this.props.createTile, this.props.releaseTile, this.map);
    this.map.overlayMapTypes.insertAt(0, this.tiledLayer);
    this.glContainer = new GLContainer(this.props.viewportWidth, this.props.viewportHeight, (overlayProjection) => {
      this.tiledLayer.setProjection(overlayProjection);
    });
    this.glContainer.setMap(this.map);
  }


  /**
   * Handles and propagates layers changes
   * @param nextProps
   */
  updateLayers(nextProps) {
    const currentLayers = this.props.layers;
    const newLayers = nextProps.layers;
    const initialLoad = Object.keys(this.addedLayers).length === 0;

    const updatedLayers = newLayers.map(
      (layer, index) => {
        if (initialLoad) return layer;
        if (currentLayers[index] === undefined) return layer;
        if (layer.title !== currentLayers[index].title) return layer;
        if (layer.visible !== currentLayers[index].visible) return layer;
        if (layer.opacity !== currentLayers[index].opacity) return layer;
        if (layer.added !== currentLayers[index].added) return layer;
        return false;
      }
    );

    const promises = [];

    for (let i = 0, j = updatedLayers.length; i < j; i++) {
      if (!updatedLayers[i]) continue;

      const newLayer = updatedLayers[i];
      const oldLayer = currentLayers[i];

      if (this.addedLayers[newLayer.id] && newLayer.added === false) {
        if (newLayer.type === LAYER_TYPES.Heatmap) {
          this.removeHeatmapLayer(newLayer);
        } else if (newLayer.type === LAYER_TYPES.Custom) {
          this.removeCustomLayer(newLayer);
        } else {
          this.removeCartoLayer(newLayer);
        }
        delete this.addedLayers[newLayer.id];
        continue;
      }

      // If the layer is already on the map and its visibility changed, we update it
      if (this.addedLayers[newLayer.id] && oldLayer && oldLayer.visible !== newLayer.visible) {
        this.toggleLayerVisibility(newLayer);
        continue;
      }

      if (this.addedLayers[newLayer.id] && oldLayer && newLayer.visible && oldLayer.opacity !== newLayer.opacity) {
        this.setLayerOpacity(newLayer);
        continue;
      }

      // If the layer is not yet on the map and is invisible, we skip it
      if (!newLayer.visible) continue;

      if (this.addedLayers[newLayer.id] !== undefined) return;

      if (newLayer.type === LAYER_TYPES.Heatmap) {
        this.addHeatmapLayer(newLayer);
      } else if (newLayer.type === LAYER_TYPES.Custom) {
        this.addCustomLayer(newLayer);
      } else {
        promises.push(this.addCartoLayer(newLayer, i + 2, nextProps.reportLayerId));
      }
    }

    Promise.all(promises);
  }

  addHeatmapLayer(newLayer) {
    this.addedLayers[newLayer.id] = this.glContainer.addLayer(newLayer);
  }

  removeHeatmapLayer(layer) {
    this.glContainer.removeLayer(layer.id);
  }

  setHeatmapFlags(props) {
    this.glContainer.setFlags(props.flagsLayers, useHeatmapStyle(this.props.zoom));
  }

  updateHeatmap(props) {
    this.glContainer.updateHeatmap(props.heatmap, props.timelineInnerExtentIndexes, props.highlightedVessels);
  }

  updateHeatmapHighlighted(props) {
    this.glContainer.updateHeatmapHighlighted(props.heatmap, props.timelineInnerExtentIndexes, props.highlightedVessels);
  }

  updateHeatmapWithCurrentProps() {
    this.updateHeatmap(this.props);
  }

  addCustomLayer(layer) {
    this.addedLayers[layer.id] = new CustomLayerWrapper(this.map, layer.url);
  }

  removeCustomLayer(layer) {
    this.addedLayers[layer.id].destroy();
  }

  /**
   * Creates a Carto-based layer
   *
   * @returns {Promise}
   * @param layerSettings
   * @param index
   * @param reportLayerId used to toggle interactivity on or off
   */
  addCartoLayer(layerSettings, index, reportLayerId) {
    const promise = new Promise(((resolve) => {
      cartodb.createLayer(this.map, layerSettings.url)
        .addTo(this.map, index)
        .done(((layer, cartoLayer) => {
          cartoLayer.setInteraction(reportLayerId === layerSettings.id);
          cartoLayer.on('featureClick', (event, latLng, pos, data) => {
            this.onCartoLayerFeatureClickBound(data, latLng, layer.id);
          });
          cartoLayer.id = layerSettings.id;
          this.addedLayers[layer.id] = cartoLayer;
          this.setLayerOpacity(layerSettings);
          resolve();
        }).bind(this, layerSettings));
    }));

    return promise;
  }

  removeCartoLayer(layer) {
    let cartoLayer;
    let overlayMapTypeIndex;
    this.map.overlayMapTypes.forEach((overlayMapType, index) => {
      if (overlayMapType && overlayMapType.id && overlayMapType.id === layer.id) {
        cartoLayer = overlayMapType;
        overlayMapTypeIndex = index;
      }
    });
    if (overlayMapTypeIndex !== undefined) {
      for (let subLayerIndex = 0, subLayersCount = cartoLayer.getSubLayerCount(); subLayerIndex < subLayersCount; subLayerIndex++) {
        const subLayer = cartoLayer.getSubLayer(subLayerIndex);
        subLayer.setInteraction(false);
        subLayer.off();
      }
      this.map.overlayMapTypes.removeAt(overlayMapTypeIndex);
    }
  }

  onCartoLayerFeatureClick(polygonData, latLng, layerId) {
    // this check should not be necessary but setInteraction(false) or interactive = false
    // on Carto layers don't seem to be reliable -_-
    if (layerId === this.props.reportLayerId) {
      this.props.showPolygon(polygonData, latLng);
    }
  }

  highlightReportedPolygons(polygonsIds, reportLayerId) {
    if (polygonsIds.length === 0) {
      this.resetReportedPolygons(reportLayerId);
      return;
    }
    this._setCartoLayerSQL(reportLayerId, `cartodb_id IN (${polygonsIds.join(', ')}) isinreport`);
  }

  resetReportedPolygons(reportLayerId) {
    this._setCartoLayerSQL(reportLayerId, 'false isinreport');
  }

  /**
   * Replaces original carto sublayer SQL to select the reported polygons
   */
  _setCartoLayerSQL(reportLayerId, isinreportCol) {
    const cartoLayer = this.addedLayers[reportLayerId];
    const sql = cartoLayer.getSubLayer(0).getSQL();
    const newSql = sql.replace(/SELECT((.|\n)+)FROM/gi, (match, cols) => {
      const reportRx = /,|false[\n|\s]+isinreport|cartodb_id IN \([\d\s,]+\)[\n|\s]+isinreport/gi;
      let newCols = cols.split(reportRx).map((col) => {
        const newCol = col.trim();
        return newCol;
      });

      newCols = compact(newCols);
      newCols.push(isinreportCol);
      const newColsStr = newCols.join(', ');
      return `SELECT ${newColsStr} FROM`;
    });
    cartoLayer.getSubLayer(0).setSQL(newSql);
  }

  setLayersInteraction(reportLayerId) {
    this.glContainer.interactive = (reportLayerId === null);
    this.props.layers.filter(layerSettings => layerSettings.type !== LAYER_TYPES.Heatmap).forEach((layerSettings) => {
      const layer = this.addedLayers[layerSettings.id];
      if (layer) {
        if (reportLayerId === layerSettings.id) {
          layer.setInteraction(true);
        } else {
          layer.setInteraction(false);
        }
      }
    });
  }

  /**
   * Toggles a layer's visibility
   *
   * @param layerSettings
   */
  toggleLayerVisibility(layerSettings) {
    if (layerSettings.visible) {
      this.addedLayers[layerSettings.id].show();
    } else {
      this.addedLayers[layerSettings.id].hide();
    }
  }

  /**
   * Updates a layer's opacity
   * @param layerSettings
   */
  setLayerOpacity(layerSettings) {
    if (!Object.keys(this.addedLayers).length) return;

    this.addedLayers[layerSettings.id].setOpacity(layerSettings.opacity);
  }

  updateTrackLayer({ data, startTimestamp, endTimestamp, timelinePaused, timelineOverExtent, zoom }) {
    if (!this.glContainer || !data) {
      return;
    }

    let overStartTimestamp;
    let overEndTimestamp;
    if (timelineOverExtent) {
      overStartTimestamp = timelineOverExtent[0].getTime();
      overEndTimestamp = timelineOverExtent[1].getTime();
    }

    this.glContainer.updateTracks(
      data,
      {
        startTimestamp,
        endTimestamp,
        timelinePaused,
        overStartTimestamp,
        overEndTimestamp,
        zoom
      }
    );
  }

  updateTrackLayerWithCurrentProps() {
    if (!this.props.vesselTracks) {
      return;
    }

    const tracks = getTracks(this.props.vesselTracks);

    this.updateTrackLayer({
      data: tracks,
      startTimestamp: this.props.timelineInnerExtent[0].getTime(),
      endTimestamp: this.props.timelineInnerExtent[1].getTime(),
      timelinePaused: this.props.timelinePaused,
      timelineOverExtent: this.props.timelineOverExtent,
      zoom: this.props.zoom
    });
  }


  /**
   * Handles map idle event (once loading is done)
   */
  onMapIdle() {
    if (this.glContainer) {
      this.glContainer.show();
      this.updateTrackLayerWithCurrentProps();
      this.updateHeatmapWithCurrentProps();
    }
  }

  onMapDragStart() {
    if (this.glContainer) {
      this.glContainer.disableRendering();
    }
  }
  onMapDragEnd() {
    if (this.glContainer) {
      this.glContainer.enableRendering();
      this.updateTrackLayerWithCurrentProps();
      this.updateHeatmapWithCurrentProps();
    }
  }

  onMapInteraction(type, event) {
    if (!event || !this.glContainer || this.glContainer.interactive === false) {
      return;
    }

    const tileQuery = this.tiledLayer.getTileQueryAt(event.pixel.x, event.pixel.y);
    const callback = (type === 'click') ? this.props.getVesselFromHeatmap : this.props.highlightVesselFromHeatmap;
    callback(tileQuery, event.latLng);
  }

  render() {
    return (<div>
      <PolygonReport
        map={this.map}
      />
      <ClusterInfoWindow
        map={this.map}
      />
    </div>);
  }
}


MapLayers.propTypes = {
  map: PropTypes.object,
  token: PropTypes.string,
  layers: PropTypes.array,
  flagsLayers: PropTypes.object,
  heatmap: PropTypes.object,
  highlightedVessels: PropTypes.object,
  zoom: PropTypes.number,
  timelineInnerExtent: PropTypes.array,
  timelineInnerExtentIndexes: PropTypes.array,
  timelineOuterExtent: PropTypes.array,
  timelineOverExtent: PropTypes.array,
  timelinePaused: PropTypes.bool,
  vesselTracks: PropTypes.array,
  viewportWidth: PropTypes.number,
  viewportHeight: PropTypes.number,
  reportLayerId: PropTypes.string,
  reportedPolygonsIds: PropTypes.array,
  getVesselFromHeatmap: PropTypes.func,
  highlightVesselFromHeatmap: PropTypes.func,
  showPolygon: PropTypes.func,
  createTile: PropTypes.func,
  releaseTile: PropTypes.func
};


export default MapLayers;
