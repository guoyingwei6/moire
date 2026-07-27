import type { PageServerLoad } from './$types';
import { config, configInspection } from '../../../moire.config';

export const load: PageServerLoad = () => ({
  config,
  inspection: configInspection
});
