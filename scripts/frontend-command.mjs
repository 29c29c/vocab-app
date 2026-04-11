import { existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const indexHtmlPath = path.join(projectRoot, 'index.html');

const [, , command = 'build'] = process.argv;

if (!existsSync(indexHtmlPath)) {
    console.error(
        [
            '未找到前端入口文件 index.html，当前仓库只有服务端代码。',
            '因此 `vite` 无法执行构建或预览。',
            '如果你只运行后端，请使用 `npm run start`。',
            '如果你要托管前端，需要先补齐前端工程文件（至少 index.html 和前端 src 目录）。'
        ].join('\n')
    );
    process.exit(1);
}

const child = spawn('vite', [command], {
    cwd: projectRoot,
    shell: true,
    stdio: 'inherit'
});

child.on('exit', code => {
    process.exit(code ?? 1);
});

