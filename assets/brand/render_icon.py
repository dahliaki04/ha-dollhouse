"""Render the Dollhouse brand assets (icon.png 256, icon@2x.png 512, logo.png 512x160, logo@2x.png 1024x320)
from the same geometry as icon.svg, with real alpha. Run: python assets/brand/render_icon.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
S = 4  # supersampling


def px(v: float) -> int:
    return int(round(v * S))


def rounded(draw: ImageDraw.ImageDraw, box, r, fill):
    draw.rounded_rectangle([px(box[0]), px(box[1]), px(box[2]), px(box[3])], radius=px(r), fill=fill)


def radial_glow(w, h, cx, cy, r, inner, mid, outer):
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    d = np.clip(d, 0, 1)[..., None]
    inner, mid, outer = (np.array(c, float) for c in (inner, mid, outer))
    t1 = np.clip(d / 0.45, 0, 1)
    t2 = np.clip((d - 0.45) / 0.55, 0, 1)
    col = np.where(d < 0.45, inner + (mid - inner) * t1, mid + (outer - mid) * t2)
    return Image.fromarray(np.dstack([col, np.full((h, w, 1), 255)]).astype(np.uint8), "RGBA")


def draw_icon() -> Image.Image:
    size = px(512)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # roof: vertical gradient triangle
    roof = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = np.linspace(0, 1, size)[:, None]
    top, bot = np.array([71, 85, 105]), np.array([30, 41, 59])
    col = (top + (bot - top) * np.clip((grad - 44 / 512) / (182 / 512), 0, 1))[..., None].transpose(0, 2, 1)
    col = np.repeat(col, size, axis=1).reshape(size, size, 3)
    roof_rgba = np.dstack([col, np.full((size, size, 1), 255)]).astype(np.uint8)
    roof_img = Image.fromarray(roof_rgba, "RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon([(px(256), px(44)), (px(484), px(226)), (px(28), px(226))], fill=255)
    roof.paste(roof_img, (0, 0), mask)
    im.alpha_composite(roof)
    rounded(d, (356, 96, 396, 166), 6, (30, 41, 59, 255))

    # body
    rounded(d, (60, 214, 452, 476), 22, (51, 65, 85, 255))

    # lit room (top-left) with radial glow
    glow = radial_glow(px(164), px(104), px(82), px(20), px(140), (255, 247, 214), (252, 211, 77), (245, 158, 11))
    room_mask = Image.new("L", glow.size, 0)
    ImageDraw.Draw(room_mask).rounded_rectangle([0, 0, glow.size[0] - 1, glow.size[1] - 1], radius=px(8), fill=255)
    im.paste(glow, (px(88), px(240)), room_mask)
    d.ellipse([px(161), px(249), px(179), px(267)], fill=(255, 255, 255, 255))

    # bedroom (top-right)
    rounded(d, (260, 240, 424, 344), 8, (226, 232, 240, 255))
    rounded(d, (300, 290, 392, 330), 8, (203, 213, 225, 255))
    rounded(d, (308, 296, 332, 310), 4, (255, 255, 255, 255))

    # living (bottom-left)
    rounded(d, (88, 352, 252, 448), 8, (226, 232, 240, 255))
    rounded(d, (112, 398, 228, 430), 10, (148, 163, 184, 255))
    rounded(d, (112, 388, 228, 404), 8, (100, 116, 139, 255))

    # kitchen (bottom-right) with window
    rounded(d, (260, 352, 424, 448), 8, (226, 232, 240, 255))
    rounded(d, (352, 366, 404, 406), 6, (125, 211, 252, 255))
    rounded(d, (284, 412, 356, 432), 4, (148, 163, 184, 255))

    return im.resize((512, 512), Image.LANCZOS)


def draw_logo(icon: Image.Image, text=(30, 41, 59, 255)) -> Image.Image:
    W, H = 1024, 320
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ic = icon.resize((240, 240), Image.LANCZOS)
    im.alpha_composite(ic, (40, 40))
    d = ImageDraw.Draw(im)
    font = None
    for f in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            font = ImageFont.truetype(f, 118)
            break
        except OSError:
            continue
    d.text((316, 92), "Dollhouse", font=font, fill=text)
    return im


if __name__ == "__main__":
    icon = draw_icon()
    icon.save(HERE / "icon@2x.png")
    icon.resize((256, 256), Image.LANCZOS).save(HERE / "icon.png")
    logo = draw_logo(icon)
    logo.save(HERE / "logo@2x.png")
    logo.resize((512, 160), Image.LANCZOS).save(HERE / "logo.png")
    dark = draw_logo(icon, (226, 232, 240, 255))
    dark.save(HERE / "logo-dark@2x.png")
    dark.resize((512, 160), Image.LANCZOS).save(HERE / "logo-dark.png")

    # preview sheet: light + dark, several sizes
    sheet = Image.new("RGBA", (760, 330), (255, 255, 255, 255))
    sheet.paste(Image.new("RGBA", (380, 330), (17, 17, 17, 255)), (380, 0))
    for off in (0, 380):
        x = 20
        for s in (200, 64, 32, 16):
            sheet.alpha_composite(icon.resize((s, s), Image.LANCZOS), (x + off, 20))
            x += s + 16
        sheet.alpha_composite(logo.resize((340, 106), Image.LANCZOS), (20 + off, 215))
    sheet.save(HERE / "preview.png")
    print("ok", icon.getpixel((2, 2)), icon.getpixel((256, 300)))
