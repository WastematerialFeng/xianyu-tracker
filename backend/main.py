"""
FastAPI 主入口
为什么用 FastAPI：轻量、自带 API 文档、异步支持好，符合 AGENTS.md 规范
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_connection, init_db

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


class ProductUpdate(BaseModel):
    """更新商品的请求体"""
    title: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image_original: Optional[int] = None
    status: Optional[str] = None


# API 路由
@app.get("/")
def root():
    """健康检查"""
    return {"message": "闲鱼追踪器 API 运行中"}


@app.get("/api/products")
def get_products():
    """获取所有商品"""
    conn = get_connection()
    cursor = conn.cursor()
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
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO products (title, category, price, description, image_original)
           VALUES (?, ?, ?, ?, ?)""",
        (product.title, product.category, product.price, 
         product.description, product.image_original)
    )
    conn.commit()
    product_id = cursor.lastrowid
    conn.close()
    return {"message": "创建成功", "id": product_id}


@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: ProductUpdate):
    """更新商品"""
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
            updates.append(f"{field} = ?")
            values.append(value)
    
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


if __name__ == "__main__":
    import uvicorn
    # 为什么用 uvicorn：FastAPI 官方推荐的 ASGI 服务器
    uvicorn.run(app, host="0.0.0.0", port=8000)
