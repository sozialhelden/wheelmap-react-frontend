// @flow

import L from 'leaflet';
import { GestureHandling } from 'leaflet-gesture-handling';
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css';
import 'leaflet.markercluster/dist/leaflet.markercluster-src';
import { t } from 'ttag';
import includes from 'lodash/includes';
import isEqual from 'lodash/isEqual';
import debounce from 'lodash/debounce';
import * as React from 'react';
import SozialheldenLogo from './SozialheldenLogo';
import { currentLocales } from '../../lib/i18n';
import LeafletLocateControl from './L.Control.Locate';
import HighlightableMarker from './HighlightableMarker';
import { isWheelmapFeature, hrefForFeature } from '../../lib/Feature';
import {
  CategoryStrings as EquipmentCategoryStrings,
  maxEquipmentInformationLifetime,
} from '../../lib/EquipmentInfo';

import {
  isWheelchairAccessible,
  hasAccessibleToilet,
  wheelmapFeatureCollectionFromResponse,
  accessibilityCloudFeatureCollectionFromResponse,
  getFeatureId,
} from '../../lib/Feature';
import ClusterIcon from './ClusterIcon';
import Categories, {
  type CategoryLookupTables,
  type RootCategoryEntry,
} from '../../lib/Categories';
import isSamePosition from './isSamePosition';
import GeoJSONTileLayer from './GeoJSONTileLayer';
import addLocateControlToMap from './addLocateControlToMap';
import getAccessibilityCloudTileUrl from './getAccessibilityCloudTileUrl';
import goToLocationSettings from '../../lib/goToLocationSettings';
import highlightMarkers from './highlightMarkers';
import overrideLeafletZoomBehavior from './overrideLeafletZoomBehavior';
import type { Feature, NodeProperties, YesNoLimitedUnknown, YesNoUnknown } from '../../lib/Feature';
import type { EquipmentInfo } from '../../lib/EquipmentInfo';
import type { PotentialPromise } from '../../app/PlaceDetailsProps';
import { normalizeCoordinate, normalizeCoordinates } from '../../lib/normalizeCoordinates';
import { accessibilityCloudFeatureCache } from '../../lib/cache/AccessibilityCloudFeatureCache';
import { wheelmapLightweightFeatureCache } from '../../lib/cache/WheelmapLightweightFeatureCache';
import { equipmentInfoCache } from '../../lib/cache/EquipmentInfoCache';
import { globalFetchManager } from '../../lib/FetchManager';
import { getUserAgent } from '../../lib/userAgent';
import NotificationButton from './NotificationButton';
import { hasOpenedLocationHelp, saveState } from '../../lib/savedState';
import colors, { interpolateWheelchairAccessibility } from '../../lib/colors';
import useImperialUnits from '../../lib/useImperialUnits';
import { tileLoadingStatus } from './trackTileLoadingState';
import { type Cluster } from './Cluster';
import { type MappingEvents } from '../../lib/MappingEvent';
import A11yMarkerIcon from './A11yMarkerIcon';
import MappingEventMarkerIcon from './MappingEventMarkerIcon';

import './Leaflet.css';
import './Map.css';
import { hrefForMappingEvent } from '../../lib/MappingEvent';

L.Map.addInitHook('addHandler', 'gestureHandling', GestureHandling);

window.L = L;

type Padding = {
  top: number,
  left: number,
  right: number,
  bottom: number,
};
type MoveArgs = {
  zoom: number,
  lat: number,
  lon: number,
  bbox: L.LatLngBounds,
};

type TargetMapState = {
  center: [number, number],
  zoom: number,
  bounds: ?L.LatLngBounds,
  zoomedToFeatureId: ?string,
};

type Props = {
  featureId?: ?string,
  feature?: PotentialPromise<?Feature>,
  mappingEvents?: MappingEvents,
  equipmentInfoId?: ?string,
  equipmentInfo?: ?PotentialPromise<?EquipmentInfo>,

  categories: CategoryLookupTables,
  lat?: ?number,
  lon?: ?number,
  zoom?: ?number,
  extent: ?[number, number, number, number],

  includeSourceIds: Array<string>,
  excludeSourceIds: Array<string>,
  disableWheelmapSource: ?boolean,

  activeCluster?: Cluster,

  onMarkerClick: (featureId: string, properties: ?NodeProperties) => void,
  onClusterClick: (cluster: Cluster) => void,
  onMappingEventClick: (eventId: string) => void,
  onMoveEnd?: (args: MoveArgs) => void,
  onClick?: () => void,
  onError?: (error: ?Error | string) => void,
  categoryId: ?string,
  accessibilityFilter: YesNoLimitedUnknown[],
  toiletFilter: YesNoUnknown[],
  accessibilityCloudAppToken: string,
  accessibilityCloudBaseUrl: string,
  wheelmapApiBaseUrl: string,
  wheelmapApiKey: string,
  mapboxTileUrl: string,
  maxZoom: number,
  minZoomWithSetCategory: number,
  minZoomWithoutSetCategory: number,
  defaultStartCenter: [number, number],
  locateOnStart?: boolean,
  padding: ?Padding,
  className: ?string,
  onMapMounted?: (map: L.Map) => void,
  unitSystem?: 'metric' | 'imperial',
  hideHints?: boolean,
  onLocationError: (error: any) => void,
  forwardedRef: ?(map: ?Map) => void,
  inEmbedMode: boolean,
};

type State = {
  showZoomInfo?: boolean,
  showLocationNotAllowedHint: boolean,
  placeOrEquipment?: ?(Feature | EquipmentInfo),
  placeOrEquipmentPromise?: ?Promise<?Feature | ?EquipmentInfo>,
  zoomedToFeatureId: ?string,
  category: ?RootCategoryEntry,
};

overrideLeafletZoomBehavior();

export default class Map extends React.Component<Props, State> {
  props: Props;
  state: State = {
    showLocationNotAllowedHint: false,
    placeOrEquipment: null,
    placeOrEquipmentPromise: null,
    zoomedToFeatureId: null,
    category: null,
  };
  map: ?L.Map;
  mapElement: ?HTMLElement;
  featureLayer: ?L.LayerGroup;
  wheelmapTileLayer: ?GeoJSONTileLayer;
  accessibilityCloudTileLayer: ?GeoJSONTileLayer;
  equipmentTileLayer: ?GeoJSONTileLayer;
  markerClusterGroup: ?L.MarkerClusterGroup;
  mappingEventsLayer: ?L.Layer;
  highLightLayer: ?L.Layer;
  locateControl: ?LeafletLocateControl;
  mapHasBeenMoved: boolean = false;
  sizeInvalidationInterval: ?IntervalID;

  static getMapStateFromProps(
    map: ?L.Map,
    state: State,
    props: Props,
    lastProps?: Props
  ): TargetMapState {
    // use old settings for anything but the initial
    let fallbackZoom = props.maxZoom - 1;
    let fallbackCenter = props.defaultStartCenter;

    if (map) {
      const center = map.getCenter();

      fallbackCenter = [center.lat, center.lng];
      fallbackZoom = map.getZoom();
    }

    let overrideZoom = props.zoom;

    // Prevent the map from being empty when navigating to a new category
    if (props.categoryId && (!lastProps || lastProps.categoryId !== props.categoryId)) {
      overrideZoom = Math.min(
        props.minZoomWithSetCategory || 20,
        props.zoom || props.minZoomWithSetCategory
      );
    }

    let zoom = overrideZoom || fallbackZoom;
    let center = [0, 0];
    let bounds = null;
    let zoomedToFeatureId = state.zoomedToFeatureId;
    let centerDefined = false;

    // try the cluster coordinates if no place set
    if (
      !state.placeOrEquipment &&
      !state.placeOrEquipmentPromise &&
      props.activeCluster &&
      props.activeCluster.leafletMarker &&
      props.activeCluster.leafletMarker._leaflet_id !== state.zoomedToFeatureId
    ) {
      const coords = props.activeCluster.center;
      const clusterCoords = coords && normalizeCoordinates([coords.lat, coords.lng]);
      center = clusterCoords || fallbackCenter;
      zoomedToFeatureId = props.activeCluster.leafletMarker._leaflet_id;
      centerDefined = true;
      zoom = props.maxZoom;
    }

    // use the feature coordinates, if we did not zoom there yet
    const placeOrEquipment = state.placeOrEquipment;
    if (
      placeOrEquipment &&
      getFeatureId(placeOrEquipment) !== state.zoomedToFeatureId &&
      placeOrEquipment.geometry &&
      placeOrEquipment.geometry.type === 'Point' &&
      placeOrEquipment.geometry.coordinates instanceof Array
    ) {
      const coords = placeOrEquipment.geometry.coordinates;
      const featureCoordinates = coords && normalizeCoordinates([coords[1], coords[0]]);
      center = featureCoordinates || fallbackCenter;

      // Store feature id to make sure we only zoom to the place once.
      zoomedToFeatureId = getFeatureId(placeOrEquipment);
      centerDefined = true;
    }

    if (!centerDefined) {
      if (props.extent) {
        // only use changed bounds once
        const newBounds = new L.LatLngBounds([
          [props.extent[1], props.extent[0]],
          [props.extent[3], props.extent[2]],
        ]);
        const prevBounds =
          lastProps && lastProps.extent
            ? new L.LatLngBounds([
                [lastProps.extent[1], lastProps.extent[0]],
                [lastProps.extent[3], lastProps.extent[2]],
              ])
            : null;
        const hasChangedExtents = !prevBounds || !newBounds.equals(prevBounds, 0.01);

        if (hasChangedExtents) {
          bounds = newBounds;
        }
      }

      if (props.lat && props.lon) {
        center = normalizeCoordinates([props.lat, props.lon]);
      } else {
        center = fallbackCenter;
      }
    }

    return { center, zoom, bounds, zoomedToFeatureId };
  }

  static getDerivedStateFromProps(props: Props, state: State): $Shape<State> {
    const { feature, equipmentInfo } = props;

    const placeOrEquipment = equipmentInfo || feature;

    const category = props.categoryId ? Categories.getRootCategory(props.categoryId) : null;

    // works also without a feature
    if (placeOrEquipment) {
      // Do not update anything when the same promise or feature is already in use.
      if (
        placeOrEquipment === state.placeOrEquipmentPromise ||
        placeOrEquipment === state.placeOrEquipment
      ) {
        return { category };
      }

      if (placeOrEquipment instanceof Promise) {
        return { category, placeOrEquipment: null, placeOrEquipmentPromise: placeOrEquipment };
      }

      return { category, placeOrEquipment, placeOrEquipmentPromise: null };
    }

    return {
      category,
      placeOrEquipment: null,
      placeOrEquipmentPromise: null,
    };
  }

  componentDidMount() {
    const initialMapState = Map.getMapStateFromProps(null, this.state, this.props);
    const map: L.Map = L.map(this.mapElement, {
      maxZoom: this.props.maxZoom,
      center: initialMapState.center,
      zoom: initialMapState.zoom,
      minZoom: 2,
      zoomControl: false,
      gestureHandling: this.props.inEmbedMode,
    });

    if (!map) {
      throw new Error('Could not initialize map component.');
    }

    if (initialMapState.bounds) {
      map.fitBounds(initialMapState.bounds, {
        animate: false,
        noMoveStart: true,
      });
    }

    map.on('click', () => {
      if (this.props.onClick) this.props.onClick();
    });
    this.map = map;
    if (this.props.onMapMounted) {
      this.props.onMapMounted(map);
    }

    tileLoadingStatus.registerMap(map);

    new L.Control.Zoom({ position: 'topright' }).addTo(this.map);

    map.on('moveend', () => this.onMoveEnd());
    map.on('zoomend', () => this.onMoveEnd());

    let unitSystem = this.props.unitSystem;
    if (!unitSystem) {
      // derive unitSystem from locale
      unitSystem = useImperialUnits() ? 'imperial' : 'metric';
    }

    this.setupLocateMeButton(map);

    const basemapLayer = L.tileLayer(this.props.mapboxTileUrl, {
      maxZoom: this.props.maxZoom,
      id: 'accessibility-cloud',
    });

    map.addLayer(basemapLayer);

    this.highLightLayer = new L.LayerGroup();
    map.addLayer(this.highLightLayer);

    this.markerClusterGroup = this.createMarkerClusterGroup();
    this.markerClusterGroup.on('clusterclick', event => {
      if (this.props.zoom === this.props.maxZoom) {
        const markers = event.layer.getAllChildMarkers();
        const props = markers.map(m => m.feature.properties).filter(Boolean);
        const interpolatedA11y = interpolateWheelchairAccessibility(props);

        this.props.onClusterClick({
          ...interpolatedA11y,
          center: event.latlng,
          leafletMarker: event.layer,
          features: markers.map(m => m.feature),
        });

        event.originalEvent.preventDefault();
        event.originalEvent.stopPropagation();
      }
    });

    this.featureLayer = new L.LayerGroup();
    this.featureLayer.addLayer(this.markerClusterGroup);

    this.setupAccessibilityCloudTileLayer(this.markerClusterGroup);
    this.setupEquipmentTileLayer(this.markerClusterGroup);
    this.updateFeatureLayerVisibility();

    this.setupWheelmapTileLayer(this.markerClusterGroup);
    this.updateFeatureLayerVisibility();

    this.setupMappingEvents();

    map.on('moveend', () => {
      this.updateFeatureLayerVisibility();
    });
    map.on('zoomend', () => {
      this.updateFeatureLayerVisibility();
    });
    map.on('zoomstart', () => {
      this.removeLayersNotVisibleInZoomLevel();
    });

    globalFetchManager.addEventListener('stop', () => this.updateTabIndexes());

    this.addAttribution();

    const { placeOrEquipmentPromise } = this.state;
    if (placeOrEquipmentPromise) {
      placeOrEquipmentPromise.then(placeOrEquipment =>
        this.handlePromiseResolved(placeOrEquipmentPromise, placeOrEquipment)
      );
    }

    if (this.props.forwardedRef) this.props.forwardedRef(this);
    this.sizeInvalidationInterval = setInterval(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 1000);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const map = this.map;
    if (!map) return;

    this.navigate(this.state, this.props, prevProps);

    if (prevProps.mappingEvents !== this.props.mappingEvents) {
      this.setupMappingEvents();
    }

    // Sort is mutable. Create a new array and sort this one instead.
    const accessibilityFilterChanged = !isEqual(
      [...this.props.accessibilityFilter].sort(),
      [...prevProps.accessibilityFilter].sort()
    );

    // Sort is mutable. Create a new array and sort this one instead.
    const toiletFilterChanged = !isEqual(
      [...this.props.toiletFilter].sort(),
      [...prevProps.toiletFilter].sort()
    );

    const customFilterChanged =
      this.props.categoryId !== prevProps.categoryId &&
      ((prevState.category && prevState.category.isMetaCategory) ||
        (this.state.category && this.state.category.isMetaCategory));

    const filterNeedsRefreshing =
      accessibilityFilterChanged || toiletFilterChanged || customFilterChanged;
    if (filterNeedsRefreshing) {
      setTimeout(() => {
        // console.log("Resetting layers", accessibilityFilterChanged, toiletFilterChanged, customFilterChanged);
        if (this.accessibilityCloudTileLayer) this.accessibilityCloudTileLayer._reset();
        if (this.equipmentTileLayer) this.equipmentTileLayer._reset();
        if (this.wheelmapTileLayer) this.wheelmapTileLayer._reset();
        if (this.accessibilityCloudTileLayer) {
          this.accessibilityCloudTileLayer._update(map.getCenter());
        }
        if (this.equipmentTileLayer) {
          this.equipmentTileLayer._update(map.getCenter());
        }
        if (this.wheelmapTileLayer) this.wheelmapTileLayer._update(map.getCenter());
      }, 100);
    }

    if (prevProps.activeCluster && prevProps.activeCluster !== this.props.activeCluster) {
      this.setClusterHighlight(prevProps.activeCluster, false);
    }

    const { placeOrEquipmentPromise } = this.state;
    if (placeOrEquipmentPromise && prevState.placeOrEquipmentPromise !== placeOrEquipmentPromise) {
      placeOrEquipmentPromise.then(placeOrEquipment =>
        this.handlePromiseResolved(placeOrEquipmentPromise, placeOrEquipment)
      );
    }

    if (prevProps.categoryId !== this.props.categoryId) {
      this.updateFeatureLayerVisibility();
    }
  }

  componentWillUnmount() {
    if (this.props.forwardedRef) this.props.forwardedRef(null);

    if (!this.map) return;
    this.map.off();
    tileLoadingStatus.unregisterMap(this.map);

    delete this.map;
    delete this.highLightLayer;
    delete this.mapElement;
    delete this.featureLayer;
    delete this.wheelmapTileLayer;
    delete this.accessibilityCloudTileLayer;
    delete this.equipmentTileLayer;
    delete this.markerClusterGroup;

    if (this.sizeInvalidationInterval) {
      clearInterval(this.sizeInvalidationInterval);
    }
  }

  handlePromiseResolved(
    placeOrEquipmentPromise: Promise<?Feature | ?EquipmentInfo>,
    placeOrEquipment: ?(Feature | EquipmentInfo)
  ) {
    if (this.state.placeOrEquipmentPromise !== placeOrEquipmentPromise) {
      return;
    }

    this.setState({
      placeOrEquipment,
    });
  }

  setupLocateMeButton(map: L.Map) {
    this.locateControl = addLocateControlToMap(map, {
      locateOnStart: this.props.locateOnStart || false,
      onLocationError: (error: any) => {
        if (
          error &&
          error.type &&
          error.type === 'locationerror' &&
          error.code &&
          error.code === 1
        ) {
          // System does not allow to use location services
          if (!hasOpenedLocationHelp()) {
            // If you open location help once, do not show this hint again until you click
            // the location button
            this.setState({ showLocationNotAllowedHint: true });
          }
        }
      },
      onClick: () => {
        saveState({ hasOpenedLocationHelp: 'false' });
        if (this.state.showLocationNotAllowedHint) {
          goToLocationSettings();
          this.setState({ showLocationNotAllowedHint: false });
        }
      },
    });

    map.once('locationfound', () => {
      if (this.locateControl && this.props.locateOnStart && !this.mapHasBeenMoved) {
        this.locateControl.setView();
      }
    });
  }

  setupWheelmapTileLayer(markerClusterGroup: L.MarkerClusterGroup) {
    if (!this.props.disableWheelmapSource) {
      // always create wheelmap tile layer, even if the url is empty
      // if we don't do this, and if the app is started with an unknown
      // category selected, a wheelmap layer is never created
      const wheelmapTileUrl = this.wheelmapTileUrl();
      if (wheelmapTileUrl) {
        this.wheelmapTileLayer = new GeoJSONTileLayer(wheelmapTileUrl, {
          featureCache: wheelmapLightweightFeatureCache,
          layerGroup: markerClusterGroup,
          featureCollectionFromResponse: wheelmapFeatureCollectionFromResponse,
          pointToLayer: this.createMarkerFromFeature,
          filter: this.isFeatureVisible.bind(this),
          maxZoom: this.props.maxZoom,
        });
      }
    }
  }

  setupEquipmentTileLayer(markerClusterGroup: L.MarkerClusterGroup) {
    const locale = currentLocales[0];
    if (!locale) {
      console.error('Could not load AC equipment tile layer because no current locale is set.');
    }
    const tileUrl = getAccessibilityCloudTileUrl(
      locale,
      'equipment-infos',
      [],
      [],
      this.props.accessibilityCloudAppToken
    );

    this.equipmentTileLayer = new GeoJSONTileLayer(tileUrl, {
      featureCache: equipmentInfoCache,
      refreshFrequency: maxEquipmentInformationLifetime / 2,
      maxNativeZoom: 14,
      layerGroup: markerClusterGroup,
      featureCollectionFromResponse: accessibilityCloudFeatureCollectionFromResponse,
      pointToLayer: this.createMarkerFromFeature,
      filter: this.isFeatureVisible.bind(this),
      maxZoom: this.props.maxZoom,
    });
  }

  setupAccessibilityCloudTileLayer(markerClusterGroup: L.MarkerClusterGroup) {
    const locale = currentLocales[0];
    if (!locale) {
      console.error('Could not load AC tile layer because no current locale is set.');
    }
    const tileUrl = getAccessibilityCloudTileUrl(
      locale,
      'place-infos',
      this.props.includeSourceIds,
      this.props.excludeSourceIds,
      this.props.accessibilityCloudAppToken
    );

    this.accessibilityCloudTileLayer = new GeoJSONTileLayer(tileUrl, {
      featureCache: accessibilityCloudFeatureCache,
      layerGroup: markerClusterGroup,
      featureCollectionFromResponse: accessibilityCloudFeatureCollectionFromResponse,
      pointToLayer: this.createMarkerFromFeature,
      filter: this.isFeatureVisible.bind(this),
      maxZoom: this.props.maxZoom,
    });
  }

  setupMappingEvents() {
    const map = this.map;
    const mappingEvents = this.props.mappingEvents;

    if (map && this.mappingEventsLayer) {
      map.removeLayer(this.mappingEventsLayer);
      this.mappingEventsLayer = null;
    }

    if (!map || !mappingEvents) {
      return;
    }

    const mappingEventsLayer = new L.LayerGroup();
    this.mappingEventsLayer = mappingEventsLayer;
    map.addLayer(mappingEventsLayer);

    mappingEvents.forEach(event => {
      const eventFeature = event.meetingPoint;

      if (!eventFeature) {
        return;
      }

      const eventLat = eventFeature.geometry.coordinates[1];
      const eventLon = eventFeature.geometry.coordinates[0];

      const eventMarker = new HighlightableMarker(
        new L.LatLng(eventLat, eventLon),
        MappingEventMarkerIcon,
        {
          eventName: event.name,
          href: hrefForMappingEvent(event),
          onClick: () => this.props.onMappingEventClick(event._id),
        },
        event._id,
        -1000
      );

      mappingEventsLayer.addLayer(eventMarker);
    });
  }

  removeLayersNotVisibleInZoomLevel() {
    const map: L.Map = this.map;
    const featureLayer = this.featureLayer;
    const accessibilityCloudTileLayer = this.accessibilityCloudTileLayer;

    if (!map || !featureLayer || !accessibilityCloudTileLayer) return;

    const minimalZoomLevelForFeatures = this.props.categoryId
      ? this.props.minZoomWithSetCategory
      : this.props.minZoomWithoutSetCategory;

    if (!this.shouldShowAccessibilityCloudLayer(this.props, this.state)) {
      if (featureLayer.hasLayer(this.accessibilityCloudTileLayer)) {
        // console.log('Hide AC layer...');
        featureLayer.removeLayer(this.accessibilityCloudTileLayer);
        featureLayer.removeLayer(this.equipmentTileLayer);
      }
    }
    if (map.getZoom() < minimalZoomLevelForFeatures && map.hasLayer(featureLayer)) {
      // console.log('Hide feature layer...');
      map.removeLayer(featureLayer);
    }
  }

  addAttribution() {
    const map = this.map;
    if (!map) return;

    map.attributionControl.setPrefix(null);
  }

  zoomIn = (event: Event) => {
    if (this.map) {
      this.map.zoomIn();
      event.stopPropagation();
      event.preventDefault();
    }
  };

  navigate(state: State, props: Props, lastProps: Props) {
    if (!this.map) {
      return;
    }

    const targetMapState = Map.getMapStateFromProps(this.map, state, props, lastProps);
    this.updateMapCenter(targetMapState, props.padding, this.state);
    this.updateFeatureLayerVisibility(props, state);
  }

  onMoveEnd() {
    this.mapHasBeenMoved = true;
    const map = this.map;
    if (!map) return;
    const { lat, lng } = map.getCenter();
    const zoom = map.getZoom();

    const onMoveEnd = this.props.onMoveEnd;
    if (typeof onMoveEnd === 'function') {
      const bbox = map.getBounds();

      onMoveEnd({ lat: normalizeCoordinate(lat), lon: normalizeCoordinate(lng), zoom, bbox });
    }

    const minimalZoomLevelForFeatures = this.props.categoryId
      ? this.props.minZoomWithSetCategory
      : this.props.minZoomWithoutSetCategory;
    const showZoomInfo = this.map ? this.map.getZoom() < minimalZoomLevelForFeatures : false;
    this.setState({ showZoomInfo });

    this.updateTabIndexes();
  }

  updateFeatureLayerVisibility = debounce(
    (props: Props = this.props, state: State = this.state) => {
      // console.log('Update feature layer visibility...');
      const map: L.Map = this.map;
      const featureLayer = this.featureLayer;
      const wheelmapTileLayer = this.wheelmapTileLayer;
      const accessibilityCloudTileLayer = this.accessibilityCloudTileLayer;
      const equipmentTileLayer = this.equipmentTileLayer;
      if (!map || !featureLayer || !this.accessibilityCloudTileLayer) return;

      let minimalZoomLevelForFeatures = this.props.minZoomWithSetCategory;

      if (map.getZoom() >= minimalZoomLevelForFeatures) {
        if (!map.hasLayer(featureLayer)) {
          // console.log('Show feature layer...');
          map.addLayer(featureLayer);
        }
      } else if (map.hasLayer(featureLayer)) {
        // console.log('Hide feature layer...');
        map.removeLayer(featureLayer);
      }

      this.updateFeatureLayerSourceUrls(props);

      if (this.shouldShowAccessibilityCloudLayer(props, state)) {
        minimalZoomLevelForFeatures = props.minZoomWithoutSetCategory;
        if (!featureLayer.hasLayer(accessibilityCloudTileLayer) && accessibilityCloudTileLayer) {
          // console.log('Show AC layer...');
          featureLayer.addLayer(accessibilityCloudTileLayer);
          accessibilityCloudTileLayer._update(map.getCenter());
          featureLayer.addLayer(equipmentTileLayer);
          equipmentTileLayer._update(map.getCenter());
        }
      } else {
        if (featureLayer.hasLayer(this.accessibilityCloudTileLayer)) {
          // console.log('Hide AC layer...');
          featureLayer.removeLayer(this.accessibilityCloudTileLayer);
          featureLayer.removeLayer(this.equipmentTileLayer);
        }
      }

      if (!featureLayer.hasLayer(wheelmapTileLayer) && wheelmapTileLayer) {
        // console.log('Show wheelmap layer...');
        featureLayer.addLayer(wheelmapTileLayer);
        wheelmapTileLayer._update(map.getCenter());
      }

      this.updateHighlightedMarker(props);
    },
    100
  );

  shouldShowAccessibilityCloudLayer(props: Props = this.props, state: State = this.state): boolean {
    // always show if no category was selected
    if (!state.category) {
      return true;
    }

    return !!state.category.isMetaCategory;
  }

  // calculate bounds with variable pixel padding
  calculateBoundsWithPadding(padding: Padding) {
    const map: L.Map = this.map;
    const mapSize = map.getSize();
    const zoom = map.getZoom();
    const corner1 = map.containerPointToLatLng(new L.Point(padding.left, padding.top), zoom);
    const corner2 = map.containerPointToLatLng(
      new L.Point(mapSize.x - padding.right, mapSize.y - padding.bottom),
      zoom
    );
    const bounds = L.latLngBounds([corner1, corner2]);
    return bounds;
  }

  updateMapCenter(targetMapState: TargetMapState, padding: ?Padding, state: State) {
    const map: L.Map = this.map;
    const center = map.getCenter();

    let moved = false;
    const { center: targetCoords, zoom, bounds } = targetMapState;

    // make max distance zoom dependant
    const mapBounds = map.getBounds();
    const maximalMoveDistance = Math.abs(mapBounds.getWest() - mapBounds.getEast()) * 0.1;

    const effectivePadding = padding || {
      top: 10,
      left: 10,
      right: 10,
      bottom: 10,
    };

    if (bounds && !mapBounds.equals(bounds, 0.01)) {
      map.fitBounds(bounds, {
        paddingTopLeft: [effectivePadding.left, effectivePadding.top],
        paddingBottomRight: [effectivePadding.right, effectivePadding.bottom],
        animate: true,
        noMoveStart: true,
      });
      moved = true;
    } else if (
      targetCoords &&
      !isSamePosition(targetCoords, [center.lat, center.lng], maximalMoveDistance)
    ) {
      const bounds = this.calculateBoundsWithPadding(effectivePadding);
      const isWithinBounds = bounds.contains(targetCoords);

      if (!isWithinBounds) {
        // animate if old map center is within sight
        const shouldAnimate = map.getBounds().contains(targetCoords);
        moved = true;
        map.flyTo(targetCoords, zoom, {
          animate: shouldAnimate,
          noMoveStart: true,
        });
      }
    }

    if (!moved && zoom !== map.getZoom()) {
      moved = true;
      map.setZoom(zoom, { animate: true });
    }

    // prevent zooming in again
    if (this.state.zoomedToFeatureId !== targetMapState.zoomedToFeatureId) {
      this.setState({
        zoomedToFeatureId: targetMapState.zoomedToFeatureId,
      });
    }
  }

  updateHighlightedMarker(props: Props) {
    // highlight multiple markers if there is equipment that belongs to the currently
    // opened one, e.g. when two escalators from a train platform lead to the same
    // other level or are next to each other
    const similarEquipmentIds =
      typeof props.equipmentInfoId === 'string'
        ? equipmentInfoCache.findSimilarEquipmentIds(props.equipmentInfoId)
        : [];

    // OSM IDs are numeric, other IDs are assumed to be globally unique so we collect
    // them in one array:
    const ids = [!props.equipmentInfoId && props.featureId, props.equipmentInfoId]
      .concat(similarEquipmentIds)
      .filter(Boolean)
      .map(String);

    if (this.wheelmapTileLayer) {
      this.wheelmapTileLayer.highlightMarkersWithIds(this.highLightLayer, ids);
    }

    if (this.accessibilityCloudTileLayer) {
      this.accessibilityCloudTileLayer.highlightMarkersWithIds(this.highLightLayer, ids);
    }

    if (this.equipmentTileLayer) {
      this.equipmentTileLayer.highlightMarkersWithIds(this.highLightLayer, ids);
    }

    // Mapping events are not using a GeoJSONTileLayer, so they need a specialized handling
    // TODO: Generalize behavior from above to work with any kind of marker layers
    if (this.mappingEventsLayer) {
      const selectedMappingEventMarker = Object.keys(this.mappingEventsLayer._layers)
        .map(key => (this.mappingEventsLayer ? this.mappingEventsLayer._layers[key] : undefined))
        .find(marker => marker && marker.featureId === props.featureId);

      if (selectedMappingEventMarker) {
        highlightMarkers(this.highLightLayer, [selectedMappingEventMarker]);
      }
    }

    if (props.activeCluster) {
      this.setClusterHighlight(props.activeCluster, !props.featureId);
    }
  }

  setClusterHighlight(cluster: Cluster, highlight: boolean) {
    const elem = cluster.leafletMarker && cluster.leafletMarker.getElement();

    if (elem) {
      if (highlight) {
        elem.classList.add('highlighted');
      } else {
        elem.classList.remove('highlighted');
      }
    }
  }

  updateTabIndexes() {
    const map = this.map;
    if (!map) return;
    map.eachLayer(layer => {
      const layerIsTabbable = layer.options.keyboard;
      if (layer.getElement && layer.getLatLng && layerIsTabbable) {
        const isInViewport = map.getBounds().contains(layer.getLatLng());
        const layerElement = layer.getElement();
        if (layerElement) {
          layerElement.setAttribute('tabindex', isInViewport ? 0 : -1);
        }
      }
    });
  }

  createMarkerClusterGroup() {
    const map = this;
    return new L.MarkerClusterGroup({
      maxClusterRadius(zoom) {
        // choose cluster size dependant of the click region
        const radius = 40 + (1.5 ** (18 - zoom) - 1) * 10;
        return Math.round(Math.max(40, Math.min(radius, 120)));
      },
      iconCreateFunction(cluster) {
        const propertiesArray = cluster
          .getAllChildMarkers()
          .map(marker => marker.feature.properties);
        const options: L.Icon.options = {
          propertiesArray,
          categories: map.props.categories,
        };
        if (isEqual(map.props.accessibilityFilter, ['unknown'])) {
          options.backgroundColor = 'rgb(171, 167, 160)';
        }
        return new ClusterIcon(options);
      },
      spiderfyOnMaxZoom: false,
      animate: true,
      chunkedLoading: true,
    });
  }

  createMarkerFromFeature = (feature: Feature, latlng: [number, number]) => {
    const properties = feature && feature.properties;
    if (!properties) return null;
    if (
      !isWheelmapFeature(feature) &&
      !properties.accessibility &&
      !includes(EquipmentCategoryStrings, properties.category)
    ) {
      return null;
    }

    const featureId: string = properties.id || properties._id || feature._id;

    return new HighlightableMarker(latlng, A11yMarkerIcon, {
      onClick: () => this.props.onMarkerClick(featureId, properties),
      href: hrefForFeature(feature, properties),
      feature,
      categories: this.props.categories,
    });
  };

  isFeatureVisible(feature: Feature) {
    const { accessibilityFilter, toiletFilter } = this.props;
    if (!feature) return false;
    if (!feature.properties) return false;
    const properties = feature.properties;
    const hasMatchingA11y = includes(accessibilityFilter, isWheelchairAccessible(properties));
    const hasMatchingToilet = includes(toiletFilter, hasAccessibleToilet(properties));

    let matchesCustomCategoryFilter = true;
    if (this.state.category && this.state.category.filter) {
      matchesCustomCategoryFilter = this.state.category.filter(feature.properties);
    }
    return hasMatchingA11y && hasMatchingToilet && matchesCustomCategoryFilter;
  }

  updateFeatureLayerSourceUrls = debounce((props: Props = this.props) => {
    const wheelmapTileLayer = this.wheelmapTileLayer;
    if (!wheelmapTileLayer) return;
    const url = this.wheelmapTileUrl(props);
    const featureLayer = this.featureLayer;
    if (featureLayer && wheelmapTileLayer._url !== url) {
      // console.log('Setting new URL on wheelmap layer / removing + re-adding layer:', url);
      wheelmapTileLayer._reset();
      featureLayer.removeLayer(wheelmapTileLayer);
      featureLayer.addLayer(wheelmapTileLayer);
      wheelmapTileLayer.setUrl(url);
    }
  }, 500);

  focus() {
    if (this.mapElement) this.mapElement.focus();
  }

  snapToFeature() {
    const map = this.map;
    if (map) {
      const targetState = Map.getMapStateFromProps(
        map,
        { ...this.state, zoomedToFeatureId: null },
        this.props
      );
      map.flyTo(targetState.center, targetState.zoom, {
        animate: true,
        noMoveStart: true,
      });
    }
  }

  renderZoomInfo() {
    // translator: Shown when zoomed out to far
    const caption = t`Zoom in closer to see more places`;
    return (
      <NotificationButton
        isHidden={this.props.hideHints || !this.state.showZoomInfo}
        onActivate={this.zoomIn}
        caption={caption}
        ariaHidden
        topPosition={10}
        color={colors.notificationBackgroundColor}
      />
    );
  }

  renderGeolocationError() {
    // translator: Shown next to the locate-me button when location services are not
    // enabled
    const caption = t`Turn on location services`;
    const isHidden =
      this.props.hideHints || !this.state.showLocationNotAllowedHint || hasOpenedLocationHelp();

    return (
      <NotificationButton
        isHidden={isHidden}
        onActivate={() => {
          goToLocationSettings();
          this.setState({ showLocationNotAllowedHint: false });
        }}
        caption={caption}
        ariaHidden
        topPosition={120}
        color={colors.notificationBackgroundColor}
      />
    );
  }

  render() {
    const userAgent = getUserAgent();
    const className = [
      userAgent.os.name === 'Android' ? 'is-android-platform' : null,
      this.props.className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <section
        className={className}
        ref={el => (this.mapElement = el)}
        role="main"
        aria-label={t`Map`}
      >
        {this.renderZoomInfo()}
        {this.renderGeolocationError()}
        <a
          href="http://mapbox.com/about/maps"
          className="mapbox-wordmark"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mapbox
        </a>
        <span className="mapbox-attribution-container">
          <span className="sozialhelden-logo-container">
            <a href="https://www.sozialhelden.de" target="_blank" rel="noopener noreferrer">
              <SozialheldenLogo />
              &nbsp;|&nbsp;
            </a>
          </span>
          <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">
            © Mapbox |
          </a>
          &nbsp;
          <a
            href="http://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            © OpenStreetMap |
          </a>
          &nbsp;
          <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener noreferrer">
            <strong>Improve this map</strong>
          </a>
        </span>
      </section>
    );
  }

  wheelmapTileUrl(props: Props = this.props, state: State = this.state): ?string {
    // For historical reasons: 'Classic' Wheelmap way of fetching GeoJSON tiles:
    // const wheelmapTileUrl = '/nodes/{x}/{y}/{z}.geojson?limit=25';
    const baseUrl = props.wheelmapApiBaseUrl;
    if (typeof baseUrl !== 'string') return null;
    const wheelmapApiKey = props.wheelmapApiKey;
    const categoryName = props.categoryId;
    if (!wheelmapApiKey) {
      return null;
    }
    const isMetaCategory = state.category && state.category.isMetaCategory;
    if (categoryName && !isMetaCategory) {
      const rootCategory = Categories.wheelmapRootCategoryWithName(props.categories, categoryName);
      if (!rootCategory) {
        const subCategory = Categories.wheelmapCategoryWithName(props.categories, categoryName);
        if (!subCategory) {
          return null;
        }
        return `${baseUrl}/api/node_types/${subCategory.id}/nodes/?api_key=${wheelmapApiKey}&per_page=100&bbox={bbox}&limit=100`;
      }
      return `${baseUrl}/api/categories/${rootCategory.id}/nodes/?api_key=${wheelmapApiKey}&per_page=100&bbox={bbox}&limit=100`;
    }
    return `${baseUrl}/api/nodes/?api_key=${wheelmapApiKey}&per_page=25&bbox={bbox}&per_page=100&limit=100`;
  }
}
