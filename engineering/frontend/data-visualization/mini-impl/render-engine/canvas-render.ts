import { IRenderer, VNode } from "./vnode";

export class CanvasRender implements IRenderer {
  createStage(container: HTMLElement, width: number, height: number): void {
    // oass
  }

  public renderElement(el: VNode, ctx?: CanvasRenderingContext2D): void {

    ctx?.save();

    if (el.attrs.x || el.attrs.y) {
      ctx?.translate(el.attrs.x || 0, el.attrs.y || 0);
    }

    el.draw(ctx);

    for (const child of el.children) {
      this.renderElement(child, ctx);
    }

    ctx?.restore();
  }

  public clear(ctx: CanvasRenderingContext2D): void {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
