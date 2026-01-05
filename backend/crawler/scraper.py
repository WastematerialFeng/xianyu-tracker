"""
闲鱼爬虫核心逻辑
基于 Playwright 实现，参考 ai-goofish-monitor 项目

为什么用 Playwright：
1. 支持现代浏览器自动化
2. 可以拦截网络请求获取 API 数据
3. 支持移动设备模拟，更不容易被检测
"""
import asyncio
import json
from datetime import datetime
from urllib.parse import urlencode
from typing import Dict, List, Any, Optional, Callable

from playwright.async_api import (
    async_playwright,
    Response,
    TimeoutError as PlaywrightTimeoutError,
    BrowserContext,
    Page
)

from .config import (
    STATE_FILE,
    RUN_HEADLESS,
    API_URL_PATTERN,
    DETAIL_API_URL_PATTERN,
    ANTI_DETECT_CONFIG,
    ANTI_DETECT_SCRIPT,
    BROWSER_ARGS,
    DELAY_CONFIG,
)
from .utils import random_sleep, log_time, get_link_unique_key
from .parsers import parse_search_results, parse_item_detail


class XianyuCrawler:
    """
    闲鱼爬虫类
    
    使用方法：
    ```python
    crawler = XianyuCrawler()
    results = await crawler.search("关键词", max_pages=2)
    ```
    """
    
    def __init__(self, on_progress: Optional[Callable] = None):
        """
        初始化爬虫
        
        Args:
            on_progress: 进度回调函数，用于实时更新状态
        """
        self.on_progress = on_progress or (lambda msg: None)
        self.browser = None
        self.context = None
        self.is_running = False
        self.should_stop = False
    
    async def _report(self, message: str):
        """报告进度"""
        log_time(message)
        self.on_progress(message)
    
    async def check_login_state(self) -> bool:
        """
        检查登录状态是否有效
        
        Returns:
            bool: 登录状态是否有效
        """
        if not STATE_FILE.exists():
            await self._report("登录状态文件不存在")
            return False
        
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)
            
            # 检查是否有 cookies
            cookies = state.get('cookies', [])
            if not cookies:
                await self._report("登录状态文件中没有 Cookie")
                return False
            
            # 检查是否有闲鱼相关的 cookie
            xianyu_cookies = [c for c in cookies if 'goofish' in c.get('domain', '') or 'taobao' in c.get('domain', '')]
            if not xianyu_cookies:
                await self._report("未找到闲鱼相关的 Cookie")
                return False
            
            await self._report(f"找到 {len(xianyu_cookies)} 个闲鱼相关 Cookie")
            return True
            
        except Exception as e:
            await self._report(f"检查登录状态时出错: {e}")
            return False
    
    async def save_login_state(self, state_data: dict) -> bool:
        """
        保存登录状态
        
        Args:
            state_data: 从 Chrome 扩展获取的登录状态数据
        
        Returns:
            bool: 是否保存成功
        """
        try:
            with open(STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(state_data, f, ensure_ascii=False, indent=2)
            await self._report("登录状态保存成功")
            return True
        except Exception as e:
            await self._report(f"保存登录状态失败: {e}")
            return False
    
    async def _init_browser(self) -> bool:
        """初始化浏览器和上下文"""
        try:
            playwright = await async_playwright().start()
            
            # 启动浏览器
            self.browser = await playwright.chromium.launch(
                headless=RUN_HEADLESS,
                args=BROWSER_ARGS
            )
            
            # 创建上下文（带登录状态）
            context_options = {
                **ANTI_DETECT_CONFIG,
                "permissions": ['geolocation'],
                "geolocation": {'longitude': 121.4737, 'latitude': 31.2304},
                "color_scheme": 'light'
            }
            
            # 如果有登录状态文件，加载它
            if STATE_FILE.exists():
                context_options["storage_state"] = str(STATE_FILE)
            
            self.context = await self.browser.new_context(**context_options)
            
            # 注入反检测脚本
            await self.context.add_init_script(ANTI_DETECT_SCRIPT)
            
            await self._report("浏览器初始化成功")
            return True
            
        except Exception as e:
            await self._report(f"浏览器初始化失败: {e}")
            return False
    
    async def _close_browser(self):
        """关闭浏览器"""
        if self.browser:
            await self.browser.close()
            self.browser = None
            self.context = None
    
    def stop(self):
        """停止爬虫"""
        self.should_stop = True
        self.is_running = False
    
    async def search(
        self,
        keyword: str,
        max_pages: int = 1,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        personal_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        搜索闲鱼商品
        
        Args:
            keyword: 搜索关键词
            max_pages: 最大页数
            min_price: 最低价格
            max_price: 最高价格
            personal_only: 仅个人闲置
        
        Returns:
            商品列表
        """
        if self.is_running:
            await self._report("爬虫正在运行中，请等待完成")
            return []
        
        self.is_running = True
        self.should_stop = False
        all_items = []
        
        try:
            # 初始化浏览器
            if not await self._init_browser():
                return []
            
            page = await self.context.new_page()
            
            # 步骤 0: 先访问首页（反检测）
            await self._report("步骤 0: 访问首页模拟真实用户...")
            await page.goto("https://www.goofish.com/", wait_until="domcontentloaded", timeout=30000)
            await random_sleep(*DELAY_CONFIG["page_load"])
            
            # 模拟滚动
            await page.evaluate("window.scrollBy(0, Math.random() * 500 + 200)")
            await random_sleep(*DELAY_CONFIG["scroll"])
            
            # 步骤 1: 导航到搜索页
            await self._report(f"步骤 1: 搜索关键词 '{keyword}'...")
            params = {'q': keyword}
            search_url = f"https://www.goofish.com/search?{urlencode(params)}"
            
            # 捕获搜索 API 响应
            search_response = None
            async with page.expect_response(
                lambda r: API_URL_PATTERN in r.url, 
                timeout=30000
            ) as response_info:
                await page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
            search_response = await response_info.value
            
            # 等待页面加载
            await page.wait_for_selector('text=新发布', timeout=15000)
            await random_sleep(*DELAY_CONFIG["page_load"])
            
            # 检查反爬弹窗
            if await self._check_anti_crawl(page):
                await self._report("检测到反爬验证，停止爬取")
                return []
            
            # 步骤 2: 应用筛选条件
            await self._report("步骤 2: 应用筛选条件...")
            search_response = await self._apply_filters(
                page, search_response, min_price, max_price, personal_only
            )
            
            # 步骤 3: 解析商品列表
            await self._report("步骤 3: 开始解析商品...")
            
            for page_num in range(1, max_pages + 1):
                if self.should_stop:
                    await self._report("收到停止信号，终止爬取")
                    break
                
                await self._report(f"处理第 {page_num}/{max_pages} 页...")
                
                # 解析当前页
                if search_response and search_response.ok:
                    json_data = await search_response.json()
                    items = await parse_search_results(json_data, f"第 {page_num} 页")
                    all_items.extend(items)
                
                # 翻页
                if page_num < max_pages:
                    search_response = await self._go_next_page(page)
                    if not search_response:
                        await self._report("无法翻页，停止爬取")
                        break
                    await random_sleep(*DELAY_CONFIG["between_pages"])
            
            await self._report(f"搜索完成，共获取 {len(all_items)} 个商品")
            
        except PlaywrightTimeoutError as e:
            await self._report(f"操作超时: {e}")
        except Exception as e:
            await self._report(f"爬取出错: {e}")
        finally:
            await self._close_browser()
            self.is_running = False
        
        return all_items
    
    async def _check_anti_crawl(self, page: Page) -> bool:
        """检查是否触发反爬"""
        try:
            baxia = page.locator("div.baxia-dialog-mask")
            await baxia.wait_for(state='visible', timeout=2000)
            return True
        except PlaywrightTimeoutError:
            return False
    
    async def _apply_filters(
        self, page: Page, current_response: Response,
        min_price: Optional[float], max_price: Optional[float], personal_only: bool
    ) -> Response:
        """应用筛选条件"""
        response = current_response
        
        try:
            # 点击"新发布"排序
            await page.click('text=新发布')
            await random_sleep(*DELAY_CONFIG["filter_click"])
            
            async with page.expect_response(
                lambda r: API_URL_PATTERN in r.url, timeout=20000
            ) as resp_info:
                await page.click('text=最新')
                await random_sleep(*DELAY_CONFIG["filter_click"])
            response = await resp_info.value
            
            # 仅个人闲置
            if personal_only:
                async with page.expect_response(
                    lambda r: API_URL_PATTERN in r.url, timeout=20000
                ) as resp_info:
                    await page.click('text=个人闲置')
                    await random_sleep(*DELAY_CONFIG["filter_click"])
                response = await resp_info.value
            
            # 价格筛选
            if min_price or max_price:
                price_container = page.locator('div[class*="search-price-input-container"]').first
                if await price_container.is_visible():
                    if min_price:
                        await price_container.get_by_placeholder("¥").first.fill(str(min_price))
                        await random_sleep(1, 2)
                    if max_price:
                        await price_container.get_by_placeholder("¥").nth(1).fill(str(max_price))
                        await random_sleep(1, 2)
                    
                    async with page.expect_response(
                        lambda r: API_URL_PATTERN in r.url, timeout=20000
                    ) as resp_info:
                        await page.keyboard.press('Tab')
                        await random_sleep(*DELAY_CONFIG["filter_click"])
                    response = await resp_info.value
                    
        except Exception as e:
            await self._report(f"应用筛选条件时出错: {e}")
        
        return response
    
    async def _go_next_page(self, page: Page) -> Optional[Response]:
        """翻到下一页"""
        try:
            next_btn = page.locator("[class*='search-pagination-arrow-right']:not([class*='disabled'])")
            if not await next_btn.count():
                return None
            
            async with page.expect_response(
                lambda r: API_URL_PATTERN in r.url, timeout=20000
            ) as resp_info:
                await next_btn.click()
                await random_sleep(*DELAY_CONFIG["filter_click"])
            return await resp_info.value
            
        except PlaywrightTimeoutError:
            return None
