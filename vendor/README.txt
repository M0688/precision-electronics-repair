Third-party libraries, kept here rather than loaded from a CDN.

  supabase-js.min.js   @supabase/supabase-js v2.117.1, bundled to a single
                        ESM file with esbuild (the npm build imports several
                        sibling packages, so it cannot be used as-is).
  jspdf.umd.min.js      jsPDF v2.5.1, the UMD build, unmodified.

Why: the workshop went blank twice because a CDN stopped serving these
(esm.sh, then jsDelivr with ERR_CONNECTION_CLOSED). The workshop is a
working tool, so it should not depend on someone else's uptime.

To update, on a machine with npm:
  npm install @supabase/supabase-js@2 jspdf@2.5.1
  npx esbuild node_modules/@supabase/supabase-js/dist/index.mjs \
      --bundle --format=esm --minify --target=es2020 \
      --outfile=supabase-js.min.js
  cp node_modules/jspdf/dist/jspdf.umd.min.js .
Then test the workshop before pushing.
