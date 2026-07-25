// 1. 统一样式属性接口
export interface ShapeAttrs {
  x?: number;
  y?: number;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  radius?: number;
  width?: number;
  height?: number;
  [key: string]: any;
}

// 2. 跨端抽象渲染接口：任何具体的渲染器（Canvas/SVG）都必须实现这个接口
export interface IRenderer {
  createStage(container: HTMLElement, width: number, height: number): void;
  renderElement(el: VNode, ctx?: any): void;
  clear(ctx?: any): void;
}

// 3. 虚拟场景树节点基类 (Virtual Node)
export abstract class VNode {
  public id: string;
  public type: string = 'node';
  public attrs: ShapeAttrs = {};
  public parent: VNode | null = null;
  public children: VNode[] = [];

  constructor(attrs: ShapeAttrs) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.attrs = attrs;
  }

  // 像操作 DOM 一样自由组合图形
  public appendChild(child: VNode) {
    child.parent = this;
    this.children.push(child);
  }

  // 留给子类具体图形（Circle/Rect）去实现的绘制逻辑描述
  abstract draw(ctx: any): void;
}