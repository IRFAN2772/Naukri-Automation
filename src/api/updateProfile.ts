import axios from 'axios';
import { uploadFileHeader } from '../utils/headers';
import type { LoginCookies } from '../utils/types';
import { resumeHeadlineUrl } from '../utils/constants';

/**
 * Update the jobseeker profile summary.
 * Uses the same endpoint as resume headline update (resman-aggregator-services)
 * which accepts profile field updates reliably.
 */
export const updateProfileSummary = async (
  cookieHeader: LoginCookies,
  profileId: string,
  summary: string
): Promise<boolean> => {
  try {
    const headers = {
      ...uploadFileHeader(cookieHeader),
      'content-type': 'application/json',
      'x-http-method-override': 'PUT',
      'x-requested-with': 'XMLHttpRequest',
      appid: '105',
      systemid: 'Naukri',
      clientid: 'd3skt0p',
      authorization: `Bearer ${cookieHeader.nauk_at}`
    };

    const data = {
      profile: {
        summary
      },
      profileId
    };

    // eslint-disable-next-line no-console
    console.log('📝 Updating profile summary...');

    const resp = await axios.post(resumeHeadlineUrl, data, { headers });

    if (resp.status !== 200) {
      console.error('Profile summary update failed:', resp.status, resp.data);
      return false;
    }

    // eslint-disable-next-line no-console
    console.log('✅ Profile summary updated successfully!');
    return true;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosError = error as any;
    if (axiosError.response) {
      console.error(
        'Error in updateProfileSummary:',
        axiosError.response.status,
        axiosError.response.data
      );
    } else {
      console.error('Error in updateProfileSummary:', error);
    }
    return false;
  }
};
