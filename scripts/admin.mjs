import { startAdminService } from '../src/admin/runtime.mjs';

try {
  const studio = await startAdminService({ port: Number(process.env.TCL_ADMIN_PORT || 4174) });
  console.log(`Private editorial studio: ${studio.url}`);
  if (!studio.owned) console.log('Reusing the studio already running for this workspace.');
  else {
    console.log(process.env.OPENAI_API_KEY ? 'AI is configured. Scans and generation use your API billing.' : 'Add OPENAI_API_KEY to .env.local and restart to enable AI.');
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await studio.close();
      process.exit(0);
    };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }
} catch (error) {
  console.error(error.code ? 'The studio could not start. Check the workspace and port.' : error.message);
  process.exit(1);
}
