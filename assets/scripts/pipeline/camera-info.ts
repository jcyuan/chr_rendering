import { gfx, renderer, Vec3 } from "cc";
import { cameraUtils } from "./utils";
import { WindowInfo } from "./windowInfo";
import { XQPipeline } from "./xq-pipeline";

export class CameraInfo extends WindowInfo {
    private _camera: renderer.scene.Camera;
    
    private _radianceFormat: gfx.Format;
    private _HDREnabled: boolean;
    private _SSSSEnabled: boolean = false;
    private _needOffscreenDepth: boolean = false;
    private _shadowMapFormat: gfx.Format = gfx.Format.RGBA8;
    private _mainLightShadowMapEnabled: boolean = false;
    private _mainLightPlanarShadowMapEnabled: boolean = false;
    private _planarReflectionProbeEnabled: boolean = false;
    
    private _isMainGameWindow: boolean = false;
    private _isGameView: boolean = false;
    
    reset(camera: renderer.scene.Camera, pipeline: XQPipeline): void {
        const windowInfo = cameraUtils.updateWindowInfo(camera, pipeline.settings);

        this._camera = camera;
        const settings = pipeline.settings;

        super.set(
            windowInfo.id,
            windowInfo.nativeWidth,
            windowInfo.nativeHeight,
            settings.enableShadingScale ? settings.shadingScale : 1
        );

        const features = pipeline.features;
        
        this._HDREnabled = features.isHDR;
        this._radianceFormat = this._HDREnabled ? gfx.Format.RGBA16F : gfx.Format.RGBA8;

        this._SSSSEnabled = settings.skin?.enabled ?? false;
        this._needOffscreenDepth = this._SSSSEnabled; // || settings.somePostEfxNeedDepthTexture?.enabled;
        
        this._shadowMapFormat = features.shadowMapFormat;
        
        const scene = camera.scene;
        const mainLight = scene?.mainLight;
        this._mainLightShadowMapEnabled = features.shadowEnabled
            && !features.usePlanarShadow
            && !!scene
            && !!mainLight
            && mainLight.shadowEnabled;
            
        this._mainLightPlanarShadowMapEnabled = features.shadowEnabled
            && features.usePlanarShadow
            && !!scene
            && !!mainLight
            && mainLight.shadowEnabled;

        this._isMainGameWindow = camera.cameraUsage === renderer.scene.CameraUsage.GAME && !!camera.window.swapchain;
        this._isGameView = this._isMainGameWindow || camera.cameraUsage === renderer.scene.CameraUsage.GAME_VIEW;

        this._planarReflectionProbeEnabled = this._isMainGameWindow
            || camera.cameraUsage === renderer.scene.CameraUsage.SCENE_VIEW
            || camera.cameraUsage === renderer.scene.CameraUsage.GAME_VIEW;
    }

    get camera(): renderer.scene.Camera {
        return this._camera;
    }

    get windowColor(): string {
        return `windowColor${this.id}`;
    }

    get windowDepthStencil(): string {
        return `windowDepthStencil${this.id}`;
    }

    get radianceColor(): string {
        return `radianceColor${this.id}`;
    };

    get depthStencil(): string {
        return `depthStencil${this.id}`;
    };

    get sceneDepthPacked(): string {
        return `sceneDepthPacked${this.id}`;
    }

    get radianceFormat() {
        return this._radianceFormat;
    }

    get isMainGameWindow(): boolean {
        return this._isMainGameWindow;
    }

    get isGameView(): boolean {
        return this._isGameView;
    }

    get planarReflectionProbeEnabled(): boolean {
        return this._planarReflectionProbeEnabled;
    }

    get HDREnabled(): boolean {
        return this._HDREnabled;
    }
    
    get shadowMap(): string {
        return `shadowMap${this.id}`;
    }
    
    get shadowDepth(): string {
        return `shadowDepth${this.id}`;
    }

    getTextureName(name: string) {
        return `${name}${this.id}`;
    }
    
    get shadowMapFormat() {
        return this._shadowMapFormat;
    }
    
    get mainLightShadowMapEnabled(): boolean {
        return this._mainLightShadowMapEnabled;
    }

    get mainLightPlanarShadowMapEnabled(): boolean {
        return this._mainLightPlanarShadowMapEnabled;
    }

    get SSSSEnabled(): boolean {
        return this._SSSSEnabled;
    }

    get needOffscreenDepth(): boolean {
        return this._needOffscreenDepth;
    }

    get mainLight(): renderer.scene.DirectionalLight | undefined {
        return this._camera.scene?.mainLight ?? undefined;
    }
    
    get scene(): renderer.RenderScene | undefined {
        return this._camera.scene ?? undefined;
    }
    
    get needClearColor() {
        return !!(this._camera.clearFlag & (gfx.ClearFlagBit.COLOR | (gfx.ClearFlagBit.STENCIL << 1)));
    }

    get needDepth() {
        return !!(this._camera.clearFlag & gfx.ClearFlagBit.DEPTH);
    }

    get needStencil() {
        return !!(this._camera.clearFlag & gfx.ClearFlagBit.STENCIL);
    }

    get needDepthStencil() {
        return !!(this._camera.clearFlag & gfx.ClearFlagBit.DEPTH_STENCIL);
    }

    isProfilerLayerCamera(profileCamera: renderer.scene.Camera) {
        if (this._camera !== profileCamera)
            return false;
        return true;
    }

    static decideProfilerCamera(cameras: renderer.scene.Camera[]) {
        for (let i = cameras.length - 1; i >= 0; --i) {
            const camera = cameras[i];
            if (!!camera.window.swapchain) {
                return camera;
            }
        }
        
        return null;
    }

    fillViewport(out: gfx.Viewport, scale: number = 1) {
        const src = this._camera.viewport;
        out.left = Math.round(src.x * this.width * scale);
        out.top = Math.round(src.y * this.height * scale);
        out.width = Math.max(Math.round(src.width * this.width * scale), 1);
        out.height = Math.max(Math.round(src.height * this.height * scale), 1);

        return out;
    }
    
    fillClearColor<T extends gfx.Color | Vec3>(out: T, outputLinear?: boolean): T {
        const clearColor = this._camera.clearColor;

        out.x = clearColor.x;
        out.y = clearColor.y;
        out.z = clearColor.z;

        if (outputLinear === true) {
            out.x = out.x * out.x;
            out.y = out.y * out.y;
            out.z = out.z * out.z;
        }

        if (out instanceof gfx.Color)
            out.w = clearColor.w;

        return out;
    }
}
