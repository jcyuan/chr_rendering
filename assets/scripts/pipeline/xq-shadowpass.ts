import { geometry, gfx, renderer, rendering, Vec3, Vec4 } from "cc";
import { PipelineBuilderBase } from "./builder-base";
import { CameraInfo } from "./camera-info";
import { RenderingContext } from "./rendering-context";
import { XQPipeline } from "./xq-pipeline";
import { XQPipelineFeatures } from "./xq-pipeline-features";
import { clearColorUtils } from "./utils";

const { AABB, Sphere, intersect } = geometry;
const { LoadOp, StoreOp } = gfx;

export class ShadowPassBuilder extends PipelineBuilderBase {
    public static readonly RenderOrder = 200;

    private _viewport = new gfx.Viewport();
    private _platform = new Vec4(0, 0, 0, 0);
    
    private readonly _lights: renderer.scene.Light[] = [];
    private readonly _shadowEnabledSpotLights: renderer.scene.SpotLight[] = [];

    private readonly _sphere = Sphere.create(0, 0, 0, 1);
    private readonly _boundingBox = new AABB();
    private readonly _rangedDirLightBoundingBox = new AABB(0.0, 0.0, 0.0, 0.5, 0.5, 0.5);

    public getConfigOrder(): number {
        return 0;
    }

    public getRenderOrder(): number {
        return ShadowPassBuilder.RenderOrder;
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
        const shadowMapSize = builder.features.shadowMapSize;
        
        // main lights
        ppl.addRenderTarget(
            cameraInfo.shadowMap,
            cameraInfo.shadowMapFormat,
            shadowMapSize.x,
            shadowMapSize.y
        );
        ppl.addDepthStencil(
            cameraInfo.shadowDepth,
            gfx.Format.DEPTH_STENCIL,
            shadowMapSize.x,
            shadowMapSize.y
        );
        
        // spot lights
        const count = builder.features.mobileMaxSpotLightShadowMaps;
        for (let i = 0; i !== count; ++i) {
            ppl.addRenderTarget(
                `spotShadowMap${i}`,
                builder.features.shadowMapFormat,
                builder.features.shadowMapSize.x,
                builder.features.shadowMapSize.y,
            );
            ppl.addDepthStencil(
                `spotShadowDepth${i}`,
                gfx.Format.DEPTH_STENCIL,
                builder.features.shadowMapSize.x,
                builder.features.shadowMapSize.y,
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
        if (!cameraInfo.scene)
            return prevRenderPass;

        ppl.setVec4('g_platform', builder.features.fillPlatformVec4(this._platform));

        this._cullLights(cameraInfo.scene, camera.frustum);
        
        if (cameraInfo.mainLightShadowMapEnabled)
            this._addCascadedShadowMapPass(ppl, cameraInfo, cameraInfo.mainLight, camera);

        if (this._shadowEnabledSpotLights.length > 0)
            this._addSpotlightShadowPasses(ppl, builder.features, camera, builder.features.mobileMaxSpotLightShadowMaps);
        
        return prevRenderPass;
    }

    get lights(): renderer.scene.Light[] {
        return this._lights;
    }

    get shadowEnabledSpotLights(): renderer.scene.SpotLight[] {
        return this._shadowEnabledSpotLights;
    }

    private _addCascadedShadowMapPass(
        ppl: rendering.BasicPipeline,
        cameraInfo: CameraInfo,
        light: renderer.scene.DirectionalLight,
        camera: renderer.scene.Camera
    ): void {
        const shadowMapSize = this._pipeline.features.shadowMapSize;
        const width = shadowMapSize.x;
        const height = shadowMapSize.y;

        const viewport = this._viewport;
        viewport.left = viewport.top = 0;
        viewport.width = width;
        viewport.height = height;

        const pass = ppl.addRenderPass(width, height, 'default');
        pass.name = 'cascadedShadowMap';
        pass.addRenderTarget(cameraInfo.shadowMap, gfx.LoadOp.CLEAR, gfx.StoreOp.STORE, clearColorUtils.white);
        pass.addDepthStencil(cameraInfo.shadowDepth, gfx.LoadOp.CLEAR, gfx.StoreOp.DISCARD);

        const csmLevel = this._pipeline.features?.csmSupported ? light.csmLevel : 1;
        const screenSpaceSignY = this._pipeline.features?.screenSpaceSignY ?? 1;

        for (let level = 0; level !== csmLevel; ++level) {
            this._fillCsmMainLightViewport(light, width, height, level, this._viewport, screenSpaceSignY);
            const queue = pass.addQueue(rendering.QueueHint.NONE, 'shadow-caster');

            if (!this._pipeline.features?.isWebGPU)
                queue.setViewport(this._viewport);

            queue.addScene(camera, rendering.SceneFlags.OPAQUE | rendering.SceneFlags.MASK | rendering.SceneFlags.SHADOW_CASTER)
                .useLightFrustum(light, level);
        }
    }

    private _fillCsmMainLightViewport(
        light: renderer.scene.DirectionalLight,
        w: number,
        h: number,
        level: number,
        vp: gfx.Viewport,
        screenSpaceSignY: number
    ): void {
        if (light.shadowFixedArea || light.csmLevel === renderer.scene.CSMLevel.LEVEL_1) {
            vp.left = 0;
            vp.top = 0;
            vp.width = Math.trunc(w);
            vp.height = Math.trunc(h);
        } else {
            vp.left = Math.trunc(level % 2 * 0.5 * w);
            if (screenSpaceSignY > 0) {
                vp.top = Math.trunc((1 - Math.floor(level / 2)) * 0.5 * h);
            } else {
                vp.top = Math.trunc(Math.floor(level / 2) * 0.5 * h);
            }
            vp.width = Math.trunc(0.5 * w);
            vp.height = Math.trunc(0.5 * h);
        }
        vp.left = Math.max(0, vp.left);
        vp.top = Math.max(0, vp.top);
        vp.width = Math.max(1, vp.width);
        vp.height = Math.max(1, vp.height);
    }

    private _cullLights(scene: renderer.RenderScene, frustum: geometry.Frustum, cameraPos?: Vec3): void {
        this._lights.length = 0;
        this._shadowEnabledSpotLights.length = 0;

        // spot lights
        for (const light of scene.spotLights) {
            if (light.baked) {
                continue;
            }
            Sphere.set(this._sphere, light.position.x, light.position.y, light.position.z, light.range);
            if (intersect.sphereFrustum(this._sphere, frustum)) {
                if (light.shadowEnabled) {
                    this._shadowEnabledSpotLights.push(light);
                } else {
                    this._lights.push(light);
                }
            }
        }

        // sphere lights
        for (const light of scene.sphereLights) {
            if (light.baked) {
                continue;
            }
            Sphere.set(this._sphere, light.position.x, light.position.y, light.position.z, light.range);
            if (intersect.sphereFrustum(this._sphere, frustum)) {
                this._lights.push(light);
            }
        }

        // point lights
        for (const light of scene.pointLights) {
            if (light.baked) {
                continue;
            }
            Sphere.set(this._sphere, light.position.x, light.position.y, light.position.z, light.range);
            if (intersect.sphereFrustum(this._sphere, frustum)) {
                this._lights.push(light);
            }
        }

        // ranged dir lights
        for (const light of scene.rangedDirLights) {
            AABB.transform(this._boundingBox, this._rangedDirLightBoundingBox, light.node!.getWorldMatrix());
            if (intersect.aabbFrustum(this._boundingBox, frustum)) {
                this._lights.push(light);
            }
        }

        if (cameraPos) {
            this._shadowEnabledSpotLights.sort(
                (lhs, rhs) => Vec3.squaredDistance(cameraPos, lhs.position) - Vec3.squaredDistance(cameraPos, rhs.position),
            );
        }
    }

    private _addSpotlightShadowPasses(
        ppl: rendering.BasicPipeline,
        features: XQPipelineFeatures,
        camera: renderer.scene.Camera,
        maxNumShadowMaps: number,
    ): void {
        if (maxNumShadowMaps <= 0)
            return;

        let i = 0;
        for (const light of this._shadowEnabledSpotLights) {
            const shadowMapSize = features.shadowMapSize;
            const shadowPass = ppl.addRenderPass(shadowMapSize.x, shadowMapSize.y, 'default');
            shadowPass.name = `spotLightShadowPass${i}`;
            shadowPass.addRenderTarget(`spotShadowMap${i}`, LoadOp.CLEAR, StoreOp.STORE, clearColorUtils.white);
            shadowPass.addDepthStencil(`spotShadowDepth${i}`, LoadOp.CLEAR, StoreOp.DISCARD);
            shadowPass.addQueue(rendering.QueueHint.NONE, 'shadow-caster')
                .addScene(camera, rendering.SceneFlags.OPAQUE | rendering.SceneFlags.MASK | rendering.SceneFlags.SHADOW_CASTER)
                .useLightFrustum(light);
            ++i;
            if (i >= maxNumShadowMaps) {
                break;
            }
        }
    }
}
