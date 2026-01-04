"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProduct, getAccounts, Account, uploadImage } from "@/lib/api";
import Link from "next/link";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CATEGORIES = [
  "数码产品", "手机配件", "电脑硬件", "服饰鞋包", "美妆护肤",
  "家居用品", "母婴用品", "图书文具", "运动户外", "食品生鲜",
  "虚拟物品", "其他"
];

// 可排序图片组件
interface SortableImageProps {
  id: string;
  preview: string;
  index: number;
  onRemove: (index: number) => void;
}

function SortableImage({ id, preview, index, onRemove }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group cursor-grab active:cursor-grabbing">
      <div {...attributes} {...listeners}>
        <img src={preview} alt={`图片${index + 1}`} className="w-full h-16 object-cover rounded-lg" />
        {index === 0 && <span className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-1 rounded-br">主图</span>}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ×
      </button>
    </div>
  );
}

export default function NewProduct() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<{ preview: string; file: File }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [uploading, setUploading] = useState(false);
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
          setImages((prev) => prev.length < 9 ? [...prev, { preview: e.target?.result as string, file }] : prev);
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

  // 拖拽排序处理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((prev) => {
        const oldIndex = prev.findIndex((_, i) => `img-${i}` === active.id);
        const newIndex = prev.findIndex((_, i) => `img-${i}` === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    // 上传所有图片
    const uploadedPaths: string[] = [];
    for (const img of images) {
      const result = await uploadImage(img.file);
      uploadedPaths.push(result.path);
    }
    
    await createProduct({
      title: form.title,
      category: form.category || undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      description: form.description || undefined,
      image_original: form.image_original,
      images: uploadedPaths.length > 0 ? uploadedPaths : undefined,
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
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}
            >
              {images.length === 0 ? (
                <div onClick={handleClick} className="cursor-pointer text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">点击、拖拽或 Ctrl+V 粘贴上传图片</p>
                  <p className="mt-1 text-xs text-gray-400">支持 JPG、PNG，最多 9 张</p>
                </div>
              ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={images.map((_, i) => `img-${i}`)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-5 gap-3">
                      {images.map((img, idx) => (
                        <SortableImage
                          key={`img-${idx}`}
                          id={`img-${idx}`}
                          preview={img.preview}
                          index={idx}
                          onRemove={removeImage}
                        />
                      ))}
                      {images.length < 9 && (
                        <div 
                          onClick={handleClick}
                          className="w-full h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-2xl cursor-pointer hover:border-blue-400"
                        >
                          +
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">已上传 {images.length}/9 张，拖拽可调整顺序</p>
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
              disabled={uploading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition-all font-medium disabled:bg-gray-400"
            >
              {uploading ? "保存中..." : "保存商品"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
