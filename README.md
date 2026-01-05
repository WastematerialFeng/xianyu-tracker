# 闲鱼发品追踪器 (Xianyu Tracker)

追踪闲鱼发品数据，分析商品表现，支持自动爬取闲鱼商品信息。

## 功能

### 核心功能
- **商品管理**: 添加/编辑/删除商品，多图片上传和拖拽排序
- **数据记录**: 手动录入曝光量、浏览量、想要数、咨询数
- **趋势图表**: 累计数据趋势图 + 每日增长趋势图
- **多账号管理**: 支持多个闲鱼账号的商品管理
- **数据导出**: CSV 格式导出商品和统计数据

### 工具箱
- **AI 生图工具**: 使用 SiliconFlow API 生成商品主图（文生图/图生图/局部重绘）
- **闲鱼爬虫**: 自动爬取闲鱼商品数据（Playwright + 反检测机制）

## 技术栈
- **前端**: Next.js + React + TypeScript + Tailwind CSS + Recharts
- **后端**: Python + FastAPI
- **数据库**: SQLite
- **爬虫**: Playwright + playwright-stealth
- **拖拽**: @dnd-kit/core + @dnd-kit/sortable

## 项目结构
```
xianyu-tracker/
├── frontend/                # 前端代码
│   └── app/
│       ├── page.tsx         # 主页
│       ├── products/        # 商品详情页
│       └── tools/           # 工具箱
│           ├── image-generator/  # AI 生图
│           └── crawler/          # 闲鱼爬虫
├── backend/                 # 后端代码
│   ├── main.py              # FastAPI 主入口
│   ├── database.py          # 数据库模型
│   └── crawler/             # 爬虫模块
│       ├── config.py        # 反检测配置
│       ├── scraper.py       # 核心爬虫类
│       ├── parsers.py       # 数据解析器
│       └── utils.py         # 工具函数
├── data/                    # 数据目录
├── uploads/                 # 上传文件目录
├── start-backend.bat        # 后端启动脚本
└── start-frontend.bat       # 前端启动脚本
```

## 启动方式
```bash
# 后端
start-backend.bat

# 前端
start-frontend.bat
```

## API 端点

### 商品管理
- `GET/POST /api/products` - 商品列表/创建
- `GET/PUT/DELETE /api/products/{id}` - 商品详情/更新/删除

### 数据记录
- `GET/POST /api/products/{id}/stats` - 统计数据

### 爬虫功能
- `GET/POST /api/crawler/login-state` - 登录状态管理
- `GET/POST/PUT/DELETE /api/crawler/tasks` - 爬虫任务管理
- `POST /api/crawler/tasks/{id}/run` - 执行任务
- `GET/DELETE /api/crawler/items` - 爬取结果管理

### 其他
- `POST /api/upload/image` - 图片上传
- `POST /api/ai/generate-image` - AI 生图
- `GET /api/export/products` - 导出商品数据
