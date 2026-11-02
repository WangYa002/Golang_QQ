"""Regenerate native icons from the project's existing orbit mark (requires Pillow)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
mark = Image.open(ROOT / "public/new-icon-1024.png").convert("RGBA")
tile = Image.new("RGBA", (1024, 1024), "#208de9")
resized = mark.resize((790, 790), Image.Resampling.LANCZOS)
tile.alpha_composite(resized, (117, 117))
rgb = tile.convert("RGB")

ios = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
rgb.save(ios)

res = ROOT / "android/app/src/main/res"
for density, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    folder = res / f"mipmap-{density}"
    icon = rgb.resize((px, px), Image.Resampling.LANCZOS)
    icon.save(folder / "ic_launcher.png")
    icon.save(folder / "ic_launcher_round.png")
    foreground = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    safe = max(1, int(px * .68))
    foreground.alpha_composite(mark.resize((safe, safe), Image.Resampling.LANCZOS), ((px-safe)//2, (px-safe)//2))
    foreground.save(folder / "ic_launcher_foreground.png")

for path in res.rglob("splash.png"):
    with Image.open(path) as old:
        size = old.size
    canvas = Image.new("RGB", size, "#208de9")
    side = max(1, int(min(size) * .34))
    logo = rgb.resize((side, side), Image.Resampling.LANCZOS)
    canvas.paste(logo, ((size[0] - side)//2, (size[1] - side)//2))
    canvas.save(path)
