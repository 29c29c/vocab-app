# 记忆飞船 V7

一个面向个人学习场景的单词记录、复习与 AI 辅助学习应用。它把“录入新词、安排复习、标记难词、生成解析、整理历史记录”放在同一个系统里，适合长期积累自己的英语 / 日语词库。

## 功能介绍

### 1. 新词录入

- 手动录入单词、例句、手动释义和日期
- 录入后优先显示本地词典结果，再异步补充 AI 解析
- 自动记录最近 5 次手动录入结果，便于快速回看
- 词典读音和最简释义会写回数据库，刷新后仍可保留

### 2. 复习系统

- 常规复习队列：按日期和阶段进入今日任务
- 当天巩固机制：
  - `忘记` 会退回第 0 周期，并要求当天重复达标
  - `模糊` 不升级周期，并要求当天重复达标
- 更随机的错题重现逻辑，避免固定 3-4 个后立刻再次出现
- `撤销上一步` 支持恢复复习进度和队列状态

### 3. 重点巩固

- 自动统计每个词的 `忘记 / 模糊` 次数
- 达到阈值后自动迁移到“重点巩固”板块
- 重点巩固与常规复习共用同一套评分和调度逻辑
- 连续稳定表现后可自动退出重点巩固，避免永久堆积难词

### 4. 荣誉殿堂

- 已掌握词条可进入荣誉殿堂
- 支持从荣誉殿堂重新学习，把词重新放回复习体系

### 5. 词典与 AI 辅助

- 英语和日语都支持本地 SQLite 词典
- 词典查询优先返回基础读音、简短释义、词性
- AI 解析通过服务端代理请求第三方模型，避免浏览器直连模型接口
- 支持多家 AI provider 预设与服务端保存 API Key

### 6. 批量学习工具

- 文章智能解析：从文章中抽取重点词汇和表达后批量加入词库
- 写作进阶与润色：AI 润色文本，并把更地道的表达批量收藏
- Excel 导入：可把外部词表快速导入为词条

### 7. 数据查看与输出

- 词频统计
- 日期归档
- 听写纸生成与打印
- Excel 导出

### 8. 账号与后台能力

- 用户登录与注册
- JWT 鉴权
- 服务端 SQLite 持久化
- 邀请码注册机制
- 管理员邀请码管理

> [!WARNING]
> 这是一个 **vibecoding** 项目。
> 它更像“个人实验 + 实用工具 + 持续边写边改”的产物，不是一个承诺长期维护的正式开源产品。
> **不承诺**长期维护、问题回复时效、PR 审核、版本兼容、生产级 SLA，使用前请自行评估风险。

## 项目特点

- 前后端一体：React + Vite 前端，Express + SQLite 后端
- 登录后数据按用户隔离
- AI Key 不直接在浏览器里调用第三方模型接口，而是通过服务端代理
- 保留了历史导入兼容接口，便于和其他项目联动
- 本地词典与网站运行时解耦，支持离线 `.mdx -> sqlite` 预处理

## 技术栈

- Frontend: React 19, Vite, Tailwind CSS, Lucide
- Backend: Express, JWT, bcryptjs
- Database: SQLite

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，然后按需修改：

```bash
cp .env.example .env
```

最常用的变量有：

- `PORT`: 服务端端口，默认 `3001`
- `JWT_SECRET`: JWT 密钥
- `ADMIN_USERNAMES`: 管理员用户名，多个用逗号分隔
- `CORS_ORIGIN`: 允许的前端来源
- `DB_PATH`: SQLite 数据库文件路径
- `SERVE_STATIC`: 是否托管前端静态文件

### 3. 本地开发

前端开发模式：

```bash
npm run dev
```

构建前端：

```bash
npm run build
```

启动后端：

```bash
npm run start
```

默认访问地址：

- 前端 / 静态托管：`http://localhost:3001/`
- API：`http://localhost:3001/api/*`

## 重要说明

### 导入接口兼容

项目中保留了历史导入接口：

- `POST /api/data`

这个接口和其他项目有联动，**不要随意修改路径、入参结构和语义**。

### 安全与隐私

上传到 GitHub 前，请不要提交这些内容：

- `.env`
- `database.sqlite`
- `.well-known/`
- 部署目录副本
- 本地构建产物 `dist/`

仓库里的 `.gitignore` 已经默认忽略了这些文件，但如果你手动 `git add -f`，仍然可能把敏感内容提交上去。

### 邀请码与管理员

- 注册依赖服务端邀请码表，不再使用单个环境变量邀请码
- 管理员账号通过 `ADMIN_USERNAMES` 指定
- 管理员可在设置页内管理邀请码
- 系统冷启动且还没有任何邀请码时，命中管理员用户名的账号可免邀请码完成首次注册

## 项目结构

```text
.
├── server.js                # 服务端启动入口
├── server/
│   └── dictionaries/        # 本地词典、离线转换脚本、GUI 与 bat
├── src/
│   ├── App.jsx              # 前端状态容器
│   ├── components/          # 前端组件
│   ├── client/              # 前端 API / 缓存 / 工具层
│   ├── app.js               # Express 应用装配
│   ├── routes/              # 后端路由
│   ├── services/            # 后端业务逻辑
│   ├── repositories/        # 数据访问层
│   ├── db/                  # SQLite 初始化与事务
│   ├── validators/          # 请求校验
│   └── middleware/          # 鉴权、安全、错误处理
└── scripts/
    └── frontend-command.mjs # 前端命令包装脚本
```

## 本地词典说明

- 网站运行时默认读取：
  - 英语：`server/dictionaries/en/main.sqlite`
  - 日语：`server/dictionaries/ja/main.sqlite`
- `.mdx -> sqlite` 转换不在网站里执行，而是在本机离线执行
- 离线工具位于：
  - [server/dictionaries/convert_mdx_to_sqlite.py](./server/dictionaries/convert_mdx_to_sqlite.py)
  - [server/dictionaries/convert_mdx_to_sqlite_gui.py](./server/dictionaries/convert_mdx_to_sqlite_gui.py)
  - [server/dictionaries/launch_converter_gui.bat](./server/dictionaries/launch_converter_gui.bat)

## 开发约定

- 默认以本地源码为准，不以服务器目录副本为准
- 服务器部署时建议只上传源码、重新安装依赖并重新构建
- 不建议把本地数据库、证书校验文件、旧部署目录一并提交到仓库

## 维护声明

这个仓库开放出来主要是为了展示、记录和复现当前状态，不代表：

- 会持续维护
- 会跟进 issue
- 会接受或合并 PR
- 会保持未来版本 API 完全不变

如果你打算基于它继续使用，建议直接 fork 一份并按自己的需求维护。
