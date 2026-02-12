import { assert, builtinResMgr, gfx, Mat4, Material, renderer, rendering, Vec4 } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { pipelineUtils } from "./utils";
import { XQPipeline } from "./xq-pipeline";
import { EDITOR } from "cc/env";

const { LoadOp, StoreOp } = gfx;
const { QueueHint, ResourceResidency } = rendering;

enum TAAMode {
    First,
    TAA,
    SSAA,
}

const _mat4a = new Mat4();
const _mat4b = new Mat4();

export class TAAPassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 500;

    private _prevViewProj = new Mat4();
    private _taaParams = new Vec4();
    private _motionCol0 = new Vec4();
    private _motionCol1 = new Vec4();
    private _motionCol2 = new Vec4();
    private _motionCol3 = new Vec4();
    private _staticFrameCount = 0;
    private _initFrames = 0;

    public getConfigOrder(): number {
        return 0;
    }

    public getRenderOrder(): number {
        return TAAPassBuilder.RenderOrder;
    }

    public windowResize(
        ppl: rendering.BasicPipeline,
        _builder: XQPipeline,
        cameraInfo: CameraInfo,
        _window: renderer.RenderWindow,
        _camera: renderer.scene.Camera,
        _nativeWidth: number,
        _nativeHeight: number
    ): void {
        if (EDITOR)
            return;

        const format = gfx.Format.RGBA8;
        const w = cameraInfo.width;
        const h = cameraInfo.height;

        ppl.addRenderTarget(
            cameraInfo.getTextureName('taaFrame0'),
            format, w, h,
            ResourceResidency.PERSISTENT
        );

        ppl.addRenderTarget(
            cameraInfo.getTextureName('taaFrame1'),
            format, w, h,
            ResourceResidency.PERSISTENT
        );

        this.reset();
    }

    public reset(): void {
        this._initFrames = 0;
        this._staticFrameCount = 0;
    }

    public setup(
        ppl: rendering.BasicPipeline,
        _builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        _prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined {
        if (EDITOR)
            return undefined;
        
        const utilMtl = builtinResMgr.get<Material>('utilMtl');
        assert(!!utilMtl, 'utilMtl is required for TAA pass');

        const jitterValue = pipelineUtils.jitter.value;
        const switchFlag = jitterValue.z > 0;
        const frame0 = cameraInfo.getTextureName('taaFrame0');
        const frame1 = cameraInfo.getTextureName('taaFrame1');
        const readFrame = switchFlag ? frame0 : frame1;
        const writeFrame = switchFlag ? frame1 : frame0;

        let mode: TAAMode;
        const isInit = this._initFrames < 2;
        if (isInit) {
            mode = TAAMode.First;
            this._initFrames++;
            this._staticFrameCount = 0;
        } else {
            if (Mat4.equals(camera.matViewProj, this._prevViewProj)) {
                mode = TAAMode.SSAA;
                this._staticFrameCount++;
            } else {
                mode = TAAMode.TAA;
                this._staticFrameCount = 0;
            }
        }

        Mat4.invert(_mat4a, camera.matView);
        Mat4.multiply(_mat4b, this._prevViewProj, _mat4a);

        this._motionCol0.set(_mat4b.m00, _mat4b.m01, _mat4b.m02, _mat4b.m03);
        this._motionCol1.set(_mat4b.m04, _mat4b.m05, _mat4b.m06, _mat4b.m07);
        this._motionCol2.set(_mat4b.m08, _mat4b.m09, _mat4b.m10, _mat4b.m11);
        this._motionCol3.set(_mat4b.m12, _mat4b.m13, _mat4b.m14, _mat4b.m15);

        this._taaParams.x = mode;
        this._taaParams.y = 1.0 / Math.max(this._staticFrameCount, 1);

        const w = cameraInfo.width;
        const h = cameraInfo.height;

        if (isInit) {
            const initPass = ppl.addRenderPass(w, h, 'screen-blit');
            initPass.name = 'taaInitHistory';
            initPass.addRenderTarget(readFrame, LoadOp.DISCARD, StoreOp.STORE);
            initPass.addTexture(context.colorName, 'inputTexture');
            initPass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMtl, 1);
        }

        const pass = ppl.addRenderPass(w, h, 'taa-resolve');
        pass.name = 'taaResolve';
        pass.addRenderTarget(writeFrame, LoadOp.DISCARD, StoreOp.STORE);
        pass.addTexture(context.colorName, 'currentInput');
        pass.addTexture(readFrame, 'historyInput');
        pass.addTexture(cameraInfo.sceneDepthPacked, 'depthInput');

        pass.setVec4('jitterInfo', jitterValue);
        pass.setVec4('taaMotion0', this._motionCol0);
        pass.setVec4('taaMotion1', this._motionCol1);
        pass.setVec4('taaMotion2', this._motionCol2);
        pass.setVec4('taaMotion3', this._motionCol3);
        pass.setVec4('taaParams', this._taaParams);

        pass.addQueue(QueueHint.NONE).addFullscreenQuad(utilMtl, 4);

        context.colorName = writeFrame;

        Mat4.copy(this._prevViewProj, camera.matViewProj);

        return pass;
    }
}
