"use client";

import React, { useState, useEffect } from "react";
import { getProducts, deleteProduct, Product, getLatestStats, DailyStats, getAccounts, Account, createAccount, updateAccount, deleteAccount, getProductStats, createStats, deleteStats, getImageUrl } from "@/lib/api";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productStats, setProductStats] = useState<Record<number, DailyStats | null>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingAccountName, setEditingAccountName] = useState("");
  
  // 展开数据录入相关
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedStats, setExpandedStats] = useState<DailyStats[]>([]);
  const [statsForm, setStatsForm] = useState({
    record_date: new Date().toISOString().split("T")[0],
    exposures: "",
    views: "",
    favorites: "",
    inquiries: "",
  });

  const loadAccounts = async () => {
    const data = await getAccounts();
    setAccounts(data);
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
      // 加载每个商品的最新数据
      const statsMap: Record<number, DailyStats | null> = {};
      await Promise.all(data.map(async (p) => {
        statsMap[p.id] = await getLatestStats(p.id);
      }));
      setProductStats(statsMap);
    } catch (error) {
      console.error("加载失败:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAccounts();
    loadProducts();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("确定删除这个商品吗？")) {
      await deleteProduct(id);
      loadProducts();
    }
  };

  const handleCreateAccount = async () => {
    if (newAccountName.trim()) {
      await createAccount({ name: newAccountName.trim() });
      setNewAccountName("");
      setShowAccountModal(false);
      loadAccounts();
    }
  };

  const handleUpdateAccount = async () => {
    if (editingAccountId && editingAccountName.trim()) {
      await updateAccount(editingAccountId, { name: editingAccountName.trim() });
      setEditingAccountId(null);
      setEditingAccountName("");
      loadAccounts();
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (confirm("确定删除这个账号吗？关联的商品将变为未分配状态。")) {
      await deleteAccount(id);
      loadAccounts();
      loadProducts();
    }
  };

  const getAccountName = (accountId: number | null) => {
    if (!accountId) return "未分配";
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : "未知账号";
  };

  // 展开/收起商品数据录入
  const handleExpand = async (productId: number) => {
    if (expandedId === productId) {
      setExpandedId(null);
      setExpandedStats([]);
    } else {
      setExpandedId(productId);
      const stats = await getProductStats(productId);
      setExpandedStats(stats || []);
      setStatsForm({
        record_date: new Date().toISOString().split("T")[0],
        exposures: "",
        views: "",
        favorites: "",
        inquiries: "",
      });
    }
  };

  // 保存数据记录
  const handleSaveStats = async (productId: number) => {
    await createStats({
      product_id: productId,
      record_date: statsForm.record_date,
      exposures: statsForm.exposures ? parseInt(statsForm.exposures) : 0,
      views: statsForm.views ? parseInt(statsForm.views) : 0,
      favorites: statsForm.favorites ? parseInt(statsForm.favorites) : 0,
      inquiries: statsForm.inquiries ? parseInt(statsForm.inquiries) : 0,
    });
    // 刷新展开区域数据
    const stats = await getProductStats(productId);
    setExpandedStats(stats || []);
    // 刷新主页最新数据
    const latest = await getLatestStats(productId);
    setProductStats(prev => ({ ...prev, [productId]: latest }));
    // 清空表单
    setStatsForm({ ...statsForm, exposures: "", views: "", favorites: "", inquiries: "" });
  };

  // 删除数据记录
  const handleDeleteStats = async (statId: number, productId: number) => {
    if (confirm("确定删除这条记录吗？")) {
      await deleteStats(statId);
      const stats = await getProductStats(productId);
      setExpandedStats(stats || []);
      const latest = await getLatestStats(productId);
      setProductStats(prev => ({ ...prev, [productId]: latest }));
    }
  };

  const filteredProducts = products
    .filter((p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => accountFilter === "all" || p.account_id === accountFilter)
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "price_high") return (b.price || 0) - (a.price || 0);
      if (sortBy === "price_low") return (a.price || 0) - (b.price || 0);
      return 0;
    });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">闲鱼发品追踪器</h1>
          <div className="flex gap-3">
            <Link
              href="/tools/crawler"
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              闲鱼爬虫
            </Link>
            <Link
              href="/tools/image-generator"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              AI 生图
            </Link>
            <Link
            href="/products/new"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition-all font-medium"
          >
            + 添加商品
          </Link>
          </div>
        </div>

        {/* 搜索栏和筛选器 */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="搜索商品标题或品类..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] max-w-md px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder-gray-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 bg-white"
          >
            <option value="all">全部状态</option>
            <option value="在售">在售</option>
            <option value="已售">已售</option>
            <option value="下架">下架</option>
          </select>
          <select
            value={accountFilter === "all" ? "all" : accountFilter.toString()}
            onChange={(e) => setAccountFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 bg-white"
          >
            <option value="all">全部账号</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAccountModal(true)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 bg-white"
            title="管理账号"
          >
            + 账号
          </button>
          {/* 导出按钮 */}
          <div className="relative group">
            <button className="px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 bg-white">
              导出 ▼
            </button>
            <div className="absolute right-0 top-full w-40 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10">
              <a href="http://localhost:8000/api/export/products" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg">导出商品列表</a>
              <a href="http://localhost:8000/api/export/stats" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-b-lg">导出数据记录</a>
            </div>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 bg-white"
          >
            <option value="newest">最新添加</option>
            <option value="oldest">最早添加</option>
            <option value="price_high">价格从高到低</option>
            <option value="price_low">价格从低到高</option>
          </select>
        </div>

        {/* 内容区域 */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* 表头始终显示 */}
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">商品主图</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">商品标题</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">品类</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">价格</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">状态</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">浏览/想要</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>加载中...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      {/* 空状态插画 */}
                      <svg className="w-24 h-24 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <div className="text-center">
                        <p className="text-lg font-medium text-gray-600">暂无追踪商品</p>
                        <p className="text-gray-500 mt-1">快去添加第一个爆款吧！</p>
                      </div>
                      <Link
                        href="/products/new"
                        className="mt-2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition-all font-medium"
                      >
                        + 添加商品
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <React.Fragment key={product.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        {product.image_path ? (
                          <img 
                            src={getImageUrl(product.image_path) || ""} 
                            alt={product.title}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900">{product.title}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                          {product.category || "未分类"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-orange-600">
                          {product.price ? `¥${product.price}` : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block px-2 py-1 text-sm rounded ${
                          product.status === "在售" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-sm">
                        <span>
                          {productStats[product.id] 
                            ? `${productStats[product.id]?.views || 0} / ${productStats[product.id]?.favorites || 0}`
                            : "- / -"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleExpand(product.id)}
                            className={`font-medium ${expandedId === product.id ? "text-green-600 hover:text-green-800" : "text-gray-500 hover:text-gray-700"}`}
                          >
                            {expandedId === product.id ? "收起" : "数据"}
                          </button>
                          <Link
                            href={`/products/${product.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            编辑
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-500 hover:text-red-700 font-medium"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* 展开区域 */}
                    {expandedId === product.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50 border-t border-b border-gray-200">
                          <div className="space-y-4">
                            {/* 数据录入表单 */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <input type="date" value={statsForm.record_date} onChange={(e) => setStatsForm({...statsForm, record_date: e.target.value})} className="border border-gray-300 px-3 py-2 rounded-lg text-gray-900 text-sm" />
                              <input type="number" placeholder="曝光" value={statsForm.exposures} onChange={(e) => setStatsForm({...statsForm, exposures: e.target.value})} className="w-20 border border-gray-300 px-3 py-2 rounded-lg text-gray-900 text-sm" />
                              <input type="number" placeholder="浏览" value={statsForm.views} onChange={(e) => setStatsForm({...statsForm, views: e.target.value})} className="w-20 border border-gray-300 px-3 py-2 rounded-lg text-gray-900 text-sm" />
                              <input type="number" placeholder="想要" value={statsForm.favorites} onChange={(e) => setStatsForm({...statsForm, favorites: e.target.value})} className="w-20 border border-gray-300 px-3 py-2 rounded-lg text-gray-900 text-sm" />
                              <input type="number" placeholder="咨询" value={statsForm.inquiries} onChange={(e) => setStatsForm({...statsForm, inquiries: e.target.value})} className="w-20 border border-gray-300 px-3 py-2 rounded-lg text-gray-900 text-sm" />
                              <button onClick={() => handleSaveStats(product.id)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">保存</button>
                            </div>
                            
                            {/* 趋势图表 */}
                            {expandedStats.length > 1 && (
                              <div className="grid grid-cols-2 gap-4">
                                {/* 累计数据趋势 */}
                                <div className="bg-white p-4 rounded-lg">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">累计数据趋势</h4>
                                  <ResponsiveContainer width="100%" height={150}>
                                    <LineChart data={[...expandedStats].sort((a, b) => a.record_date.localeCompare(b.record_date))}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                      <XAxis dataKey="record_date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                                      <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                                      <Tooltip contentStyle={{ fontSize: 12 }} />
                                      <Legend wrapperStyle={{ fontSize: 10 }} />
                                      <Line type="monotone" dataKey="views" name="浏览量(累计)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="favorites" name="想要数(累计)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="exposures" name="曝光量" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="inquiries" name="咨询数" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                                {/* 每日增长趋势 */}
                                <div className="bg-white p-4 rounded-lg">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">每日增长趋势</h4>
                                  <ResponsiveContainer width="100%" height={150}>
                                    <LineChart data={(() => {
                                      const sorted = [...expandedStats].sort((a, b) => a.record_date.localeCompare(b.record_date));
                                      return sorted.map((stat, idx) => {
                                        const prev = idx > 0 ? sorted[idx - 1] : null;
                                        return {
                                          record_date: stat.record_date,
                                          exposures: stat.exposures || 0,
                                          inquiries: stat.inquiries,
                                          views_growth: prev ? stat.views - prev.views : stat.views,
                                          favorites_growth: prev ? stat.favorites - prev.favorites : stat.favorites,
                                        };
                                      });
                                    })()}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                      <XAxis dataKey="record_date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                                      <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                                      <Tooltip contentStyle={{ fontSize: 12 }} />
                                      <Legend wrapperStyle={{ fontSize: 10 }} />
                                      <Line type="monotone" dataKey="views_growth" name="浏览增长" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="favorites_growth" name="想要增长" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="exposures" name="曝光量" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="inquiries" name="咨询数" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            )}

                            {/* 历史记录 */}
                            {expandedStats.length > 0 ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 text-left">
                                    <th className="py-2">日期</th><th>曝光</th><th>浏览</th><th>想要</th><th>咨询</th><th>操作</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedStats.slice(0, 5).map((stat) => (
                                    <tr key={stat.id} className="text-gray-700">
                                      <td className="py-1">{stat.record_date}</td>
                                      <td>{stat.exposures || 0}</td>
                                      <td>{stat.views}</td>
                                      <td>{stat.favorites}</td>
                                      <td>{stat.inquiries}</td>
                                      <td><button onClick={() => handleDeleteStats(stat.id, product.id)} className="text-red-500 hover:text-red-700">删除</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-gray-500 text-sm">暂无数据记录</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 账号管理弹窗 */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">添加新账号</h3>
            <input
              type="text"
              placeholder="账号名称（如：主账号、小号1）"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowAccountModal(false); setNewAccountName(""); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleCreateAccount}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                添加
              </button>
            </div>
            {accounts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-2">已有账号：</p>
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                      {editingAccountId === account.id ? (
                        <>
                          <input
                            type="text"
                            value={editingAccountName}
                            onChange={(e) => setEditingAccountName(e.target.value)}
                            className="flex-1 border border-gray-300 px-2 py-1 rounded text-gray-900 text-sm"
                            autoFocus
                          />
                          <div className="flex gap-2 ml-2">
                            <button onClick={handleUpdateAccount} className="text-green-600 hover:text-green-800 text-sm">保存</button>
                            <button onClick={() => { setEditingAccountId(null); setEditingAccountName(""); }} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-700 text-sm">{account.name}</span>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingAccountId(account.id); setEditingAccountName(account.name); }} className="text-blue-600 hover:text-blue-800 text-sm">编辑</button>
                            <button onClick={() => handleDeleteAccount(account.id)} className="text-red-500 hover:text-red-700 text-sm">删除</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
