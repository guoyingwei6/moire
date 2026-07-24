import { toDataURL } from 'qrcode';
import type { PageServerLoad } from './$types';
import { config } from '../../../moire.config';

export const load: PageServerLoad = async () => {
  const target = `${config.url}/`;
  const image = await toDataURL(target, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 640
  });

  return {
    canonical: `${config.url}/qr/`,
    image,
    target
  };
};
