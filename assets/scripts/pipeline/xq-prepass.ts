import { gfx, renderer, rendering } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { XQPipeline } from "./xq-pipeline";
import { clearColorUtils, pipelineUtils } from "./utils";

const { LoadOp, StoreOp } = gfx;
const { SceneFlags, QueueHint } = rendering;

export class PrePassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 0;

    private _viewport = new gfx.Viewport();

    public getConfigOrder(): number {
        return 0;
    }

    public getRenderOrder(): number {
        return PrePassBuilder.RenderOrder;
    }

    public windowResize(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        window: renderer.RenderWindow,
        camera: renderer.scene.Camera,
        nativeWidth: number,
        nativeHeight: number
    ): void {
        ppl.addRenderTarget(
            cameraInfo.sceneDepthPacked,
            gfx.Format.RGBA16F,
            cameraInfo.width,
            cameraInfo.height,
            rendering.ResourceResidency.PERSISTENT
        );

        ppl.addDepthStencil(
            cameraInfo.getTextureName('prepassDepth'),
            gfx.Format.DEPTH_STENCIL,
            cameraInfo.width,
            cameraInfo.height,
            rendering.ResourceResidency.MEMORYLESS
        );

        if (pipelineUtils.needOffscreenRT(builder, cameraInfo)) {
            ppl.addDepthStencil(
                cameraInfo.depthStencil,
                gfx.Format.DEPTH_STENCIL,
                cameraInfo.width,
                cameraInfo.height,
                rendering.ResourceResidency.PERSISTENT
            );
        }
    }

    public setup(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined {
        cameraInfo.fillViewport(this._viewport);

        const pass = ppl.addRenderPass(cameraInfo.width, cameraInfo.height, 'default');
        pass.name = 'prepassDepth';
        pass.setViewport(this._viewport);
        pass.addRenderTarget(cameraInfo.sceneDepthPacked, LoadOp.CLEAR, StoreOp.STORE, clearColorUtils.transparent);
        pass.addDepthStencil(
            cameraInfo.getTextureName('prepassDepth'),
            LoadOp.CLEAR,
            StoreOp.DISCARD,
            1, 0,
            gfx.ClearFlagBit.DEPTH_STENCIL
        );
        pass.addQueue(QueueHint.OPAQUE, 'prepass')
            .addScene(camera, SceneFlags.OPAQUE | SceneFlags.MASK);
            
        context.depthStencilName = pipelineUtils.needOffscreenRT(builder, cameraInfo)
            ? cameraInfo.depthStencil : cameraInfo.windowDepthStencil;
        
        return pass;
    }
}
