import { assert, builtinResMgr, gfx, Material, renderer, rendering, Vec4, warn } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";

import { XQPipeline } from "./xq-pipeline";

const { LoadOp, StoreOp } = gfx;
const { QueueHint, SceneFlags } = rendering;

export class SSSPassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 400;

    private _viewport = new gfx.Viewport();
    private _sssInfo = new Vec4();

    public getConfigOrder(): number {
        return 0;
    }

    public getRenderOrder(): number {
        return SSSPassBuilder.RenderOrder;
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
        const sssBlurredName = cameraInfo.getTextureName('sssBlurred');
        const sssBlendName = cameraInfo.getTextureName('sssBlend');

        ppl.addRenderTarget(
            sssBlurredName,
            gfx.Format.R11G11B10F,
            cameraInfo.width,
            cameraInfo.height
        );

        ppl.addRenderTarget(
            sssBlendName,
            gfx.Format.R11G11B10F,
            cameraInfo.width,
            cameraInfo.height
        );
    }

    public override updateGlobalResources(ppl: rendering.BasicPipeline, builder: XQPipeline, cameraInfo: CameraInfo): void {
        if (cameraInfo.SSSSEnabled) {
            const lutTexture = builder.settings?.skin.sssLutTexture?.getGFXTexture();
            if (!lutTexture)
                warn(`SSS LUT texture not found, please make sure the pipeline settings is correct`);
            else
                ppl.addExternalTexture('sssKernelLut', lutTexture, rendering.ResourceFlags.SAMPLED);
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

        if (cameraInfo.SSSSEnabled) {
            const utilMtl = builtinResMgr.get<Material>('utilMtl');
            assert(!!utilMtl, 'utilMtl is required for SSS pass');

            const sssBlurredName = cameraInfo.getTextureName('sssBlurred');
            const sssBlendName = cameraInfo.getTextureName('sssBlend');
            
            this._sssInfo.x = builder.settings?.skin.sssQuality ?? 0;

            let copyPass = ppl.addRenderPass(this._viewport.width, this._viewport.height, 'screen-blit');
            copyPass.name = 'sssCopyDiffuse';
            copyPass.setViewport(this._viewport);
            copyPass.addRenderTarget(sssBlurredName, LoadOp.DISCARD, StoreOp.STORE);
            copyPass.addTexture(context.colorName, 'inputTexture');
            copyPass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMtl, 1);

            let blurPass = ppl.addRenderPass(this._viewport.width, this._viewport.height, 'ssss-blur-y');
            blurPass.name = 'ssssBlurY';
            blurPass.setViewport(this._viewport);
            blurPass.addRenderTarget(sssBlendName, LoadOp.DISCARD, StoreOp.STORE);
            blurPass.addTexture(sssBlurredName, 'colorInput');
            blurPass.addTexture(cameraInfo.sceneDepthPacked, 'depthInput');
            if (ppl.hasExternalTexture('sssKernelLut'))
                blurPass.addTexture('sssKernelLut', 'sssKernelLut');
            blurPass.setVec4('sssInfo', this._sssInfo);
            blurPass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMtl, 3);

            blurPass = ppl.addRenderPass(this._viewport.width, this._viewport.height, 'ssss-blur-x');
            blurPass.name = 'ssssBlurX';
            blurPass.setViewport(this._viewport);
            blurPass.addRenderTarget(sssBlurredName, LoadOp.DISCARD, StoreOp.STORE);
            blurPass.addTexture(sssBlendName, 'colorInput');
            blurPass.addTexture(cameraInfo.sceneDepthPacked, 'depthInput');
            if (ppl.hasExternalTexture('sssKernelLut'))
                blurPass.addTexture('sssKernelLut', 'sssKernelLut');
            blurPass.setVec4('sssInfo', this._sssInfo);
            blurPass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMtl, 2);

            copyPass = ppl.addRenderPass(this._viewport.width, this._viewport.height, 'screen-blit');
            copyPass.name = 'sssCopyBlurred';
            copyPass.setViewport(this._viewport);
            copyPass.addRenderTarget(context.colorName, LoadOp.DISCARD, StoreOp.STORE);
            copyPass.addTexture(sssBlurredName, 'inputTexture');
            copyPass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMtl, 1);
        }
        
        const specularPass = ppl.addRenderPass(this._viewport.width, this._viewport.height, 'default');
        specularPass.name = 'sssSpecular';
        specularPass.setViewport(this._viewport);
        specularPass.addRenderTarget(context.colorName, LoadOp.LOAD, StoreOp.STORE);
        specularPass.addDepthStencil(context.depthStencilName, LoadOp.LOAD, StoreOp.DISCARD);
        const specularQueue = specularPass.addQueue(QueueHint.BLEND, 'specular-pass');
        specularQueue.addScene(
            camera,
            SceneFlags.BLEND,
            cameraInfo.mainLight
        );

        return specularPass;
    }
}
