import { gfx, renderer, rendering, sys, Vec2, Vec4 } from "cc";

export class XQPipelineFeatures {
    private _isWeb: boolean = false;
    private _isWebGL1: boolean = false;
    private _isWebGL2: boolean = false;
    private _isWebGPU: boolean = false;
    private _isMobile: boolean = false;
    private _isHDR: boolean = false;
    private _useFloatOutput: boolean = false;
    private _toneMappingType: number = 0;
    private _shadowEnabled: boolean = false;
    private _csmSupported: boolean = false;
    private _shadowMapFormat = gfx.Format.RGBA8;
    private _shadowMapSize: Vec2 = new Vec2(1024, 1024);
    private _usePlanarShadow: boolean = false;
    private _screenSpaceSignY: number = 1;
    private _supportDepthSample: boolean = false;
    private _platform: { x: number; w: number } = { x: 0, w: 0 };
    private _SSSSEnabled: boolean = false;
    private _mobileMaxSpotLightShadowMaps: number = 1;

    reset(pipeline: rendering.BasicPipeline) {
        const sampleFeature = gfx.FormatFeatureBit.SAMPLED_TEXTURE | gfx.FormatFeatureBit.LINEAR_FILTER;
        const device = pipeline.device;
        
        this._isWeb = !sys.isNative;
        this._isWebGL1 = device.gfxAPI === gfx.API.WEBGL;
        this._isWebGL2 = device.gfxAPI === gfx.API.WEBGL2;
        this._isWebGPU = device.gfxAPI === gfx.API.WEBGPU;
        this._isMobile = sys.isMobile;

        this._isHDR = pipeline.pipelineSceneData.isHDR;
        this._useFloatOutput = pipeline.getMacroBool('CC_USE_FLOAT_OUTPUT');
        this._toneMappingType = pipeline.pipelineSceneData.postSettings.toneMappingType;

        this._SSSSEnabled = pipeline.pipelineSceneData.skin.enabled;

        this._csmSupported = pipeline.pipelineSceneData.csmSupported;

        const shadowInfo = pipeline.pipelineSceneData.shadows;
        this._shadowEnabled = shadowInfo.enabled;

        this._shadowMapFormat = (device.getFormatFeatures(gfx.Format.R32F) & (gfx.FormatFeatureBit.RENDER_TARGET | gfx.FormatFeatureBit.SAMPLED_TEXTURE))  
                                === (gfx.FormatFeatureBit.RENDER_TARGET | gfx.FormatFeatureBit.SAMPLED_TEXTURE)  
                                && !(device.gfxAPI === gfx.API.WEBGL)
                            ? gfx.Format.R32F : gfx.Format.RGBA8;
        this._shadowMapSize.set(shadowInfo.size);
        this._usePlanarShadow = shadowInfo.enabled && shadowInfo.type === renderer.scene.ShadowType.Planar;

        this._screenSpaceSignY = pipeline.device.capabilities.screenSpaceSignY;
        this._supportDepthSample = (pipeline.device.getFormatFeatures(gfx.Format.DEPTH_STENCIL) & sampleFeature) === sampleFeature;

        this._platform.x = this._isMobile ? 1.0 : 0.0;
        this._platform.w = (this._screenSpaceSignY * 0.5 + 0.5) << 1 | (device.capabilities.clipSpaceSignY * 0.5 + 0.5);
    }

    get isWeb(): boolean {
        return this._isWeb;
    }

    get isWebGL1(): boolean {
        return this._isWebGL1;
    }
    
    get isWebGL2(): boolean {
        return this._isWebGL2;
    }

    get isWebGPU(): boolean {
        return this._isWebGPU;
    }
    
    get isMobile(): boolean {
        return this._isMobile;
    }

    get isHDR(): boolean {
        return this._isHDR;
    }
    
    get useFloatOutput(): boolean {
        return this._useFloatOutput;
    }

    get toneMappingType(): number {
        return this._toneMappingType;
    }

    get SSSSEnabled(): boolean {
        return this._SSSSEnabled;
    }
    
    get shadowEnabled(): boolean {
        return this._shadowEnabled;
    }

    get csmSupported(): boolean {
        return this._csmSupported;
    }
    
    get mobileMaxSpotLightShadowMaps(): number {
        return this._mobileMaxSpotLightShadowMaps;
    }

    get shadowMapFormat() {
        return this._shadowMapFormat;
    }
    
    get shadowMapSize() {
        return this._shadowMapSize;
    }

    get usePlanarShadow(): boolean {
        return this._usePlanarShadow;
    }
    
    get screenSpaceSignY(): number {
        return this._screenSpaceSignY;
    }

    get supportDepthSample(): boolean {
        return this._supportDepthSample;
    }

    get platformFlag(): number {
        return this._platform.x;
    }

    get clipSpaceSignY(): number {
        return this._platform.w;
    }

    fillPlatformVec4(vec4: Vec4) {
        vec4.x = this._platform.x;
        vec4.w = this._platform.w;

        return vec4;
    }
}
