import { renderer, rendering } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { XQPipelineSettings } from "../components/pipeline-settings";
import { XQPipeline } from "./xq-pipeline";

export class PrePassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 0;

    public getConfigOrder(): number {
        return 0;
    }

    public getRenderOrder(): number {
        return PrePassBuilder.RenderOrder;
    }

    public setup(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined {
        return prevRenderPass;
    }
}
