"""
爬虫配置文件
为什么单独配置：便于管理反检测参数、API 模式等，不影响主程序
"""
import os
from pathlib import Path

# 状态文件路径（存储登录 Cookie）
STATE_DIR = Path(__file__).parent.parent / "state"
STATE_FILE = STATE_DIR / "xianyu_state.json"

# 确保目录存在
STATE_DIR.mkdir(parents=True, exist_ok=True)

# 运行模式
RUN_HEADLESS = os.getenv("CRAWLER_HEADLESS", "false").lower() == "true"  # 默认非无头，更不容易被检测

# API URL 匹配模式（用于拦截闲鱼内部 API）
API_URL_PATTERN = "mtop.idle.web.search"  # 搜索结果 API
DETAIL_API_URL_PATTERN = "mtop.idle.web.item.detail"  # 商品详情 API
USER_HEAD_API_PATTERN = "mtop.idle.web.user.page.head"  # 用户信息 API

# 反检测配置
ANTI_DETECT_CONFIG = {
    # 移动设备模拟（模拟 Android 手机访问）
    "user_agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    "viewport": {"width": 412, "height": 915},  # Pixel 5 尺寸
    "device_scale_factor": 2.625,
    "is_mobile": True,
    "has_touch": True,
    "locale": "zh-CN",
    "timezone_id": "Asia/Shanghai",
}

# 反检测 JavaScript 脚本
ANTI_DETECT_SCRIPT = """
    // 移除 webdriver 标识
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    
    // 模拟真实移动设备的 navigator 属性
    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
    Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh', 'en-US', 'en']});
    
    // 添加 chrome 对象
    window.chrome = {runtime: {}, loadTimes: function() {}, csi: function() {}};
    
    // 模拟触摸支持
    Object.defineProperty(navigator, 'maxTouchPoints', {get: () => 5});
    
    // 覆盖 permissions 查询
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
            Promise.resolve({state: Notification.permission}) :
            originalQuery(parameters)
    );
"""

# 浏览器启动参数
BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
]

# 延迟配置（秒）- 用于模拟真实用户行为
DELAY_CONFIG = {
    "page_load": (3, 6),       # 页面加载后等待
    "scroll": (1, 2),          # 滚动后等待
    "filter_click": (2, 4),    # 点击筛选后等待
    "between_items": (15, 30), # 商品之间的间隔（最重要）
    "between_pages": (25, 50), # 翻页之间的间隔
}
