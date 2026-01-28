import { rendering } from "cc";

export class RenderingContext {
    colorName: string | null = null;
    depthStencilName: string | null = null;
    lastPass: rendering.BasicRenderPassBuilder | null = null;

    reset() {
        this.colorName = null;
        this.depthStencilName = null;
        this.lastPass = null;
    }
}
