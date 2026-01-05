"""
爬虫工具函数
"""
import asyncio
import random
import re
from datetime import datetime
from typing import Any, Optional


async def random_sleep(min_sec: float, max_sec: float):
    """
    随机延迟，模拟真实用户行为
    为什么需要：固定延迟容易被检测，随机延迟更像真人
    """
    delay = random.uniform(min_sec, max_sec)
    await asyncio.sleep(delay)


def log_time(message: str):
    """带时间戳的日志输出"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


async def safe_get(data: dict, *keys, default=None) -> Any:
    """
    安全获取嵌套字典的值
    为什么需要：API 返回的数据结构可能不完整，避免 KeyError
    """
    result = data
    for key in keys:
        if isinstance(result, dict):
            result = result.get(key, default)
        else:
            return default
    return result if result is not None else default


def get_link_unique_key(link: str) -> str:
    """
    从商品链接提取唯一标识（商品ID）
    用于去重判断
    """
    # 匹配 id= 参数
    match = re.search(r'id=(\d+)', link)
    if match:
        return match.group(1)
    # 匹配路径中的 ID
    match = re.search(r'/(\d{10,})', link)
    if match:
        return match.group(1)
    return link


def format_price(price_str: str) -> Optional[float]:
    """格式化价格字符串为浮点数"""
    if not price_str:
        return None
    try:
        # 移除货币符号和空格
        cleaned = re.sub(r'[¥￥\s,]', '', str(price_str))
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def format_registration_days(days: int) -> str:
    """格式化注册天数为可读文本"""
    if days <= 0:
        return "未知"
    if days < 30:
        return f"{days}天"
    if days < 365:
        months = days // 30
        return f"{months}个月"
    years = days // 365
    months = (days % 365) // 30
    if months > 0:
        return f"{years}年{months}个月"
    return f"{years}年"
