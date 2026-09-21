#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 PWA 所需的全部位图资源（与 icon.svg 保持同一套视觉：667eea→764ba2 渐变 + 白色柱状/折线图标）。

用法：
    python icons/generate-pwa-assets.py

产出：
    icons/icon-{72,96,128,144,152,192,384,512}.png       manifest.json 引用的应用图标
    icons/splash-*.png                                     index.html 引用的 iOS 启动图
    icons/shortcut-review.png / shortcut-plan.png          manifest.json 快捷方式图标
    og-image.jpg                                           index.html 引用的社交分享预览图

说明：本脚本只补齐 manifest.json / index.html 中已经引用、但仓库里缺失的位图文件，
不使用到 manifest 以外的任何地方，也不会改动页面结构或样式。

依赖：pillow
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# 与 icon.svg 完全一致的几何参数（基于 512x512 设计稿）
C1 = (0x66, 0x7E, 0xEA)          # #667eea
C2 = (0x76, 0x4B, 0xA2)          # #764ba2
BARS = [(100, 280, 60, 120), (180, 220, 60, 180), (260, 160, 60, 240), (340, 120, 60, 280)]
TREND = [(80, 350), (160, 280), (240, 220), (320, 160), (400, 100)]
ARROW = [(400, 80), (430, 110), (400, 120), (390, 100)]
UNIT = 512

GRADIENT_CACHE = {}


def gradient_square(side):
    """对角线性渐变（0,0 → 100%,100%）。低分辨率生成再放大，线性渐变缩放不失真。"""
    if side in GRADIENT_CACHE:
        return GRADIENT_CACHE[side]
    base = 512
    img = Image.new("RGB", (base, base))
    px = img.load()
    denom = 2.0 * (base - 1)
    for y in range(base):
        for x in range(base):
            t = (x + y) / denom
            px[x, y] = (
                round(C1[0] + (C2[0] - C1[0]) * t),
                round(C1[1] + (C2[1] - C1[1]) * t),
                round(C1[2] + (C2[2] - C1[2]) * t),
            )
    if side != base:
        img = img.resize((side, side), Image.BILINEAR)
    GRADIENT_CACHE[side] = img
    return img


def gradient_rect(w, h):
    """任意宽高比的对角渐变。"""
    side = max(w, h)
    sq = gradient_square(side)
    return sq.crop((0, 0, w, h))


def draw_logo(draw, k, ox=0.0, oy=0.0, alpha=255):
    """按 512 设计稿绘制柱状图 + 折线 + 箭头。k 为缩放系数，(ox,oy) 为平移量。"""
    def X(v):
        return ox + v * k

    def Y(v):
        return oy + v * k

    for (x, y, w, h) in BARS:
        draw.rounded_rectangle(
            [X(x), Y(y), X(x + w), Y(y + h)],
            radius=max(1, round(10 * k)),
            fill=(255, 255, 255, alpha),
        )

    d = (255, 255, 255, 204)
    width = max(1, round(12 * k))
    pts = [(X(p[0]), Y(p[1])) for p in TREND]
    draw.line(pts, fill=d, width=width, joint="curve")
    r = 6 * k
    for (px, py) in (pts[0], pts[-1]):                    # 还原 stroke-linecap: round
        draw.ellipse([px - r, py - r, px + r, py + r], fill=d)
    draw.polygon([(X(p[0]), Y(p[1])) for p in ARROW], fill=d)


def make_icon(size, supersample=4):
    """圆角方形图标，等价于 icon.svg。"""
    W = size * supersample
    k = W / UNIT
    card = gradient_square(W).convert("RGBA")
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=round(80 * k), fill=255)
    card.putalpha(mask)
    draw_logo(ImageDraw.Draw(card), k)
    return card.resize((size, size), Image.LANCZOS)


def make_splash(w, h, logo_ratio=0.34, supersample=2):
    """iOS 启动图：满幅渐变 + 居中品牌图标。"""
    W, H = w * supersample, h * supersample
    canvas = gradient_rect(W, H).convert("RGBA")
    logo_side = int(W * logo_ratio)
    k = logo_side / UNIT
    layer = Image.new("RGBA", (logo_side, logo_side), (0, 0, 0, 0))
    draw_logo(ImageDraw.Draw(layer), k)
    canvas.alpha_composite(layer, ((W - logo_side) // 2, (H - logo_side) // 2))
    return canvas.resize((w, h), Image.LANCZOS)


def load_font(name, size):
    for candidate in (name, "msyh.ttc", "segoeui.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_og_image(w=1200, h=630):
    """社交分享预览图。"""
    canvas = gradient_rect(w, h).convert("RGBA")
    logo_side = 300
    layer = Image.new("RGBA", (logo_side, logo_side), (0, 0, 0, 0))
    draw_logo(ImageDraw.Draw(layer), logo_side / UNIT)
    canvas.alpha_composite(layer, (100, (h - logo_side) // 2))

    draw = ImageDraw.Draw(canvas)
    title_font = load_font("msyhbd.ttc", 76)
    sub_font = load_font("msyh.ttc", 36)
    draw.text((470, 232), "智能复盘助手", font=title_font, fill=(255, 255, 255, 255))
    draw.text((472, 340), "每日复盘 · 明日规划 · 成长跟踪", font=sub_font, fill=(255, 255, 255, 220))
    return canvas.convert("RGB")


def main():
    os.makedirs(HERE, exist_ok=True)
    written = []

    for s in (72, 96, 128, 144, 152, 192, 384, 512):
        p = os.path.join(HERE, f"icon-{s}x{s}.png")
        make_icon(s).save(p, "PNG", optimize=True)
        written.append(p)

    for (w, h) in ((640, 1136), (750, 1334), (1242, 2208), (1125, 2436), (1170, 2532)):
        p = os.path.join(HERE, f"splash-{w}x{h}.png")
        make_splash(w, h).save(p, "PNG", optimize=True)
        written.append(p)

    for name in ("shortcut-review", "shortcut-plan"):
        p = os.path.join(HERE, f"{name}.png")
        make_icon(96).save(p, "PNG", optimize=True)
        written.append(p)

    p = os.path.join(ROOT, "og-image.jpg")
    make_og_image().save(p, "JPEG", quality=88, optimize=True)
    written.append(p)

    for p in written:
        print(f"  {os.path.relpath(p, ROOT)}  ({os.path.getsize(p):,} bytes)")
    print(f"\n共生成 {len(written)} 个资源文件。")


if __name__ == "__main__":
    main()
