import { createClient } from '@supabase/supabase-js';
import { createBackblazeClient } from './backblaze.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let client = null;
if (supabaseUrl && supabaseKey) {
  client = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase env vars are not set. API will return empty results for data routes until configured.');
}

// If Backblaze env vars are present, create a storage shim that matches the
// small subset of the supabase.storage API the app uses (storage.from(bucket).<methods>). 
// This allows keeping existing calls like `supabase.storage.from(bucket).upload(...)`.
let backblaze = null;
const hasBackblaze = process.env.BACKBLAZE_APPLICATION_KEY && (process.env.BACKBLAZE_BUCKET_NAME || process.env.B2_BUCKET_NAME);
if (hasBackblaze) {
  backblaze = createBackblazeClient();
}

// Export an object named `supabase` (either the real client or a light shim)
// so existing imports continue to work. If Backblaze is configured we override
// the `.storage` property to point at the Backblaze-compatible shim.
const exported = client || {};
if (backblaze) {
  // storage.from(bucket) -> backblaze.from(bucket)
  exported.storage = {
    from: (bucket) => backblaze.from(bucket)
  };
}

export const supabase = exported;
