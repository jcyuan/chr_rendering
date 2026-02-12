import { assert, builtinResMgr, gfx, Material, renderer, rendering, Vec2 } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { IPostEffectConfig, IPostEffectEntry } from "./pass-settings";
import { RenderingContext } from "./rendering-context";
import { XQPipeline } from "./xq-pipeline";
import { XQPipelineSettings } from "../components/pipeline-settings";
import { TAAPassBuilder } from "./xq-taapass";

const { LoadOp, StoreOp } = gfx;
const { QueueHint } = rendering;

export class PostProcessPassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 500;

    private readonly _taa = new TAAPassBuilder(this._pipeline);
    private readonly _colorGradingTexSize = new Vec2(0, 0);

    getConfigOrder(): number {
        return 0;
    }

    getRenderOrder(): number {
        return PostProcessPassBuilder.RenderOrder;
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
            cameraInfo.getTextureName('postIntermediate'),
            cameraInfo.radianceFormat,
            cameraInfo.width, cameraInfo.height
        );
        ppl.addRenderTarget(
            cameraInfo.getTextureName('postLdrBuffer'),
            gfx.Format.RGBA8,
            cameraInfo.width, cameraInfo.height
        );
        this._taa.windowResize(ppl, builder, cameraInfo, window, camera, nativeWidth, nativeHeight);
    }

    public setup(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined {
        const inputColorName = context.colorName;
        const outputColorName = cameraInfo.windowColor;
        assert(inputColorName != outputColorName, "?? it's impossible to break from here");

        const settings = builder.settings;
        const w = cameraInfo.width;
        const h = cameraInfo.height;
        const nw = cameraInfo.nativeWidth;
        const nh = cameraInfo.nativeHeight;
        const intermediateName = cameraInfo.getTextureName('postIntermediate');
        const ldrIntermediateName = cameraInfo.getTextureName('postLdrBuffer');

        const preEffects: IPostEffectEntry[] = [];
        const postEffects: IPostEffectEntry[] = [];

        if (settings.bloom.enabled && !!settings.bloom.material) {
            preEffects.push({
                config: settings.bloom,
                execute: (input, output, pw, ph) =>
                    this._bloomPass(ppl, settings, pw, ph, input, output),
            });
        }

        const colorGradingEnabled = settings.colorGrading.enabled
            && !!settings.colorGrading.material
            && !!settings.colorGrading.colorGradingMap;
        const toneMappingEnabled = cameraInfo.HDREnabled || colorGradingEnabled;
        if (toneMappingEnabled) {
            preEffects.push({
                config: colorGradingEnabled ? settings.colorGrading : settings.toneMapping,
                execute: (input, output, pw, ph) =>
                    colorGradingEnabled
                        ? this._colorGradingPass(ppl, settings, pw, ph, input, output)
                        : this._tonemapPass(ppl, settings, pw, ph, input, output),
            });
        }

        if (settings.fxaa.enabled && !!settings.fxaa.material) {
            postEffects.push({
                config: settings.fxaa,
                execute: (input, output, pw, ph) =>
                    this._fxaaPass(ppl, settings, pw, ph, input, output),
            });
        }

        preEffects.sort((a, b) => a.config.renderOrder - b.config.renderOrder);
        postEffects.sort((a, b) => a.config.renderOrder - b.config.renderOrder);

        let currentColor = inputColorName;
        let lastPass: rendering.BasicRenderPassBuilder | undefined = prevRenderPass;

        for (const effect of preEffects) {
            lastPass = effect.execute(currentColor, intermediateName, w, h);
            currentColor = intermediateName;
        }

        context.colorName = currentColor;
        const taaPass = this._taa.setup(ppl, builder, cameraInfo, camera, context, lastPass);
        if (taaPass)
            lastPass = taaPass;
        currentColor = context.colorName;

        for (const effect of postEffects) {
            lastPass = effect.execute(currentColor, ldrIntermediateName, w, h);
            currentColor = ldrIntermediateName;
        }

        const fsrActive = settings.fsr.enabled && !!settings.fsr.material;
        if (fsrActive) {
            lastPass = this._fsrPass(ppl, settings, nw, nh, currentColor, outputColorName);
            currentColor = outputColorName;
        }

        if (currentColor !== outputColorName)
            lastPass = this._blitPass(ppl, nw, nh, currentColor, outputColorName);

        context.colorName = outputColorName;
        return lastPass;
    }

    private _blitPass(
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
        colorName: string
    ): rendering.BasicRenderPassBuilder {
        const pass = ppl.addRenderPass(width, height, 'tonemap');
        pass.name = 'toneMapping';
        pass.addRenderTarget(colorName, LoadOp.DISCARD, StoreOp.STORE);
        pass.addTexture(radianceName, 'inputTexture');

        const customMat = settings.toneMapping.material;
        if (customMat) {
            pass.addQueue(QueueHint.NONE).addFullscreenQuad(customMat, 0);
        } else {
            const utilMat = builtinResMgr.get<Material>('utilMtl');
            assert(!!utilMat, 'utilMtl is required for tone mapping');
            pass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMat, 0);
        }

        return pass;
    }

    private _colorGradingPass(
        ppl: rendering.BasicPipeline,
        settings: XQPipelineSettings,
        width: number,
        height: number,
        radianceName: string,
        colorName: string
    ): rendering.BasicRenderPassBuilder {
        assert(!!settings.colorGrading.material);
        assert(!!settings.colorGrading.colorGradingMap);

        const lutTex = settings.colorGrading.colorGradingMap;
        this._colorGradingTexSize.set(lutTex.width, lutTex.height);

        const isSquareMap = lutTex.width === lutTex.height;
        const pass = ppl.addRenderPass(width, height, isSquareMap ? 'cc-color-grading-8x8' : 'cc-color-grading-nx1');
        pass.name = 'colorGrading';
        pass.addRenderTarget(colorName, LoadOp.DISCARD, StoreOp.STORE);
        pass.addTexture(radianceName, 'sceneColorMap');
        pass.setVec2('lutTextureSize', this._colorGradingTexSize);
        pass.setFloat('contribute', settings.colorGrading.contribute);
        pass.addQueue(QueueHint.NONE).addFullscreenQuad(settings.colorGrading.material, isSquareMap ? 1 : 0);

        return pass;
    }

    private _bloomPass(
        ppl: rendering.BasicPipeline,
        settings: XQPipelineSettings,
        width: number,
        height: number,
        inputColor: string,
        outputColor: string
    ): rendering.BasicRenderPassBuilder {
        assert(!!settings.bloom.material);

        const pass = ppl.addRenderPass(width, height, 'bloom');
        pass.name = 'bloom';
        pass.addRenderTarget(outputColor, LoadOp.DISCARD, StoreOp.STORE);
        pass.addTexture(inputColor, 'inputTexture');
        pass.setFloat('threshold', settings.bloom.threshold);
        pass.setFloat('intensity', settings.bloom.intensity);
        pass.addQueue(QueueHint.NONE).addFullscreenQuad(settings.bloom.material, 0);

        return pass;
    }

    private _fxaaPass(
        ppl: rendering.BasicPipeline,
        settings: XQPipelineSettings,
        width: number,
        height: number,
        inputColor: string,
        outputColor: string
    ): rendering.BasicRenderPassBuilder {
        assert(!!settings.fxaa.material);

        const pass = ppl.addRenderPass(width, height, 'fxaa');
        pass.name = 'fxaa';
        pass.addRenderTarget(outputColor, LoadOp.DISCARD, StoreOp.STORE);
        pass.addTexture(inputColor, 'inputTexture');
        pass.addQueue(QueueHint.NONE).addFullscreenQuad(settings.fxaa.material, 0);

        return pass;
    }

    private _fsrPass(
        ppl: rendering.BasicPipeline,
        settings: XQPipelineSettings,
        width: number,
        height: number,
        inputColor: string,
        outputColor: string
    ): rendering.BasicRenderPassBuilder {
        assert(!!settings.fsr.material);

        const pass = ppl.addRenderPass(width, height, 'fsr');
        pass.name = 'fsr';
        pass.addRenderTarget(outputColor, LoadOp.DISCARD, StoreOp.STORE);
        pass.addTexture(inputColor, 'inputTexture');
        pass.setFloat('sharpness', settings.fsr.sharpness);
        pass.addQueue(QueueHint.NONE).addFullscreenQuad(settings.fsr.material, 0);

        return pass;
    }
}
