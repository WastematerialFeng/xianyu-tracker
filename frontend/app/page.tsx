"use client";

import { useState, useEffect } from "react";
import { getProducts, deleteProduct, Product } from "@/lib/api";
import Link from "next/link";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载商品列表
  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error("加载失败:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // 删除商品
  const handleDelete = async (id: number) => {
    if (confirm("确定删除这个商品吗？")) {
      await deleteProduct(id);
      loadProducts();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">闲鱼发品追踪器</h1>
          <Link
            href="/products/new"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            添加商品
          </Link>
        </div>

        {loading ? (
          <p>加载中...</p>
        ) : products.length === 0 ? (
          <p className="text-gray-500">暂无商品，点击上方按钮添加</p>
        ) : (
          <table className="w-full bg-white rounded shadow">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">标题</th>
                <th className="p-3 text-left">品类</th>
                <th className="p-3 text-left">价格</th>
                <th className="p-3 text-left">图片原创</th>
                <th className="p-3 text-left">状态</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t">
                  <td className="p-3">{product.title}</td>
                  <td className="p-3">{product.category || "-"}</td>
                  <td className="p-3">{product.price ? `¥${product.price}` : "-"}</td>
                  <td className="p-3">{product.image_original ? "是" : "否"}</td>
                  <td className="p-3">{product.status}</td>
                  <td className="p-3 space-x-2">
                    <Link
                      href={`/products/${product.id}`}
                      className="text-blue-500 hover:underline"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-500 hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
