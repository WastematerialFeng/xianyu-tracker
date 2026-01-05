"""
FastAPI 主入口
为什么用 FastAPI：轻量、自带 API 文档、异步支持好，符合 AGENTS.md 规范
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_connection, init_db
from pathlib import Path
import csv
import io
import uuid
import os
import httpx
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY", "")
SILICONFLOW_API_BASE = "https://api.siliconflow.cn/v1"

# 图片存储目录
IMAGES_DIR = Path(__file__).parent.parent / "data" / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 初始化数据库
init_db()

app = FastAPI(title="闲鱼追踪器 API", version="1.0.0")

# 跨域配置 - 允许前端访问
# 为什么需要：前端和后端端口不同，浏览器会阻止跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js 默认端口
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 请求/响应模型
class ProductCreate(BaseModel):
    """创建商品的请求体"""
    title: str
    category: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image_original: Optional[int] = 0  # 0=非原创, 1=原创
    image_path: Optional[str] = None  # 主图路径（兼容旧版）
    images: Optional[List[str]] = None  # 多图片路径数组
    account_id: Optional[int] = None  # 所属账号


class ProductUpdate(BaseModel):
    """更新商品的请求体"""
    title: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image_original: Optional[int] = None
    image_path: Optional[str] = None  # 主图路径
    images: Optional[List[str]] = None  # 多图片路径数组
    status: Optional[str] = None
    account_id: Optional[int] = None  # 所属账号


class AccountCreate(BaseModel):
    """创建账号的请求体"""
    name: str
    xianyu_id: Optional[str] = None


class AccountUpdate(BaseModel):
    """更新账号的请求体"""
    name: Optional[str] = None
    xianyu_id: Optional[str] = None


class StatsCreate(BaseModel):
    """创建数据记录的请求体"""
    product_id: int
    record_date: str  # 格式: YYYY-MM-DD
    exposures: Optional[int] = 0
    views: Optional[int] = 0
    clicks: Optional[int] = 0
    inquiries: Optional[int] = 0
    favorites: Optional[int] = 0


class StatsUpdate(BaseModel):
    """更新数据记录的请求体"""
    exposures: Optional[int] = None
    views: Optional[int] = None
    clicks: Optional[int] = None
    inquiries: Optional[int] = None
    favorites: Optional[int] = None


# API 路由
@app.get("/")
def root():
    """健康检查"""
    return {"message": "闲鱼追踪器 API 运行中"}


@app.get("/api/products")
def get_products(account_id: Optional[int] = None):
    """获取所有商品，支持按账号筛选"""
    conn = get_connection()
    cursor = conn.cursor()
    if account_id:
        cursor.execute("SELECT * FROM products WHERE account_id = ? ORDER BY created_at DESC", (account_id,))
    else:
        cursor.execute("SELECT * FROM products ORDER BY created_at DESC")
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"data": products}


@app.get("/api/products/{product_id}")
def get_product(product_id: int):
    """获取单个商品"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    product = cursor.fetchone()
    conn.close()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    return {"data": dict(product)}


@app.post("/api/products")
def create_product(product: ProductCreate):
    """创建商品"""
    import json
    conn = get_connection()
    cursor = conn.cursor()
    
    # 处理 images 数组转 JSON
    images_json = json.dumps(product.images) if product.images else None
    # 如果有 images，第一张作为主图
    image_path = product.image_path or (product.images[0] if product.images else None)
    
    cursor.execute(
        """INSERT INTO products (title, category, price, description, image_original, image_path, images, account_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (product.title, product.category, product.price, 
         product.description, product.image_original, image_path, images_json, product.account_id)
    )
    conn.commit()
    product_id = cursor.lastrowid
    conn.close()
    return {"message": "创建成功", "id": product_id}


@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: ProductUpdate):
    """更新商品"""
    import json
    conn = get_connection()
    cursor = conn.cursor()
    
    # 检查商品是否存在
    cursor.execute("SELECT id FROM products WHERE id = ?", (product_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="商品不存在")
    
    # 动态构建更新语句
    updates = []
    values = []
    for field, value in product.model_dump(exclude_unset=True).items():
        if value is not None:
            # images 字段需要转 JSON
            if field == "images":
                value = json.dumps(value)
            updates.append(f"{field} = ?")
            values.append(value)
    
    # 如果更新了 images，同时更新 image_path 为第一张
    if product.images and len(product.images) > 0:
        if "image_path = ?" not in updates:
            updates.append("image_path = ?")
            values.append(product.images[0])
    
    if updates:
        values.append(product_id)
        cursor.execute(
            f"UPDATE products SET {', '.join(updates)} WHERE id = ?",
            values
        )
        conn.commit()
    
    conn.close()
    return {"message": "更新成功"}


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    """删除商品"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="商品不存在")
    conn.commit()
    conn.close()
    return {"message": "删除成功"}


# ========== 数据记录 API ==========

@app.get("/api/products/{product_id}/stats")
def get_product_stats(product_id: int):
    """获取商品的所有数据记录"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM daily_stats WHERE product_id = ? ORDER BY record_date DESC",
        (product_id,)
    )
    stats = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"data": stats}


@app.get("/api/products/{product_id}/stats/latest")
def get_latest_stats(product_id: int):
    """获取商品最新的数据记录"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM daily_stats WHERE product_id = ? ORDER BY record_date DESC LIMIT 1",
        (product_id,)
    )
    stat = cursor.fetchone()
    conn.close()
    return {"data": dict(stat) if stat else None}


@app.post("/api/stats")
def create_stats(stats: StatsCreate):
    """创建或更新数据记录（同一天同一商品只保留一条）"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 检查商品是否存在
    cursor.execute("SELECT id FROM products WHERE id = ?", (stats.product_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="商品不存在")
    
    # 使用 REPLACE 实现 upsert（同一天同一商品更新）
    cursor.execute(
        """INSERT OR REPLACE INTO daily_stats 
           (product_id, record_date, exposures, views, clicks, inquiries, favorites)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (stats.product_id, stats.record_date, stats.exposures, stats.views, 
         stats.clicks, stats.inquiries, stats.favorites)
    )
    conn.commit()
    stat_id = cursor.lastrowid
    conn.close()
    return {"message": "记录成功", "id": stat_id}


@app.delete("/api/stats/{stat_id}")
def delete_stats(stat_id: int):
    """删除数据记录"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM daily_stats WHERE id = ?", (stat_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="记录不存在")
    conn.commit()
    conn.close()
    return {"message": "删除成功"}


# ========== 账号管理 API ==========

@app.get("/api/accounts")
def get_accounts():
    """获取所有账号"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM accounts ORDER BY created_at DESC")
    accounts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"data": accounts}


@app.get("/api/accounts/{account_id}")
def get_account(account_id: int):
    """获取单个账号"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM accounts WHERE id = ?", (account_id,))
    account = cursor.fetchone()
    conn.close()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    return {"data": dict(account)}


@app.post("/api/accounts")
def create_account(account: AccountCreate):
    """创建账号"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO accounts (name, xianyu_id) VALUES (?, ?)",
        (account.name, account.xianyu_id)
    )
    conn.commit()
    account_id = cursor.lastrowid
    conn.close()
    return {"message": "创建成功", "id": account_id}


@app.put("/api/accounts/{account_id}")
def update_account(account_id: int, account: AccountUpdate):
    """更新账号"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 检查账号是否存在
    cursor.execute("SELECT * FROM accounts WHERE id = ?", (account_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="账号不存在")
    
    # 构建更新语句
    updates = []
    values = []
    if account.name is not None:
        updates.append("name = ?")
        values.append(account.name)
    if account.xianyu_id is not None:
        updates.append("xianyu_id = ?")
        values.append(account.xianyu_id)
    
    if updates:
        values.append(account_id)
        cursor.execute(f"UPDATE accounts SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()
    
    conn.close()
    return {"message": "更新成功"}


@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int):
    """删除账号"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="账号不存在")
    conn.commit()
    conn.close()
    return {"message": "删除成功"}


# ========== 数据导出 API ==========

@app.get("/api/export/products")
def export_products_csv():
    """导出商品列表为 CSV"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.id, p.title, p.category, p.price, p.status, p.created_at,
               a.name as account_name
        FROM products p
        LEFT JOIN accounts a ON p.account_id = a.id
        ORDER BY p.created_at DESC
    """)
    products = cursor.fetchall()
    conn.close()
    
    # 生成 CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "商品标题", "品类", "价格", "状态", "创建时间", "所属账号"])
    for p in products:
        writer.writerow([p["id"], p["title"], p["category"], p["price"], p["status"], p["created_at"], p["account_name"] or "未分配"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"}
    )


@app.get("/api/export/stats")
def export_stats_csv():
    """导出所有数据记录为 CSV"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ds.record_date, p.title, ds.exposures, ds.views, ds.favorites, ds.inquiries
        FROM daily_stats ds
        JOIN products p ON ds.product_id = p.id
        ORDER BY ds.record_date DESC, p.title
    """)
    stats = cursor.fetchall()
    conn.close()
    
    # 生成 CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["日期", "商品标题", "曝光量", "浏览量", "想要数", "咨询数"])
    for s in stats:
        writer.writerow([s["record_date"], s["title"], s["exposures"] or 0, s["views"], s["favorites"], s["inquiries"]])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stats.csv"}
    )


# ========== 图片上传 API ==========

@app.post("/api/upload/image")
async def upload_image(file: UploadFile = File(...)):
    """上传图片，返回图片路径"""
    # 验证文件类型
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只能上传图片文件")
    
    # 生成唯一文件名
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = IMAGES_DIR / filename
    
    # 保存文件
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    return {"filename": filename, "path": f"/api/images/{filename}"}


@app.get("/api/images/{filename}")
def get_image(filename: str):
    """获取图片"""
    filepath = IMAGES_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="图片不存在")
    return FileResponse(filepath)


# ==================== AI 图片生成 API ====================

class ImageGenerateRequest(BaseModel):
    """AI 图片生成请求"""
    mode: str  # "generate" | "edit" | "inpaint"
    prompt: str
    image: Optional[str] = None  # base64 参考图
    mask: Optional[str] = None   # base64 遮罩图（局部重绘用）
    n: int = 1  # 生成数量 1-4
    size: str = "1024x1024"  # 图片尺寸


@app.post("/api/tools/generate-image")
async def generate_image(request: ImageGenerateRequest):
    """
    AI 图片生成接口 - 使用 SiliconFlow API
    支持文生图模式
    """
    if not SILICONFLOW_API_KEY:
        raise HTTPException(status_code=500, detail="API Key 未配置")
    
    headers = {
        "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{SILICONFLOW_API_BASE}/images/generations",
                headers=headers,
                json={
                    "model": "black-forest-labs/FLUX.1-schnell",
                    "prompt": request.prompt,
                    "image_size": request.size,
                    "num_inference_steps": 20
                }
            )
            
            result = response.json()
            print(f"API Response: {result}")
            
            if response.status_code != 200:
                error_msg = result.get("message") or result.get("error", {}).get("message", "生成失败")
                return {"images": [], "error": str(error_msg)}
            
            images = []
            for item in result.get("images", []) or result.get("data", []):
                if isinstance(item, dict):
                    img = item.get("url")
                    if img:
                        images.append(img)
            
            return {"images": images, "error": None}
            
    except httpx.TimeoutException:
        return {"images": [], "error": "请求超时，请稍后重试"}
    except Exception as e:
        return {"images": [], "error": f"生成失败: {str(e)}"}


# ==================== 爬虫相关 API ====================
# 为什么需要：管理闲鱼爬虫任务，实现自动获取商品数据

import json
import asyncio
from crawler.scraper import XianyuCrawler
from crawler.config import STATE_FILE

# 全局爬虫实例（用于控制运行状态）
_crawler_instance: XianyuCrawler = None
_crawler_logs: List[str] = []


class CrawlerTaskCreate(BaseModel):
    """创建爬虫任务的请求体"""
    name: str
    task_type: str = "search"  # search=搜索市场, my_items=我的商品
    keyword: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    personal_only: bool = False
    max_pages: int = 1


class CrawlerTaskUpdate(BaseModel):
    """更新爬虫任务的请求体"""
    name: Optional[str] = None
    keyword: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    personal_only: Optional[bool] = None
    max_pages: Optional[int] = None


class LoginStateData(BaseModel):
    """登录状态数据"""
    cookies: List[dict]
    origins: Optional[List[dict]] = None


# 导入扫码登录管理器
from crawler.qr_login import qr_login_manager


# ========== 扫码登录 ==========

@app.post("/api/crawler/qr-login/generate")
async def generate_qr_login():
    """生成扫码登录二维码"""
    result = await qr_login_manager.generate_qr_code()
    return result


@app.get("/api/crawler/qr-login/status/{session_id}")
def get_qr_login_status(session_id: str):
    """获取扫码登录状态"""
    result = qr_login_manager.get_session_status(session_id)
    
    # 如果登录成功，自动保存 Cookie 到状态文件
    if result.get('status') == 'success' and result.get('cookies'):
        try:
            # 将 cookie 字符串转换为 Playwright 格式
            cookie_str = result['cookies']
            cookies_list = []
            for item in cookie_str.split('; '):
                if '=' in item:
                    name, value = item.split('=', 1)
                    cookies_list.append({
                        'name': name,
                        'value': value,
                        'domain': '.goofish.com',
                        'path': '/'
                    })
            
            state_data = {"cookies": cookies_list}
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(state_data, f, ensure_ascii=False, indent=2)
            
            result['saved'] = True
        except Exception as e:
            result['saved'] = False
            result['save_error'] = str(e)
    
    return result


# ========== 登录状态管理 ==========

@app.get("/api/crawler/login-state/check")
def check_login_state():
    """检查登录状态是否有效"""
    if not STATE_FILE.exists():
        return {"valid": False, "message": "登录状态文件不存在"}
    
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            state = json.load(f)
        
        cookies = state.get('cookies', [])
        if not cookies:
            return {"valid": False, "message": "没有 Cookie 数据"}
        
        # 检查闲鱼相关 cookie
        xianyu_cookies = [c for c in cookies if 'goofish' in c.get('domain', '') or 'taobao' in c.get('domain', '')]
        if not xianyu_cookies:
            return {"valid": False, "message": "未找到闲鱼相关 Cookie"}
        
        return {"valid": True, "message": f"找到 {len(xianyu_cookies)} 个闲鱼 Cookie", "cookie_count": len(xianyu_cookies)}
    except Exception as e:
        return {"valid": False, "message": f"检查失败: {str(e)}"}


@app.post("/api/crawler/login-state")
def save_login_state(data: LoginStateData):
    """保存登录状态（从 Chrome 扩展获取）"""
    try:
        state_data = {"cookies": data.cookies}
        if data.origins:
            state_data["origins"] = data.origins
        
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(state_data, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "登录状态保存成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


# ========== 爬虫任务管理 ==========

@app.get("/api/crawler/tasks")
def get_crawler_tasks():
    """获取所有爬虫任务"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM crawler_tasks ORDER BY created_at DESC")
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"data": tasks}


@app.get("/api/crawler/tasks/{task_id}")
def get_crawler_task(task_id: int):
    """获取单个爬虫任务"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM crawler_tasks WHERE id = ?", (task_id,))
    task = cursor.fetchone()
    conn.close()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"data": dict(task)}


@app.post("/api/crawler/tasks")
def create_crawler_task(task: CrawlerTaskCreate):
    """创建爬虫任务"""
    # 验证：搜索任务必须有关键词
    if task.task_type == "search" and not task.keyword:
        raise HTTPException(status_code=400, detail="搜索任务必须提供关键词")
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO crawler_tasks (name, task_type, keyword, min_price, max_price, personal_only, max_pages)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (task.name, task.task_type, task.keyword, task.min_price, task.max_price, 
         1 if task.personal_only else 0, task.max_pages)
    )
    conn.commit()
    task_id = cursor.lastrowid
    conn.close()
    return {"message": "创建成功", "id": task_id}


@app.put("/api/crawler/tasks/{task_id}")
def update_crawler_task(task_id: int, task: CrawlerTaskUpdate):
    """更新爬虫任务"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM crawler_tasks WHERE id = ?", (task_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="任务不存在")
    
    updates = []
    values = []
    for field, value in task.model_dump(exclude_unset=True).items():
        if value is not None:
            if field == "personal_only":
                value = 1 if value else 0
            updates.append(f"{field} = ?")
            values.append(value)
    
    if updates:
        values.append(task_id)
        cursor.execute(f"UPDATE crawler_tasks SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()
    
    conn.close()
    return {"message": "更新成功"}


@app.delete("/api/crawler/tasks/{task_id}")
def delete_crawler_task(task_id: int):
    """删除爬虫任务"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM crawler_tasks WHERE id = ?", (task_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="任务不存在")
    # 同时删除该任务的爬取结果
    cursor.execute("DELETE FROM crawled_items WHERE task_id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "删除成功"}


# ========== 爬虫执行控制 ==========

@app.post("/api/crawler/tasks/{task_id}/run")
async def run_crawler_task(task_id: int):
    """执行爬虫任务"""
    global _crawler_instance, _crawler_logs
    
    # 检查登录状态
    if not STATE_FILE.exists():
        raise HTTPException(status_code=400, detail="请先配置登录状态")
    
    # 获取任务配置
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM crawler_tasks WHERE id = ?", (task_id,))
    task = cursor.fetchone()
    if not task:
        conn.close()
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task_dict = dict(task)
    
    # 检查是否已在运行
    if _crawler_instance and _crawler_instance.is_running:
        conn.close()
        raise HTTPException(status_code=400, detail="已有任务在运行中")
    
    # 更新任务状态
    cursor.execute("UPDATE crawler_tasks SET status = 'running' WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    
    # 清空日志
    _crawler_logs = []
    
    def log_callback(msg: str):
        _crawler_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    
    # 创建爬虫实例并执行
    _crawler_instance = XianyuCrawler(on_progress=log_callback)
    
    try:
        # 根据任务类型执行不同的爬取逻辑
        task_type = task_dict.get('task_type', 'search')
        
        if task_type == 'my_items':
            # 爬取我的商品
            items = await _crawler_instance.crawl_my_items()
            
            # 保存并同步到商品库
            conn = get_connection()
            cursor = conn.cursor()
            saved_count = 0
            synced_count = 0
            
            for item in items:
                try:
                    item_id = item.get('item_id')
                    if not item_id:
                        continue
                    
                    # 保存到 crawled_items
                    cursor.execute(
                        """INSERT OR REPLACE INTO crawled_items 
                           (task_id, item_id, title, price, image_url)
                           VALUES (?, ?, ?, ?, ?)""",
                        (task_id, item_id, item.get('title'), item.get('price'), item.get('image_url'))
                    )
                    saved_count += 1
                    
                    # 同步到 products 表（通过 xianyu_item_id 去重）
                    cursor.execute("SELECT id FROM products WHERE xianyu_item_id = ?", (item_id,))
                    existing = cursor.fetchone()
                    
                    if existing:
                        # 更新现有商品
                        cursor.execute(
                            """UPDATE products SET title = ?, price = ?, status = ?, image_path = ?
                               WHERE xianyu_item_id = ?""",
                            (item.get('title'), item.get('price'), item.get('status', 'active'),
                             item.get('image_url'), item_id)
                        )
                    else:
                        # 创建新商品
                        cursor.execute(
                            """INSERT INTO products (title, price, status, image_path, xianyu_item_id)
                               VALUES (?, ?, ?, ?, ?)""",
                            (item.get('title'), item.get('price'), item.get('status', 'active'),
                             item.get('image_url'), item_id)
                        )
                        synced_count += 1
                    
                    # 记录今日数据到 daily_stats
                    product_id = existing[0] if existing else cursor.lastrowid
                    today = datetime.now().strftime('%Y-%m-%d')
                    cursor.execute(
                        """INSERT OR REPLACE INTO daily_stats (product_id, record_date, views, favorites)
                           VALUES (?, ?, ?, ?)""",
                        (product_id, today, item.get('views', 0), item.get('wants', 0))
                    )
                    
                except Exception as e:
                    print(f"保存商品失败: {e}")
            
            # 更新任务状态
            cursor.execute(
                "UPDATE crawler_tasks SET status = 'idle', last_run = ?, items_count = ? WHERE id = ?",
                (datetime.now().isoformat(), saved_count, task_id)
            )
            conn.commit()
            conn.close()
            
            return {"success": True, "message": f"爬取完成，获取 {saved_count} 个商品，新增 {synced_count} 个到追踪库"}
        
        else:
            # 搜索市场商品（原有逻辑）
            items = await _crawler_instance.search(
                keyword=task_dict['keyword'],
                max_pages=task_dict['max_pages'],
                min_price=task_dict['min_price'],
                max_price=task_dict['max_price'],
                personal_only=bool(task_dict['personal_only'])
            )
        
        # 保存爬取结果
        conn = get_connection()
        cursor = conn.cursor()
        saved_count = 0
        
        for item in items:
            try:
                cursor.execute(
                    """INSERT OR IGNORE INTO crawled_items 
                       (task_id, item_id, title, price, seller_id, seller_name, location, want_count, image_url)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (task_id, item.get('商品ID'), item.get('商品标题'), item.get('商品价格'),
                     item.get('卖家ID'), item.get('卖家昵称'), item.get('发布地点'),
                     item.get('"想要"人数', 0), item.get('商品主图链接'))
                )
                if cursor.rowcount > 0:
                    saved_count += 1
            except Exception as e:
                print(f"保存商品失败: {e}")
        
        # 更新任务状态
        cursor.execute(
            "UPDATE crawler_tasks SET status = 'idle', last_run = ?, items_count = items_count + ? WHERE id = ?",
            (datetime.now().isoformat(), saved_count, task_id)
        )
        conn.commit()
        conn.close()
        
        return {"success": True, "message": f"爬取完成，新增 {saved_count} 个商品", "items_count": len(items)}
        
    except Exception as e:
        # 更新任务状态为错误
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE crawler_tasks SET status = 'error' WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=500, detail=f"爬取失败: {str(e)}")


@app.post("/api/crawler/tasks/{task_id}/stop")
def stop_crawler_task(task_id: int):
    """停止爬虫任务"""
    global _crawler_instance
    
    if _crawler_instance:
        _crawler_instance.stop()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE crawler_tasks SET status = 'idle' WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "已发送停止信号"}
    
    return {"success": False, "message": "没有正在运行的任务"}


@app.get("/api/crawler/logs")
def get_crawler_logs():
    """获取爬虫运行日志"""
    return {"logs": _crawler_logs}


# ========== 爬取结果管理 ==========

@app.get("/api/crawler/items")
def get_crawled_items(task_id: Optional[int] = None, synced: Optional[int] = None):
    """获取爬取的商品列表"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM crawled_items WHERE 1=1"
    params = []
    
    if task_id:
        query += " AND task_id = ?"
        params.append(task_id)
    if synced is not None:
        query += " AND synced_to_product = ?"
        params.append(synced)
    
    query += " ORDER BY crawled_at DESC"
    cursor.execute(query, params)
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"data": items}


@app.delete("/api/crawler/items/{item_id}")
def delete_crawled_item(item_id: int):
    """删除爬取的商品"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM crawled_items WHERE id = ?", (item_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="商品不存在")
    conn.commit()
    conn.close()
    return {"message": "删除成功"}


@app.post("/api/crawler/items/{item_id}/sync")
def sync_crawled_item_to_product(item_id: int, account_id: Optional[int] = None):
    """将爬取的商品同步到商品追踪表"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM crawled_items WHERE id = ?", (item_id,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="商品不存在")
    
    item_dict = dict(item)
    
    cursor.execute(
        """INSERT INTO products (title, price, description, image_path, account_id)
           VALUES (?, ?, ?, ?, ?)""",
        (item_dict['title'], item_dict['price'], 
         f"从闲鱼爬取 - 卖家: {item_dict['seller_name']}", 
         item_dict['image_url'], account_id)
    )
    product_id = cursor.lastrowid
    
    cursor.execute("UPDATE crawled_items SET synced_to_product = 1 WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    
    return {"message": "同步成功", "product_id": product_id}


if __name__ == "__main__":
    import uvicorn
    # 为什么用 uvicorn：FastAPI 官方推荐的 ASGI 服务器
    uvicorn.run(app, host="0.0.0.0", port=8000)
