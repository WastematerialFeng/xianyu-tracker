"use client";

/**
 * 闲鱼爬虫管理页面
 * 功能：管理爬虫任务、配置登录状态、查看爬取结果
 */

import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

// 类型定义
interface CrawlerTask {
  id: number;
  name: string;
  keyword: string;
  min_price: number | null;
  max_price: number | null;
  personal_only: number;
  max_pages: number;
  status: string;
  last_run: string | null;
  items_count: number;
  created_at: string;
}

interface CrawledItem {
  id: number;
  task_id: number;
  item_id: string;
  title: string;
  price: number;
  seller_id: string;
  seller_name: string;
  location: string;
  want_count: number;
  image_url: string;
  crawled_at: string;
  synced_to_product: number;
}

export default function CrawlerPage() {
  // 状态
  const [tasks, setTasks] = useState<CrawlerTask[]>([]);
  const [items, setItems] = useState<CrawledItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loginStatus, setLoginStatus] = useState<{valid: boolean; message: string} | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "items" | "login">("tasks");
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);
  
  // 新建任务表单
  const [newTask, setNewTask] = useState({
    name: "",
    keyword: "",
    min_price: "",
    max_price: "",
    personal_only: false,
    max_pages: 1,
  });
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  
  // Cookie 输入
  const [cookieInput, setCookieInput] = useState("");

  // 加载数据
  useEffect(() => {
    loadTasks();
    checkLoginStatus();
  }, []);

  // 轮询日志（当有任务运行时）
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (runningTaskId) {
      interval = setInterval(loadLogs, 2000);
    }
    return () => clearInterval(interval);
  }, [runningTaskId]);

  const loadTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crawler/tasks`);
      const data = await res.json();
      setTasks(data.data || []);
    } catch (e) {
      console.error("加载任务失败:", e);
    }
  };

  const loadItems = async (taskId?: number) => {
    try {
      const url = taskId 
        ? `${API_BASE}/api/crawler/items?task_id=${taskId}`
        : `${API_BASE}/api/crawler/items`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.data || []);
    } catch (e) {
      console.error("加载商品失败:", e);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crawler/logs`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.error("加载日志失败:", e);
    }
  };

  const checkLoginStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crawler/login-state/check`);
      const data = await res.json();
      setLoginStatus(data);
    } catch (e) {
      setLoginStatus({ valid: false, message: "检查失败" });
    }
  };

  // 创建任务
  const handleCreateTask = async () => {
    if (!newTask.name || !newTask.keyword) {
      alert("请填写任务名称和关键词");
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/crawler/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTask,
          min_price: newTask.min_price ? parseFloat(newTask.min_price) : null,
          max_price: newTask.max_price ? parseFloat(newTask.max_price) : null,
        }),
      });
      
      if (res.ok) {
        setShowNewTaskForm(false);
        setNewTask({ name: "", keyword: "", min_price: "", max_price: "", personal_only: false, max_pages: 1 });
        loadTasks();
      }
    } catch (e) {
      alert("创建失败");
    }
  };

  // 执行任务
  const handleRunTask = async (taskId: number) => {
    if (!loginStatus?.valid) {
      alert("请先配置登录状态");
      setActiveTab("login");
      return;
    }
    
    setRunningTaskId(taskId);
    setLogs([]);
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/crawler/tasks/${taskId}/run`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        loadTasks();
        loadItems(taskId);
      } else {
        alert(data.detail || "执行失败");
      }
    } catch (e) {
      alert("执行失败");
    } finally {
      setRunningTaskId(null);
      setLoading(false);
    }
  };

  // 停止任务
  const handleStopTask = async (taskId: number) => {
    try {
      await fetch(`${API_BASE}/api/crawler/tasks/${taskId}/stop`, { method: "POST" });
      setRunningTaskId(null);
      loadTasks();
    } catch (e) {
      console.error("停止失败:", e);
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("确定删除此任务？相关爬取结果也会被删除")) return;
    
    try {
      await fetch(`${API_BASE}/api/crawler/tasks/${taskId}`, { method: "DELETE" });
      loadTasks();
    } catch (e) {
      alert("删除失败");
    }
  };

  // 保存登录状态
  const handleSaveLoginState = async () => {
    if (!cookieInput.trim()) {
      alert("请粘贴 Cookie 数据");
      return;
    }
    
    try {
      const cookieData = JSON.parse(cookieInput);
      const res = await fetch(`${API_BASE}/api/crawler/login-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cookieData),
      });
      
      if (res.ok) {
        alert("保存成功");
        setCookieInput("");
        checkLoginStatus();
      } else {
        alert("保存失败");
      }
    } catch (e) {
      alert("Cookie 格式错误，请确保是有效的 JSON");
    }
  };

  // 同步商品到追踪
  const handleSyncItem = async (itemId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/crawler/items/${itemId}/sync`, {
        method: "POST",
      });
      if (res.ok) {
        alert("同步成功");
        loadItems();
      }
    } catch (e) {
      alert("同步失败");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 头部 */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-blue-600 hover:underline text-sm">
              ← 返回首页
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">闲鱼爬虫管理</h1>
            <p className="text-gray-600 text-sm mt-1">自动获取闲鱼商品数据</p>
          </div>
          
          {/* 登录状态指示 */}
          <div className={`px-4 py-2 rounded-lg ${loginStatus?.valid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {loginStatus?.valid ? "✓ 已登录" : "✗ 未登录"}
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "tasks", label: "爬虫任务" },
            { key: "items", label: "爬取结果" },
            { key: "login", label: "登录配置" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                if (tab.key === "items") loadItems();
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 任务列表 */}
        {activeTab === "tasks" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">爬虫任务</h2>
              <button
                onClick={() => setShowNewTaskForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + 新建任务
              </button>
            </div>

            {/* 新建任务表单 */}
            {showNewTaskForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">新建爬虫任务</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="任务名称"
                    value={newTask.name}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-gray-900"
                  />
                  <input
                    type="text"
                    placeholder="搜索关键词"
                    value={newTask.keyword}
                    onChange={(e) => setNewTask({ ...newTask, keyword: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-gray-900"
                  />
                  <input
                    type="number"
                    placeholder="最低价格"
                    value={newTask.min_price}
                    onChange={(e) => setNewTask({ ...newTask, min_price: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-gray-900"
                  />
                  <input
                    type="number"
                    placeholder="最高价格"
                    value={newTask.max_price}
                    onChange={(e) => setNewTask({ ...newTask, max_price: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-gray-900"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="personal_only"
                      checked={newTask.personal_only}
                      onChange={(e) => setNewTask({ ...newTask, personal_only: e.target.checked })}
                    />
                    <label htmlFor="personal_only" className="text-gray-700">仅个人闲置</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-gray-700">页数:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newTask.max_pages}
                      onChange={(e) => setNewTask({ ...newTask, max_pages: parseInt(e.target.value) || 1 })}
                      className="w-20 px-3 py-2 border rounded-lg text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleCreateTask} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    创建
                  </button>
                  <button onClick={() => setShowNewTaskForm(false)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 任务列表 */}
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无任务，点击上方按钮创建</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{task.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          task.status === "running" ? "bg-blue-100 text-blue-800" :
                          task.status === "error" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {task.status === "running" ? "运行中" : task.status === "error" ? "错误" : "空闲"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        关键词: {task.keyword} | 
                        价格: {task.min_price || 0} - {task.max_price || "不限"} |
                        已爬取: {task.items_count} 个
                      </p>
                      {task.last_run && (
                        <p className="text-xs text-gray-400 mt-1">上次运行: {new Date(task.last_run).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {task.status === "running" ? (
                        <button
                          onClick={() => handleStopTask(task.id)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          停止
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRunTask(task.id)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm disabled:opacity-50"
                        >
                          执行
                        </button>
                      )}
                      <button
                        onClick={() => { loadItems(task.id); setActiveTab("items"); }}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        查看结果
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 运行日志 */}
            {logs.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-2">运行日志</h3>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-48 overflow-y-auto font-mono text-sm">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 爬取结果 */}
        {activeTab === "items" && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">爬取结果 ({items.length} 个)</h2>
              <button onClick={() => loadItems()} className="text-blue-600 hover:underline text-sm">
                刷新
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无爬取结果</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg overflow-hidden">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.title} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-3">
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{item.title}</h3>
                      <p className="text-red-600 font-bold mt-1">¥{item.price}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.seller_name} · {item.location} · {item.want_count}人想要
                      </p>
                      <div className="flex gap-2 mt-2">
                        {item.synced_to_product ? (
                          <span className="text-xs text-green-600">已同步</span>
                        ) : (
                          <button
                            onClick={() => handleSyncItem(item.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            同步到追踪
                          </button>
                        )}
                        <a
                          href={`https://www.goofish.com/item?id=${item.item_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:underline"
                        >
                          查看原链接
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 登录配置 */}
        {activeTab === "login" && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">登录状态配置</h2>
            
            <div className={`p-4 rounded-lg mb-6 ${loginStatus?.valid ? "bg-green-50" : "bg-yellow-50"}`}>
              <p className={loginStatus?.valid ? "text-green-800" : "text-yellow-800"}>
                {loginStatus?.message}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">获取登录状态</h3>
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li>安装 Chrome 扩展: <a href="https://chromewebstore.google.com/detail/xianyu-login-state-extrac/eidlpfjiodpigmfcahkmlenhppfklcoa" target="_blank" className="text-blue-600 hover:underline">闲鱼登录状态提取</a></li>
                  <li>在 Chrome 中打开并登录 <a href="https://www.goofish.com" target="_blank" className="text-blue-600 hover:underline">闲鱼网页版</a></li>
                  <li>点击扩展图标，点击"提取登录状态"</li>
                  <li>点击"复制到剪贴板"</li>
                  <li>将内容粘贴到下方输入框</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">粘贴 Cookie 数据 (JSON 格式)</label>
                <textarea
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder='{"cookies": [...], "origins": [...]}'
                  className="w-full h-40 px-3 py-2 border rounded-lg font-mono text-sm text-gray-900"
                />
              </div>

              <button
                onClick={handleSaveLoginState}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存登录状态
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
