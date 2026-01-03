"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getProduct, updateProduct, getProductStats, createStats, deleteStats, DailyStats } from "@/lib/api";
import Link from "next/link";

const CATEGORIES = [
  "数码产品", "手机配件", "电脑硬件", "服饰鞋包", "美妆护肤",
  "家居用品", "母婴用品", "图书文具", "运动户外", "食品生鲜",
  "虚拟物品", "其他"
];

export default function EditProduct() {
  const router = useRouter();
  const params = useParams();
  const productId = Number(params.id);

  const [activeTab, setActiveTab] = useState<"info" | "stats">("info");
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    image_original: 0,
    status: "在售",
  });
  const [loading, setLoading] = useState(true);
  
  // 数据记录相关
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [statsForm, setStatsForm] = useState({
    record_date: new Date().toISOString().split("T")[0],
    exposures: "",
    views: "",
    clicks: "",
    inquiries: "",
    favorites: "",
  });

  useEffect(() => {
    const load = async () => {
      const product = await getProduct(productId);
      setForm({
        title: product.title,
        category: product.category || "",
        price: product.price?.toString() || "",
        description: product.description || "",
        image_original: product.image_original,
        status: product.status,
      });
      const statsData = await getProductStats(productId);
      setStats(statsData || []);
      setLoading(false);
    };
    load();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProduct(productId, {
      title: form.title,
      category: form.category || undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      description: form.description || undefined,
      image_original: form.image_original,
      status: form.status,
    });
    router.push("/");
  };

  const handleStatsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createStats({
      product_id: productId,
      record_date: statsForm.record_date,
      exposures: statsForm.exposures ? parseInt(statsForm.exposures) : 0,
      views: statsForm.views ? parseInt(statsForm.views) : 0,
      clicks: statsForm.clicks ? parseInt(statsForm.clicks) : 0,
      inquiries: statsForm.inquiries ? parseInt(statsForm.inquiries) : 0,
      favorites: statsForm.favorites ? parseInt(statsForm.favorites) : 0,
    });
    const statsData = await getProductStats(productId);
    setStats(statsData || []);
    setStatsForm({ ...statsForm, exposures: "", views: "", clicks: "", inquiries: "", favorites: "" });
  };

  const handleDeleteStats = async (id: number) => {
    if (confirm("确定删除这条记录吗？")) {
      await deleteStats(id);
      const statsData = await getProductStats(productId);
      setStats(statsData || []);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-100 p-8 flex items-center justify-center"><p className="text-gray-500">加载中...</p></div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900">商品详情</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">← 返回列表</Link>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 mb-6 bg-gray-200 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === "info" ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"}`}
          >
            基本信息
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === "stats" ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"}`}
          >
            数据记录
          </button>
        </div>

        {/* 基本信息 Tab */}
        {activeTab === "info" && (
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">商品标题 *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">品类</label>
                <input
                  type="text"
                  list="category-list"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <datalist id="category-list">
                  {CATEGORIES.map((cat) => <option key={cat} value={cat} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">价格</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full border border-gray-300 p-3 pl-8 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">状态</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="在售">在售</option>
                <option value="已售">已售</option>
                <option value="下架">下架</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">商品文案</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-32 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="image_original"
                checked={form.image_original === 1}
                onChange={(e) => setForm({ ...form, image_original: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="image_original" className="text-sm text-gray-700">图片为原创拍摄</label>
            </div>
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
              <Link href="/" className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">取消</Link>
              <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 font-medium">保存修改</button>
            </div>
          </form>
        )}

        {/* 数据记录 Tab */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            {/* 添加记录表单 */}
            <form onSubmit={handleStatsSubmit} className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">添加数据记录</h3>
              <div className="grid grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                  <input
                    type="date"
                    value={statsForm.record_date}
                    onChange={(e) => setStatsForm({ ...statsForm, record_date: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded-lg text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">曝光量</label>
                  <input
                    type="number"
                    min="0"
                    value={statsForm.exposures}
                    onChange={(e) => setStatsForm({ ...statsForm, exposures: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-300 p-2 rounded-lg text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">浏览量</label>
                  <input
                    type="number"
                    min="0"
                    value={statsForm.views}
                    onChange={(e) => setStatsForm({ ...statsForm, views: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-300 p-2 rounded-lg text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">想要数</label>
                  <input
                    type="number"
                    min="0"
                    value={statsForm.favorites}
                    onChange={(e) => setStatsForm({ ...statsForm, favorites: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-300 p-2 rounded-lg text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">咨询数</label>
                  <input
                    type="number"
                    min="0"
                    value={statsForm.inquiries}
                    onChange={(e) => setStatsForm({ ...statsForm, inquiries: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-300 p-2 rounded-lg text-gray-900"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
                    记录
                  </button>
                </div>
              </div>
            </form>

            {/* 历史记录表格 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">日期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">曝光量</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">浏览量</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">想要数</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">咨询数</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">暂无数据记录</td>
                    </tr>
                  ) : (
                    stats.map((stat) => (
                      <tr key={stat.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{stat.record_date}</td>
                        <td className="px-4 py-3 text-gray-900">{stat.exposures || 0}</td>
                        <td className="px-4 py-3 text-gray-900">{stat.views}</td>
                        <td className="px-4 py-3 text-gray-900">{stat.favorites}</td>
                        <td className="px-4 py-3 text-gray-900">{stat.inquiries}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteStats(stat.id)} className="text-red-500 hover:text-red-700 font-medium">删除</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
