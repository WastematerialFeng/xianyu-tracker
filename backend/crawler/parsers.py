"""
数据解析器
用于解析闲鱼 API 返回的 JSON 数据
"""
from typing import List, Dict, Any, Optional
from .utils import safe_get, format_price


async def parse_search_results(json_data: dict, page_info: str = "") -> List[Dict[str, Any]]:
    """
    解析搜索结果 API 返回的商品列表
    
    为什么需要解析：闲鱼 API 返回的数据结构复杂，需要提取关键字段
    """
    items = []
    
    try:
        # 获取商品列表
        result_list = await safe_get(json_data, 'data', 'resultList', default=[])
        
        if not result_list:
            print(f"   [{page_info}] 未找到商品数据")
            return items
        
        for item in result_list:
            try:
                item_data = await safe_get(item, 'data', default={})
                
                # 提取基础信息
                parsed_item = {
                    "商品ID": await safe_get(item_data, 'id', default=''),
                    "商品标题": await safe_get(item_data, 'title', default=''),
                    "商品价格": format_price(await safe_get(item_data, 'price', default='')),
                    "商品链接": f"https://www.goofish.com/item?id={await safe_get(item_data, 'id', default='')}",
                    "商品主图链接": await safe_get(item_data, 'pic', default=''),
                    "卖家ID": await safe_get(item_data, 'sellerId', default=''),
                    "卖家昵称": await safe_get(item_data, 'sellerNick', default=''),
                    "发布地点": await safe_get(item_data, 'area', default=''),
                    '"想要"人数': await safe_get(item_data, 'wantCnt', default=0),
                }
                
                # 只添加有效商品
                if parsed_item["商品ID"]:
                    items.append(parsed_item)
                    
            except Exception as e:
                print(f"   解析单个商品时出错: {e}")
                continue
        
        print(f"   [{page_info}] 成功解析 {len(items)} 个商品")
        
    except Exception as e:
        print(f"   [{page_info}] 解析搜索结果时出错: {e}")
    
    return items


async def parse_item_detail(json_data: dict) -> Dict[str, Any]:
    """
    解析商品详情 API 返回的数据
    """
    detail = {}
    
    try:
        item_do = await safe_get(json_data, 'data', 'itemDO', default={})
        seller_do = await safe_get(json_data, 'data', 'sellerDO', default={})
        
        # 商品详情
        detail["商品ID"] = await safe_get(item_do, 'id', default='')
        detail["商品标题"] = await safe_get(item_do, 'title', default='')
        detail["商品描述"] = await safe_get(item_do, 'desc', default='')
        detail["商品价格"] = format_price(await safe_get(item_do, 'price', default=''))
        detail["原价"] = format_price(await safe_get(item_do, 'originalPrice', default=''))
        detail["浏览量"] = await safe_get(item_do, 'browseCnt', default=0)
        detail['"想要"人数'] = await safe_get(item_do, 'wantCnt', default=0)
        detail["发布时间"] = await safe_get(item_do, 'publishTime', default='')
        detail["商品状态"] = await safe_get(item_do, 'status', default='')
        
        # 图片列表
        image_infos = await safe_get(item_do, 'imageInfos', default=[])
        detail["商品图片列表"] = [img.get('url') for img in image_infos if img.get('url')]
        if detail["商品图片列表"]:
            detail["商品主图链接"] = detail["商品图片列表"][0]
        
        # 卖家信息
        detail["卖家ID"] = await safe_get(seller_do, 'sellerId', default='')
        detail["卖家昵称"] = await safe_get(seller_do, 'sellerNick', default='')
        detail["卖家头像"] = await safe_get(seller_do, 'avatar', default='')
        detail["卖家注册天数"] = await safe_get(seller_do, 'userRegDay', default=0)
        detail["卖家芝麻信用"] = await safe_get(seller_do, 'zhimaLevelInfo', 'levelName', default='')
        
    except Exception as e:
        print(f"   解析商品详情时出错: {e}")
    
    return detail


async def parse_user_head_data(json_data: dict) -> Dict[str, Any]:
    """
    解析用户头部信息 API 返回的数据
    """
    user_info = {}
    
    try:
        data = await safe_get(json_data, 'data', default={})
        
        user_info["卖家昵称"] = await safe_get(data, 'nickName', default='')
        user_info["卖家头像"] = await safe_get(data, 'avatar', default='')
        user_info["卖家简介"] = await safe_get(data, 'desc', default='')
        user_info["粉丝数"] = await safe_get(data, 'fansCount', default=0)
        user_info["关注数"] = await safe_get(data, 'followCount', default=0)
        user_info["在售商品数"] = await safe_get(data, 'onSaleCount', default=0)
        user_info["已售商品数"] = await safe_get(data, 'soldCount', default=0)
        
    except Exception as e:
        print(f"   解析用户信息时出错: {e}")
    
    return user_info
