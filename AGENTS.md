# AGENTS.md（闲鱼发品追踪器 - 项目开发规范）

> 继承自全局 AGENTS.md，以下为本项目特定规范

## 项目概述
闲鱼发品追踪器 - 追踪闲鱼商品数据，分析商品表现，支持多账号管理

## 技术栈
- **前端**：Next.js 16 + React + TypeScript + Tailwind CSS + Recharts
- **后端**：Python 3.14 + FastAPI + Uvicorn
- **数据库**：SQLite（本地存储于 `data/xianyu.db`）

## 项目结构
```
xianyu-tracker/
├── frontend/              # Next.js 前端
│   ├── app/               # App Router 页面
│   │   ├── page.tsx       # 主页（商品列表）
│   │   └── products/      # 商品相关页面
│   │       ├── new/       # 添加商品
│   │       └── [id]/      # 商品详情/编辑/数据记录
│   └── lib/api.ts         # API 调用封装
├── backend/               # FastAPI 后端
│   ├── main.py            # API 路由
│   └── database.py        # 数据库操作
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

### 待开发功能
- [x] 趋势图表（数据可视化）
- [x] 多账号管理
- [x] 主页行内展开数据录入
- [x] 账号编辑/删除功能
- [x] 数据导出（CSV）
- [ ] 商品图片存储
- [ ] AB 测试对比
- [ ] OCR 数据录入
- [ ] **图片文字替换工具**（新页面）
  - 上传图片，输入目标文字
  - AI 识别图片中的文字并替换为用户提供的文字
  - 用于快速生成商品图片变体
