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
    
    # 商品表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT,
            price REAL,
            description TEXT,
            image_original INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active'
        )
    """)
    
    # 每日数据记录表（用于后续功能）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            record_date DATE NOT NULL,
            views INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            inquiries INTEGER DEFAULT 0,
            favorites INTEGER DEFAULT 0,
            FOREIGN KEY (product_id) REFERENCES products(id),
            UNIQUE(product_id, record_date)
        )
    """)
    
    conn.commit()
    conn.close()
    print("数据库初始化完成")


if __name__ == "__main__":
    init_db()
