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


if __name__ == "__main__":
    import uvicorn
    # 为什么用 uvicorn：FastAPI 官方推荐的 ASGI 服务器
    uvicorn.run(app, host="0.0.0.0", port=8000)
