import { renderer, rendering } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { XQPipeline } from "./xq-pipeline";

export class UIPassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 1000;
    
    public getConfigOrder(): number {
        return 0;
    }

    public getRenderOrder(): number {
        return UIPassBuilder.RenderOrder;
    }

    public setup(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined {
        if (!prevRenderPass) {
            console.warn('UIPassBuilder requires a previous render pass, drawing ignored');
            return undefined;
        }
        
        const queue = prevRenderPass.addQueue(rendering.QueueHint.BLEND);
        queue.addDraw2D(camera);
        if (cameraInfo.isProfilerLayerCamera(builder.profileCamera)) {
            prevRenderPass.showStatistics = true;
            queue.addProfiler(camera);
        }

        return prevRenderPass;
    }
}
