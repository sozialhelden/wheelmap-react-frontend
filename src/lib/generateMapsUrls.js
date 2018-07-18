// @flow
import type { Feature } from './Feature';
import openButtonCaption from './openButtonCaption';

// see https://developer.android.com/guide/components/intents-common#Maps
export function generateGeoUrl(feature: Feature, placeName: string) {
  if (!feature.geometry || !(feature.geometry.coordinates instanceof Array)) return null;
  const coords = feature.geometry.coordinates;
  return `geo:${coords[1]},${coords[0]}?q=${coords[1]},${coords[0]}(${encodeURIComponent(placeName)})`;
}

// see https://developer.apple.com/library/content/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
export function generateAppleMapsUrl(feature: Feature, placeName: string) {
  if (!feature.geometry || !(feature.geometry.coordinates instanceof Array)) return null;
  const coords = feature.geometry.coordinates;
  return `http://maps.apple.com/?ll=${coords[1]},${coords[0]}&q=${encodeURIComponent(placeName)}`;
}

// see https://docs.microsoft.com/en-us/previous-versions/windows/apps/jj635237(v=win.10)
export function generateBingMapsUrl(feature: Feature, placeName: string) {
  if (!feature.geometry || !(feature.geometry.coordinates instanceof Array)) return null;
  const coords = feature.geometry.coordinates;
  return `bingmaps:?collection=point.${coords[1]}_${coords[0]}_${encodeURIComponent(placeName)}`;
}

export function generateMapsUrl(feature: Feature, placeName: string) {
  const isBingMaps = navigator.appVersion.match(/Win/);
  const isAppleMaps = navigator.platform.match(/Mac/) ||
    ['iPhone', 'iPad', 'iPod'].indexOf(navigator.platform) !== -1;

  if (isBingMaps) {
    const caption = openButtonCaption('Bing Maps');
    return {url: generateBingMapsUrl(feature, placeName), caption};
  }

  if (isAppleMaps) {
    const caption = openButtonCaption('Apple Maps');
    return {url: generateAppleMapsUrl(feature, placeName), caption};
  }

  const caption = openButtonCaption('Maps app');
  return {url: generateGeoUrl(feature, placeName), caption};
}