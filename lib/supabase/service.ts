import { createClient } from "@supabase/supabase-js";

// Klien Supabase service-role — server-only, TIDAK terikat kepada request/cookie.
// HANYA untuk digunakan di dalam route API ingest (app/api/ingest/*), yang menerima
// webhook push dari Google Apps Script dan perlu menulis melepasi RLS.
// JANGAN import/guna fail ini di Client Component atau mana-mana kod yang boleh
// terdedah kepada pelayar. JANGAN log atau papar SUPABASE_SERVICE_ROLE_KEY.
//
// Env var yang perlu ditetapkan di Vercel (Project Settings -> Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY=<service_role key dari Supabase project settings>
// (NEXT_PUBLIC_SUPABASE_URL sudah sedia ada untuk klien lain dalam projek ini.)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
