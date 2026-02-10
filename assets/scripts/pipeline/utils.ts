import { director, Enum, gfx, NodeEventType, renderer, resources, sys, Texture2D, Vec4, } from "cc";
import { WindowInfo } from "./windowInfo";
import { IPipelineSettings } from "./xq-pipeline-types";

export const pipelineUtils = {
    _repeatSampler: undefined as gfx.Sampler | undefined,

    get pointRepeatSampler() {
        if (pipelineUtils._repeatSampler) return pipelineUtils._repeatSampler;

        pipelineUtils._repeatSampler = director.root.device.getSampler(
            new gfx.SamplerInfo(
                gfx.Filter.POINT,
                gfx.Filter.POINT,
                gfx.Filter.NONE,
                gfx.Address.WRAP,
                gfx.Address.WRAP,
                gfx.Address.WRAP,
            ),
        );

        return pipelineUtils._repeatSampler;
    },

    jitter: {
        _haltonTable: [
            [0.263385, -0.0252475],
            [-0.38545, 0.054485],
            [-0.139795, -0.5379925],
            [-0.2793775, 0.6875475],
            [0.7139025, 0.4710925],
            [0.90044, -0.16422],
            [0.4481775, -0.82799],
            [-0.9253375, -0.2910625],
            [0.3468025, 1.02292],
            [-1.13742, 0.33522],
            [-0.7676225, -0.9123175],
            [-0.2005775, -1.1774125],
            [-0.926525, 0.96876],
            [1.12909, -0.7500325],
            [0.9603, 1.14625],
        ] as ReadonlyArray<[number, number]>,
        /**
         * 0,1 = jitterXY
         * 2 = ping-pong flag
         * 3 = current sample index
         */
        _v4: new Vec4(0, 0, -1, 0),
        get value(): Readonly<Vec4> {
            return this._v4;
        },
        update() {
            const table = this._haltonTable;
            const nextIndex = ((this._v4.w | 0) + 1) % table.length;
            const sample = table[nextIndex];
            this._v4.x = sample[0];
            this._v4.y = sample[1];
            this._v4.z = -this._v4.z;
            this._v4.w = nextIndex;
        },
        reset() {
            this._v4.set(0, 0, -1, 0);
        },
    }
};

export enum SSSSType {
    Skin = 1,
    Jade = 2,
    Foliage = 3
}
export const SSSSTypeEnum = Enum(SSSSType);

export interface SSSSProfile {
    type: SSSSType;
    scatteringFactor: number[];
    falloff: number[];
}

export const sssUtils = {
    _profileTable: [{
        type: SSSSType.Skin,
        scatteringFactor: [0.722, 0.67, 0.56],
        falloff: [1.0, 0.64, 0.58]
    },
    {
        type: SSSSType.Jade,
        scatteringFactor: [0.96, 0.8, 0.56],
        falloff: [0.85, 0.89, 0.58]
    },
    {
        type: SSSSType.Foliage,
        scatteringFactor: [0.75, 1.0, 0.55],
        falloff: [0.85, 1.0, 0.25]
    },
    ] as ReadonlyArray<SSSSProfile>,
    getProfile(index: number): Readonly<SSSSProfile> {
        return this._profileTable[index];
    }
};

export const clearColorUtils = {
    white: new gfx.Color(1, 1, 1, 1) as Readonly<gfx.Color>,
    black: new gfx.Color(0, 0, 0, 0) as Readonly<gfx.Color>,
    transparent: new gfx.Color(0, 0, 0, 0) as Readonly<gfx.Color>,
};

export const cameraUtils = {
    _windowInfo: new Map<number, WindowInfo>(),

    getWindowInfo: (
        camera: renderer.scene.Camera,
        pipelineSettings: IPipelineSettings,
    ): WindowInfo => {
        let info = cameraUtils._windowInfo.get(camera.window.renderWindowId);
        if (info !== undefined) return info;

        const shadingScale = pipelineSettings.enableShadingScale
            ? pipelineSettings.shadingScale
            : 1;
        const nativeWidth = Math.max(Math.floor(camera.window.width), 1);
        const nativeHeight = Math.max(Math.floor(camera.window.height), 1);
        info = new WindowInfo();
        info.set(
            camera.window.renderWindowId,
            nativeWidth,
            nativeHeight,
            shadingScale,
        );
        cameraUtils._windowInfo.set(info.id, info);

        return info;
    },

    updateWindowInfo: (
        camera: renderer.scene.Camera,
        pipelineSettings: IPipelineSettings,
    ): WindowInfo => {
        let info = cameraUtils._windowInfo.get(camera.window.renderWindowId);
        if (!info) return cameraUtils.getWindowInfo(camera, pipelineSettings);

        const nativeWidth = Math.max(Math.floor(camera.window.width), 1);
        const nativeHeight = Math.max(Math.floor(camera.window.height), 1);
        if (
            info.nativeWidth !== nativeWidth ||
            info.nativeHeight !== nativeHeight
        ) {
            const scale = pipelineSettings.enableShadingScale
                ? pipelineSettings.shadingScale
                : 1;
            info.set(info.id, nativeWidth, nativeHeight, scale);
        }

        return info;
    },
};

export const resUtils = {
    black1x1: null as Texture2D,

    async prepare(): Promise<void> {
        const black1x1 = await resUtils.createTextureFromBase64(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2NgAAIAAAUAAR4f7BQAAAAASUVORK5CYII=",
        );
        black1x1.setWrapMode(Texture2D.WrapMode.REPEAT, Texture2D.WrapMode.REPEAT);
        resUtils.black1x1 = black1x1;
    },

    async createTextureFromResource(path: string): Promise<Texture2D> {
        return new Promise((r, j) => {
            resources.load(path + "/texture", Texture2D, (err, texture) => {
                if (err) {
                    j(err);
                    return;
                }
                r(texture);
            });
        });
    },

    async createTextureFromBase64(urlOrBase64: string): Promise<Texture2D> {
        return new Promise((r, j) => {
            const img = new Image();
            img.src = urlOrBase64;
            img.onload = () => {
                img.onload = null;
                const t = new Texture2D();
                t.reset({
                    width: img.width,
                    height: img.height,
                });
                t.uploadData(img);
                r(t);
            };
            img.onerror = img.onabort = () => {
                img.onerror = img.onabort = null;
                j();
            };
        });
    },
};

export const envUtils = {
    get NodeEventTypePointerDown() {
        return sys.isMobile ? NodeEventType.TOUCH_START : NodeEventType.MOUSE_DOWN;
    },

    get NodeEventTypePointerUp() {
        return sys.isMobile ? NodeEventType.TOUCH_END : NodeEventType.MOUSE_UP;
    },

    get NodeEventTypePointerMove() {
        return sys.isMobile ? NodeEventType.TOUCH_MOVE : NodeEventType.MOUSE_MOVE;
    },
};
