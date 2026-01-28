import { gfx, ReflectionProbeManager, renderer, rendering, Vec3, warn } from "cc";
import { DEBUG, EDITOR } from "cc/env";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { XQPipeline } from "./xq-pipeline";
import { ShadowPassBuilder } from "./xq-shadowpass";

const { ClearFlagBit, Color, Format, LoadOp, StoreOp, TextureType, Viewport } = gfx;
const { scene } = renderer;
const { LightType } = scene;
const { QueueHint, ResourceFlags, ResourceResidency, SceneFlags } = rendering;

export class MainPassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 300;

    private _viewport = new Viewport();
    private _clearColor = new Color();
    private _reflectionProbeClearColor = new Vec3(0, 0, 0);

    public getConfigOrder(): number {
        return 0;
    }

    public getRenderOrder(): number {
        return MainPassBuilder.RenderOrder;
    }

    private _needOffscreenRT(builder: XQPipeline, cameraInfo: CameraInfo): { enableShadingScale: boolean; needOffscreen: boolean } {
        const settings = builder.settings;
        const enableShadingScale = settings.enableShadingScale && cameraInfo.shadingScale !== 1;
        const enableColorGrading = settings.colorGrading.enabled
            && !!settings.colorGrading.material
            && !!settings.colorGrading.colorGradingMap;
        const needPostProcess = cameraInfo.HDREnabled || enableColorGrading;
        // MSAA also needs off-screen RT as resolve target
        const needOffscreen = needPostProcess || enableShadingScale || cameraInfo.MSAAEnabled;
        return { enableShadingScale, needOffscreen };
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
        const width = cameraInfo.width;
        const height = cameraInfo.height;
        const radianceFormat = cameraInfo.radianceFormat;

        const { enableShadingScale, needOffscreen } = this._needOffscreenRT(builder, cameraInfo);
        if (needOffscreen) {
            const colorName = enableShadingScale ? cameraInfo.scaledRadianceColor : cameraInfo.radianceColor;
            const dsName = enableShadingScale ? cameraInfo.scaledDepthStencil : cameraInfo.depthStencil;
            ppl.addRenderTarget(colorName, radianceFormat, width, height);
            ppl.addDepthStencil(dsName, Format.DEPTH_STENCIL, width, height);
        }

        if (cameraInfo.MSAAEnabled) {
            const sampleCount = builder.settings.msaa.sampleCount;
            const format = cameraInfo.HDREnabled ? radianceFormat : Format.RGBA8;
            ppl.addTexture(cameraInfo.msaaRadiance, TextureType.TEX2D, format, width, height, 1, 1, 1,
                sampleCount, ResourceFlags.COLOR_ATTACHMENT, ResourceResidency.MEMORYLESS);
            ppl.addTexture(cameraInfo.msaaDepthStencil, TextureType.TEX2D, Format.DEPTH_STENCIL, width, height, 1, 1, 1,
                sampleCount, ResourceFlags.DEPTH_STENCIL_ATTACHMENT, ResourceResidency.MEMORYLESS);
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
        this._tryAddReflectionProbePasses(ppl, builder, cameraInfo, cameraInfo.mainLight, camera.scene);

        // decide render target based on post-processing needs
        const { enableShadingScale, needOffscreen } = this._needOffscreenRT(builder, cameraInfo);
        if (needOffscreen) {
            context.colorName = enableShadingScale ? cameraInfo.scaledRadianceColor : cameraInfo.radianceColor;
            context.depthStencilName = enableShadingScale ? cameraInfo.scaledDepthStencil : cameraInfo.depthStencil;
        } else {
            context.colorName = cameraInfo.windowColor;
            context.depthStencilName = cameraInfo.windowDepthStencil;
        }

        cameraInfo.fillClearColor(this._clearColor);
        cameraInfo.fillViewport(this._viewport);
        
        const pass = this._addForwardSingleRadiancePass(
                            ppl, builder, cameraInfo, camera, cameraInfo.width, cameraInfo.height,
                            cameraInfo.mainLight, context.colorName, context.depthStencilName,
                            StoreOp.DISCARD, cameraInfo.MSAAEnabled
                        );
        if (cameraInfo.mainLightPlanarShadowMapEnabled) {
            pass.addQueue(QueueHint.BLEND, 'planar-shadow')
                        .addScene(
                            camera,
                            SceneFlags.SHADOW_CASTER | SceneFlags.PLANAR_SHADOW | SceneFlags.BLEND,
                            cameraInfo.mainLight
                        );
        }
        
        const sceneFlags = SceneFlags.BLEND | (camera.geometryRenderer ? SceneFlags.GEOMETRY : SceneFlags.NONE);
        pass.addQueue(QueueHint.BLEND).addScene(camera, sceneFlags, cameraInfo.mainLight);

        return pass;
    }

    private _addForwardSingleRadiancePass(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        width: number,
        height: number,
        mainLight: renderer.scene.DirectionalLight | undefined,
        colorName: string,
        depthStencilName: string,
        depthStencilStoreOp: gfx.StoreOp,
        enableMSAA: boolean = false
    ): rendering.BasicRenderPassBuilder {
        let pass: rendering.BasicRenderPassBuilder;

        if (enableMSAA) {
            const msaaRadianceName = cameraInfo.msaaRadiance;
            const msaaDepthStencilName = cameraInfo.msaaDepthStencil;

            const msPass = ppl.addMultisampleRenderPass(width, height, builder.settings.msaa.sampleCount, 0, 'default');
            msPass.name = 'msaaForwardPass';

            // MSAA always discards depth stencil (cannot resolve MS depth cross-platform)
            this._buildForwardMainLightPass(msPass, builder, cameraInfo, camera,
                msaaRadianceName, msaaDepthStencilName, StoreOp.DISCARD, mainLight, true);

            msPass.resolveRenderTarget(msaaRadianceName, colorName);

            pass = msPass;
        } else {
            pass = ppl.addRenderPass(width, height, 'default');
            pass.name = 'forwardPass';
            this._buildForwardMainLightPass(pass, builder, cameraInfo, camera, colorName, depthStencilName, depthStencilStoreOp, mainLight, false);
        }

        const shadowPassBuilder = builder.findFirstPassBuilderByOrder(ShadowPassBuilder.RenderOrder) as ShadowPassBuilder;
        this._addLightQueues(camera, shadowPassBuilder.lights, pass);

        let i = 0;
        for (const light of shadowPassBuilder.shadowEnabledSpotLights) {
            pass.addTexture(`spotShadowMap${i}`, 'cc_spotShadowMap');
            const queue = pass.addQueue(rendering.QueueHint.BLEND, 'forward-add');
            queue.addScene(camera, rendering.SceneFlags.BLEND, light);
            ++i;

            if (i >= builder.features.mobileMaxSpotLightShadowMaps)
                break;
        }

        return pass;
    }

    private _addLightQueues(camera: renderer.scene.Camera, lights: renderer.scene.Light[], pass: rendering.BasicRenderPassBuilder): void {
        for (const light of lights) {
            const queue = pass.addQueue(rendering.QueueHint.BLEND, 'forward-add');
            switch (light.type) {
                case LightType.SPHERE:
                    queue.name = 'sphere-light';
                    break;
                case LightType.SPOT:
                    queue.name = 'spot-light';
                    break;
                case LightType.POINT:
                    queue.name = 'point-light';
                    break;
                case LightType.RANGED_DIRECTIONAL:
                    queue.name = 'ranged-directional-light';
                    break;
                default:
                    queue.name = 'unknown-light';
            }
            queue.addScene(
                camera,
                rendering.SceneFlags.BLEND,
                light,
            );
        }
    }

    private _buildForwardMainLightPass(
        pass: rendering.BasicRenderPassBuilder,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        colorName: string,
        depthStencilName: string,
        depthStencilStoreOp: gfx.StoreOp,
        mainLight: renderer.scene.DirectionalLight | undefined,
        isMSAA: boolean = false
    ) {
        pass.setViewport(this._viewport);

        const colorStoreOp = isMSAA ? StoreOp.DISCARD : StoreOp.STORE;

        if (cameraInfo.needClearColor)
            pass.addRenderTarget(colorName, LoadOp.CLEAR, colorStoreOp, this._clearColor);
        else
            pass.addRenderTarget(colorName, LoadOp.LOAD, colorStoreOp);

        if (DEBUG && !isMSAA) {
            if (colorName === cameraInfo.windowColor &&
                depthStencilName !== cameraInfo.windowDepthStencil) {
                warn('Default framebuffer cannot use custom depth stencil buffer');
            }
        }

        if (cameraInfo.needDepthStencil)
            pass.addDepthStencil(
                depthStencilName,
                LoadOp.CLEAR,
                depthStencilStoreOp,
                camera.clearDepth,
                camera.clearStencil,
                camera.clearFlag & ClearFlagBit.DEPTH_STENCIL,
            );
        else
            pass.addDepthStencil(depthStencilName, LoadOp.LOAD, depthStencilStoreOp);

        const shadowPassBuilder = builder.findFirstPassBuilderByOrder(ShadowPassBuilder.RenderOrder) as ShadowPassBuilder;
        if (cameraInfo.mainLightShadowMapEnabled && shadowPassBuilder.lights.length > 0)
            pass.addTexture(cameraInfo.shadowMap, 'cc_shadowMap');

        pass.addQueue(QueueHint.NONE)
            .addScene(camera, SceneFlags.OPAQUE | SceneFlags.MASK, mainLight || undefined, camera.scene || undefined);
    }

    private _tryAddReflectionProbePasses(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        mainLight: renderer.scene.DirectionalLight | undefined,
        scene: renderer.RenderScene | undefined,
    ): void {
        const reflectionProbeManager = ReflectionProbeManager.probeManager;
        if (!reflectionProbeManager)
            return;
        
        const probes = reflectionProbeManager.getProbes();
        const maxProbeCount = 4;
        let probeID = 0;
        for (const probe of probes) {
            if (!probe.needRender)
                continue;
            
            const area = probe.renderArea();
            const width = Math.max(Math.floor(area.x), 1);
            const height = Math.max(Math.floor(area.y), 1);

            if (probe.probeType === renderer.scene.ProbeType.PLANAR) {
                if (!cameraInfo.planarReflectionProbeEnabled)
                    continue;
                
                const window = probe.realtimePlanarTexture!.window!;
                const colorName = `planarProbeRT${probeID}`;
                const depthStencilName = `planarProbeDS${probeID}`;

                ppl.addRenderWindow(colorName,
                    cameraInfo.radianceFormat, width, height, window);
                ppl.addDepthStencil(depthStencilName,
                    gfx.Format.DEPTH_STENCIL, width, height, ResourceResidency.MEMORYLESS);

                const probePass = ppl.addRenderPass(width, height, 'default');
                probePass.name = `planarReflectionProbe${probeID}`;
                this._buildReflectionProbePass(probePass, builder, cameraInfo, probe.camera, colorName, depthStencilName, mainLight, scene);

            } else if (EDITOR) {
                for (let faceIdx = 0; faceIdx < probe.bakedCubeTextures.length; faceIdx++) {
                    probe.updateCameraDir(faceIdx);
                    const window = probe.bakedCubeTextures[faceIdx].window!;
                    const colorName = `cubeProbeRT${probeID}${faceIdx}`;
                    const depthStencilName = `cubeProbeDS${probeID}${faceIdx}`;
                    
                    ppl.addRenderWindow(colorName, cameraInfo.radianceFormat, width, height, window);
                    ppl.addDepthStencil(depthStencilName, gfx.Format.DEPTH_STENCIL, width, height, ResourceResidency.MEMORYLESS);

                    const probePass = ppl.addRenderPass(width, height, 'default');
                    probePass.name = `cubeProbe${probeID}${faceIdx}`;
                    this._buildReflectionProbePass(probePass, builder, cameraInfo, probe.camera, colorName, depthStencilName, mainLight, scene);
                }

                probe.needRender = false;
            }

            ++probeID;

            if (probeID === maxProbeCount)
                break;
        }
    }

    private _buildReflectionProbePass(
        pass: rendering.BasicRenderPassBuilder,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        colorName: string,
        depthStencilName: string,
        mainLight: renderer.scene.DirectionalLight | undefined,
        scene: renderer.RenderScene | undefined,
    ): void {
        if (cameraInfo.needClearColor) {
            cameraInfo.fillClearColor(this._reflectionProbeClearColor);
            const clearColor = rendering.packRGBE(this._reflectionProbeClearColor);
            this._clearColor.x = clearColor.x;
            this._clearColor.y = clearColor.y;
            this._clearColor.z = clearColor.z;
            this._clearColor.w = clearColor.w;
            pass.addRenderTarget(colorName, LoadOp.CLEAR, StoreOp.STORE, this._clearColor);
        } else
            pass.addRenderTarget(colorName, LoadOp.LOAD, StoreOp.STORE);

        if (cameraInfo.needDepthStencil) {
            pass.addDepthStencil(
                depthStencilName,
                LoadOp.CLEAR,
                StoreOp.DISCARD,
                camera.clearDepth,
                camera.clearStencil,
                camera.clearFlag & ClearFlagBit.DEPTH_STENCIL,
            );
        } else
            pass.addDepthStencil(depthStencilName, LoadOp.LOAD, StoreOp.DISCARD);

        const shadowPassBuilder = builder.findFirstPassBuilderByOrder(ShadowPassBuilder.RenderOrder) as ShadowPassBuilder;
        if (cameraInfo.mainLightShadowMapEnabled && shadowPassBuilder.lights.length > 0)
            pass.addTexture(cameraInfo.shadowMap, 'cc_shadowMap');

        pass.addQueue(QueueHint.NONE, 'reflect-map')
            .addScene(camera, SceneFlags.OPAQUE | SceneFlags.MASK | SceneFlags.REFLECTION_PROBE, mainLight, scene);
    }
}
