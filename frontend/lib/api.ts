/**
 * API 调用工具
 * 为什么单独封装：统一管理 API 地址，方便维护
 */

const API_BASE = "http://localhost:8000";

// 商品类型定义
export interface Product {
  id: number;
  title: string;
  category: string | null;
  price: number | null;
  description: string | null;
  image_original: number;
  created_at: string;
  status: string;
}

export interface ProductCreate {
  title: string;
  category?: string;
  price?: number;
  description?: string;
  image_original?: number;
}

// 获取所有商品
export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/products`);
  const data = await res.json();
  return data.data;
}

// 获取单个商品
export async function getProduct(id: number): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/products/${id}`);
  const data = await res.json();
  return data.data;
}

// 创建商品
export async function createProduct(product: ProductCreate): Promise<{ id: number }> {
  const res = await fetch(`${API_BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  return res.json();
}

// 更新商品
export async function updateProduct(id: number, product: Partial<ProductCreate>): Promise<void> {
  await fetch(`${API_BASE}/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
}

// 删除商品
export async function deleteProduct(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/products/${id}`, {
    method: "DELETE",
  });
}

// ========== 数据记录 API ==========

export interface DailyStats {
  id: number;
  product_id: number;
  record_date: string;
  exposures: number;
  views: number;
  clicks: number;
  inquiries: number;
  favorites: number;
}

export interface StatsCreate {
  product_id: number;
  record_date: string;
  exposures?: number;
  views?: number;
  clicks?: number;
  inquiries?: number;
  favorites?: number;
}

// 获取商品所有数据记录
export async function getProductStats(productId: number): Promise<DailyStats[]> {
  const res = await fetch(`${API_BASE}/api/products/${productId}/stats`);
  const data = await res.json();
  return data.data;
}

// 获取商品最新数据记录
export async function getLatestStats(productId: number): Promise<DailyStats | null> {
  const res = await fetch(`${API_BASE}/api/products/${productId}/stats/latest`);
  const data = await res.json();
  return data.data;
}

// 创建数据记录
export async function createStats(stats: StatsCreate): Promise<{ id: number }> {
  const res = await fetch(`${API_BASE}/api/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stats),
  });
  return res.json();
}

// 删除数据记录
export async function deleteStats(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/stats/${id}`, {
    method: "DELETE",
  });
}
