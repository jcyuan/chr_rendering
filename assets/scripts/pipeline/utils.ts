import { director, gfx, NodeEventType, renderer, resources, sys, Texture2D } from "cc";
import { WindowInfo } from "./windowInfo";
import { PipelineSettings } from "./xq-pipeline-types";

export const pipelineUtils = {
    _repeatSampler: undefined as gfx.Sampler | undefined,
    
    get pointRepeatSampler() {
        if (pipelineUtils._repeatSampler)
            return pipelineUtils._repeatSampler;

        pipelineUtils._repeatSampler = director.root.device.getSampler(new gfx.SamplerInfo(
            gfx.Filter.POINT,
            gfx.Filter.POINT,
            gfx.Filter.NONE,
            gfx.Address.WRAP,
            gfx.Address.WRAP,
            gfx.Address.WRAP
        ));

        return pipelineUtils._repeatSampler;
    }
}

export const cameraUtils = {
    _windowInfo: new Map<number, WindowInfo>(),

    getWindowInfo: (camera: renderer.scene.Camera, pipelineSettings: PipelineSettings): WindowInfo => {
        let info = cameraUtils._windowInfo.get(camera.window.renderWindowId);
        if (info !== undefined)
            return info;
        
        const shadingScale = pipelineSettings.enableShadingScale ? pipelineSettings.shadingScale : 1;
        const nativeWidth = Math.max(Math.floor(camera.window.width), 1);
        const nativeHeight = Math.max(Math.floor(camera.window.height), 1);
        info = new WindowInfo();
        info.set(camera.window.renderWindowId, nativeWidth, nativeHeight, shadingScale);
        cameraUtils._windowInfo.set(info.id, info);

        return info;
     },

     updateWindowInfo: (camera: renderer.scene.Camera, pipelineSettings: PipelineSettings): WindowInfo => {
        let info = cameraUtils._windowInfo.get(camera.window.renderWindowId);
        if (!info)
            return cameraUtils.getWindowInfo(camera, pipelineSettings);
        
        const nativeWidth = Math.max(Math.floor(camera.window.width), 1);
        const nativeHeight = Math.max(Math.floor(camera.window.height), 1);
        if (info.nativeWidth !== nativeWidth
            || info.nativeHeight !== nativeHeight)
        {
            const scale = pipelineSettings.enableShadingScale ? pipelineSettings.shadingScale : 1;
            info.set(info.id, nativeWidth, nativeHeight, scale);
        }
        
        return info;
     }
}

export const resUtils = {
    black1x1: null as Texture2D,
    
    async prepare(): Promise<void> {
        const black1x1 = await resUtils.createTextureFromBase64("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2NgAAIAAAUAAR4f7BQAAAAASUVORK5CYII=");
        black1x1.setWrapMode(Texture2D.WrapMode.REPEAT, Texture2D.WrapMode.REPEAT);
        resUtils.black1x1 = black1x1;
    },

    async createTextureFromResource(path: string): Promise<Texture2D> {
        return new Promise((r, j) => {
            resources.load(path + '/texture', Texture2D, (err, texture) => {
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
                    height: img.height
                });
                t.uploadData(img);
                r(t);
            }
            img.onerror = img.onabort = () => {
                img.onerror = img.onabort = null;
                j();
            };
        });
    }
}

export const envUtils = {
    get NodeEventTypePointerDown() {
        return sys.isMobile ? NodeEventType.TOUCH_START : NodeEventType.MOUSE_DOWN;
    },

    get NodeEventTypePointerUp() {
        return sys.isMobile ? NodeEventType.TOUCH_END : NodeEventType.MOUSE_UP;
    },

    get NodeEventTypePointerMove() {
        return sys.isMobile ? NodeEventType.TOUCH_MOVE : NodeEventType.MOUSE_MOVE;
    }
}
