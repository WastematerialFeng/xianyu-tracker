"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProduct, getAccounts, Account } from "@/lib/api";
import Link from "next/link";

const CATEGORIES = [
  "数码产品", "手机配件", "电脑硬件", "服饰鞋包", "美妆护肤",
  "家居用品", "母婴用品", "图书文具", "运动户外", "食品生鲜",
  "虚拟物品", "其他"
];

export default function NewProduct() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    image_original: 0,
    account_id: "",
  });

  useEffect(() => {
    getAccounts().then(setAccounts);
  }, []);

  // 处理图片文件
  const handleImageFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (file.type.startsWith("image/") && images.length < 9) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImages((prev) => prev.length < 9 ? [...prev, e.target?.result as string] : prev);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // 点击上传
  const handleClick = () => fileInputRef.current?.click();

  // 文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleImageFiles(e.target.files);
  };

  // 拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleImageFiles(e.dataTransfer.files);
  };

  // 粘贴上传
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            const file = items[i].getAsFile();
            if (file) imageFiles.push(file);
          }
        }
        if (imageFiles.length > 0) handleImageFiles(imageFiles);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [images]);

  // 删除图片
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct({
      title: form.title,
      category: form.category || undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      description: form.description || undefined,
      image_original: form.image_original,
      account_id: form.account_id ? parseInt(form.account_id) : undefined,
    });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">添加商品</h1>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg space-y-6">
          {/* 图片上传区域 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">商品图片</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
            />
            <div
              onClick={handleClick}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"
              }`}
            >
              {images.length === 0 ? (
                <>
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">点击、拖拽或 Ctrl+V 粘贴上传图片</p>
                  <p className="mt-1 text-xs text-gray-400">支持 JPG、PNG，最多 9 张</p>
                </>
              ) : (
                <div className="grid grid-cols-5 gap-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`图片${idx + 1}`} className="w-full h-16 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {images.length < 9 && (
                    <div className="w-full h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-2xl">
                      +
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">已上传 {images.length}/9 张</p>
          </div>

          {/* 标题 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">商品标题 *</label>
              <span className="text-xs text-gray-400">{form.title.length}/60</span>
            </div>
            <input
              type="text"
              required
              maxLength={60}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="输入商品标题，吸引买家注意"
              className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 品类 + 价格 一行两列 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">品类</label>
              <input
                type="text"
                list="category-list"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="选择或输入品类"
                className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <datalist id="category-list">
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">价格</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">¥</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-gray-300 p-3 pl-8 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 所属账号 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">所属账号</label>
            <select
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">未分配</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          {/* 商品文案 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">商品文案</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="详细描述商品的成色、规格、使用情况等..."
              className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-32 resize-none"
            />
          </div>

          {/* 图片原创 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="image_original"
              checked={form.image_original === 1}
              onChange={(e) => setForm({ ...form, image_original: e.target.checked ? 1 : 0 })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="image_original" className="text-sm text-gray-700">图片为原创拍摄</label>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
            <Link 
              href="/" 
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              取消
            </Link>
            <button 
              type="submit" 
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition-all font-medium"
            >
              保存商品
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
