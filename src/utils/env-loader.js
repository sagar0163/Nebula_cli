import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Walk up to find the root with package.json or .env
const rootDir = join(__dirname, '../../');
const envPath = join(rootDir, '.env');

if (fs.existsSync(envPath)) {
    // console.log('DEBUG: Loading env from', envPath);
    dotenv.config({ path: envPath });
} else {
    // Fallback to standard resolve if .env not found at calculated root
    dotenv.config();
}
