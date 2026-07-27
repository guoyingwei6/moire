import type { PageServerLoad } from './$types';
import { config, configInspection } from '../../../moire.config';
import { getConfigurationRecords } from '$lib/server/content';

export const load: PageServerLoad = () => ({
  config,
  inspection: configInspection,
  records: getConfigurationRecords()
});
