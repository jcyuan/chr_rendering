import { gfx, ReflectionProbeManager, renderer, rendering, Vec3, warn } from "cc";
import { DEBUG, EDITOR } from "cc/env";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { XQPipeline } from "./xq-pipeline";
import { ShadowPassBuilder } from "./xq-shadowpass";

const { ClearFlagBit, Color, LoadOp, StoreOp, Viewport } = gfx;
const { scene } = renderer;
const { LightType } = scene;
const { QueueHint, ResourceResidency, SceneFlags } = rendering;

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
        ppl.addRenderTarget(cameraInfo.radianceColor, radianceFormat, width, height);
    }

    public setup(
        ppl: rendering.BasicPipeline,
        builder: XQPipeline,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        prevRenderPass?: rendering.BasicRenderPassBuilder
    ): rendering.BasicRenderPassBuilder | undefined {
        this._tryAddReflectionProbePasses(ppl, cameraInfo, cameraInfo.mainLight, camera.scene);

        context.colorName = cameraInfo.radianceColor;

        cameraInfo.fillClearColor(this._clearColor);
        cameraInfo.fillViewport(this._viewport);
        
        const pass = this._addForwardSingleRadiancePass(ppl, builder, cameraInfo, camera, context);
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
        context: RenderingContext,
    ): rendering.BasicRenderPassBuilder {
        const { width, height, mainLight } = cameraInfo;

        const pass = ppl.addRenderPass(width, height, 'default');
        pass.name = 'forwardPass';
        this._buildForwardMainLightPass(pass, cameraInfo, camera, context, mainLight);
        
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

    private _buildForwardMainLightPass(
        pass: rendering.BasicRenderPassBuilder,
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        context: RenderingContext,
        mainLight?: renderer.scene.DirectionalLight
    ) {
        pass.setViewport(this._viewport);

        if (cameraInfo.needClearColor)
            pass.addRenderTarget(context.colorName, LoadOp.CLEAR, StoreOp.STORE, cameraInfo.fillClearColor<gfx.Color>(this._clearColor, true));
        else
            pass.addRenderTarget(context.colorName, LoadOp.LOAD, StoreOp.STORE);

        if (DEBUG) {
            if (context.colorName === cameraInfo.windowColor &&
                context.depthStencilName !== cameraInfo.windowDepthStencil) {
                warn('Default framebuffer cannot use custom depth stencil buffer');
            }
        }

        if (cameraInfo.needDepthStencil)
            pass.addDepthStencil(
                context.depthStencilName,
                LoadOp.CLEAR,
                StoreOp.STORE,
                camera.clearDepth,
                camera.clearStencil,
                camera.clearFlag & ClearFlagBit.DEPTH_STENCIL,
            );
        else
            pass.addDepthStencil(
                context.depthStencilName,
                LoadOp.LOAD,
                StoreOp.STORE
            );

        if (cameraInfo.mainLightShadowMapEnabled)
            pass.addTexture(cameraInfo.shadowMap, 'cc_shadowMap');
        pass.addTexture(cameraInfo.sceneDepthPacked, 'inputDepth');

        pass.addQueue(QueueHint.NONE)
            .addScene(camera, SceneFlags.OPAQUE | SceneFlags.MASK, mainLight, cameraInfo.scene);
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

    private _tryAddReflectionProbePasses(
        ppl: rendering.BasicPipeline,
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
                this._buildReflectionProbePass(probePass, cameraInfo, probe.camera, colorName, depthStencilName, mainLight, scene);

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
                    this._buildReflectionProbePass(probePass, cameraInfo, probe.camera, colorName, depthStencilName, mainLight, scene);
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
        cameraInfo: CameraInfo,
        camera: renderer.scene.Camera,
        colorName: string,
        depthStencilName: string,
        mainLight: renderer.scene.DirectionalLight | undefined,
        scene: renderer.RenderScene | undefined,
    ): void {
        if (cameraInfo.needClearColor) {
            cameraInfo.fillClearColor(this._reflectionProbeClearColor, true);
            const clearColor = rendering.packRGBE(this._reflectionProbeClearColor);
            this._clearColor.set(clearColor.x, clearColor.y, clearColor.z, clearColor.w);
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

        if (cameraInfo.mainLightShadowMapEnabled)
            pass.addTexture(cameraInfo.shadowMap, 'cc_shadowMap');

        pass.addQueue(QueueHint.NONE, 'reflect-map')
            .addScene(camera, SceneFlags.OPAQUE | SceneFlags.MASK | SceneFlags.REFLECTION_PROBE, mainLight, scene);
    }
}
