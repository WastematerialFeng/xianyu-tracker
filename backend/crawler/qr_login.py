"""
闲鱼扫码登录工具
基于 xianyu-fahuo 项目的 qr_login.py 实现
"""

import asyncio
import time
import uuid
import json
import re
import hashlib
import base64
from io import BytesIO
from random import random
from typing import Optional, Dict, Any
import httpx
import qrcode
import qrcode.constants


def generate_headers():
    """生成请求头"""
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Referer': 'https://passport.goofish.com/',
        'Origin': 'https://passport.goofish.com',
    }


class QRLoginSession:
    """二维码登录会话"""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.status = 'waiting'  # waiting, scanned, success, expired, cancelled
        self.qr_code_url = None
        self.qr_content = None
        self.cookies = {}
        self.unb = None
        self.created_time = time.time()
        self.expire_time = 300  # 5分钟过期
        self.params = {}

    def is_expired(self) -> bool:
        return time.time() - self.created_time > self.expire_time

    def to_dict(self) -> Dict[str, Any]:
        return {
            'session_id': self.session_id,
            'status': self.status,
            'qr_code_url': self.qr_code_url,
            'created_time': self.created_time,
            'is_expired': self.is_expired()
        }


class QRLoginManager:
    """二维码登录管理器"""

    def __init__(self):
        self.sessions: Dict[str, QRLoginSession] = {}
        self.headers = generate_headers()
        self.host = "https://passport.goofish.com"
        self.api_mini_login = f"{self.host}/mini_login.htm"
        self.api_generate_qr = f"{self.host}/newlogin/qrcode/generate.do"
        self.api_scan_status = f"{self.host}/newlogin/qrcode/query.do"
        self.api_h5_tk = "https://h5api.m.goofish.com/h5/mtop.gaia.nodejs.gaia.idle.data.gw.v2.index.get/1.0/"
        self.proxy = None
        self.timeout = httpx.Timeout(connect=30.0, read=60.0, write=30.0, pool=60.0)

    def _cookie_marshal(self, cookies: dict) -> str:
        """将Cookie字典转换为字符串"""
        return "; ".join([f"{k}={v}" for k, v in cookies.items()])

    async def _get_mh5tk(self, session: QRLoginSession) -> dict:
        """获取m_h5_tk和m_h5_tk_enc"""
        data = {"bizScene": "home"}
        data_str = json.dumps(data, separators=(',', ':'))
        t = str(int(time.time() * 1000))
        app_key = "34839810"

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True, proxy=self.proxy) as client:
            resp = await client.get(self.api_h5_tk, headers=self.headers)
            cookies = {k: v for k, v in resp.cookies.items()}
            session.cookies.update(cookies)

            m_h5_tk = cookies.get("m_h5_tk", "")
            token = m_h5_tk.split("_")[0] if "_" in m_h5_tk else ""

            sign_input = f"{token}&{t}&{app_key}&{data_str}"
            sign = hashlib.md5(sign_input.encode()).hexdigest()

            params = {
                "jsv": "2.7.2",
                "appKey": app_key,
                "t": t,
                "sign": sign,
                "v": "1.0",
                "type": "originaljson",
                "dataType": "json",
                "timeout": 20000,
                "api": "mtop.gaia.nodejs.gaia.idle.data.gw.v2.index.get",
                "data": data_str,
            }

            await client.post(self.api_h5_tk, params=params, headers=self.headers, cookies=session.cookies)
            return cookies

    async def _get_login_params(self, session: QRLoginSession) -> dict:
        """获取二维码登录时需要的表单参数"""
        params = {
            "lang": "zh_cn",
            "appName": "xianyu",
            "appEntrance": "web",
            "styleType": "vertical",
            "bizParams": "",
            "notLoadSsoView": False,
            "notKeepLogin": False,
            "isMobile": False,
            "qrCodeFirst": False,
            "stie": 77,
            "rnd": random(),
        }

        async with httpx.AsyncClient(follow_redirects=True, timeout=self.timeout, proxy=self.proxy) as client:
            resp = await client.get(
                self.api_mini_login,
                params=params,
                cookies=session.cookies,
                headers=self.headers,
            )

            pattern = r"window\.viewData\s*=\s*(\{.*?\});"
            match = re.search(pattern, resp.text)
            if match:
                json_string = match.group(1)
                view_data = json.loads(json_string)
                data = view_data.get("loginFormData")
                if data:
                    data["umidTag"] = "SERVER"
                    session.params.update(data)
                    return data
            raise Exception("获取登录参数失败")

    async def generate_qr_code(self) -> Dict[str, Any]:
        """生成二维码"""
        try:
            session_id = str(uuid.uuid4())
            session = QRLoginSession(session_id)

            # 1. 获取m_h5_tk
            await self._get_mh5tk(session)

            # 2. 获取登录参数
            await self._get_login_params(session)

            # 3. 生成二维码
            async with httpx.AsyncClient(follow_redirects=True, timeout=self.timeout, proxy=self.proxy) as client:
                resp = await client.get(
                    self.api_generate_qr,
                    params=session.params,
                    headers=self.headers
                )

                results = resp.json()
                if results.get("content", {}).get("success") == True:
                    session.params.update({
                        "t": results["content"]["data"]["t"],
                        "ck": results["content"]["data"]["ck"],
                    })

                    qr_content = results["content"]["data"]["codeContent"]
                    session.qr_content = qr_content

                    # 生成二维码图片
                    qr = qrcode.QRCode(
                        version=5,
                        error_correction=qrcode.constants.ERROR_CORRECT_L,
                        box_size=10,
                        border=2,
                    )
                    qr.add_data(qr_content)
                    qr.make()

                    qr_img = qr.make_image()
                    buffer = BytesIO()
                    qr_img.save(buffer, format='PNG')
                    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
                    qr_data_url = f"data:image/png;base64,{qr_base64}"

                    session.qr_code_url = qr_data_url
                    session.status = 'waiting'
                    self.sessions[session_id] = session

                    # 启动状态监控
                    asyncio.create_task(self._monitor_qr_status(session_id))

                    return {
                        'success': True,
                        'session_id': session_id,
                        'qr_code_url': qr_data_url
                    }
                else:
                    raise Exception("获取登录二维码失败")

        except Exception as e:
            return {'success': False, 'message': f'生成二维码失败: {str(e)}'}

    async def _poll_qrcode_status(self, session: QRLoginSession) -> httpx.Response:
        """获取二维码扫描状态"""
        async with httpx.AsyncClient(follow_redirects=True, timeout=self.timeout, proxy=self.proxy) as client:
            resp = await client.post(
                self.api_scan_status,
                data=session.params,
                cookies=session.cookies,
                headers=self.headers,
            )
            return resp

    async def _monitor_qr_status(self, session_id: str):
        """监控二维码状态"""
        session = self.sessions.get(session_id)
        if not session:
            return

        max_wait_time = 300
        start_time = time.time()

        while time.time() - start_time < max_wait_time:
            try:
                if session_id not in self.sessions:
                    break

                resp = await self._poll_qrcode_status(session)
                qrcode_status = (
                    resp.json()
                    .get("content", {})
                    .get("data", {})
                    .get("qrCodeStatus")
                )

                if qrcode_status == "CONFIRMED":
                    session.status = 'success'
                    for k, v in resp.cookies.items():
                        session.cookies[k] = v
                        if k == 'unb':
                            session.unb = v
                    break
                elif qrcode_status == "NEW":
                    pass
                elif qrcode_status == "EXPIRED":
                    session.status = 'expired'
                    break
                elif qrcode_status == "SCANED":
                    if session.status == 'waiting':
                        session.status = 'scanned'
                else:
                    session.status = 'cancelled'
                    break

                await asyncio.sleep(0.8)

            except Exception:
                await asyncio.sleep(2)

        if session.status not in ['success', 'expired', 'cancelled']:
            session.status = 'expired'

    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """获取会话状态"""
        session = self.sessions.get(session_id)
        if not session:
            return {'status': 'not_found'}

        if session.is_expired() and session.status != 'success':
            session.status = 'expired'

        result = {
            'status': session.status,
            'session_id': session_id
        }

        if session.status == 'success' and session.cookies:
            result['cookies'] = self._cookie_marshal(session.cookies)
            result['unb'] = session.unb

        return result

    def get_session_cookies(self, session_id: str) -> Optional[Dict[str, str]]:
        """获取会话Cookie"""
        session = self.sessions.get(session_id)
        if session and session.status == 'success':
            return {
                'cookies': self._cookie_marshal(session.cookies),
                'unb': session.unb
            }
        return None


# 全局实例
qr_login_manager = QRLoginManager()
