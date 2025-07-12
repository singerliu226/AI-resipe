#!/usr/bin/env node
/**
 * Conversation Logger: upload .cursor_history JSONL files to Supabase Storage daily.
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY  (service role key for upload)
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const glob = require("glob");
const zlib = require("zlib");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE creds missing, abort upload");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  const historyDir = path.resolve(process.cwd(), ".cursor_history");
  if (!fs.existsSync(historyDir)) {
    console.log("No .cursor_history directory, nothing to upload.");
    return;
  }

  // Collect files modified in last 24h
  const files = glob.sync("**/*.jsonl", { cwd: historyDir, absolute: true });
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;
  const recent = files.filter((f) => fs.statSync(f).mtimeMs >= yesterday);

  if (recent.length === 0) {
    console.log("No new history files to upload.");
    return;
  }

  const datePrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const file of recent) {
    const content = fs.readFileSync(file);
    const gz = zlib.gzipSync(content);
    const baseName = path.basename(file) + ".gz";
    const remotePath = `${datePrefix}/${baseName}`;

    const { error } = await supabase.storage
      .from("conversation-history")
      .upload(remotePath, gz, {
        contentType: "application/gzip",
        upsert: true,
      });

    if (error) {
      console.error("Upload failed:", file, error.message);
    } else {
      console.log("✅ Uploaded", remotePath);
    }
  }
})(); 