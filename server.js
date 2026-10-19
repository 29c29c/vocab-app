import 'dotenv/config';
import { createApp } from './src/app.js';
import { config } from './src/config/env.js';
import { databaseReady } from './src/db/index.js';
import { startMasteredReviewScheduler } from './src/services/masteredReviewScheduler.js';

await databaseReady;

const app = createApp({ config });
const masteredReviewScheduler = startMasteredReviewScheduler();

const server = app.listen(config.port, () => {
    console.log(`🚀 服务器已启动: http://localhost:${config.port}`);
});
server.once('close', () => masteredReviewScheduler.stop());
