import { VNode } from "./vnode";

// 圆形虚拟节点
export class VCircle extends VNode {
  type = 'circle';

  draw(ctx: CanvasRenderingContext2D) {
    const { x = 0, y = 0, radius = 0, fillStyle, strokeStyle, lineWidth = 1 } = this.attrs;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }
}

// 组合节点（容器，用来做图层嵌套或整体平移变换）
export class VGroup extends VNode {
  type = 'group';
  draw(ctx: CanvasRenderingContext2D) {
    // 容器本身不需要绘制图形，它的存在是为了递归渲染子节点
  }
}