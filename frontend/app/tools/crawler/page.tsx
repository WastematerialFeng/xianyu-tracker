"use client";

/**
 * 闲鱼爬虫管理页面
 * 功能：账号管理、商品管理
 */

import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

// 类型定义
interface CrawlerAccount {
  id: number;
  name: string;
  xianyu_id: string;
  status: string;
  cookie_count: number;
  last_sync: string | null;
  created_at: string;
}

interface CrawledItem {
  id: number;
  account_id: number;
  item_id: string;
  title: string;
  price: number;
  status: string;
  image_url: string;
  crawled_at: string;
  synced: number;
}

export default function CrawlerPage() {
  const [activeTab, setActiveTab] = useState<"accounts" | "items">("accounts");
  const [loading, setLoading] = useState(false);
  
  // 账号管理
  const [accounts, setAccounts] = useState<CrawlerAccount[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"qrcode" | "manual">("qrcode");
  
  // 扫码登录
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrSessionId, setQrSessionId] = useState("");
  const [qrStatus, setQrStatus] = useState<"idle" | "loading" | "ready" | "scanned" | "success" | "expired" | "error">("idle");
  const [newAccountName, setNewAccountName] = useState("");
  const [cookieInput, setCookieInput] = useState("");
  
  // 商品管理
  const [items, setItems] = useState<CrawledItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    loadAccounts();
    loadItems();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrSessionId && (qrStatus === "ready" || qrStatus === "scanned")) {
      interval = setInterval(checkQrStatus, 2000);
    }
    return () => clearInterval(interval);
  }, [qrSessionId, qrStatus]);

  const loadAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crawler/accounts`);
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (e) {
      console.error("加载账号失败", e);
    }
  };

  const loadItems = async () => {
    try {
      const url = selectedAccountId === "all" 
        ? `${API_BASE}/api/crawler/items`
        : `${API_BASE}/api/crawler/items?account_id=${selectedAccountId}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.data || []);
    } catch (e) {
      console.error("加载商品失败", e);
    }
  };

  const generateQrCode = async () => {
    setQrStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/crawler/qr-login/generate`, { method: "POST" });
      const data = await res.json();
      if (data.qr_code_url) {
        setQrCodeUrl(data.qr_code_url);
        setQrSessionId(data.session_id);
        setQrStatus("ready");
      } else {
        setQrStatus("error");
      }
    } catch (e) {
      setQrStatus("error");
    }
  };

  const checkQrStatus = async () => {
    if (!qrSessionId) return;
    try {
      const res = await fetch(`${API_BASE}/api/crawler/qr-login/status/${qrSessionId}`);
      const data = await res.json();
      if (data.status === "scanned") {
        setQrStatus("scanned");
      } else if (data.status === "success") {
        setQrStatus("success");
        await saveAccount(data.cookies, data.unb);
      } else if (data.status === "expired") {
        setQrStatus("expired");
      }
    } catch (e) {
      console.error("检查扫码状态失败", e);
    }
  };

  const saveAccount = async (cookies: string, xianyuId?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/crawler/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAccountName || `账号${accounts.length + 1}`,
          xianyu_id: xianyuId || "",
          cookies: cookies,
        }),
      });
      if (res.ok) {
        alert("账号添加成功！");
        setShowAddAccount(false);
        setNewAccountName("");
        setQrStatus("idle");
        setQrCodeUrl("");
        setCookieInput("");
        loadAccounts();
      } else {
        alert("保存失败");
      }
    } catch (e) {
      alert("保存失败");
    }
  };

  const handleManualSave = async () => {
    if (!cookieInput.trim()) {
      alert("请输入 Cookie");
      return;
    }
    await saveAccount(cookieInput);
  };

  const deleteAccount = async (id: number) => {
    if (!confirm("确定删除此账号？")) return;
    try {
      await fetch(`${API_BASE}/api/crawler/accounts/${id}`, { method: "DELETE" });
      loadAccounts();
    } catch (e) {
      alert("删除失败");
    }
  };

  const syncItems = async (accountId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/crawler/accounts/${accountId}/sync`, { method: "POST" });
      const data = await res.json();
      alert(data.message || "同步完成");
      loadItems();
      loadAccounts();
    } catch (e) {
      alert("同步失败");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (searchKeyword && !item.title.includes(searchKeyword)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900">← 返回首页</Link>
            <h1 className="text-xl font-bold text-gray-900">闲鱼爬虫管理</h1>
          </div>
          <button 
            onClick={() => { loadAccounts(); loadItems(); }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            刷新
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === "accounts" ? "bg-white text-blue-600 shadow" : "text-gray-600"
            }`}
          >
            账号管理
          </button>
          <button
            onClick={() => setActiveTab("items")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === "items" ? "bg-white text-blue-600 shadow" : "text-gray-600"
            }`}
          >
            商品管理
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "accounts" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">+ 添加新账号</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => { setLoginMethod("qrcode"); setShowAddAccount(true); }}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    loginMethod === "qrcode" && showAddAccount ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-gray-900">扫码登录</div>
                  <div className="text-sm text-gray-500">推荐方式</div>
                </button>
                <button
                  onClick={() => { setLoginMethod("manual"); setShowAddAccount(true); }}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    loginMethod === "manual" && showAddAccount ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-gray-900">手动输入</div>
                  <div className="text-sm text-gray-500">手动输入Cookie</div>
                </button>
              </div>

              {showAddAccount && loginMethod === "qrcode" && (
                <div className="border-t pt-6">
                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      {qrStatus === "idle" && (
                        <button onClick={generateQrCode} className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-blue-400">
                          <span className="text-4xl mb-2">📱</span>
                          <span>点击生成二维码</span>
                        </button>
                      )}
                      {qrStatus === "loading" && <div className="w-48 h-48 border rounded-xl flex items-center justify-center bg-gray-50"><span className="text-gray-500">生成中...</span></div>}
                      {(qrStatus === "ready" || qrStatus === "scanned") && qrCodeUrl && (
                        <div className="relative">
                          <img src={qrCodeUrl} alt="登录二维码" className="w-48 h-48 rounded-xl" />
                          {qrStatus === "scanned" && <div className="absolute inset-0 bg-green-500/80 rounded-xl flex items-center justify-center text-white font-medium">已扫码，请确认</div>}
                        </div>
                      )}
                      {qrStatus === "success" && <div className="w-48 h-48 border rounded-xl flex items-center justify-center bg-green-50 text-green-600 font-medium">登录成功！</div>}
                      {qrStatus === "expired" && <button onClick={generateQrCode} className="w-48 h-48 border rounded-xl flex flex-col items-center justify-center bg-red-50 text-red-500"><span>已过期</span><span className="text-sm">点击刷新</span></button>}
                      {qrStatus === "error" && <button onClick={generateQrCode} className="w-48 h-48 border rounded-xl flex flex-col items-center justify-center bg-red-50 text-red-500"><span>生成失败</span><span className="text-sm">点击重试</span></button>}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">账号名称（可选）</label>
                      <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="例如：主账号、店铺1" className="w-full px-4 py-2 border rounded-lg text-gray-900" />
                      <p className="mt-4 text-sm text-gray-500">请使用闲鱼 App 扫描二维码登录，登录成功后账号将自动保存。</p>
                    </div>
                  </div>
                </div>
              )}

              {showAddAccount && loginMethod === "manual" && (
                <div className="border-t pt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">账号名称（可选）</label>
                    <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="例如：主账号、店铺1" className="w-full px-4 py-2 border rounded-lg text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cookie</label>
                    <textarea value={cookieInput} onChange={(e) => setCookieInput(e.target.value)} placeholder="从浏览器复制完整的 Cookie 字符串..." rows={4} className="w-full px-4 py-2 border rounded-lg text-gray-900 font-mono text-sm" />
                  </div>
                  <button onClick={handleManualSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存账号</button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">账号列表</h2>
                <span className="text-sm text-gray-500">{accounts.length} 个账号</span>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">账号名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">闲鱼ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">上次同步</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accounts.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">暂无账号，请添加新账号</td></tr>
                  ) : accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900 font-medium">{account.name}</td>
                      <td className="px-6 py-4 text-gray-600">{account.xianyu_id || "-"}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${account.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{account.status === "active" ? "正常" : "已过期"}</span></td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{account.last_sync ? new Date(account.last_sync).toLocaleString() : "从未同步"}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => syncItems(account.id)} disabled={loading} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">同步商品</button>
                          <button onClick={() => deleteAccount(account.id)} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "items" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">商品管理</h2>
                <button onClick={() => loadItems()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">刷新</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">筛选账号</label>
                  <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value === "all" ? "all" : parseInt(e.target.value))} className="w-full px-4 py-2 border rounded-lg text-gray-900">
                    <option value="all">所有账号</option>
                    {accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">搜索商品</label>
                  <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="搜索商品标题..." className="w-full px-4 py-2 border rounded-lg text-gray-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">商品列表</h2>
                <span className="text-sm text-gray-500">{filteredItems.length} 个商品</span>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品图片</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品标题</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">价格</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">爬取时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">暂无商品数据</td></tr>
                  ) : filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">{item.image_url ? <img src={item.image_url} alt="" className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 bg-gray-100 rounded"></div>}</td>
                      <td className="px-6 py-4 text-gray-900 max-w-xs truncate">{item.title}</td>
                      <td className="px-6 py-4 text-red-600 font-medium">{item.price}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${item.synced ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{item.synced ? "已同步" : "未同步"}</span></td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{new Date(item.crawled_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
