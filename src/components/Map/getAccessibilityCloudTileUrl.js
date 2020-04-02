// @flow
import { type Locale } from '../../lib/i18n';
import env from '../../lib/env';

export function buildSourceIdParams(
  includeSourceIds: Array<string>,
  excludeSourceIds: Array<string>
): string {
  // always do not show wheelmap source, but all other sources
  const wheelmapSourceId = 'LiBTS67TjmBcXdEmX';

  let sourceIdParams = '';
  // include > exclude > defaults
  if (includeSourceIds && includeSourceIds.length > 0) {
    sourceIdParams = `includeSourceIds=${includeSourceIds.join(',')}`;
  } else if (excludeSourceIds && excludeSourceIds.length > 0) {
    sourceIdParams = `excludeSourceIds=${[wheelmapSourceId, ...excludeSourceIds].join(',')}`;
  } else {
    sourceIdParams = `excludeSourceIds=${wheelmapSourceId}`;
  }

  return sourceIdParams;
}

export default function getAccessibilityCloudTileUrl(
  locale: Locale,
  resourceType: 'place-infos' | 'equipment-infos',
  includeSourceIds: Array<string>,
  excludeSourceIds: Array<string>,
  appToken: string
): string {
  const acLocaleString = locale.transifexLanguageIdentifier;
  const sourceIdParams =
    resourceType == 'place-infos' ? buildSourceIdParams(includeSourceIds, excludeSourceIds) : '';
  const baseUrl = env.REACT_APP_ACCESSIBILITY_CLOUD_BASE_URL || '';
  return `${baseUrl}/${resourceType}.json?${sourceIdParams}&x={x}&y={y}&z={z}&c={c}&appToken=${appToken}&locale=${acLocaleString}&includePlacesWithoutAccessibility=1`;
}
