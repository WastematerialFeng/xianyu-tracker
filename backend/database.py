"""
数据库模型定义
使用 SQLite - 为什么用：符合 AGENTS.md 规范，本地项目优先，无需额外配置
"""
import sqlite3
from datetime import datetime
from pathlib import Path

# 数据库文件路径
DB_PATH = Path(__file__).parent.parent / "data" / "xianyu.db"


def get_connection():
    """获取数据库连接"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # 返回字典格式
    return conn


def init_db():
    """初始化数据库表"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 账号表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            xianyu_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 商品表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            title TEXT NOT NULL,
            category TEXT,
            price REAL,
            description TEXT,
            image_original INTEGER DEFAULT 0,
            image_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    """)
    
    # 每日数据记录表（用于后续功能）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            record_date DATE NOT NULL,
            exposures INTEGER DEFAULT 0,
            views INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            inquiries INTEGER DEFAULT 0,
            favorites INTEGER DEFAULT 0,
            FOREIGN KEY (product_id) REFERENCES products(id),
            UNIQUE(product_id, record_date)
        )
    """)
    
    # 爬虫任务表
    # 为什么需要：管理多个爬取任务，支持不同关键词和筛选条件
    # task_type: search=搜索市场商品, my_items=我的商品
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS crawler_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            task_type TEXT DEFAULT 'search',
            keyword TEXT,
            min_price REAL,
            max_price REAL,
            personal_only INTEGER DEFAULT 0,
            max_pages INTEGER DEFAULT 1,
            status TEXT DEFAULT 'idle',
            last_run DATETIME,
            items_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 爬取的商品数据表
    # 为什么需要：存储从闲鱼爬取的原始商品数据，与手动录入的商品分开管理
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS crawled_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            item_id TEXT UNIQUE,
            title TEXT,
            price REAL,
            seller_id TEXT,
            seller_name TEXT,
            location TEXT,
            want_count INTEGER DEFAULT 0,
            image_url TEXT,
            images TEXT,
            detail_data TEXT,
            crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            synced_to_product INTEGER DEFAULT 0,
            FOREIGN KEY (task_id) REFERENCES crawler_tasks(id)
        )
    """)
    
    # 检查 products 表是否有 images 字段，没有则添加
    cursor.execute("PRAGMA table_info(products)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'images' not in columns:
        cursor.execute("ALTER TABLE products ADD COLUMN images TEXT")
        print("已添加 products.images 字段")
    
    # 检查 products 表是否有 xianyu_item_id 字段（用于关联闲鱼商品ID）
    if 'xianyu_item_id' not in columns:
        cursor.execute("ALTER TABLE products ADD COLUMN xianyu_item_id TEXT")
        print("已添加 products.xianyu_item_id 字段")
    
    # 检查 crawler_tasks 表是否有 task_type 字段
    cursor.execute("PRAGMA table_info(crawler_tasks)")
    task_columns = [col[1] for col in cursor.fetchall()]
    if 'task_type' not in task_columns:
        cursor.execute("ALTER TABLE crawler_tasks ADD COLUMN task_type TEXT DEFAULT 'search'")
        print("已添加 crawler_tasks.task_type 字段")
    
    conn.commit()
    conn.close()
    print("数据库初始化完成")


if __name__ == "__main__":
    init_db()
