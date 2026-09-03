import fs from 'fs'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type LoginCookies = {
  unid: string
  nkwap: string
  nauk_at: string
  nauk_rt: string
  nauk_sid: string
}

const LOGIN_URL = 'https://www.naukri.com/central-login-services/v1/login'
const RESUME_UPLOAD_URL = 'https://filevalidation.naukri.com/file'
const RESUME_HEADLINE_URL =
  'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v1/users/self/fullprofiles'

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (value && value.trim()) return value.trim()
  }
  return ''
}

function cookieString(cookies: LoginCookies): string {
  return `MYNAUKRI[UNID]=${cookies.unid}; NKWAP=${cookies.nkwap}; nauk_at=${cookies.nauk_at}; nauk_rt=${cookies.nauk_rt}; nauk_sid=${cookies.nauk_sid}`
}

function loginHeaders() {
  return {
    accept: 'application/json',
    'accept-language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    appid: '109',
    'cache-control': 'no-cache',
    clientid: 'd3skt0p',
    'content-type': 'application/json',
    gid: 'LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE',
    pragma: 'no-cache',
    'x-requested-with': 'XMLHttpRequest',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.5735.198 Safari/537.36',
    systemid: 'jobseeker',
    Referer: 'https://www.naukri.com/'
  }
}

function authHeaders(cookies: LoginCookies) {
  return {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    appid: '105',
    origin: 'https://www.naukri.com',
    referer: 'https://www.naukri.com/',
    'content-type': 'application/json',
    'x-http-method-override': 'PUT',
    'x-requested-with': 'XMLHttpRequest',
    systemid: 'Naukri',
    clientid: 'd3skt0p',
    authorization: `Bearer ${cookies.nauk_at}`,
    Cookie: cookieString(cookies),
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.5735.198 Safari/537.36'
  }
}

function extractCookies(setCookie: string[] = []): LoginCookies {
  const cookies: LoginCookies = {
    unid: '',
    nkwap: '',
    nauk_at: '',
    nauk_rt: '',
    nauk_sid: ''
  }

  for (const cookie of setCookie) {
    if (cookie.startsWith('MYNAUKRI[UNID]=')) {
      cookies.unid = cookie.split(';')[0].split('=')[1]
    } else if (cookie.startsWith('NKWAP=')) {
      cookies.nkwap = cookie.split(';')[0].split('=')[1]
    } else if (cookie.startsWith('nauk_at=')) {
      cookies.nauk_at = cookie.split(';')[0].split('=')[1]
    } else if (cookie.startsWith('nauk_rt=')) {
      cookies.nauk_rt = cookie.split(';')[0].split('=')[1]
    } else if (cookie.startsWith('nauk_sid=')) {
      cookies.nauk_sid = cookie.split(';')[0].split('=')[1]
    }
  }

  return cookies
}

async function login(
  username: string,
  password: string
): Promise<LoginCookies> {
  const response = await axios.post(
    LOGIN_URL,
    { username, password },
    {
      headers: loginHeaders(),
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    }
  )

  const cookies = extractCookies(response.headers['set-cookie'])
  if (!cookies.nauk_at) {
    throw new Error('Login failed: nauk_at cookie missing')
  }
  return cookies
}

async function updateProfileField(
  cookies: LoginCookies,
  profileId: string,
  profile: Record<string, string>
): Promise<boolean> {
  try {
    const resp = await axios.post(
      RESUME_HEADLINE_URL,
      { profile, profileId },
      { headers: authHeaders(cookies) }
    )
    return resp.status === 200
  } catch (error) {
    console.error('Profile field update failed:', error)
    return false
  }
}

async function uploadResume(
  cookies: LoginCookies,
  resumePath: string,
  profileId: string
): Promise<boolean> {
  const formKey = 'F51f8e7e54e205'
  const fileKey = 'UyFNbCXtBHdkXQ'
  const fileName = path.basename(resumePath)
  const formData = new FormData()
  formData.append('formKey', formKey)
  formData.append('fileName', fileName)
  formData.append('uploadCallback', 'true')
  formData.append('fileKey', fileKey)
  formData.append('file', fs.readFileSync(resumePath), {
    filename: fileName,
    contentType: 'application/pdf'
  })

  const uploadHeaders = {
    ...formData.getHeaders(),
    accept: 'application/json, text/javascript, */*; q=0.01',
    origin: 'https://www.naukri.com',
    referer: 'https://www.naukri.com/',
    appid: '109',
    clientid: 'd3skt0p',
    systemid: 'fileupload',
    Cookie: cookieString(cookies),
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.5735.198 Safari/537.36'
  }

  const uploadResponse = await axios.post(RESUME_UPLOAD_URL, formData, {
    headers: uploadHeaders
  })
  if (uploadResponse.status !== 200) return false

  const updateUrl = `https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v0/users/self/profiles/${profileId}/advResume`
  const updateResponse = await axios.post(
    updateUrl,
    { textCV: { formKey, fileKey, textCvContent: '' } },
    { headers: authHeaders(cookies) }
  )
  return updateResponse.status === 200
}

function resolveResumePath(inputPath: string): string {
  const basename = path.basename(inputPath)
  const candidates = [
    inputPath,
    path.resolve(process.cwd(), inputPath),
    path.resolve(process.cwd(), 'resumes', basename),
    path.join('/var/task', inputPath),
    path.join('/var/task/resumes', basename)
  ]

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(`Resume file not found. Tried: ${candidates.join(' | ')}`)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader

  if (!cronSecret || token !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const username = env('INPUT_USERNAME') || env('NAUKRI_USERNAME')
  const password = env('INPUT_PASSWORD') || env('NAUKRI_PASSWORD')
  const profileId = env('INPUT_PROFILE_ID') || env('NAUKRI_PROFILE_ID')
  const resumePathInput =
    env('INPUT_RESUME_PATH') ||
    env('NAUKRI_RESUME_PATH') ||
    './resumes/Mohammad_Irfanuddin_FullStack_Developer_v3.pdf'
  let profileSummary =
    env('INPUT_PROFILE_SUMMARY') || env('NAUKRI_PROFILE_SUMMARY')
  const resumeHeadline =
    env('INPUT_RESUME_HEADLINE') || env('NAUKRI_RESUME_HEADLINE')

  try {
    if (!username || !password || !profileId) {
      throw new Error(
        'Missing required env: INPUT_USERNAME, INPUT_PASSWORD, INPUT_PROFILE_ID'
      )
    }

    const resumePath = resolveResumePath(resumePathInput)
    console.log(`Starting Naukri update from bom1 using ${resumePath}`)

    const cookies = await login(username, password)
    if (!cookies) {
      throw new Error('Login failed: no cookies returned')
    }

    const result = {
      login: true,
      profileSummary: 'skipped',
      resumeHeadline: 'skipped',
      resumeUpload: false,
      resumePath
    }

    if (profileSummary) {
      if (profileSummary.length < 50) {
        result.profileSummary = 'skipped-too-short'
      } else {
        if (profileSummary.length > 1000) {
          profileSummary = profileSummary.slice(0, 1000)
        }
        result.profileSummary = (await updateProfileField(cookies, profileId, {
          summary: profileSummary
        }))
          ? 'updated'
          : 'failed'
      }
    }

    if (resumeHeadline) {
      if (resumeHeadline.length > 250) {
        result.resumeHeadline = 'skipped-too-long'
      } else {
        result.resumeHeadline = (await updateProfileField(cookies, profileId, {
          resumeHeadline
        }))
          ? 'updated'
          : 'failed'
      }
    }

    result.resumeUpload = await uploadResume(cookies, resumePath, profileId)
    if (!result.resumeUpload) {
      throw new Error('Resume upload failed')
    }

    return res.status(200).json({
      success: true,
      region: 'bom1',
      message: 'Naukri profile updated successfully from Mumbai (bom1)',
      result
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Naukri Execution Error:', error)
    return res.status(500).json({
      success: false,
      region: 'bom1',
      error: message
    })
  }
}