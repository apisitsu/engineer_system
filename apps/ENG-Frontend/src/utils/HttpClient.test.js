import axios from 'axios';
import { DEFAULT_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from './HttpClient';

// HttpClient installs its interceptors on the DEFAULT axios instance (`export const
// httpClient = axios`), so every caller that does `import axios from 'axios'` gets them.
// Reach the request interceptor the same way axios itself would.
const applyRequestInterceptor = (config) => {
  const handler = axios.interceptors.request.handlers.find((h) => h && h.fulfilled);
  return handler.fulfilled({ url: '/api/thing', headers: {}, ...config });
};

describe('HttpClient request timeout defaults', () => {
  it('gives an ordinary request the short default', async () => {
    const out = await applyRequestInterceptor({ method: 'get' });
    expect(out.timeout).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('gives a FormData body the upload allowance instead', async () => {
    // The whole point: axios's timeout is a deadline for the entire request, so a large
    // file transferring healthily would still be aborted at the short default.
    const out = await applyRequestInterceptor({ method: 'post', data: new FormData() });
    expect(out.timeout).toBe(UPLOAD_TIMEOUT_MS);
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(DEFAULT_TIMEOUT_MS);
  });

  it('never overrides a timeout the caller set explicitly', async () => {
    const plain = await applyRequestInterceptor({ method: 'post', timeout: 1234 });
    expect(plain.timeout).toBe(1234);

    const upload = await applyRequestInterceptor({
      method: 'post', data: new FormData(), timeout: 5678,
    });
    expect(upload.timeout).toBe(5678);
  });

  it('treats timeout 0 as "not set" rather than as "no timeout"', async () => {
    // axios reads 0 as infinite; the interceptor deliberately fills it in so a stuck
    // request still fails instead of spinning forever.
    const out = await applyRequestInterceptor({ method: 'post', data: new FormData(), timeout: 0 });
    expect(out.timeout).toBe(UPLOAD_TIMEOUT_MS);
  });

  it('leaves a non-FormData body on the short default', async () => {
    const out = await applyRequestInterceptor({ method: 'post', data: { a: 1 } });
    expect(out.timeout).toBe(DEFAULT_TIMEOUT_MS);
  });
});
