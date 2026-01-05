# AGENTS.md（闲鱼发品追踪器 - 项目开发规范）

> 继承自全局 AGENTS.md，以下为本项目特定规范

## 项目概述
闲鱼发品追踪器 - 追踪闲鱼商品数据，分析商品表现，支持多账号管理

## 技术栈
- **前端**：Next.js 16 + React + TypeScript + Tailwind CSS + Recharts + @dnd-kit（拖拽排序）
- **后端**：Python 3.14 + FastAPI + Uvicorn + python-multipart（文件上传）+ httpx（HTTP客户端）+ Playwright（浏览器自动化）
- **数据库**：SQLite（本地存储于 `data/xianyu.db`）
- **AI API**：SiliconFlow（图片生成）
- **爬虫**：Playwright + playwright-stealth（闲鱼数据爬取）

## 项目结构
```
xianyu-tracker/
├── frontend/              # Next.js 前端
│   ├── app/               # App Router 页面
│   │   ├── page.tsx       # 主页（商品列表）
│   │   ├── products/      # 商品相关页面
│   │   │   ├── new/       # 添加商品
│   │   │   └── [id]/      # 商品详情/编辑/数据记录
│   │   └── tools/         # 工具页面
│   │       ├── image-generator/  # AI 图片生成器
│   │       └── crawler/          # 闲鱼爬虫管理
│   └── lib/api.ts         # API 调用封装
├── backend/               # FastAPI 后端
│   ├── main.py            # API 路由
│   ├── database.py        # 数据库操作
│   ├── crawler/           # 爬虫模块
│   │   ├── __init__.py
│   │   ├── config.py      # 爬虫配置
│   │   ├── scraper.py     # 核心爬虫逻辑
│   │   ├── parsers.py     # 数据解析器
│   │   └── utils.py       # 工具函数
│   ├── state/             # 登录状态存储
│   │   └── xianyu_state.json
│   └── .env               # 环境变量（API Key）
├── data/                  # SQLite 数据库目录
├── AGENTS.md              # 项目开发规范（本文件）
├── COMMIT-LOG.md          # 提交记录
├── start-backend.bat      # 后端启动脚本
└── start-frontend.bat     # 前端启动脚本
```

## 数据库表结构

### accounts（账号表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 账号名称 |
| xianyu_id | TEXT | 闲鱼ID（可选）|
| created_at | DATETIME | 创建时间 |

### products（商品表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| account_id | INTEGER | 所属账号ID（外键）|
| title | TEXT | 商品标题 |
| category | TEXT | 品类 |
| price | REAL | 价格 |
| description | TEXT | 商品文案 |
| image_original | INTEGER | 图片是否原创（0/1）|
| image_path | TEXT | 主图路径（第一张图）|
| images | TEXT | 多图路径（JSON数组）|
| status | TEXT | 状态（在售/已售/下架）|
| created_at | DATETIME | 创建时间 |

### daily_stats（每日数据记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| product_id | INTEGER | 商品ID（外键）|
| record_date | DATE | 记录日期 |
| exposures | INTEGER | 曝光量（每日更新）|
| views | INTEGER | 浏览量（累计值）|
| favorites | INTEGER | 想要数（累计值）|
| inquiries | INTEGER | 咨询数（每日更新）|

### crawler_tasks（爬虫任务表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 任务名称 |
| keyword | TEXT | 搜索关键词 |
| min_price | REAL | 最低价格 |
| max_price | REAL | 最高价格 |
| personal_only | INTEGER | 仅个人闲置（0/1）|
| max_pages | INTEGER | 最大页数 |
| status | TEXT | 状态（idle/running/error）|
| last_run | DATETIME | 上次运行时间 |
| items_count | INTEGER | 已爬取商品数 |
| created_at | DATETIME | 创建时间 |

### crawled_items（爬取商品表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| task_id | INTEGER | 任务ID（外键）|
| item_id | TEXT | 闲鱼商品ID（唯一）|
| title | TEXT | 商品标题 |
| price | REAL | 价格 |
| seller_id | TEXT | 卖家ID |
| seller_name | TEXT | 卖家昵称 |
| location | TEXT | 发布地点 |
| want_count | INTEGER | 想要人数 |
| image_url | TEXT | 主图链接 |
| crawled_at | DATETIME | 爬取时间 |
| synced_to_product | INTEGER | 是否已同步（0/1）|

## API 端点

### 账号管理
- `GET /api/accounts` - 获取所有账号
- `GET /api/accounts/{id}` - 获取单个账号
- `POST /api/accounts` - 创建账号
- `PUT /api/accounts/{id}` - 更新账号
- `DELETE /api/accounts/{id}` - 删除账号

### 商品管理
- `GET /api/products` - 获取所有商品（支持 ?account_id= 筛选）
- `GET /api/products/{id}` - 获取单个商品
- `POST /api/products` - 创建商品
- `PUT /api/products/{id}` - 更新商品
- `DELETE /api/products/{id}` - 删除商品

### 数据记录
- `GET /api/products/{id}/stats` - 获取商品所有数据记录
- `GET /api/products/{id}/stats/latest` - 获取最新数据记录
- `POST /api/stats` - 创建/更新数据记录
- `DELETE /api/stats/{id}` - 删除数据记录

### 图片上传
- `POST /api/upload/image` - 上传图片（返回路径）
- `GET /api/images/{filename}` - 获取图片

### 数据导出
- `GET /api/export/products` - 导出商品CSV
- `GET /api/export/stats` - 导出数据记录CSV

### AI 图片生成
- `POST /api/tools/generate-image` - AI 生成图片
  - mode: "generate"（文生图）| "edit"（图生图）| "inpaint"（局部重绘）
  - prompt: 提示词
  - image: base64 参考图（图生图/局部重绘必填）
  - mask: base64 遮罩图（局部重绘可选）
  - n: 生成数量（1-4）
  - size: 尺寸（1024x1024 等）

### 爬虫管理
- `GET /api/crawler/login-state/check` - 检查登录状态
- `POST /api/crawler/login-state` - 保存登录状态（Cookie）
- `GET /api/crawler/tasks` - 获取所有爬虫任务
- `GET /api/crawler/tasks/{id}` - 获取单个任务
- `POST /api/crawler/tasks` - 创建爬虫任务
- `PUT /api/crawler/tasks/{id}` - 更新任务
- `DELETE /api/crawler/tasks/{id}` - 删除任务
- `POST /api/crawler/tasks/{id}/run` - 执行爬虫任务
- `POST /api/crawler/tasks/{id}/stop` - 停止任务
- `GET /api/crawler/logs` - 获取运行日志
- `GET /api/crawler/items` - 获取爬取的商品（支持 ?task_id= 筛选）
- `DELETE /api/crawler/items/{id}` - 删除爬取商品
- `POST /api/crawler/items/{id}/sync` - 同步到商品追踪表

## 启动方式
```bash
# 后端（端口 8000）
cd backend && python main.py
# 或双击 start-backend.bat

# 前端（端口 3000）
cd frontend && npm run dev
# 或双击 start-frontend.bat
```

## 开发规范

### 前端
- 页面组件放在 `app/` 目录下
- API 调用统一通过 `lib/api.ts`
- 使用 Tailwind CSS 进行样式开发
- 图表使用 Recharts 库

### 后端
- API 路由统一以 `/api/` 开头
- 使用 Pydantic 进行请求体验证
- 数据库操作封装在 `database.py`

### 文档同步规则（重要）
- **修改数据库表结构时，必须同步更新本文件的"数据库表结构"部分**
- **新增/修改 API 端点时，必须同步更新本文件的"API 端点"部分**
- **新增依赖库时，必须同步更新本文件的"技术栈"部分**
- **修改项目结构时，必须同步更新本文件的"项目结构"部分**
- **功能完成后必须更新文档**：当用户提出的新功能开发完成并确认后，必须将该功能更新到相关的介绍文档（如本文件的"已完成功能"和"待开发功能"列表）

### 已完成功能
- [x] 商品 CRUD（增删改查）
- [x] 数据记录（曝光量/浏览量/想要数/咨询数）
- [x] 趋势图表（累计数据 + 每日增长）
- [x] 多账号管理（筛选/编辑/删除）
- [x] 主页行内展开数据录入
- [x] 数据导出（CSV）
- [x] 多图片存储（最多9张）
- [x] 图片拖拽排序（第一张为主图）
- [x] AI 商品主图生成器（文生图/图生图/局部重绘）
- [x] 闲鱼自动爬虫（Playwright + 反检测）

### 待开发功能
- [ ] AB 测试对比
- [ ] OCR 数据录入
- [ ] 定时爬取任务
