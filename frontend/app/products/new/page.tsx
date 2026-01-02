"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/lib/api";
import Link from "next/link";

export default function NewProduct() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    image_original: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct({
      title: form.title,
      category: form.category || undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      description: form.description || undefined,
      image_original: form.image_original,
    });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">添加商品</h1>
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
              placeholder="如：数码、服饰、家居"
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
