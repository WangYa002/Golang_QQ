"""黑猫 SVG → Golang QQ 应用图标全套（favicon / icons / icon.ico）"""
import subprocess
import os
from PIL import Image

SVG = r'D:\Golang\Golang_QQ\web\public\new-icon.svg'
PUB = r'D:\Golang\Golang_QQ\web\public'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

html = f'''<html><body style="margin:0;width:1024px;height:1024px">
<div style="width:1024px;height:1024px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden">
<img src="file:///{SVG.replace(chr(92), "/")}" style="width:780px;height:780px;margin:0">
</div></body></html>'''
html_path = r'D:\Golang\Golang_QQ\web\public\new-icon.html'
open(html_path, 'w').write(html)

subprocess.run([
    CHROME, '--headless', '--disable-gpu',
    f'--screenshot={PUB}\\new-icon-1024.png',
    '--window-size=1024,1024',
    '--default-background-color=00000000',
    html_path,
], check=True, capture_output=True, timeout=60)

img = Image.open(os.path.join(PUB, 'new-icon-1024.png')).convert('RGBA')
print('渲染完成:', img.size)

# favicon.ico（16+32+48）
ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_imgs = [img.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_imgs[0].save(os.path.join(PUB, 'favicon.ico'), format='ICO', sizes=ico_sizes, append_images=ico_imgs[1:])

# 各尺寸 PNG（icons 目录）
for size in (16, 32, 48, 64, 128, 180, 192, 256, 512):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(PUB, 'icons', f'icon-{size}.png'))

# icon.ico（Electron）
sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]
ico_imgs = [img.resize(s, Image.LANCZOS) for s in sizes]
ico_imgs[0].save(os.path.join(PUB, 'icon.ico'), format='ICO', sizes=sizes, append_images=ico_imgs[1:])

print('全套图标生成完成')
for f in ['favicon.ico', 'icon.ico']:
    print(' ', f, os.path.getsize(os.path.join(PUB, f)), 'bytes')
