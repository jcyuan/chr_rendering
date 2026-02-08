import { renderer, rendering } from "cc";
import { XQPipeline } from "./xq-pipeline";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";

export abstract class PipelineBuilderBase implements rendering.PipelinePassBuilder {
    constructor(protected readonly _pipeline: XQPipeline) {}
    static readonly RenderOrder: number;
    abstract getConfigOrder(): number;
    abstract getRenderOrder(): number;
    updateGlobalResources?(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo
    ): void;
    windowResize?(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        window: renderer.RenderWindow,
        camera: renderer.scene.Camera,
        nativeWidth: number,
        nativeHeight: number
    ): void;
    setup?(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined;
}
