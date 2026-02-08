import { assert, builtinResMgr, gfx, Material, renderer, rendering, Vec2 } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { XQPipeline } from "./xq-pipeline";
import { XQPipelineSettings } from "../components/pipeline-settings";

const { Color, LoadOp, StoreOp } = gfx;
const { QueueHint } = rendering;

export class PostProcessPassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 500;
    
    private readonly _colorGradingTexSize = new Vec2(0, 0);
    private readonly _clearColor = new Color(0, 0, 0, 0);
    
    getConfigOrder(): number {
        return 0;
    }

    getRenderOrder(): number {
        return PostProcessPassBuilder.RenderOrder;
    }

    public setup(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined {
        const inputColorName = context.colorName ?? cameraInfo.windowColor;
        const outputColorName = cameraInfo.windowColor;

        // if input is already windowColor, no post-processing needed
        if (inputColorName === outputColorName)
            return prevRenderPass;

        const colorGradingEnabled = builder.settings.colorGrading.enabled
            && !!builder.settings.colorGrading.material
            && !!builder.settings.colorGrading.colorGradingMap;

        const toneMappingEnabled = cameraInfo.HDREnabled || colorGradingEnabled;

        const outputWidth = cameraInfo.nativeWidth;
        const outputHeight = cameraInfo.nativeHeight;

        if (toneMappingEnabled) {
            return this._tonemapPass(
                ppl,
                builder.settings,
                outputWidth,
                outputHeight,
                inputColorName,
                outputColorName,
                colorGradingEnabled
            );
        } else
            return this._copyToScreenPass(ppl, outputWidth, outputHeight, inputColorName, outputColorName);
    }

    private _copyToScreenPass(
        ppl: rendering.BasicPipeline,
        width: number,
        height: number,
        inputColorName: string,
        outputColorName: string
    ): rendering.BasicRenderPassBuilder {
        const pass = ppl.addRenderPass(width, height, 'screen-blit');
        pass.name = 'copyToScreen';
        pass.addRenderTarget(outputColorName, LoadOp.DISCARD, StoreOp.STORE);
        pass.addTexture(inputColorName, 'inputTexture');

        const utilMat = builtinResMgr.get<Material>('utilMtl');
        if (utilMat)
            pass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMat, 1);
        else
            console.warn('utilMtl is not found, copy to screen failed');

        return pass;
    }

    private _tonemapPass(
        ppl: rendering.BasicPipeline,
        settings: XQPipelineSettings,
        width: number,
        height: number,
        radianceName: string,
        colorName: string,
        colorGradingEnabled: boolean
    ): rendering.BasicRenderPassBuilder {
        let pass: rendering.BasicRenderPassBuilder;

        if (colorGradingEnabled) {
            assert(!!settings.colorGrading.material);
            assert(!!settings.colorGrading.colorGradingMap);

            const lutTex = settings.colorGrading.colorGradingMap;
            this._colorGradingTexSize.set(lutTex.width, lutTex.height);

            const isSquareMap = lutTex.width === lutTex.height;
            pass = ppl.addRenderPass(width, height, isSquareMap ? 'cc-color-grading-8x8' : 'cc-color-grading-nx1');
            pass.name = 'colorGrading';
            pass.addRenderTarget(colorName, LoadOp.DISCARD, StoreOp.STORE);
            pass.addTexture(radianceName, 'sceneColorMap');
            pass.setVec2('lutTextureSize', this._colorGradingTexSize);
            pass.setFloat('contribute', settings.colorGrading.contribute);
            pass.addQueue(QueueHint.NONE).addFullscreenQuad(settings.colorGrading.material, isSquareMap ? 1 : 0);
        } else {
            pass = ppl.addRenderPass(width, height, 'tonemap');
            pass.name = 'toneMapping';
            pass.addRenderTarget(colorName, LoadOp.DISCARD, StoreOp.STORE);
            pass.addTexture(radianceName, 'inputTexture');
            
            // use custom toneMapping material if provided, otherwise fallback to utilMat
            const customMat = settings.toneMapping.material;
            if (customMat) {
                pass.addQueue(QueueHint.NONE).addFullscreenQuad(customMat, 0);
            } else {
                const utilMat = builtinResMgr.get<Material>('utilMtl');
                assert(!!utilMat, 'utilMtl is required for tone mapping');
                pass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMat, 0);
            }
        }

        return pass;
    }
}
