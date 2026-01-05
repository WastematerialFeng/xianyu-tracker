"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

// 生成模式
type Mode = "generate" | "edit" | "inpaint";

const MODES = [
  { id: "generate" as Mode, name: "文生图", desc: "纯文字描述生成图片" },
  { id: "edit" as Mode, name: "图生图", desc: "基于参考图生成新图" },
  { id: "inpaint" as Mode, name: "局部重绘", desc: "修改图片指定区域" },
];

const SIZES = ["1024x1024", "1024x1792", "1792x1024"];

export default function ImageGenerator() {
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [size, setSize] = useState("1024x1024");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);

  // 文件转 base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:image/xxx;base64, 前缀
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 处理图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "mask") => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const base64 = await fileToBase64(file);
    if (type === "image") {
      setImage(base64);
    } else {
      setMask(base64);
    }
  };

  // 生成图片
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("请输入提示词");
      return;
    }
    if (mode !== "generate" && !image) {
      setError("请上传参考图片");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch(`${API_BASE}/api/tools/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt,
          image: mode !== "generate" ? image : undefined,
          mask: mode === "inpaint" ? mask : undefined,
          n: count,
          size,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.images && data.images.length > 0) {
        setResults(data.images);
      } else {
        setError("未生成任何图片");
      }
    } catch (err) {
      setError("请求失败，请检查后端服务是否运行");
    } finally {
      setLoading(false);
    }
  };

  // 下载图片
  const handleDownload = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `generated-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      setError("下载失败");
    }
  };

  // 复制图片到剪贴板
  const handleCopy = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      alert("已复制到剪贴板");
    } catch {
      setError("复制失败，请尝试下载");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">AI 商品主图生成器</h1>
            <p className="text-gray-500 text-sm mt-1">基于 AI 生成原创商品图片</p>
          </div>
          <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </Link>
        </div>

        {/* 主体 */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {/* 模式选择 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">生成模式</label>
            <div className="grid grid-cols-3 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    mode === m.id
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-purple-300"
                  }`}
                >
                  <div className="font-medium text-gray-800">{m.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 参考图上传（图生图/局部重绘模式） */}
          {mode !== "generate" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  参考图片 <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={(e) => handleImageUpload(e, "image")}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition-colors h-40 flex items-center justify-center"
                >
                  {image ? (
                    <img
                      src={`data:image/png;base64,${image}`}
                      alt="参考图"
                      className="max-h-full max-w-full object-contain rounded"
                    />
                  ) : (
                    <div className="text-gray-400">
                      <svg className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-1 text-sm">点击上传参考图</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 遮罩图（仅局部重绘） */}
              {mode === "inpaint" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    遮罩图片（可选）
                  </label>
                  <input
                    type="file"
                    ref={maskInputRef}
                    onChange={(e) => handleImageUpload(e, "mask")}
                    accept="image/*"
                    className="hidden"
                  />
                  <div
                    onClick={() => maskInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition-colors h-40 flex items-center justify-center"
                  >
                    {mask ? (
                      <img
                        src={`data:image/png;base64,${mask}`}
                        alt="遮罩图"
                        className="max-h-full max-w-full object-contain rounded"
                      />
                    ) : (
                      <div className="text-gray-400">
                        <svg className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <p className="mt-1 text-sm">点击上传遮罩</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 提示词 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              提示词 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要生成的图片，例如：一个白色背景的简约风格手机壳产品图，光线柔和，高清细节"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* 生成数量和尺寸 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">生成数量</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`flex-1 py-2 rounded-lg border-2 font-medium transition-all ${
                      count === n
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">图片尺寸</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                生成中...
              </span>
            ) : (
              "生成图片"
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* 生成结果 */}
        {results.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">生成结果</h2>
            <div className="grid grid-cols-2 gap-4">
              {results.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={url.startsWith("http") ? url : `data:image/png;base64,${url}`}
                    alt={`生成图片 ${idx + 1}`}
                    className="w-full rounded-lg shadow-md"
                  />
                  <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(url.startsWith("http") ? url : `data:image/png;base64,${url}`, idx)}
                      className="px-3 py-1.5 bg-white/90 hover:bg-white rounded-lg shadow text-sm font-medium text-gray-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      下载
                    </button>
                    <button
                      onClick={() => handleCopy(url.startsWith("http") ? url : `data:image/png;base64,${url}`)}
                      className="px-3 py-1.5 bg-white/90 hover:bg-white rounded-lg shadow text-sm font-medium text-gray-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      复制
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
