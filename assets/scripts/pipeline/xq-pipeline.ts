import { _decorator, builtinResMgr, director, gfx, Layers, PipelineEventType, renderer, rendering } from 'cc';
import { XQPipelineSettings } from '../components/pipeline-settings';
import { PipelineBuilderBase } from './builder-base';
import { CameraInfo } from "./camera-info";
import { _polyfillPPL } from './polyfill';
import { RenderingContext } from "./rendering-context";
import { MainPassBuilder } from './xq-mainpass';
import { XQPipelineFeatures } from './xq-pipeline-features';
import { PostProcessPassBuilder } from './xq-postpass';
import { PrePassBuilder } from './xq-prepass';
import { ShadowPassBuilder } from './xq-shadowpass';
import { SSSPassBuilder } from './xq-ssspass';
import { UIPassBuilder } from './xq-uipass';

const { requireComponent } = _decorator;

@requireComponent(XQPipelineSettings)
export class XQPipeline implements rendering.PipelineBuilder {
    private readonly _prePass = new PrePassBuilder(this);
    private readonly _shadowPass = new ShadowPassBuilder(this);
    private readonly _mainPass = new MainPassBuilder(this);
    private readonly _sssPass = new SSSPassBuilder(this);
    private readonly _postPass = new PostProcessPassBuilder(this);
    private readonly _uiPass = new UIPassBuilder(this);

    private readonly _passBuilders: PipelineBuilderBase[] = [
        this._prePass,
        this._sssPass,
        this._shadowPass,
        this._mainPass,
        this._postPass,
        this._uiPass
    ];
    
    private _settings: XQPipelineSettings;
    private _cameraInfo = new CameraInfo();
    private _features = new XQPipelineFeatures();
    private _renderingContext = new RenderingContext();

    private _viewport = new gfx.Viewport();
    private _clearColor = new gfx.Color();
    private _profileCamera: renderer.scene.Camera | null = null;

    private readonly _pipelineEvent = director.root.pipelineEvent;

    constructor() {
        this._passBuilders.sort((a, b) => {
            return a.getRenderOrder() - b.getRenderOrder();
        });
    }

    get features(): XQPipelineFeatures {
        return this._features;
    }

    get settings(): XQPipelineSettings {
        return this._settings;
    }

    get profileCamera(): renderer.scene.Camera | null {
        return this._profileCamera;
    }

    private _updateSettingsAndInfo(camera: renderer.scene.Camera): void {
        const isEditorView: boolean = camera.cameraUsage === renderer.scene.CameraUsage.SCENE_VIEW || camera.cameraUsage === renderer.scene.CameraUsage.PREVIEW;
        if (isEditorView) {
            const editorSettings = rendering.getEditorPipelineSettings() as XQPipelineSettings | null;
            this._settings = editorSettings ?? XQPipelineSettings.defaultSettings;
        } else
            this._settings = (camera.pipelineSettings as XQPipelineSettings) ?? XQPipelineSettings.defaultSettings;
        
        this._cameraInfo.reset(camera, this);
    }

    public windowResize(pipeline: rendering.BasicPipeline, window: renderer.RenderWindow, camera: renderer.scene.Camera, nativeWidth: number, nativeHeight: number): void {
        _polyfillPPL(pipeline);

        this._features.reset(pipeline);
        this._updateSettingsAndInfo(camera);

        pipeline.addRenderWindow(this._cameraInfo.windowColor, gfx.Format.RGBA8, nativeWidth, nativeHeight, window, this._cameraInfo.windowDepthStencil);
        
        for (const builder of this._passBuilders)
            builder.windowResize?.(pipeline, this, this._cameraInfo, window, camera, nativeWidth, nativeHeight);
    }

    private get _dependeiciesReady() {
        // attach PipelineDependenciesLoader onto the main camera to initialize those necessary materials
        const utilMat = builtinResMgr.get('utilMtl');
        return !!utilMat;
    }

    public setup(cameras: renderer.scene.Camera[], ppl: rendering.BasicPipeline): void {
        if (!this._dependeiciesReady)
            return;

        _polyfillPPL(ppl);
        
        this._profileCamera = CameraInfo.decideProfilerCamera(cameras);
        
        for (const camera of cameras) {
            if (!camera.scene || !camera.window)
                continue;

            this._updateSettingsAndInfo(camera);

            for (const builder of this._passBuilders)
                builder.updateGlobalResources?.(ppl, this, this._cameraInfo);

            this._pipelineEvent.emit(PipelineEventType.RENDER_CAMERA_BEGIN, camera);

            if ((camera.visibility & (Layers.Enum.DEFAULT)) !== 0) {
                this._renderingContext.reset();
                for (const builder of this._passBuilders) {
                    if (!builder.setup)
                        continue;
                    this._renderingContext.lastPass = builder.setup(ppl, this, this._cameraInfo, camera, this._renderingContext, this._renderingContext.lastPass);
                }
            }
            else
                this._buildSimplePipeline(ppl, this._cameraInfo);
            
            this._pipelineEvent.emit(PipelineEventType.RENDER_CAMERA_END, camera);
        }
    }

    public findFirstPassBuilderByOrder(order: number): rendering.PipelinePassBuilder | null {
        return this._passBuilders.find(builder => builder.getRenderOrder() === order) ?? null;
    }

    private _buildSimplePipeline(ppl: rendering.BasicPipeline, info: CameraInfo) {
        const camera = info.camera;
        
        info.fillClearColor(this._clearColor, true);
        info.fillViewport(this._viewport);

        const pass = ppl.addRenderPass(info.width, info.height);
        pass.setViewport(this._viewport);

        if (info.needClearColor)
            pass.addRenderTarget(info.windowColor, gfx.LoadOp.CLEAR, gfx.StoreOp.STORE, this._clearColor);
        else
            pass.addRenderTarget(info.windowColor, gfx.LoadOp.LOAD, gfx.StoreOp.STORE);
            
        if (info.needDepthStencil)
            pass.addDepthStencil(info.windowDepthStencil, gfx.LoadOp.CLEAR, gfx.StoreOp.DISCARD, camera.clearDepth, camera.clearStencil,
                                    camera.clearFlag & gfx.ClearFlagBit.DEPTH_STENCIL);
        else
            pass.addDepthStencil(info.windowDepthStencil, gfx.LoadOp.LOAD, gfx.StoreOp.DISCARD);
        
        pass.addQueue(rendering.QueueHint.OPAQUE).addScene(camera, rendering.SceneFlags.OPAQUE | rendering.SceneFlags.MASK | rendering.SceneFlags.GEOMETRY);
        const queue = pass.addQueue(rendering.QueueHint.BLEND)
        queue.addScene(camera, rendering.SceneFlags.BLEND);
        queue.addScene(camera, rendering.SceneFlags.UI);
        queue.addDraw2D(camera);

        if (info.isProfilerLayerCamera(this._profileCamera)) {
            pass.showStatistics = true;
            queue.addProfiler(camera);
        }
    }
}

rendering && rendering.setCustomPipeline('XQPipeline', new XQPipeline());
