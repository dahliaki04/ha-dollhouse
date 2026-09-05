"""Render brand assets from icon.svg with resvg (real alpha):
icon@2x.png 512, icon.png 256, favicon.png 64, logo(.png/@2x, light+dark), preview.png.
Run: python assets/brand/render_icon.py
"""
from io import BytesIO
from pathlib import Path

import resvg_py
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent


def render_svg(path: Path, size: int) -> Image.Image:
    svg = path.read_text(encoding="utf-8")
    png = resvg_py.svg_to_bytes(svg_string=svg, width=size, height=size)
    return Image.open(BytesIO(bytes(png))).convert("RGBA")


def wordmark(icon: Image.Image, text_color) -> Image.Image:
    W, H = 1024, 320
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    im.alpha_composite(icon.resize((240, 240), Image.LANCZOS), (40, 40))
    d = ImageDraw.Draw(im)
    font = None
    for f in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            font = ImageFont.truetype(f, 118)
            break
        except OSError:
            continue
    d.text((316, 92), "Dollhouse", font=font, fill=text_color)
    return im


if __name__ == "__main__":
    icon = render_svg(HERE / "icon.svg", 1024)  # supersampled, then downscaled
    icon.resize((512, 512), Image.LANCZOS).save(HERE / "icon@2x.png")
    icon.resize((256, 256), Image.LANCZOS).save(HERE / "icon.png")
    icon.resize((64, 64), Image.LANCZOS).save(HERE / "favicon.png")

    logo = wordmark(icon, (30, 41, 59, 255))
    logo.save(HERE / "logo@2x.png")
    logo.resize((512, 160), Image.LANCZOS).save(HERE / "logo.png")
    dark = wordmark(icon, (226, 232, 240, 255))
    dark.save(HERE / "logo-dark@2x.png")
    dark.resize((512, 160), Image.LANCZOS).save(HERE / "logo-dark.png")

    sheet = Image.new("RGBA", (760, 330), (255, 255, 255, 255))
    sheet.paste(Image.new("RGBA", (380, 330), (17, 17, 17, 255)), (380, 0))
    for off in (0, 380):
        x = 20
        for s in (200, 64, 32, 16):
            sheet.alpha_composite(icon.resize((s, s), Image.LANCZOS), (x + off, 20))
            x += s + 16
        sheet.alpha_composite((logo if off == 0 else dark).resize((340, 106), Image.LANCZOS), (20 + off, 215))
    sheet.save(HERE / "preview.png")
    print("ok corner alpha", icon.getpixel((3, 3))[3], "centre alpha", icon.getpixel((512, 512))[3])
