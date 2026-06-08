# WASM 应用场景

## 1. 图像处理

```rust
// Rust + image crate
#[wasm_bindgen]
pub fn resize_image(data: &[u8], width: u32, height: u32) -> Vec<u8> {
    let img = image::load_from_memory(data).unwrap();
    let resized = img.resize(width, height, image::imageops::Lanczos3);
    let mut output = Vec::new();
    resized.write_to(&mut output, image::ImageFormat::Jpeg).unwrap();
    output
}

#[wasm_bindgen]
pub fn apply_filter(data: &[u8], filter_type: &str) -> Vec<u8> {
    let mut img = image::load_from_memory(data).unwrap().to_rgba8();

    match filter_type {
        "grayscale" => {
            for pixel in img.pixels_mut() {
                let gray = (0.299 * pixel[0] as f32
                    + 0.587 * pixel[1] as f32
                    + 0.114 * pixel[2] as f32) as u8;
                *pixel = image::Rgba([gray, gray, gray, pixel[3]]);
            }
        }
        "blur" => {
            img = image::imageops::blur(&img, 2.0);
        }
        _ => {}
    }

    let mut output = Vec::new();
    img.write_to(&mut output, image::ImageFormat::Png).unwrap();
    output
}
```

```javascript
// JS 中使用
import init, { resize_image, apply_filter } from './pkg/image_processor.js';

await init();

const fileInput = document.getElementById('file');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // 调整大小
  const resized = resize_image(uint8Array, 800, 600);

  // 应用滤镜
  const filtered = apply_filter(resized, 'grayscale');

  // 显示结果
  const blob = new Blob([filtered], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  document.getElementById('preview').src = url;
});
```

## 2. 音视频编解码

```javascript
// FFmpeg.wasm：在浏览器中运行 FFmpeg
import { FFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = new FFmpeg();

async function convertVideo(inputFile) {
  await ffmpeg.load();

  // 写入文件到 WASM 内存
  ffmpeg.writeFile('input.mp4', await fetchFile(inputFile));

  // 执行 FFmpeg 命令
  await ffmpeg.exec(['-i', 'input.mp4', '-c:v', 'libx264', 'output.mp4']);

  // 读取结果
  const data = await ffmpeg.readFile('output.mp4');
  return URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
}
```

## 3. 加密与安全

```rust
// Rust + ring crate
use wasm_bindgen::prelude::*;
use ring::aead::*;

#[wasm_bindgen]
pub struct AesGcm {
    key: LessSafeKey,
}

#[wasm_bindgen]
impl AesGcm {
    pub fn new(key: &[u8]) -> AesGcm {
        let key = UnboundKey::new(&AES_256_GCM, key).unwrap();
        AesGcm {
            key: LessSafeKey::new(key),
        }
    }

    pub fn encrypt(&self, nonce: &[u8], plaintext: &[u8], aad: &[u8]) -> Vec<u8> {
        let nonce = Nonce::try_assume_unique_for_key(nonce).unwrap();
        let mut in_out = plaintext.to_vec();
        self.key.seal_in_place_append_tag(nonce, Aad::from(aad), &mut in_out).unwrap();
        in_out
    }

    pub fn decrypt(&self, nonce: &[u8], ciphertext: &[u8], aad: &[u8]) -> Option<Vec<u8>> {
        let nonce = Nonce::try_assume_unique_for_key(nonce).unwrap();
        let mut in_out = ciphertext.to_vec();
        self.key.open_in_place(nonce, Aad::from(aad), &mut in_out).ok()?;
        let plaintext_len = in_out.len() - AES_256_GCM.tag_len();
        in_out.truncate(plaintext_len);
        Some(in_out)
    }
}
```

## 4. 科学计算

```javascript
// ONNX Runtime Web：运行机器学习模型
import * as ort from 'onnxruntime-web';

async function runModel() {
  const session = await ort.InferenceSession.create('./model.onnx', {
    executionProviders: ['wasm'],
  });

  const input = new ort.Tensor('float32', data, [1, 3, 224, 224]);
  const results = await session.run({ input });

  return results.output.data;
}

// TensorFlow.js WASM 后端
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';

await tf.setBackend('wasm');
const model = await tf.loadLayersModel('./model.json');
const prediction = model.predict(tf.tensor([input]));
```

## 5. 游戏与仿真

```rust
// Bevy 引擎（Rust 游戏引擎）可编译到 WASM
// 或使用更轻量的 macroquad

#[macroquad::main("Game")]
async fn main() {
    loop {
        clear_background(BLACK);

        if is_key_down(KeyCode::Left) {
            player.x -= 1.0;
        }
        if is_key_down(KeyCode::Right) {
            player.x += 1.0;
        }

        draw_rectangle(player.x, player.y, 32.0, 32.0, GREEN);

        next_frame().await;
    }
}
```

## 6. 应用场景选型

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 图像滤镜 | Rust + image | 性能高，生态成熟 |
| 视频转码 | FFmpeg.wasm | 功能最全 |
| 加密操作 | Rust + ring | 安全，性能高 |
| ML 推理 | ONNX Runtime | 跨框架，优化好 |
| PDF 处理 | PDFium / pdf.js | 各有优势 |
| 游戏 | Rust + wgpu | WebGPU 未来 |
| 数据库 | SQLite.wasm | 完整 SQL 支持 |
