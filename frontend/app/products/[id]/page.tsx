"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getProduct, updateProduct } from "@/lib/api";
import Link from "next/link";

export default function EditProduct() {
  const router = useRouter();
  const params = useParams();
  const productId = Number(params.id);

  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    image_original: 0,
    status: "active",
  });
  const [loading, setLoading] = useState(true);

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
    });
    router.push("/");
  };

  if (loading) return <p className="p-8">加载中...</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">编辑商品</h1>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">标题 *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">品类</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">价格</label>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">商品文案</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border p-2 rounded h-24"
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.image_original === 1}
                onChange={(e) => setForm({ ...form, image_original: e.target.checked ? 1 : 0 })}
              />
              <span>图片原创</span>
            </label>
          </div>
          <div className="flex gap-4">
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              保存
            </button>
            <Link href="/" className="px-4 py-2 border rounded hover:bg-gray-100">
              取消
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
