import type { LayoutServerLoad } from './$types';
import { getSectionEntries } from '$lib/server/content';
import { mergeNavigation } from '$lib/server/navigation.js';
import { config } from '../../moire.config';

export const load: LayoutServerLoad = () => {
  const topLevelSections = getSectionEntries('/')
    .filter((entry) => entry.kind === 'section');

  return {
    navigation: mergeNavigation(config.navigation, topLevelSections)
  };
};
