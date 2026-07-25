import { VGroup } from "./vscircle";

export class Layer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public root: VGroup; // 每一个物理层，都拥有一棵独立的虚拟场景树

  constructor(width: number, height: number, zIndex: number, container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.zIndex = String(zIndex);

    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.root = new VGroup({}); // 初始化当前图层的根虚拟节点
  }
}

// export class Stage {
//   private container: HTMLElement;
//   private width: number;
//   private height: number;
//   private layers: Map<string, Layer> = new Map();
//   private renderer: CanvasRenderer;

//   constructor(containerId: string, width: number, height: number) {
//     this.container = document.getElementById(containerId)!;
//     this.width = width;
//     this.height = height;
//     this.renderer = new CanvasRenderer();
//     this.container.style.position = 'relative';

//     // 物理分层双缓冲初始化
//     this.initLayers();
//   }

//   private initLayers() {
//     // 优雅地拆分物理图层，分配 zIndex 秩序
//     this.layers.set('background', new Layer(this.width, this.height, 1, this.container));
//     this.layers.set('main', new Layer(this.width, this.height, 2, this.container));
//     this.layers.set('interaction', new Layer(this.width, this.height, 3, this.container));
//   }

//   // 获取某一层的虚拟树根节点，供上层业务添加图形
//   public getLayerRoot(layerName: 'background' | 'main' | 'interaction'): VGroup {
//     return this.layers.get(layerName)!.root;
//   }

//   // 精准更新：只想重绘交互层时，绝不惊动庞大的数据层
//   public update(layerName: 'background' | 'main' | 'interaction') {
//     const layer = this.layers.get(layerName)!;
//     this.renderer.clear(layer.ctx); // 擦除当前画布
//     this.renderer.renderElement(layer.root, layer.ctx); // 重新跑一遍 DFS 场景树绘制
//   }
// }